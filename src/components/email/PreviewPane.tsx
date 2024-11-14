"use client";

import { useEffect, useState } from "react";
import { Contact, Company } from "@prisma/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { replacePlaceholders, validatePlaceholders } from "@/lib/placeholders";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface PreviewPaneProps {
  content: string;
  contact: ContactWithCompany | null;
  fallbacks: Record<string, string>;
  customValues: Record<string, string>;
}

export function PreviewPane({
  content,
  contact,
  fallbacks,
  customValues,
}: PreviewPaneProps) {
  const [processedContent, setProcessedContent] = useState("");
  const [missingPlaceholders, setMissingPlaceholders] = useState<string[]>([]);

  useEffect(() => {
    // Process content with placeholders
    const processed = replacePlaceholders(content, {
      contact,
      fallbacks,
      customValues,
    });

    // Convert any plain text placeholders to HTML
    const htmlContent = processed.replace(/\n/g, "<br />");
    setProcessedContent(htmlContent);

    // Validate for any remaining unprocessed placeholders
    const missing = validatePlaceholders(processed);
    setMissingPlaceholders(missing);
  }, [content, contact, fallbacks, customValues]);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50}>
        <div className="h-full p-4">
          <h3 className="text-sm font-medium mb-2">Original Content</h3>
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <RichTextEditor
              initialContent={content}
              onChange={() => {}}
              readOnly={true}
              placeholder=""
            />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}>
        <div className="h-full p-4">
          <h3 className="text-sm font-medium mb-2">Preview</h3>
          {missingPlaceholders.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Missing values for placeholders:{" "}
                {missingPlaceholders.join(", ")}
              </AlertDescription>
            </Alert>
          )}
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <RichTextEditor
              initialContent={processedContent}
              onChange={() => {}}
              readOnly={true}
              placeholder=""
            />
          </ScrollArea>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
