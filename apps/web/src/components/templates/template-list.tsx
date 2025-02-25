"use client";

import { useState, useEffect } from "react";
import { Template } from "@prisma/client";
import { useRouter } from "next/navigation";
import EditTemplateDrawer from "./edit-template-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Edit2,
  Trash2,
  FileText,
  Plus,
  Eye,
  ScrollText,
  MoreVertical,
  Copy,
} from "lucide-react";
import PreviewTemplateDrawer from "./preview-template-drawer";
import DeleteTemplateDialog from "./delete-template-dialog";
import { toast } from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginationControls } from "@/components/pagination";

interface TemplateListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
  initialTemplates: Template[];
  onAddTemplate?: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface TemplateResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextPage: number | undefined;
}

export default function TemplateList({
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
  initialTemplates,
  onAddTemplate,
  page,
  limit,
  onPageChange,
  onPageSizeChange,
}: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(
    null
  );
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!isInitialLoad && searchQuery.length === 1) {
        return;
      }

      setIsLoading(true);
      onSearchStart?.();
      try {
        const queryParams = new URLSearchParams();
        queryParams.set("page", page.toString());
        queryParams.set("limit", limit.toString());
        if (searchQuery.length >= 2) {
          queryParams.set("q", searchQuery);
        }

        const url = `/api/templates?${queryParams.toString()}`;
        const response = await fetch(url);
        const data: TemplateResponse = await response.json();
        setTemplates(data.templates);
        setTotal(data.total);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
        onSearchEnd?.();
      }
    };

    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      fetchTemplates();
    }
  }, [searchQuery, onSearchStart, onSearchEnd, isInitialLoad, page, limit]);

  const showLoading = isLoading || isInitialLoad;
  const showEmptyState = !showLoading && templates.length === 0;

  const handleDuplicate = async (template: Template) => {
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          subject: template.subject,
          content: template.content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to duplicate template");
      }

      const duplicatedTemplate = await response.json();
      setTemplates((prev) => [duplicatedTemplate, ...prev]);
      toast.success("Template duplicated successfully");
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast.error("Failed to duplicate template");
    }
  };

  return (
    <div className="space-y-4">
      {showLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="space-y-4 text-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-96 rounded bg-muted" />
            </div>
          </div>
        </div>
      ) : showEmptyState ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <ScrollText className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            Create your first template
          </h3>
          <p className="text-muted-foreground mb-4">
            Start creating email templates to streamline your communication and
            save time.
          </p>
          <Button onClick={onAddTemplate}>Add Template</Button>
        </div>
      ) : (
        <>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground/70" />
                        <span className="font-medium">{template.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingTemplate(template)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(template)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingTemplate(template)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={page}
            totalPages={Math.ceil(total / limit)}
            pageSize={limit}
            totalItems={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}

      {previewTemplate && (
        <PreviewTemplateDrawer
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {editingTemplate && (
        <EditTemplateDrawer
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(updatedTemplate) => {
            setTemplates((prev) =>
              prev.map((t) =>
                t.id === updatedTemplate.id ? updatedTemplate : t
              )
            );
            setEditingTemplate(null);
            toast.success("Template updated successfully");
          }}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateDialog
          template={deletingTemplate}
          onClose={() => setDeletingTemplate(null)}
          onDelete={(deletedTemplate) => {
            setTemplates((prev) =>
              prev.filter((t) => t.id !== deletedTemplate)
            );
            setDeletingTemplate(null);
            toast.success("Template deleted successfully");
          }}
        />
      )}
    </div>
  );
}
