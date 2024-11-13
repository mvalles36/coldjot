"use client";

import { useState } from "react";
import { Contact, Template } from "@prisma/client";
import { TemplateWithSections } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, Save, Send, X } from "lucide-react";
import { toast } from "react-hot-toast";

interface EmailComposerProps {
  contacts: Contact[];
  templates: TemplateWithSections[];
}

interface Section {
  id: string;
  name: string;
  content: string;
}

export default function EmailComposer({
  contacts,
  templates,
}: EmailComposerProps) {
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [content, setContent] = useState("");
  const [sections, setSections] = useState<Section[]>([]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setContent(template.content);
      setSections(
        template.sections.map((s) => ({
          id: s.id,
          name: s.name,
          content: s.content,
        }))
      );
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSaveAsDraft = async () => {
    if (!selectedContact || !selectedTemplate) {
      toast.error("Please select a contact and template");
      return;
    }

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: selectedContact,
          templateId: selectedTemplate,
          content,
          sections,
        }),
      });

      if (!response.ok) throw new Error("Failed to save draft");

      toast.success("Draft saved successfully");
    } catch (error) {
      toast.error("Failed to save draft");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact</Label>
          <Select value={selectedContact} onValueChange={setSelectedContact}>
            <SelectTrigger>
              <SelectValue placeholder="Select a contact" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name} ({contact.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Template</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
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
        <Label>Content</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="font-mono whitespace-pre-wrap"
        />
      </div>

      <div className="space-y-4">
        <Label>Sections</Label>
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
                        className="border rounded-lg p-4 bg-background"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center gap-2"
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{section.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSection(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
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
                          className="font-mono whitespace-pre-wrap"
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

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={!selectedContact || !selectedTemplate}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          onClick={() => {}}
          disabled={!selectedContact || !selectedTemplate}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Email
        </Button>
      </div>
    </div>
  );
}
