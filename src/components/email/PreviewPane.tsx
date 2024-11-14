import { useEffect, useState } from "react";
import { Contact, Company } from "@prisma/client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { replacePlaceholders, validatePlaceholders } from "@/lib/placeholders";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PreviewPaneProps {
  content: string;
  contact: (Contact & { company: Company | null }) | null;
  fallbacks: Record<string, string>;
  customValues?: Record<string, string>;
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
    setProcessedContent(processed);

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
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {content}
            </pre>
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
            <div className="prose prose-sm max-w-none">
              {processedContent.split("\n").map((line, i) => (
                <p key={i} className={line.trim() === "" ? "h-4" : ""}>
                  {line}
                </p>
              ))}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
