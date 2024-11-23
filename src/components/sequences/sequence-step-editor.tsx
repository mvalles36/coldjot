"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Mail } from "lucide-react";
import { useForm, Controller } from "react-hook-form";

interface StepFormData {
  type: string;
  timing: string;
  priority: string;
  delayAmount?: number;
  delayUnit?: string;
  note?: string;
}

interface SequenceStepEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function SequenceStepEditor({
  open,
  onClose,
  onSave,
}: SequenceStepEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, watch, control } = useForm<StepFormData>({
    defaultValues: {
      type: "manual_email",
      timing: "immediate",
      priority: "medium",
      delayAmount: 30,
      delayUnit: "minutes",
    },
  });

  const timing = watch("timing");

  const onSubmit = async (data: StepFormData) => {
    setIsSubmitting(true);
    try {
      const formattedData = {
        type: "manual_email",
        timing: data.timing,
        priority: data.priority,
        ...(data.timing === "delay" && {
          delayAmount: Number(data.delayAmount),
          delayUnit: data.delayUnit,
        }),
        note: data.note,
      };

      onSave(formattedData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Add Sequence Step</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Mail className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-medium">Manual email</h3>
                <p className="text-sm text-muted-foreground">
                  Task is created to edit and deliver email.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Label>When to start this step:</Label>
              <Controller
                name="timing"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="immediate" id="immediate" />
                      <Label htmlFor="immediate">
                        Immediately after the contact is added to sequence
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delay" id="delay" />
                      <Label htmlFor="delay">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-20"
                            {...register("delayAmount")}
                            disabled={timing !== "delay"}
                          />
                          <Controller
                            name="delayUnit"
                            control={control}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={timing !== "delay"}
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minutes">
                                    minutes
                                  </SelectItem>
                                  <SelectItem value="hours">hours</SelectItem>
                                  <SelectItem value="days">days</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <span>after the contact is added</span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            <div className="space-y-4">
              <Label>Assign task priority</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="high" id="high" />
                        <Label htmlFor="high">High priority</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" id="medium" />
                        <Label htmlFor="medium">Medium priority</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="low" id="low" />
                        <Label htmlFor="low">Low priority</Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Add note</Label>
              <Textarea
                {...register("note")}
                placeholder="Add a description, purpose or goal for the task"
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
