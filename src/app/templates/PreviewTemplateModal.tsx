"use client";

import { Template } from "@/types";
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

export default function PreviewTemplateModal({
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

  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => (
      <p key={i} className={line.trim() === "" ? "h-4" : ""}>
        {line}
      </p>
    ));
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
                <div className="prose prose-sm max-w-none rounded-md bg-muted p-4 whitespace-pre-wrap">
                  {formatContent(template.content)}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
