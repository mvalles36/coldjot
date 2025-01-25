export interface StatsData {
  totalEmails: number;
  sentEmails: number;
  openedEmails: number;
  uniqueOpens: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
  unsubscribed: number;
  interested: number;
  peopleContacted: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
}

export interface ChartData {
  date: string;
  sent: number;
  opened: number;
  replied: number;
  uniqueOpens: number;
}
