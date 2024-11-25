import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import type { SendEmailOptions } from "@/lib/email";
import { DEMO_CONTACTS, getRandomDemoRecipient } from "@/config/demo";

export async function processSequences() {
  console.log("🔄 Starting sequence processing...");

  // Get all active sequences with contacts
  const sequences = await prisma.sequence.findMany({
    where: {
      status: "active",
    },
    include: {
      contacts: {
        where: {
          status: {
            in: ["not_sent", "in_progress"],
          },
        },
        include: {
          contact: true,
        },
      },
      steps: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  console.log(`📋 Found ${sequences.length} active sequences to process`);

  for (const sequence of sequences) {
    console.log(
      `\n🔍 Processing sequence: ${sequence.name} (ID: ${sequence.id})`
    );
    console.log(`📝 Mode: ${sequence.demoMode ? "Test" : "Live"}`);

    for (const sequenceContact of sequence.contacts) {
      const currentStep = sequence.steps[sequenceContact.currentStep];

      if (!currentStep) {
        console.log(
          `✅ All steps completed for contact: ${sequenceContact.contact.email}`
        );
        await prisma.sequenceContact.update({
          where: { id: sequenceContact.id },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });
        continue;
      }

      const previousStep =
        sequenceContact.currentStep > 0
          ? sequence.steps[sequenceContact.currentStep - 1]
          : null;

      try {
        console.log(
          `\n📧 Processing email for contact: ${sequenceContact.contact.email}`
        );
        console.log(
          `📍 Step ${sequenceContact.currentStep + 1} of ${
            sequence.steps.length
          }`
        );

        // Prepare email content with test mode indicator if needed
        const emailContent = sequence.demoMode
          ? `[TEST MODE] Email intended for: ${sequenceContact.contact.email}\n\n${currentStep.content}`
          : currentStep.content;

        // In test mode, replace recipient with demo email
        const recipientEmail = sequence.demoMode
          ? getRandomDemoRecipient()
          : sequenceContact.contact.email;

        if (sequence.demoMode) {
          console.log(`🎯 Test mode: Redirecting email to ${recipientEmail}`);
        }

        const emailOptions: SendEmailOptions = {
          to: recipientEmail,
          subject: sequence.demoMode
            ? `[TEST] ${currentStep.subject}`
            : currentStep.subject || "",
          content: emailContent || "",
          threadId: previousStep?.id,
        };

        // Only send if not in test mode or if contact is a demo contact
        const shouldSend =
          !sequence.demoMode ||
          DEMO_CONTACTS.some(
            (dc) => dc.email === sequenceContact.contact.email
          );

        if (shouldSend) {
          console.log(`📤 Sending email...`);
          await sendEmail(emailOptions);
          console.log(`✅ Email sent successfully`);
        } else {
          console.log(`⏭️ Skipping email send (test mode)`);
        }

        // Update sequence contact status
        await prisma.sequenceContact.update({
          where: {
            id: sequenceContact.id,
          },
          data: {
            currentStep: sequenceContact.currentStep + 1,
            status:
              sequenceContact.currentStep + 1 >= sequence.steps.length
                ? "completed"
                : "in_progress",
            lastProcessedAt: new Date(),
            ...(sequenceContact.currentStep + 1 >= sequence.steps.length
              ? { completedAt: new Date() }
              : {}),
          },
        });

        console.log(`✅ Contact status updated`);
      } catch (error) {
        console.error(
          `❌ Error processing sequence contact ${sequenceContact.id}:`,
          error
        );

        await prisma.sequenceContact.update({
          where: {
            id: sequenceContact.id,
          },
          data: {
            status: "failed",
          },
        });
      }
    }
  }

  console.log("\n✨ Sequence processing completed");
}
