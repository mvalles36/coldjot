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

  /* ---------------- Call-related metrics ---------------- */
  /** Total outbound calls placed during the period. */
  totalCallsPlaced: number;
  /** Number of calls that successfully connected (answered by a human). */
  callsConnected: number;
  /** Percentage of connected calls out of total placed. */
  callConnectRate: number;
  /** Number of voicemails the system left. */
  voicemailsLeft: number;
  /** Percentage of calls that resulted in leaving a voicemail. */
  voicemailRate: number;
  /** Number of appointments booked as a direct result of calls. */
  appointmentsSet: number;
  /** Percentage of connected calls that set appointments. */
  appointmentsSetRate: number;
}

export interface ChartData {
  date: string;
  sent: number;
  opened: number;
  replied: number;
  uniqueOpens: number;
}
