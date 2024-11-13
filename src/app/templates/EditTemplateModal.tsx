"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash } from "lucide-react";
import { TemplateWithSections } from "@/types";

type FormData = {
  name: string;
  content: string;
  sections: {
    name: string;
    content: string;
  }[];
};

const defaultSection = {
  name: "",
  content: "",
};

export default function EditTemplateModal({
  template,
  onClose,
  onSave,
}: {
  template: TemplateWithSections;
  onClose: () => void;
  onSave: (template: TemplateWithSections) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      name: template.name,
      content: template.content,
      sections: template.sections.map((section) => ({
        name: section.name,
        content: section.content,
      })),
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sections = watch("sections");

  const addSection = () => {
    const currentSections = watch("sections");
    setValue("sections", [...currentSections, defaultSection]);
  };

  const removeSection = (index: number) => {
    const currentSections = watch("sections");
    setValue(
      "sections",
      currentSections.filter((_, i) => i !== index)
    );
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update template");

      const updatedTemplate = await response.json();
      toast.success("Template updated successfully");
      onSave(updatedTemplate);
    } catch (error) {
      toast.error("Failed to update template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open onOpenChange={onClose} modal={false}>
      <SheetContent
        side="right"
        className="w-[600px] sm:max-w-[600px] h-full p-0"
      >
        <div className="h-full flex flex-col">
          <SheetHeader className="p-6">
            <SheetTitle>Edit Template</SheetTitle>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Base Content</Label>
                <Textarea
                  id="content"
                  rows={8}
                  className="font-mono whitespace-pre-wrap"
                  {...register("content", { required: "Content is required" })}
                  placeholder="Enter the main template content..."
                />
                {errors.content && (
                  <p className="text-sm text-destructive">
                    {errors.content.message}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Template Sections</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Section
                  </Button>
                </div>

                {sections.map((_, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`sections.${index}.name`}>
                          Section Name
                        </Label>
                        <Input
                          id={`sections.${index}.name`}
                          {...register(`sections.${index}.name` as const, {
                            required: "Section name is required",
                          })}
                        />
                        {errors.sections?.[index]?.name && (
                          <p className="text-sm text-destructive">
                            {errors.sections[index]?.name?.message}
                          </p>
                        )}
                      </div>
                      {sections.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-2"
                          onClick={() => removeSection(index)}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`sections.${index}.content`}>
                        Section Content
                      </Label>
                      <Textarea
                        id={`sections.${index}.content`}
                        rows={6}
                        className="font-mono whitespace-pre-wrap"
                        {...register(`sections.${index}.content` as const, {
                          required: "Section content is required",
                        })}
                      />
                      {errors.sections?.[index]?.content && (
                        <p className="text-sm text-destructive">
                          {errors.sections[index]?.content?.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
