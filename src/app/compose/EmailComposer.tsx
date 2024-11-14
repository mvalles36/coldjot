"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Send, Save, Eye, Loader2 } from "lucide-react";
import { Contact, Company, Template } from "@prisma/client";
import { toast } from "react-hot-toast";
import { PreviewPane } from "@/components/email/PreviewPane";
import { Label } from "@/components/ui/label";
import { ContactSearch } from "./ContactSearch";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Input } from "@/components/ui/input";

type ContactWithCompany = Contact & {
  company: Company | null;
};

type TemplateWithDetails = Template;

interface Props {
  templates: TemplateWithDetails[];
}

export default function EmailComposer({ templates }: Props) {
  const [selectedContact, setSelectedContact] =
    useState<ContactWithCompany | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [fallbacks, setFallbacks] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");

  useEffect(() => {
    try {
      const savedContactStr = localStorage.getItem("selectedContact");
      if (savedContactStr) {
        const contact = JSON.parse(savedContactStr);
        setSelectedContact(contact);
        localStorage.removeItem("selectedContact");
      }
    } catch (error) {
      console.error("Error loading saved contact:", error);
    }
  }, []);

  useEffect(() => {
    if (selectedTemplate && templates) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setContent(template.content || "");
      }
    } else {
      setContent("");
    }
  }, [selectedTemplate, templates]);

  const handleSaveAsDraft = async () => {
    try {
      if (!selectedContact || !selectedTemplate) return;
      setIsSaving(true);

      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          templateId: selectedTemplate,
          content: content,
          subject: "",
          fallbacks: fallbacks,
          customValues: {},
        }),
      });

      if (!response.ok) throw new Error("Failed to save draft");
      toast.success("Draft saved successfully");
    } catch (error) {
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      if (!selectedContact || !selectedTemplate) return;
      setIsSending(true);

      const draftResponse = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          templateId: selectedTemplate,
          content: content,
          subject: "",
          fallbacks: fallbacks,
          customValues: {},
        }),
      });

      if (!draftResponse.ok) throw new Error("Failed to save draft");
      const draft = await draftResponse.json();

      const sendResponse = await fetch("/api/drafts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          fallbacks: fallbacks,
          customValues: {},
        }),
      });

      if (!sendResponse.ok) throw new Error("Failed to send email");
      toast.success("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Contact</label>
          <ContactSearch
            selectedContact={selectedContact}
            onSelect={setSelectedContact}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Select Template</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Content</Label>
        </div>
        <RichTextEditor
          initialContent={content}
          onChange={setContent}
          placeholder="Write your email content here..."
          onLinkDialogChange={setIsLinkDialogOpen}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setShowPreview(true)}
          disabled={!selectedContact || !selectedTemplate || isLinkDialogOpen}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={
            !selectedContact ||
            !selectedTemplate ||
            isSaving ||
            isLinkDialogOpen
          }
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSaving ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          onClick={handleSendEmail}
          disabled={
            !selectedContact ||
            !selectedTemplate ||
            isSending ||
            isLinkDialogOpen
          }
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {isSending ? "Sending..." : "Send Email"}
        </Button>
      </div>

      {showPreview && (
        <PreviewPane
          content={content}
          contact={selectedContact}
          fallbacks={fallbacks}
          customValues={{}}
        />
      )}
    </div>
  );
}
