"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { Template } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { PlaceholderButton } from "@/components/email/PlaceholderButton";

interface Props {
  template: Template;
  onClose: () => void;
  onSave: (template: Template) => void;
}

type FormData = {
  name: string;
  content: string;
};

export default function EditTemplateModal({
  template,
  onClose,
  onSave,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { register, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      name: template.name,
      content: template.content,
    },
  });

  const content = watch("content");

  const insertPlaceholder = (placeholder: string) => {
    if (!contentRef.current) return;

    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + placeholder + after;
    setValue("content", newText);

    // Set cursor position after the placeholder
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + placeholder.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update template");

      const updatedTemplate = await response.json();
      onSave(updatedTemplate);
      toast.success("Template updated successfully");
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] h-[100dvh] p-0">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col h-full"
        >
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Edit Template</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Template name is required",
                  })}
                  placeholder="Enter template name"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Content</Label>
                  <PlaceholderButton onSelectPlaceholder={insertPlaceholder} />
                </div>
                <Textarea
                  {...register("content", { required: "Content is required" })}
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setValue("content", e.target.value)}
                  rows={12}
                  className="font-mono"
                  placeholder="Write your template content here..."
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t mt-auto">
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
