"use client";

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Save, Eye, Loader2 } from "lucide-react";
import { Contact, Company, Template } from "@prisma/client";
import { toast } from "react-hot-toast";
import { PreviewPane } from "@/components/email/PreviewPane";
import { Label } from "@/components/ui/label";
import { ContactSearch } from "./ContactSearch";
import { PlaceholderButton } from "@/components/email/PlaceholderButton";

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
  const [variables, setVariables] = useState<
    { name: string; label: string; value: string }[]
  >([]);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [fallbacks, setFallbacks] = useState<Record<string, string>>({});

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
      setVariables([]);
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
        }),
      });

      if (!draftResponse.ok) throw new Error("Failed to save draft");
      const draft = await draftResponse.json();

      const sendResponse = await fetch("/api/drafts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
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

  const insertPlaceholder = (placeholder: string) => {
    if (!contentRef.current) return;

    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + placeholder + after;
    setContent(newText);

    // Set cursor position after the placeholder
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + placeholder.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Content</Label>
          <PlaceholderButton onSelectPlaceholder={insertPlaceholder} />
        </div>
        <Textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="font-mono"
        />
      </div>

      {variables.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Template Variables</h3>
          <div className="grid grid-cols-2 gap-4">
            {variables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <Label htmlFor={variable.name}>{variable.label}</Label>
                <input
                  id={variable.name}
                  value={variable.value}
                  onChange={(e) => {
                    const newVariables = variables.map((v) =>
                      v.name === variable.name
                        ? { ...v, value: e.target.value }
                        : v
                    );
                    setVariables(newVariables);
                  }}
                  className="w-full p-2 border rounded"
                  placeholder={`Enter ${variable.label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setShowPreview(true)}
          disabled={!selectedContact || !selectedTemplate}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={!selectedContact || !selectedTemplate || isSaving}
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
          disabled={!selectedContact || !selectedTemplate || isSending}
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
          customValues={variables.reduce(
            (acc: Record<string, string>, curr) => {
              acc[curr.name] = curr.value;
              return acc;
            },
            {}
          )}
        />
      )}
    </div>
  );
}
