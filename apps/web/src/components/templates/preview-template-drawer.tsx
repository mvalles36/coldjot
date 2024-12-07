"use client";

import { Template } from "@mailjot/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "react-hot-toast";
import { RichTextEditor } from "@/components/editor/rich-text-editor";

export default function PreviewTemplateDrawer({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy to clipboard");
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
            <SheetTitle>{template.name}</SheetTitle>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Template Content
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(template.content)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <RichTextEditor
                  initialContent={template.content}
                  onChange={() => {}}
                  readOnly={true}
                  placeholder=""
                />
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
