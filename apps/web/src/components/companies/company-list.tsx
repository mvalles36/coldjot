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
import { Edit2, Trash2, Building2, Users, Building } from "lucide-react";
import EditCompanyModal from "./edit-company-drawer";
import DeleteCompanyDialog from "./delete-company-dialog";
import CompanyDetails from "./company-details-drawer";
import Link from "next/link";

type CompanyWithContacts = Company & {
  contacts: Contact[];
};

interface CompanyListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
  initialCompanies: CompanyWithContacts[];
  onAddCompany?: () => void;
}

export default function CompanyList({
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
  initialCompanies,
  onAddCompany,
}: CompanyListProps) {
  const router = useRouter();
  const [companies, setCompanies] =
    useState<CompanyWithContacts[]>(initialCompanies);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editingCompany, setEditingCompany] =
    useState<CompanyWithContacts | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithContacts | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!isInitialLoad && searchQuery.length === 1) {
        return;
      }

      setIsLoading(true);
      onSearchStart?.();
      try {
        const url =
          searchQuery.length >= 2
            ? `/api/companies/search?q=${encodeURIComponent(searchQuery)}`
            : "/api/companies";

        const response = await fetch(url);
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
        onSearchEnd?.();
      }
    };

    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      fetchCompanies();
    }
  }, [searchQuery, onSearchStart, onSearchEnd, isInitialLoad]);

  const showLoading = isLoading || isInitialLoad;
  const showEmptyState = !showLoading && companies.length === 0;

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
      {showLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="space-y-4 text-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-96 rounded bg-muted" />
            </div>
          </div>
        </div>
      ) : showEmptyState ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <Building className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Add your first company</h3>
          <p className="text-muted-foreground mb-4">
            Start building your company database to better organize your
            contacts and communications.
          </p>
          <Button onClick={onAddCompany}>Add Company</Button>
        </div>
      ) : (
        <>
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
        </>
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
