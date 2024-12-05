export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface Contact {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  subject: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateWithSections = Template;

export interface EmailList {
  id: string;
  name: string;
  userId: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  contacts: Contact[];
}

export * from "./events";
export * from "./search";
export * from "./sequences";
export * from "./email";
