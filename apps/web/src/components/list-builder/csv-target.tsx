"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "react-hot-toast";
import { 
  Loader2, 
  Upload, 
  FileSpreadsheet, 
  Info, 
  X, 
  ArrowDown 
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CSVConfig,
  CSVJobParams,
  RefreshFrequency,
} from "@coldjot/types";
import Papa from 'papaparse';

interface CSVTargetProps {
  onNext: (params: {
    csvConfig: CSVConfig;
    fileUrl: string;
    listName: string;
    listDescription: string;
    isDynamic: boolean;
    refreshFrequency?: RefreshFrequency;
    enrichData: boolean;
  }) => void;
}

// Contact field options for mapping
const contactFields = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "Zip Code" },
  { value: "company", label: "Company" },
  { value: "title", label: "Job Title" },
  { value: "website", label: "Website" },
  { value: "notes", label: "Notes" },
];

// Delimiter options
const delimiterOptions = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

export default function CSVTarget({ onNext }: CSVTargetProps) {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // CSV parsing options
  const [delimiter, setDelimiter] = useState<string>(",");
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);
  
  // Column mapping
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  
  // Form state
  const [listName, setListName] = useState<string>("");
  const [listDescription, setListDescription] = useState<string>("");
  const [isDynamic, setIsDynamic] = useState<boolean>(false);
  const [refreshFrequency, setRefreshFrequency] = useState<RefreshFrequency>(RefreshFrequency.WEEKLY);
  const [enrichData, setEnrichData] = useState<boolean>(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<number>(5);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };
  
  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
    }
  }, []);
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Process the uploaded file
  const processFile = (file: File) => {
    // Check file type
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a CSV file');
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit');
      return;
    }
    
    setFile(file);
    setIsUploading(true);
    
    // Create object URL for the file
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    
    // Parse CSV file
    Papa.parse(file, {
      delimiter: delimiter,
      preview: 20, // Parse more rows than we display for better header detection
      complete: (results) => {
        const parsedData = results.data as string[][];
        
        if (parsedData.length === 0) {
          toast.error('The CSV file appears to be empty');
          setIsUploading(false);
          return;
        }
        
        // Set headers and data
        if (hasHeaders && parsedData.length > 1) {
          setHeaders(parsedData[0]);
          setCsvData(parsedData.slice(1));
          
          // Auto-map columns based on header names
          const mappings: Record<string, string> = {};
          parsedData[0].forEach((header, index) => {
            const normalizedHeader = header.toLowerCase().trim();
            
            // Try to match headers to contact fields
            if (normalizedHeader.includes('first') || normalizedHeader === 'fname') {
              mappings[index.toString()] = 'firstName';
            } else if (normalizedHeader.includes('last') || normalizedHeader === 'lname') {
              mappings[index.toString()] = 'lastName';
            } else if (normalizedHeader.includes('email')) {
              mappings[index.toString()] = 'email';
            } else if (normalizedHeader.includes('phone')) {
              mappings[index.toString()] = 'phone';
            } else if (normalizedHeader.includes('address') && !normalizedHeader.includes('email')) {
              mappings[index.toString()] = 'address';
            } else if (normalizedHeader.includes('city')) {
              mappings[index.toString()] = 'city';
            } else if (normalizedHeader.includes('state')) {
              mappings[index.toString()] = 'state';
            } else if (normalizedHeader.includes('zip') || normalizedHeader.includes('postal')) {
              mappings[index.toString()] = 'zip';
            } else if (normalizedHeader.includes('company') || normalizedHeader.includes('organization')) {
              mappings[index.toString()] = 'company';
            } else if (normalizedHeader.includes('title') || normalizedHeader.includes('job')) {
              mappings[index.toString()] = 'title';
            } else if (normalizedHeader.includes('website') || normalizedHeader.includes('url')) {
              mappings[index.toString()] = 'website';
            } else if (normalizedHeader.includes('note') || normalizedHeader.includes('comment')) {
              mappings[index.toString()] = 'notes';
            }
          });
          
          setColumnMappings(mappings);
        } else {
          setHeaders([]);
          setCsvData(parsedData);
        }
        
        // Set list name from file name if not already set
        if (!listName) {
          const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
          setListName(`${fileName} List`);
        }
        
        setIsUploading(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to parse CSV file');
        setIsUploading(false);
      }
    });
  };
  
  // Handle column mapping change
  const handleMappingChange = (columnIndex: string, contactField: string) => {
    setColumnMappings({
      ...columnMappings,
      [columnIndex]: contactField,
    });
  };
  
  // Handle delimiter change
  const handleDelimiterChange = (value: string) => {
    setDelimiter(value);
    
    // Re-parse the file with the new delimiter
    if (file) {
      processFile(file);
    }
  };
  
  // Handle headers toggle
  const handleHeadersChange = (checked: boolean) => {
    setHasHeaders(checked);
    
    // Re-parse the file with the new headers setting
    if (file) {
      processFile(file);
    }
  };
  
  // Remove file
  const handleRemoveFile = () => {
    setFile(null);
    setFileUrl("");
    setCsvData([]);
    setHeaders([]);
    setColumnMappings({});
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!file) {
      toast.error("Please upload a CSV file");
      return;
    }
    
    if (!listName.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    
    // Check if at least email or phone is mapped
    const hasEmailMapping = Object.values(columnMappings).includes("email");
    const hasPhoneMapping = Object.values(columnMappings).includes("phone");
    
    if (!hasEmailMapping && !hasPhoneMapping) {
      toast.error("Please map at least an email or phone column");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create CSV configuration
      const csvConfig: CSVConfig = {
        filename: file.name,
        hasHeaders,
        delimiter,
        mappings: columnMappings,
      };
      
      // Call the onNext callback with the form data
      onNext({
        csvConfig,
        fileUrl,
        listName,
        listDescription,
        isDynamic,
        refreshFrequency: isDynamic ? refreshFrequency : undefined,
        enrichData,
      });
      
    } catch (error) {
      console.error("Error submitting CSV import:", error);
      toast.error("Failed to process the CSV file");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <Card>
        <CardContent className="pt-6">
          {!file ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv,.txt"
              />
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop a CSV file here, or click to browse
              </p>
              <Button variant="outline" type="button">
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                  <div>
                    <h3 className="font-medium">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • {csvData.length} rows
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
              
              {/* CSV Parsing Options */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="delimiter">Delimiter</Label>
                  <Select
                    value={delimiter}
                    onValueChange={handleDelimiterChange}
                  >
                    <SelectTrigger id="delimiter">
                      <SelectValue placeholder="Select delimiter" />
                    </SelectTrigger>
                    <SelectContent>
                      {delimiterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between h-9">
                    <Label htmlFor="has-headers">First Row Contains Headers</Label>
                    <Switch
                      id="has-headers"
                      checked={hasHeaders}
                      onCheckedChange={handleHeadersChange}
                    />
                  </div>
                </div>
              </div>
              
              {/* CSV Preview */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label>CSV Preview</Label>
                  <span className="text-xs text-muted-foreground">
                    Showing first {Math.min(previewRows, csvData.length)} rows
                  </span>
                </div>
                
                <div className="border rounded-md overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        {headers.length > 0
                          ? headers.map((header, index) => (
                              <TableHead key={index}>{header}</TableHead>
                            ))
                          : csvData[0]?.map((_, index) => (
                              <TableHead key={index}>Column {index + 1}</TableHead>
                            ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, previewRows).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          <TableCell className="font-medium">{rowIndex + 1}</TableCell>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {/* Column Mapping */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Map Columns to Contact Fields</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Map each CSV column to the appropriate contact field</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {(hasHeaders ? headers : csvData[0]?.map((_, i) => `Column ${i + 1}`))?.map(
                    (column, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1 text-sm truncate">{column}</div>
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={columnMappings[index.toString()] || ""}
                          onValueChange={(value) => handleMappingChange(index.toString(), value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Do not import</SelectItem>
                            {contactFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* List Creation Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                placeholder="Enter a name for your list"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="list-description">Description (Optional)</Label>
              <Textarea
                id="list-description"
                placeholder="Enter a description for your list"
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="dynamic-list"
                checked={isDynamic}
                onCheckedChange={setIsDynamic}
              />
              <Label htmlFor="dynamic-list">
                Dynamic List (auto-refresh)
              </Label>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Dynamic lists automatically refresh on a schedule</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {isDynamic && (
              <div className="space-y-2">
                <Label htmlFor="refresh-frequency">Refresh Frequency</Label>
                <Select
                  value={refreshFrequency}
                  onValueChange={(value) => setRefreshFrequency(value as RefreshFrequency)}
                >
                  <SelectTrigger id="refresh-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RefreshFrequency.DAILY}>Daily</SelectItem>
                    <SelectItem value={RefreshFrequency.WEEKLY}>Weekly</SelectItem>
                    <SelectItem value={RefreshFrequency.MONTHLY}>Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="enrich-data"
                checked={enrichData}
                onCheckedChange={setEnrichData}
              />
              <Label htmlFor="enrich-data">
                Enrich Data (find missing emails, validate addresses)
              </Label>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Automatically find missing information and validate existing data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!file || !listName.trim() || isLoading || isUploading}
          >
            {(isLoading || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Enrichment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
