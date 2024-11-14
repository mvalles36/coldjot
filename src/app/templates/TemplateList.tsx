"use client";

import { useState } from "react";
import { Template } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit2, Trash2 } from "lucide-react";
import AddTemplateButton from "./AddTemplateButton";
import EditTemplateModal from "./EditTemplateModal";
import PreviewTemplateModal from "./PreviewTemplateModal";
import DeleteTemplateDialog from "./DeleteTemplateDialog";

interface Props {
  initialTemplates: Template[];
}

export default function TemplateList({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(
    null
  );

  const handleAddTemplate = (template: Template) => {
    setTemplates((prev) => [template, ...prev]);
  };

  const handleUpdateTemplate = (updatedTemplate: Template) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setDeletingTemplate(null);
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
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.name}</TableCell>
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
          onSave={handleUpdateTemplate}
        />
      )}

      {previewTemplate && (
        <PreviewTemplateModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateDialog
          template={deletingTemplate}
          onClose={() => setDeletingTemplate(null)}
          onDelete={handleDeleteTemplate}
        />
      )}
    </div>
  );
}
