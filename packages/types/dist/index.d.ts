import { gmail_v1 } from 'googleapis';

type EmailEventType = "sent" | "opened" | "clicked" | "replied" | "bounced" | "spam" | "unsubscribed" | "interested";

type SearchResultType = "contact" | "company" | "action";
interface SearchResult {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: string;
    icon?: string;
    url?: string;
}
interface SearchState {
    query: string;
    results: SearchResult[];
    isLoading: boolean;
    selectedCategory?: SearchResultType;
}

declare enum StepType {
    MANUAL_EMAIL = "manual_email",
    AUTOMATED_EMAIL = "automated_email",
    WAIT = "wait",
    CONDITION = "condition",
    ACTION = "action"
}
declare enum TimingType {
    IMMEDIATE = "immediate",
    DELAY = "delay",
    SCHEDULED = "scheduled"
}
declare enum StepPriority {
    HIGH = "high",
    NORMAL = "normal",
    LOW = "low"
}
declare enum StepStatus {
    NOT_SENT = "not_sent",
    DRAFT = "draft",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    ERROR = "error"
}
declare enum SequenceStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    ERROR = "error"
}
interface SequenceStep {
    id: string;
    sequenceId: string;
    stepType: StepType;
    status: StepStatus;
    priority: StepPriority;
    timing: TimingType;
    delayAmount?: number | null;
    delayUnit?: string | null;
    subject?: string | null;
    content?: string | null;
    includeSignature: boolean;
    note?: string | null;
    order: number;
    previousStepId?: string | null;
    replyToThread: boolean;
    threadId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    templateId?: string | null;
}
interface Sequence {
    id: string;
    userId: string;
    name: string;
    description?: string | null;
    status: SequenceStatus;
    accessLevel: "team" | "private";
    scheduleType: "business" | "custom";
    businessHours?: BusinessHours;
    steps: SequenceStep[];
    contacts: SequenceContact[];
    _count: {
        contacts: number;
    };
    testMode: boolean;
    createdAt: Date;
    updatedAt: Date;
    emailListId?: string | null;
}
interface SequenceContact {
    id: string;
    sequenceId: string;
    contactId: string;
    status: StepStatus;
    currentStep: number;
    startedAt: Date;
    updatedAt: Date;
    lastProcessedAt?: Date | null;
    completedAt?: Date | null;
    threadId?: string | null;
    contact: {
        id: string;
        name: string;
        email: string;
        company?: {
            name: string;
        } | null;
    };
}
interface BusinessHours {
    timezone: string;
    workDays: number[];
    workHours: {
        start: string;
        end: string;
    };
    holidays: Date[];
}
interface SequenceStats {
    id: string;
    sequenceId: string;
    contactId?: string | null;
    totalEmails: number;
    sentEmails: number;
    openedEmails: number;
    uniqueOpens: number;
    clickedEmails: number;
    repliedEmails: number;
    bouncedEmails: number;
    failedEmails: number;
    avgOpenTime?: number | null;
    avgClickTime?: number | null;
    avgReplyTime?: number | null;
    avgResponseTime?: number | null;
    createdAt: Date;
    updatedAt: Date;
}
interface ProcessingWindow {
    start: Date;
    end: Date;
    timezone: string;
    maxJobsPerWindow: number;
    currentLoad: number;
}
interface RateLimits {
    perMinute: number;
    perHour: number;
    perDay: number;
    perContact: number;
    perSequence: number;
    cooldown: {
        afterBounce: number;
        afterError: number;
    };
}

type MessagePartHeader = gmail_v1.Schema$MessagePartHeader;
type Gmail = gmail_v1.Gmail;
type Message = gmail_v1.Schema$Message;
interface SendEmailOptions {
    to: string;
    subject: string;
    content: string;
    threadId?: string;
    accessToken?: string;
    originalContent?: string;
}
interface CreateDraftOptions {
    to: string;
    subject: string;
    content: string;
    accessToken: string;
}
interface SendDraftOptions {
    draftId: string;
    accessToken: string;
}
interface EmailResponse {
    messageId: string;
    threadId?: string;
}
interface ThreadHeaders {
    messageId: string;
    inReplyTo?: string;
    references?: string[];
}
interface EmailResult {
    messageId: string;
    threadId?: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    image?: string;
}
interface Contact {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}
interface Template {
    id: string;
    userId: string;
    name: string;
    subject: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}
type TemplateWithSections = Template;
interface EmailList {
    id: string;
    name: string;
    userId: string;
    description?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
    contacts: Contact[];
}

export { type BusinessHours, type Contact, type CreateDraftOptions, type EmailEventType, type EmailList, type EmailResponse, type EmailResult, type Gmail, type Message, type MessagePartHeader, type ProcessingWindow, type RateLimits, type SearchResult, type SearchResultType, type SearchState, type SendDraftOptions, type SendEmailOptions, type Sequence, type SequenceContact, type SequenceStats, SequenceStatus, type SequenceStep, StepPriority, StepStatus, StepType, type Template, type TemplateWithSections, type ThreadHeaders, TimingType, type User };
