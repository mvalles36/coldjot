// Define EmailEventType based on the schema enum
export type EmailEventType =
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "spam"
  | "unsubscribed"
  | "interested";
