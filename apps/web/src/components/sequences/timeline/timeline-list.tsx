"use client";

import { useState, useEffect } from "react";
import { TimelineItem } from "./timeline-item";
import { EmailDetailsDrawer } from "./email-details-drawer";
import { CallTimelineItem } from "./call-timeline-item";
import { CallDetailsDrawer } from "./call-details-drawer";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailTracking } from "@/types/email";

// Define the CallTracking interface for call events
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

// Define a unified timeline item type that can be either an email or a call
interface TimelineEvent {
  type: "email" | "call";
  item: EmailTracking | CallTracking;
  timestamp: Date; // For sorting purposes
}

interface TimelineListProps {
  userId: string;
  sequenceId?: string;
  initialEmails?: EmailTracking[];
  initialCalls?: CallTracking[];
}

export function TimelineList({
  userId,
  sequenceId,
  initialEmails = [],
  initialCalls = [],
}: TimelineListProps) {
  const [emails, setEmails] = useState<EmailTracking[]>(initialEmails);
  const [calls, setCalls] = useState<CallTracking[]>(initialCalls);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailTracking | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallTracking | null>(null);
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [showCallDetails, setShowCallDetails] = useState(false);

  // Combined timeline events
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  // Fetch timeline data on component mount
  useEffect(() => {
    if (initialEmails.length === 0 && initialCalls.length === 0) {
      fetchTimelineData();
    } else {
      // Combine and sort initial data
      combineAndSortEvents(initialEmails, initialCalls);
    }
  }, []);

  // Combine and sort email and call events
  const combineAndSortEvents = (emailEvents: EmailTracking[], callEvents: CallTracking[]) => {
    const combined: TimelineEvent[] = [
      ...emailEvents.map((email) => ({
        type: "email" as const,
        item: email,
        timestamp: new Date(email.sentAt || email.createdAt),
      })),
      ...callEvents.map((call) => ({
        type: "call" as const,
        item: call,
        timestamp: new Date(call.startedAt || call.createdAt),
      })),
    ];

    // Sort by timestamp, newest first
    combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setTimelineEvents(combined);
  };

  // Fetch timeline data
  const fetchTimelineData = async () => {
    setIsLoading(true);
    try {
      // Fetch emails
      const emailsResponse = await fetch(
        `/api/timeline?userId=${userId}${
          sequenceId ? `&sequenceId=${sequenceId}` : ""
        }&page=${page}&limit=20`
      );
      const emailsData = await emailsResponse.json();
      
      // Fetch calls
      const callsResponse = await fetch(
        `/api/calls/timeline?userId=${userId}${
          sequenceId ? `&sequenceId=${sequenceId}` : ""
        }&page=${page}&limit=20`
      );
      const callsData = await callsResponse.json();

      if (page === 1) {
        setEmails(emailsData.emails || []);
        setCalls(callsData.calls || []);
        combineAndSortEvents(emailsData.emails || [], callsData.calls || []);
      } else {
        setEmails((prev) => [...prev, ...(emailsData.emails || [])]);
        setCalls((prev) => [...prev, ...(callsData.calls || [])]);
        combineAndSortEvents(
          [...emails, ...(emailsData.emails || [])],
          [...calls, ...(callsData.calls || [])]
        );
      }

      // Check if there are more pages
      setHasMore(
        emailsData.hasMore || callsData.hasMore
      );
    } catch (error) {
      console.error("Error fetching timeline data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load more timeline data
  const loadMore = () => {
    setPage((prev) => prev + 1);
    fetchTimelineData();
  };

  // Handle email selection
  const handleEmailSelect = (email: EmailTracking) => {
    setSelectedEmail(email);
    setShowEmailDetails(true);
  };

  // Handle call selection
  const handleCallSelect = (call: CallTracking) => {
    setSelectedCall(call);
    setShowCallDetails(true);
  };

  return (
    <div className="space-y-4">
      {timelineEvents.length === 0 && !isLoading ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No timeline events found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {timelineEvents.map((event) => (
              <div key={`${event.type}-${event.item.id}`}>
                {event.type === "email" ? (
                  <TimelineItem
                    email={event.item as EmailTracking}
                    onSelect={handleEmailSelect}
                  />
                ) : (
                  <CallTimelineItem
                    call={event.item as CallTracking}
                    onSelect={handleCallSelect}
                  />
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoading}
                className="w-40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Email Details Drawer */}
      <EmailDetailsDrawer
        email={selectedEmail}
        open={showEmailDetails}
        onClose={() => {
          setShowEmailDetails(false);
          setSelectedEmail(null);
        }}
      />

      {/* Call Details Drawer */}
      <CallDetailsDrawer
        call={selectedCall}
        open={showCallDetails}
        onClose={() => {
          setShowCallDetails(false);
          setSelectedCall(null);
        }}
      />
    </div>
  );
}
