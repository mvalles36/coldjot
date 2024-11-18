"use client";

import { useState, useEffect } from "react";
import { Template } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, FileText, Plus } from "lucide-react";

interface TemplateListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
}

export default function TemplateList({
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
}: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!searchQuery || searchQuery.length >= 2) {
        onSearchStart?.();
        try {
          const response = await fetch(
            `/api/templates/search?q=${encodeURIComponent(searchQuery)}`
          );
          const data = await response.json();
          setTemplates(data);
        } catch (error) {
          console.error("Failed to fetch templates:", error);
        } finally {
          onSearchEnd?.();
        }
      }
    };

    if (searchQuery.length === 1) {
      return;
    }

    fetchTemplates();
  }, [searchQuery, onSearchStart, onSearchEnd]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <div className="rounded-md border">
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
                    <Button variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
