"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2 } from "lucide-react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { TemplateCommand } from "./template-command";

interface SequenceEmailEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: {
    subject?: string;
    content?: string;
    includeSignature?: boolean;
  };
}

export function SequenceEmailEditor({
  open,
  onClose,
  onSave,
  initialData,
}: SequenceEmailEditorProps) {
  const [content, setContent] = useState(initialData?.content || "");
  const [subject, setSubject] = useState(initialData?.subject || "");
  const [includeSignature, setIncludeSignature] = useState(
    initialData?.includeSignature ?? true
  );

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setContent(initialData.content || "");
      setSubject(initialData.subject || "");
      setIncludeSignature(initialData.includeSignature ?? true);
    }
  }, [initialData]);

  const handleTemplateSelect = (template: {
    subject: string;
    content: string;
  }) => {
    setSubject(template.subject);
    setContent(template.content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      subject,
      content,
      includeSignature,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-11/12 sm:w-[95%] max-w-[1400px] h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Email" : "Create Email"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 h-full flex flex-col"
        >
          <div className="grid grid-cols-2 gap-6 flex-grow">
            {/* Left column */}
            <div className="h-full flex flex-col gap-4">
              <div className="space-y-4 flex flex-col">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>

              <div className="flex-grow">
                <RichTextEditor
                  initialContent={content}
                  onChange={setContent}
                  placeholder="Write your email content..."
                  className="h-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="signature"
                  checked={includeSignature}
                  onCheckedChange={(checked) =>
                    setIncludeSignature(checked as boolean)
                  }
                />
                <Label htmlFor="signature">Include Signature</Label>
              </div>
            </div>

            {/* Right column - Preview */}
            <div className="p-6 bg-muted/30">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Generate Preview for Contact (optional)
                </h3>
                <Input placeholder="Choose a contact" />
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg">
                <div className="text-sm text-muted-foreground">
                  <p>To: Example Contact &lt;example@google.com&gt;</p>
                  <p>Subject: {subject || "(No Subject)"}</p>
                </div>
                <div className="mt-4 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                  {includeSignature && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>Best regards,</p>
                      <p>Your Name</p>
                      <p>Your Company</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2">
              <TemplateCommand onSelect={handleTemplateSelect} />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {}}
              >
                <Wand2 className="h-4 w-4" />
                AI assistant
              </Button>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
