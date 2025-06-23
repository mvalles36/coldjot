"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-hot-toast";
import { PaginationControls } from "@/components/pagination";
import {
  Loader2,
  CheckCircle2,
  Filter,
  MoreHorizontal,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  Ban,
  CheckCheck,
  RefreshCw,
  Mail,
  Phone,
  Building,
  MapPin,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EnrichedContact,
  DataQualityStats,
  ListBuilderSourceType,
} from "@coldjot/types";

interface ReviewStepProps {
  sourceType: ListBuilderSourceType;
  listId: string;
  enrichmentJobId?: string;
  onNext: (reviewData: {
    listId: string;
    contactIds: string[];
    deduplicated: boolean;
    removedDuplicates: number;
  }) => void;
  onBack: () => void;
}

export default function ReviewStep({
  sourceType,
  listId,
  enrichmentJobId,
  onNext,
  onBack,
}: ReviewStepProps) {
  // State for contacts data
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<EnrichedContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<EnrichedContact | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalContacts, setTotalContacts] = useState<number>(0);
  
  // State for filtering
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  
  // State for data quality stats
  const [stats, setStats] = useState<DataQualityStats>({
    total: 0,
    withEmail: 0,
    withPhone: 0,
    withAddress: 0,
    withCompany: 0,
    highQuality: 0,
    mediumQuality: 0,
    lowQuality: 0,
    averageScore: 0,
  });
  
  // State for deduplication
  const [showDedupeDialog, setShowDedupeDialog] = useState<boolean>(false);
  const [dedupeMethod, setDedupeMethod] = useState<string>("email");
  const [dedupeStats, setDedupeStats] = useState<{
    duplicatesFound: number;
    uniqueContacts: number;
  }>({
    duplicatesFound: 0,
    uniqueContacts: 0,
  });
  const [isDeduplicated, setIsDeduplicated] = useState<boolean>(false);
  
  // State for bulk edit dialog
  const [showBulkEditDialog, setShowBulkEditDialog] = useState<boolean>(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");
  
  // State for delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [contactsToDelete, setContactsToDelete] = useState<string[]>([]);
  
  // Fetch contacts data
  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      if (qualityFilter !== "all") {
        params.append("quality", qualityFilter);
      }
      
      if (fieldFilter !== "all") {
        params.append("field", fieldFilter);
      }
      
      // Fetch contacts from API
      const response = await fetch(`/api/list-builder/lists/${listId}/contacts?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      
      const data = await response.json();
      
      setContacts(data.contacts);
      setFilteredContacts(data.contacts);
      setTotalContacts(data.pagination.total);
      setStats(data.stats);
      
      // Clear selection when filters or pagination changes
      setSelectedContacts(new Set());
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  }, [listId, page, pageSize, searchQuery, qualityFilter, fieldFilter]);
  
  // Initial data fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };
  
  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page when searching
  };
  
  // Handle quality filter change
  const handleQualityFilterChange = (value: string) => {
    setQualityFilter(value);
    setPage(1); // Reset to first page when filtering
  };
  
  // Handle field filter change
  const handleFieldFilterChange = (value: string) => {
    setFieldFilter(value);
    setPage(1); // Reset to first page when filtering
  };
  
  // Handle checkbox selection
  const handleSelectContact = (contactId: string, checked: boolean) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(contactId);
      } else {
        next.delete(contactId);
      }
      return next;
    });
  };
  
  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredContacts.map(contact => contact.id);
      setSelectedContacts(new Set(allIds));
    } else {
      setSelectedContacts(new Set());
    }
  };
  
  // Handle inline edit start
  const handleEditStart = (contact: EnrichedContact) => {
    setEditingContact({ ...contact });
  };
  
  // Handle inline edit save
  const handleEditSave = async () => {
    if (!editingContact) return;
    
    try {
      const response = await fetch(`/api/list-builder/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingContact),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update contact");
      }
      
      // Update the contact in the local state
      setContacts(prev => 
        prev.map(c => c.id === editingContact.id ? editingContact : c)
      );
      setFilteredContacts(prev => 
        prev.map(c => c.id === editingContact.id ? editingContact : c)
      );
      
      setEditingContact(null);
      toast.success("Contact updated successfully");
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    }
  };
  
  // Handle inline edit cancel
  const handleEditCancel = () => {
    setEditingContact(null);
  };
  
  // Handle inline edit field change
  const handleEditFieldChange = (field: keyof EnrichedContact, value: any) => {
    if (!editingContact) return;
    
    setEditingContact(prev => ({
      ...prev!,
      [field]: value,
    }));
  };
  
  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      const contactIds = Array.from(selectedContacts);
      
      const response = await fetch(`/api/list-builder/lists/${listId}/contacts`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contactIds }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete contacts");
      }
      
      const data = await response.json();
      
      toast.success(`${data.removed} contacts removed from list`);
      setSelectedContacts(new Set());
      fetchContacts();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting contacts:", error);
      toast.error("Failed to delete contacts");
    }
  };
  
  // Handle bulk edit
  const handleBulkEdit = async () => {
    try {
      const contactIds = Array.from(selectedContacts);
      
      const response = await fetch(`/api/list-builder/contacts/bulk`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds,
          field: bulkEditField,
          value: bulkEditValue,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update contacts");
      }
      
      const data = await response.json();
      
      toast.success(`${data.updated} contacts updated successfully`);
      setSelectedContacts(new Set());
      fetchContacts();
      setShowBulkEditDialog(false);
      setBulkEditField("");
      setBulkEditValue("");
    } catch (error) {
      console.error("Error updating contacts:", error);
      toast.error("Failed to update contacts");
    }
  };
  
  // Handle deduplication
  const handleDeduplicate = async () => {
    try {
      const response = await fetch(`/api/list-builder/lists/${listId}/deduplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: dedupeMethod,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to deduplicate contacts");
      }
      
      const data = await response.json();
      
      setDedupeStats({
        duplicatesFound: data.duplicatesRemoved,
        uniqueContacts: data.remainingContacts,
      });
      
      setIsDeduplicated(true);
      toast.success(`${data.duplicatesRemoved} duplicate contacts removed`);
      fetchContacts();
      setShowDedupeDialog(false);
    } catch (error) {
      console.error("Error deduplicating contacts:", error);
      toast.error("Failed to deduplicate contacts");
    }
  };
  
  // Handle proceeding to next step
  const handleContinue = () => {
    onNext({
      listId,
      contactIds: filteredContacts.map(c => c.id),
      deduplicated: isDeduplicated,
      removedDuplicates: dedupeStats.duplicatesFound,
    });
  };
  
  // Render quality badge for a contact
  const renderQualityBadge = (score: number | undefined) => {
    if (!score) return null;
    
    if (score >= 80) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          High
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <Ban className="h-3 w-3 mr-1" />
          Low
        </Badge>
      );
    }
  };
  
  // Render field indicator
  const renderFieldIndicator = (hasField: boolean) => {
    return hasField ? (
      <span className="text-green-600">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    ) : (
      <span className="text-gray-300">
        <Ban className="h-4 w-4" />
      </span>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Data Quality Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-2 text-primary" />
            Data Quality Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="text-sm font-medium">With Email</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {stats.withEmail}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((stats.withEmail / stats.total) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm font-medium">With Phone</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {stats.withPhone}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((stats.withPhone / stats.total) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center">
                  <Building className="h-4 w-4 mr-2 text-purple-500" />
                  <span className="text-sm font-medium">With Company</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {stats.withCompany}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((stats.withCompany / stats.total) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-red-500" />
                  <span className="text-sm font-medium">With Address</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {stats.withAddress}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((stats.withAddress / stats.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Data Quality</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    {stats.highQuality} High
                  </span>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    {stats.mediumQuality} Medium
                  </span>
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                    {stats.lowQuality} Low
                  </span>
                </div>
              </div>
              <Progress 
                value={stats.averageScore} 
                className="h-2 mt-2"
                // Apply color based on score
                style={{
                  backgroundColor: '#f1f5f9',
                  '--progress-color': stats.averageScore >= 80 
                    ? '#22c55e' 
                    : stats.averageScore >= 50 
                      ? '#eab308' 
                      : '#ef4444'
                } as React.CSSProperties}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Search</Label>
              <Input
                id="search"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <div>
                <Select
                  value={qualityFilter}
                  onValueChange={handleQualityFilterChange}
                >
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quality</SelectItem>
                    <SelectItem value="high">High Quality</SelectItem>
                    <SelectItem value="medium">Medium Quality</SelectItem>
                    <SelectItem value="low">Low Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Select
                  value={fieldFilter}
                  onValueChange={handleFieldFilterChange}
                >
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Fields" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    <SelectItem value="email">Has Email</SelectItem>
                    <SelectItem value="phone">Has Phone</SelectItem>
                    <SelectItem value="address">Has Address</SelectItem>
                    <SelectItem value="company">Has Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setQualityFilter("all");
                  setFieldFilter("all");
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
          
          {selectedContacts.size > 0 && (
            <div className="flex items-center justify-between mt-4 p-2 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {selectedContacts.size} contacts selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowBulkEditDialog(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bulk Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setContactsToDelete(Array.from(selectedContacts));
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredContacts.length > 0 &&
                        selectedContacts.size === filteredContacts.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <span className="mt-2 block text-sm text-muted-foreground">
                        Loading contacts...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <span className="text-muted-foreground">
                        No contacts found
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={(checked) =>
                            handleSelectContact(contact.id, checked as boolean)
                          }
                          aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        />
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingContact.firstName}
                              onChange={(e) =>
                                handleEditFieldChange("firstName", e.target.value)
                              }
                              className="w-[100px]"
                            />
                            <Input
                              value={editingContact.lastName}
                              onChange={(e) =>
                                handleEditFieldChange("lastName", e.target.value)
                              }
                              className="w-[100px]"
                            />
                          </div>
                        ) : (
                          `${contact.firstName} ${contact.lastName}`
                        )}
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <Input
                            value={editingContact.email}
                            onChange={(e) =>
                              handleEditFieldChange("email", e.target.value)
                            }
                          />
                        ) : (
                          contact.email
                        )}
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <Input
                            value={editingContact.phoneData?.formatted || ""}
                            onChange={(e) =>
                              handleEditFieldChange("phoneData", {
                                ...editingContact.phoneData,
                                formatted: e.target.value,
                              })
                            }
                          />
                        ) : (
                          contact.phoneData?.formatted || (
                            <span className="text-muted-foreground">None</span>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <Input
                            value={
                              editingContact.domainData?.company?.name || ""
                            }
                            onChange={(e) =>
                              handleEditFieldChange("domainData", {
                                ...editingContact.domainData,
                                company: {
                                  ...(editingContact.domainData?.company || {}),
                                  name: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          contact.domainData?.company?.name || (
                            <span className="text-muted-foreground">None</span>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <Input
                            value={editingContact.addressData?.formatted || ""}
                            onChange={(e) =>
                              handleEditFieldChange("addressData", {
                                ...editingContact.addressData,
                                formatted: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-[150px]">
                                  {contact.addressData?.formatted || (
                                    <span className="text-muted-foreground">None</span>
                                  )}
                                </span>
                              </TooltipTrigger>
                              {contact.addressData?.formatted && (
                                <TooltipContent side="top">
                                  <p>{contact.addressData.formatted}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderQualityBadge(contact.dataQualityScore)}
                      </TableCell>
                      <TableCell>
                        {editingContact && editingContact.id === contact.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleEditSave}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleEditCancel}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleEditStart(contact)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setContactsToDelete([contact.id]);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 border-t">
            <PaginationControls
              currentPage={page}
              totalPages={Math.ceil(totalContacts / pageSize)}
              pageSize={pageSize}
              totalItems={totalContacts}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setShowDedupeDialog(true)}
            disabled={isLoading}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Deduplicate Contacts
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
            >
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={isLoading || filteredContacts.length === 0}
            >
              Continue to Save
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      {/* Deduplication Dialog */}
      <Dialog open={showDedupeDialog} onOpenChange={setShowDedupeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deduplicate Contacts</DialogTitle>
            <DialogDescription>
              Remove duplicate contacts based on the selected field.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dedupe-method">Deduplicate By</Label>
              <Select
                value={dedupeMethod}
                onValueChange={setDedupeMethod}
              >
                <SelectTrigger id="dedupe-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email Address</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="name_address">Name + Address</SelectItem>
                  <SelectItem value="all_fields">All Fields (Exact Match)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {dedupeMethod === "email" && "Keep the first contact with each unique email address."}
                {dedupeMethod === "phone" && "Keep the first contact with each unique phone number."}
                {dedupeMethod === "name_address" && "Keep the first contact with each unique name and address combination."}
                {dedupeMethod === "all_fields" && "Only remove contacts that are exact duplicates across all fields."}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDedupeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleDeduplicate}
            >
              Deduplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Contacts</DialogTitle>
            <DialogDescription>
              Edit the selected field for all {selectedContacts.size} selected contacts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-field">Field to Edit</Label>
              <Select
                value={bulkEditField}
                onValueChange={setBulkEditField}
              >
                <SelectTrigger id="bulk-edit-field">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="source">Source</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-value">New Value</Label>
              <Input
                id="bulk-edit-value"
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                placeholder="Enter new value"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkEditDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleBulkEdit}
              disabled={!bulkEditField || !bulkEditValue.trim()}
            >
              Update {selectedContacts.size} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contacts</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {contactsToDelete.length} contact(s)?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
