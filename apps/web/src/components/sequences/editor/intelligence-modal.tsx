"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

interface IntelligenceModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (data: {
    mode: "single" | "sequence";
    userPrompt?: string;
    tone?: string;
  }) => Promise<void>;
  onRegenerate?: () => Promise<void>;
  sequenceId: string;
  stepId: string;
  isLoading: boolean;
  hasGeneratedContent?: boolean;
}

export function IntelligenceModal({
  open,
  onClose,
  onGenerate,
  onRegenerate,
  sequenceId,
  stepId,
  isLoading,
  hasGeneratedContent = false,
}: IntelligenceModalProps) {
  const [mode, setMode] = useState<"single" | "sequence">("single");
  const [userPrompt, setUserPrompt] = useState("");
  const [tone, setTone] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate({
      mode,
      userPrompt: userPrompt.trim() || undefined,
      tone,
    });
  };

  const handleRegenerate = async () => {
    if (onRegenerate) {
      await onRegenerate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Email Intelligence
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-4">
            <div>
              <Label className="text-base">What would you like to generate?</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as "single" | "sequence")}
                className="flex flex-col space-y-2 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="font-normal">
                    This Email Only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sequence" id="sequence" />
                  <Label htmlFor="sequence" className="font-normal">
                    Full Sequence (Multiple Emails)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">What is this campaign about? (Optional)</Label>
              <Textarea
                id="prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="E.g., Introducing our new software product to marketing directors"
                className="resize-none h-24"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone (Optional)</Label>
              <Select
                value={tone}
                onValueChange={setTone}
                disabled={isLoading}
              >
                <SelectTrigger id="tone">
                  <SelectValue placeholder="Select a tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="humor">Humor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            {hasGeneratedContent && onRegenerate ? (
              <Button
                type="button"
                onClick={handleRegenerate}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
