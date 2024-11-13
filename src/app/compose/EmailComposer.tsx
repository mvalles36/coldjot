"use client";

import { useState, useEffect } from "react";
// import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Send, Save, Grip, Eye, Loader2 } from "lucide-react";
import { Contact, TemplateWithSections } from "@/types";
import { toast } from "react-hot-toast";
import PreviewEmail from "./PreviewEmail";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Section = {
  id: string;
  name: string;
  content: string;
};

type Variable = {
  name: string;
  label: string;
  value: string;
};

export default function EmailComposer({
  contacts,
  templates,
}: {
  contacts: Contact[];
  templates: TemplateWithSections[];
}) {
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [baseContent, setBaseContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setBaseContent(template.content);
        setSections(
          template.sections.map((section) => ({
            id: section.id,
            name: section.name,
            content: section.content,
          }))
        );
        if (template.variables) {
          setVariables(
            template.variables.map((v) => ({
              name: v.name,
              label: v.label,
              value: "",
            }))
          );
        } else {
          setVariables([]);
        }
      }
    } else {
      setBaseContent("");
      setSections([]);
      setVariables([]);
    }
  }, [selectedTemplate, templates]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
  };

  const replaceVariables = (content: string) => {
    let replacedContent = content;
    variables.forEach((variable) => {
      const regex = new RegExp(`{{${variable.name}}}`, "g");
      replacedContent = replacedContent.replace(regex, variable.value);
    });
    return replacedContent;
  };

  const getProcessedContent = () => {
    const processedBase = replaceVariables(baseContent);
    const processedSections = sections.map((section) => ({
      ...section,
      content: replaceVariables(section.content),
    }));
    return {
      base: processedBase,
      sections: processedSections,
    };
  };

  const handleSaveAsDraft = async () => {
    try {
      if (!selectedContact || !selectedTemplate) return;
      setIsSaving(true);

      const processed = getProcessedContent();
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact,
          templateId: selectedTemplate,
          content: processed.base,
          sections: processed.sections,
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

      // First save as draft
      const draftResponse = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact,
          templateId: selectedTemplate,
          content: baseContent,
          sections: sections,
        }),
      });

      if (!draftResponse.ok) throw new Error("Failed to save draft");
      const draft = await draftResponse.json();

      // Then send the draft
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Select Contact</label>
          <Select value={selectedContact} onValueChange={setSelectedContact}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a contact" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div>
          <label className="text-sm font-medium">Base Content</label>
          <Textarea
            value={baseContent}
            onChange={(e) => setBaseContent(e.target.value)}
            rows={6}
            className="font-mono"
          />
        </div>

        <Separator />

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {sections.map((section, index) => (
                  <Draggable
                    key={section.id}
                    draggableId={section.id}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center gap-2"
                          >
                            <Grip className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{section.name}</span>
                          </div>
                        </div>
                        <Textarea
                          value={section.content}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[index] = {
                              ...section,
                              content: e.target.value,
                            };
                            setSections(newSections);
                          }}
                          rows={4}
                          className="font-mono"
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {variables.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Template Variables</h3>
          <div className="grid grid-cols-2 gap-4">
            {variables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <Label htmlFor={variable.name}>{variable.label}</Label>
                <Input
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
        <PreviewEmail
          content={`${replaceVariables(baseContent)}\n\n${sections
            .map((section) => replaceVariables(section.content))
            .join("\n\n")}`}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
