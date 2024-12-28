import { prisma } from "@mailjot/database";
import { AlertConfig } from "@mailjot/types";
import { logger } from "@/lib/log";
import nodemailer from "nodemailer";

export class AlertService {
  private defaultAlertConfig: AlertConfig = {
    errorThreshold: 0.1, // 10%
    warningThreshold: 0.05, // 5%
    criticalThreshold: 0.2, // 20%
    checkInterval: 5 * 60 * 1000, // 5 minutes
    retryInterval: 60 * 1000, // 1 minute
    maxRetries: 3,
    channels: {
      email: [process.env.ALERT_EMAIL_TO || ""],
      slack: process.env.SLACK_WEBHOOK_URL
        ? [process.env.SLACK_WEBHOOK_URL]
        : undefined,
    },
  };

  private emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async processAlert(
    type: string,
    message: string,
    severity: "info" | "warning" | "error",
    metadata: Record<string, any> = {}
  ) {
    try {
      // Create alert record
      const alert = await prisma.queueAlert.create({
        data: {
          type,
          queueName: metadata.queueName || "system",
          value: message,
          threshold: metadata.threshold?.toString() || "N/A",
          timestamp: new Date(),
        },
      });

      // Log the alert
      logger.info(`Alert [${severity}] ${type}: ${message}`);

      // Process alert based on severity and channels
      await this.deliverAlert(alert, severity, metadata);

      return alert;
    } catch (error) {
      logger.error("Error processing alert:", error);
      throw error;
    }
  }

  private async deliverAlert(
    alert: any,
    severity: "info" | "warning" | "error",
    metadata: Record<string, any>
  ) {
    const config = this.defaultAlertConfig;

    // Email notifications
    if (config.channels.email?.length) {
      await this.sendEmailAlert(alert, severity, metadata);
    }

    // Slack notifications
    if (config.channels.slack?.length) {
      await this.sendSlackAlert(alert, severity, metadata);
    }

    // Dashboard notifications are handled by the web app
    // through the database records
  }

  private async sendEmailAlert(
    alert: any,
    severity: "info" | "warning" | "error",
    metadata: Record<string, any>
  ) {
    try {
      if (!process.env.ALERT_EMAIL_TO) {
        logger.warn("No alert email recipient configured");
        return;
      }

      const subject = `[${severity.toUpperCase()}] Queue Alert: ${alert.type}`;
      const html = `
        <h2>Queue Alert</h2>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Severity:</strong> ${severity}</p>
        <p><strong>Message:</strong> ${alert.value}</p>
        <p><strong>Queue:</strong> ${alert.queueName}</p>
        <p><strong>Threshold:</strong> ${alert.threshold}</p>
        <p><strong>Time:</strong> ${alert.timestamp}</p>
        ${
          metadata.details
            ? `<h3>Additional Details</h3><pre>${JSON.stringify(
                metadata.details,
                null,
                2
              )}</pre>`
            : ""
        }
      `;

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.ALERT_EMAIL_TO,
        subject,
        html,
      });
    } catch (error) {
      logger.error("Error sending email alert:", error);
    }
  }

  private async sendSlackAlert(
    alert: any,
    severity: "info" | "warning" | "error",
    metadata: Record<string, any>
  ) {
    try {
      if (!process.env.SLACK_WEBHOOK_URL) {
        logger.warn("No Slack webhook URL configured");
        return;
      }

      const color =
        severity === "error"
          ? "#ff0000"
          : severity === "warning"
            ? "#ffa500"
            : "#00ff00";

      const message = {
        attachments: [
          {
            color,
            title: `Queue Alert: ${alert.type}`,
            text: alert.value,
            fields: [
              {
                title: "Severity",
                value: severity,
                short: true,
              },
              {
                title: "Queue",
                value: alert.queueName,
                short: true,
              },
              {
                title: "Threshold",
                value: alert.threshold,
                short: true,
              },
              {
                title: "Time",
                value: new Date(alert.timestamp).toISOString(),
                short: true,
              },
            ],
            ...(metadata.details && {
              fields: [
                {
                  title: "Details",
                  value:
                    "```" + JSON.stringify(metadata.details, null, 2) + "```",
                },
              ],
            }),
          },
        ],
      };

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (error) {
      logger.error("Error sending Slack alert:", error);
    }
  }
}

// Export singleton instance
export const alertService = new AlertService();
