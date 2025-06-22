"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Voicemail,
  CalendarCheck,
  Clock,
  Calendar,
  User,
  Mic,
  Info,
} from "lucide-react";
import { format, formatDuration, intervalToDuration } from "date-fns";

interface CallTracking {
  id: string;
  sequenceId: string;
  contactId: string;
  stepId: string;
  status: string;
  callId?: string | null;
  duration?: number | null;
  summary?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  contact?: {
    name: string;
    email: string;
    phone?: string;
    phoneNumber?: string;
  } | null;
}

interface CallDetailsDrawerProps {
  call: CallTracking | null;
  open: boolean;
  onClose: () => void;
}

export function CallDetailsDrawer({
  call,
  open,
  onClose,
}: CallDetailsDrawerProps) {
  if (!call) return null;

  // Format duration in a human-readable way (e.g., "2m 30s")
  const formattedDuration = call.duration
    ? formatDuration(
        intervalToDuration({
          start: 0,
          end: call.duration * 1000, // convert seconds to milliseconds
        }),
        { format: ["minutes", "seconds"] }
      )
    : "N/A";

  // Get the appropriate status badge and icon
  const getStatusBadge = () => {
    switch (call.status) {
      case "answered":
      case "completed":
        return {
          label: "Answered",
          badge: (
            <Badge
              variant="secondary"
              className="gap-1 text-green-600 bg-green-100"
            >
              <PhoneCall className="h-3 w-3 text-green-500" />
              Answered
            </Badge>
          ),
          icon: <PhoneCall className="h-5 w-5 text-green-500" />,
        };
      case "left_voicemail":
        return {
          label: "Voicemail Left",
          badge: (
            <Badge
              variant="secondary"
              className="gap-1 text-amber-600 bg-amber-100"
            >
              <Voicemail className="h-3 w-3 text-amber-500" />
              Voicemail Left
            </Badge>
          ),
          icon: <Voicemail className="h-5 w-5 text-amber-500" />,
        };
      case "appointment_set":
        return {
          label: "Appointment Set",
          badge: (
            <Badge
              variant="secondary"
              className="gap-1 text-blue-600 bg-blue-100"
            >
              <CalendarCheck className="h-3 w-3 text-blue-500" />
              Appointment Set
            </Badge>
          ),
          icon: <CalendarCheck className="h-5 w-5 text-blue-500" />,
        };
      case "no_answer":
        return {
          label: "No Answer",
          badge: (
            <Badge
              variant="secondary"
              className="gap-1 text-gray-600 bg-gray-100"
            >
              <PhoneOff className="h-3 w-3 text-gray-500" />
              No Answer
            </Badge>
          ),
          icon: <PhoneOff className="h-5 w-5 text-gray-500" />,
        };
      case "failed":
        return {
          label: "Failed",
          badge: (
            <Badge variant="destructive" className="gap-1">
              <PhoneOff className="h-3 w-3" />
              Failed
            </Badge>
          ),
          icon: <PhoneOff className="h-5 w-5 text-destructive" />,
        };
      case "do_not_call":
        return {
          label: "Do Not Call",
          badge: (
            <Badge variant="destructive" className="gap-1">
              <PhoneOff className="h-3 w-3" />
              Do Not Call
            </Badge>
          ),
          icon: <PhoneOff className="h-5 w-5 text-destructive" />,
        };
      default:
        return {
          label: call.status.replace(/_/g, " "),
          badge: (
            <Badge variant="outline" className="gap-1">
              <Phone className="h-3 w-3" />
              {call.status.replace(/_/g, " ")}
            </Badge>
          ),
          icon: <Phone className="h-5 w-5 text-primary" />,
        };
    }
  };

  const statusInfo = getStatusBadge();
  const phoneNumber =
    call.contact?.phone ||
    call.contact?.phoneNumber ||
    (call.metadata?.phoneNumber || "Unknown");

  // Extract assistant details from metadata
  const assistantName = call.metadata?.assistantName || call.metadata?.vapiAssistantId || "Unknown Assistant";
  const voiceName = call.metadata?.voiceName || call.metadata?.voiceId || "Unknown Voice";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            <span>Call Details</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              {call.contact?.name || "Unknown Contact"}
            </h3>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
              <div>
                <p className="font-medium">{phoneNumber}</p>
                <p className="text-sm text-muted-foreground">Phone Number</p>
              </div>
            </div>

            {call.contact?.email && (
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <p className="font-medium">{call.contact.email}</p>
                  <p className="text-sm text-muted-foreground">Email</p>
                </div>
              </div>
            )}
          </div>

          {/* Call Status */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusInfo.icon}
                <span className="font-medium">{statusInfo.label}</span>
              </div>
              {statusInfo.badge}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formattedDuration}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Started At</p>
                <p className="font-medium">
                  {call.startedAt
                    ? format(new Date(call.startedAt), "MMM d, yyyy 'at' h:mm a")
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Call Summary */}
          {call.summary && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Call Summary
              </h4>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="whitespace-pre-wrap">{call.summary}</p>
              </div>
            </div>
          )}

          {/* Assistant Details */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Assistant Details
            </h4>
            <div className="p-4 bg-muted/30 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Assistant</p>
                  <p className="font-medium flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {assistantName}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Voice</p>
                  <p className="font-medium flex items-center gap-1">
                    <Mic className="h-4 w-4" />
                    {voiceName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Technical Details
            </h4>
            <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-xs font-mono text-muted-foreground">
              <p>Call ID: {call.callId || "N/A"}</p>
              <p>Sequence ID: {call.sequenceId}</p>
              <p>Step ID: {call.stepId}</p>
              <p>
                Created:{" "}
                {format(new Date(call.createdAt), "yyyy-MM-dd HH:mm:ss")}
              </p>
              <p>
                Updated:{" "}
                {format(new Date(call.updatedAt), "yyyy-MM-dd HH:mm:ss")}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
