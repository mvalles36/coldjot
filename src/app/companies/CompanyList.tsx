"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Company, Contact } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Building2, Users, ExternalLink } from "lucide-react";
import AddCompanyModal from "./AddCompanyModal";
import EditCompanyModal from "./EditCompanyModal";
import DeleteCompanyDialog from "./DeleteCompanyDialog";
import CompanyDetails from "./CompanyDetails";
import { Plus } from "lucide-react";
import Link from "next/link";

type CompanyWithContacts = Company & {
  contacts: Contact[];
};

interface CompanyListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
}

export default function CompanyList({
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
}: CompanyListProps) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<CompanyWithContacts | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithContacts | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!searchQuery || searchQuery.length >= 2) {
        onSearchStart?.();
        try {
          const response = await fetch(
            `/api/companies/search?q=${encodeURIComponent(searchQuery)}`
          );
          const data = await response.json();
          setCompanies(data);
        } catch (error) {
          console.error("Failed to fetch companies:", error);
        } finally {
          onSearchEnd?.();
        }
      }
    };

    if (searchQuery.length === 1) {
      return;
    }

    fetchCompanies();
  }, [searchQuery, onSearchStart, onSearchEnd]);

  const handleContactClick = (contact: Contact) => {
    localStorage.setItem(
      "selectedContact",
      JSON.stringify({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
        company: selectedCompany,
      })
    );
    router.push("/compose");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <div className="rounded-md border">
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
              <TableRow
                key={company.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedCompany(company)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground/70" />
                    <span className="font-medium">{company.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {company.website ? (
                    <a
                      href={
                        company.website.startsWith("http")
                          ? company.website
                          : `https://${company.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {company.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {company.contacts.length}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCompany(company);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCompany(company);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onAdd={(newCompany) => {
            setCompanies((prev) => [...prev, { ...newCompany, contacts: [] }]);
            setShowAddModal(false);
          }}
        />
      )}

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSave={(updatedCompany) => {
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
          onDelete={(deletedCompany) => {
            setCompanies((prev) =>
              prev.filter((c) => c.id !== deletedCompany.id)
            );
            setDeletingCompany(null);
          }}
        />
      )}

      {selectedCompany && (
        <CompanyDetails
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onContactClick={handleContactClick}
        />
      )}
    </div>
  );
}
