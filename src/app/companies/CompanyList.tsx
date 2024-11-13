"use client";

import { useState } from "react";
import { Company } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Plus, Users } from "lucide-react";
import AddCompanyModal from "./AddCompanyModal";
import EditCompanyModal from "./EditCompanyModal";
import DeleteCompanyDialog from "./DeleteCompanyDialog";

type CompanyWithContacts = Company & {
  contacts: { id: string; name: string; email: string }[];
};

export default function CompanyList({
  initialCompanies,
}: {
  initialCompanies: CompanyWithContacts[];
}) {
  const [companies, setCompanies] =
    useState<CompanyWithContacts[]>(initialCompanies);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<CompanyWithContacts | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.name}</TableCell>
              <TableCell>{company.website}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{company.contacts.length}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingCompany(company)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingCompany(company)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onAdd={(newCompany: Company) => {
            setCompanies((prev) => [...prev, { ...newCompany, contacts: [] }]);
            setShowAddModal(false);
          }}
        />
      )}

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSave={(updatedCompany: Company) => {
            setCompanies((prev) =>
              prev.map((c) =>
                c.id === updatedCompany.id
                  ? { ...updatedCompany, contacts: c.contacts }
                  : c
              )
            );
            setEditingCompany(null);
          }}
        />
      )}

      {deletingCompany && (
        <DeleteCompanyDialog
          company={deletingCompany}
          onClose={() => setDeletingCompany(null)}
          onDelete={(deletedCompany: Company) => {
            setCompanies((prev) =>
              prev.filter((c) => c.id !== deletedCompany.id)
            );
            setDeletingCompany(null);
          }}
        />
      )}
    </div>
  );
}
