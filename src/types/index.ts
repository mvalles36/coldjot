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

  createdAt: Date;
  updatedAt: Date;
}

export type TemplateWithSections = Template;
