"use client";

import { format, formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { Phone, PhoneCall, PhoneOff, Voicemail, CalendarCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface CallTimelineItemProps {
  call: CallTracking;
  onSelect: (call: CallTracking) => void;
}

export function CallTimelineItem({ call, onSelect }: CallTimelineItemProps) {
  // Format duration in a human-readable way (e.g., "2m 30s")
  const formattedDuration = call.duration 
    ? formatDuration(
        intervalToDuration({ 
          start: 0, 
          end: call.duration * 1000 // convert seconds to milliseconds
        }),
        { format: ['minutes', 'seconds'] }
      )
    : null;

  // Get the appropriate status badge
  const getStatusBadge = () => {
    switch (call.status) {
      case "answered":
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 text-green-600 bg-green-100">
            <PhoneCall className="h-3 w-3 text-green-500" />
            Answered
          </Badge>
        );
      case "left_voicemail":
        return (
          <Badge variant="secondary" className="gap-1 text-amber-600 bg-amber-100">
            <Voicemail className="h-3 w-3 text-amber-500" />
            Voicemail Left
          </Badge>
        );
      case "appointment_set":
        return (
          <Badge variant="secondary" className="gap-1 text-blue-600 bg-blue-100">
            <CalendarCheck className="h-3 w-3 text-blue-500" />
            Appointment Set
          </Badge>
        );
      case "no_answer":
        return (
          <Badge variant="secondary" className="gap-1 text-gray-600 bg-gray-100">
            <PhoneOff className="h-3 w-3 text-gray-500" />
            No Answer
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <PhoneOff className="h-3 w-3" />
            Failed
          </Badge>
        );
      case "do_not_call":
        return (
          <Badge variant="destructive" className="gap-1">
            <PhoneOff className="h-3 w-3" />
            Do Not Call
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Phone className="h-3 w-3" />
            {call.status.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  // Get contact phone number
  const phoneNumber = call.contact?.phone || 
                     call.contact?.phoneNumber || 
                     (call.metadata?.phoneNumber || "Unknown");

  return (
    <div
      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onSelect(call)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium flex-1">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>Call to {call.contact?.name || "Unknown Contact"}</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground/80">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">
                To: {phoneNumber}
              </span>
              {getStatusBadge()}
            </span>
          </div>
          {call.summary && (
            <div className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {call.summary}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-end gap-4">
            {call.duration && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild className="cursor-pointer">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{formattedDuration}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Call duration: {formattedDuration}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-right">
            {format(
              new Date(call.startedAt || call.createdAt),
              "MMM d, yyyy 'at' h:mm a"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
