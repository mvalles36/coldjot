import { prisma } from "@coldjot/database";

export async function getDevSettings(userId: string) {
  return await prisma.devSettings.findUnique({
    where: { userId },
    select: {
      disableSending: true,
      testEmails: true,
    },
  });
}
