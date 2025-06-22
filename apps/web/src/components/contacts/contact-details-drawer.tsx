"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Contact } from "@prisma/client";
import {
  Mail,
  Building2,
  Globe,
  Calendar,
  Phone,
  PhoneCall,
} from "lucide-react";
import Link from "next/link";
import { formatLinkedInUrl } from "@/lib/utils";
import ActionButtons from "./action-buttons";

interface ContactDetailsDrawerProps {
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

export default function ContactDetailsDrawer({
  contact,
  open,
  onClose,
}: ContactDetailsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            {contact.firstName} {contact.lastName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <ActionButtons contact={contact} />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
              <div>
                <p className="font-medium">{contact.email}</p>
                <p className="text-sm text-muted-foreground">Email</p>
              </div>
            </div>

            {/* Phone number (if available) */}
            {((contact as any).phone || (contact as any).phoneNumber) && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {(contact as any).phone || (contact as any).phoneNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">Phone</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
              <div>
                <p className="font-medium">
                  {new Date(contact.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">Added on</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground/80">
              Recent Activity
            </h4>

            {/* Latest Call Activity */}
            {(contact as any).metadata?.callSummary && (
              <div className="flex items-start gap-3">
                <PhoneCall className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {(contact as any).metadata.callSummary}
                  </p>
                  {((contact as any).metadata.lastCallAt || null) && (
                    <p className="text-sm text-muted-foreground">
                      {new Date(
                        (contact as any).metadata.lastCallAt
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Latest Email Activity */}
            {(contact as any).metadata?.lastEmailSubject && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {(contact as any).metadata.lastEmailSubject}
                  </p>
                  {((contact as any).metadata.lastEmailAt || null) && (
                    <p className="text-sm text-muted-foreground">
                      {new Date(
                        (contact as any).metadata.lastEmailAt
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
