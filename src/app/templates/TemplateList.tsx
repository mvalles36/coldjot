"use client";

import { useState } from "react";
import { TemplateWithSections } from "@/types";
import EditTemplateModal from "./EditTemplateModal";
import PreviewTemplateModal from "./PreviewTemplateModal";
import AddTemplateButton from "./AddTemplateButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Eye, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TemplateList({
  initialTemplates,
}: {
  initialTemplates: TemplateWithSections[];
}) {
  const [templates, setTemplates] =
    useState<TemplateWithSections[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] =
    useState<TemplateWithSections | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<TemplateWithSections | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<TemplateWithSections | null>(null);

  const handleAddTemplate = (newTemplate: TemplateWithSections) => {
    setTemplates((prev) => [newTemplate, ...prev]);
  };

  const handleDelete = async (template: TemplateWithSections) => {
    const response = await fetch(`/api/templates/${template.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setTemplates(templates.filter((t) => t.id !== template.id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddTemplateButton onAddTemplate={handleAddTemplate} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Sections</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.name}</TableCell>
              <TableCell>{template.sections.length} sections</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingTemplate(template)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(updatedTemplate) => {
            setTemplates(
              templates.map((t) =>
                t.id === updatedTemplate.id ? updatedTemplate : t
              )
            );
            setEditingTemplate(null);
          }}
        />
      )}

      {previewTemplate && (
        <PreviewTemplateModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={() => setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              template and all its sections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingTemplate) {
                  handleDelete(deletingTemplate);
                  setDeletingTemplate(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
