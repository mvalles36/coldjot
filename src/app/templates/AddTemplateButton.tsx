"use client";

import { useState } from "react";
import { TemplateWithSections } from "@/types";
import AddTemplateModal from "./AddTemplateModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AddTemplateButton({
  onAddTemplate,
}: {
  onAddTemplate: (template: TemplateWithSections) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Template
      </Button>

      {isOpen && (
        <AddTemplateModal
          onClose={() => setIsOpen(false)}
          onAdd={(template) => {
            onAddTemplate(template);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
