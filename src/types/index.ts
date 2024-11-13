export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  content: string;
  sections: TemplateSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateSection {
  id: string;
  name: string;
  content: string;
  order: number;
}

export interface Draft {
  id: string;
  userId: string;
  contactId: string;
  templateId: string;
  content: string;
  gmailDraftId?: string;
  createdAt: Date;
  updatedAt: Date;
}
// import { Template } from "@prisma/client";

export interface TemplateVariable {
  id: string;
  name: string;
  label: string;
}

export interface TemplateWithSections extends Template {
  sections: {
    id: string;
    name: string;
    content: string;
    order: number;
  }[];
  variables: TemplateVariable[];
}
