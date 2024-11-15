"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Contact, Company } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CompanySearch } from "./CompanySearch";

type ContactWithCompany = Contact & {
  company: Company | null;
};

type FormData = {
  name: string;
  email: string;
};

interface EditContactModalProps {
  contact: ContactWithCompany;
  companies: Company[];
  onClose: () => void;
  onSave: (contact: ContactWithCompany) => void;
}

export default function EditContactModal({
  contact,
  companies,
  onClose,
  onSave,
}: EditContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(
    contact.company
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: contact.name,
      email: contact.email,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          companyId: selectedCompany?.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to update contact");

      const updatedContact = await response.json();
      const contactWithCompany: ContactWithCompany = {
        ...updatedContact,
        company: selectedCompany,
      };

      onSave(contactWithCompany);
      toast.success("Contact updated successfully");
    } catch (error) {
      toast.error("Failed to update contact");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[600px] w-[90vw]">
        <SheetHeader>
          <SheetTitle>Edit Contact</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col h-full"
          >
            <div className="flex-1 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Company</Label>
                <CompanySearch
                  companies={companies}
                  selectedCompany={selectedCompany}
                  onSelect={setSelectedCompany}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 py-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
