/**
 * List Builder Types
 * 
 * This file contains TypeScript definitions for the List Builder feature,
 * including map-based lead capture, keyword scraping, and data enrichment.
 */

import { Contact, EmailList } from "@prisma/client";

// -------------------------------------------------------------------------
// Enums
// -------------------------------------------------------------------------

/**
 * Types of list builder sources
 */
export enum ListBuilderSourceType {
  MAP = "map",
  KEYWORD = "keyword",
  CSV = "csv",
  WEATHER = "weather"
}

/**
 * Types of list builder jobs
 */
export enum ListBuilderJobType {
  MAP = "map",
  KEYWORD = "keyword",
  CSV = "csv",
  ENRICH = "enrich",
  WEATHER = "weather"
}

/**
 * Status of list builder jobs
 */
export enum ListBuilderJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed"
}

/**
 * Status of contact enrichment
 */
export enum EnrichmentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed"
}

/**
 * Dynamic list refresh frequency options
 */
export enum RefreshFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  NEVER = "never"
}

/**
 * Draw modes for map-based selection
 */
export enum MapDrawMode {
  RECTANGLE = "rectangle",
  POLYGON = "polygon"
}

// -------------------------------------------------------------------------
// Base Interfaces
// -------------------------------------------------------------------------

/**
 * Base interface for list builder source configurations
 */
export interface ListBuilderSourceConfigBase {
  id?: string;
  userId: string;
  listId: string;
  configType: ListBuilderSourceType;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Base interface for list builder jobs
 */
export interface ListBuilderJobBase {
  id?: string;
  userId: string;
  listId?: string;
  jobType: ListBuilderJobType;
  status: ListBuilderJobStatus;
  sourceParams: Record<string, any>;
  progress: number;
  totalItems?: number;
  processedItems?: number;
  results?: Record<string, any>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// -------------------------------------------------------------------------
// GeoJSON Types
// -------------------------------------------------------------------------

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // Array of linear rings (first is exterior, rest are holes)
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][]; // Array of polygons
}

export interface GeoJSONFeature<G = GeoJSONPolygon | GeoJSONMultiPolygon> {
  type: "Feature";
  geometry: G;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// -------------------------------------------------------------------------
// Map-Based Lead Capture Types
// -------------------------------------------------------------------------

export interface MapArea {
  type: MapDrawMode;
  bounds: GeoJSONFeature;
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  metadata?: Record<string, any>;
}

export interface PropertyRecord {
  parcelId: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  ownerName?: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
  propertyType?: string;
  landValue?: number;
  buildingValue?: number;
  totalValue?: number;
  yearBuilt?: number;
  lotSize?: number;
  buildingSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  location?: GeoJSONPoint;
  metadata?: Record<string, any>;
}

export interface MapSourceConfig extends ListBuilderSourceConfigBase {
  configType: ListBuilderSourceType.MAP;
  mapArea: MapArea;
}

export interface MapJobParams {
  mapArea: MapArea;
  parcelLimit?: number;
  includeOwnerData?: boolean;
  includePropertyDetails?: boolean;
}

export interface MapJobResults {
  totalProperties: number;
  processedProperties: number;
  successfullyMapped: number;
  failedToMap: number;
  contactsCreated: number;
  errors?: string[];
}

// -------------------------------------------------------------------------
// Keyword-Based Scraper Types
// -------------------------------------------------------------------------

export interface KeywordSearchParams {
  keywords: string[];
  location?: string;
  radius?: number;
  maxResults?: number;
  businessType?: string;
}

export interface BusinessRecord {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  placeId?: string; // Google Maps place ID
  location?: GeoJSONPoint;
  metadata?: Record<string, any>;
}

export interface KeywordSourceConfig extends ListBuilderSourceConfigBase {
  configType: ListBuilderSourceType.KEYWORD;
  keywords: string[];
}

export interface KeywordJobParams extends KeywordSearchParams {}

export interface KeywordJobResults {
  totalBusinesses: number;
  processedBusinesses: number;
  contactsCreated: number;
  errors?: string[];
}

// -------------------------------------------------------------------------
// CSV Import Types
// -------------------------------------------------------------------------

export interface CSVConfig {
  filename: string;
  hasHeaders: boolean;
  delimiter: string;
  mappings: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    company?: string;
    title?: string;
    [key: string]: string | undefined;
  };
}

export interface CSVSourceConfig extends ListBuilderSourceConfigBase {
  configType: ListBuilderSourceType.CSV;
  csvConfig: CSVConfig;
}

export interface CSVJobParams {
  csvConfig: CSVConfig;
  fileUrl: string;
  enrichData?: boolean;
}

export interface CSVJobResults {
  totalRows: number;
  processedRows: number;
  contactsCreated: number;
  duplicates: number;
  invalidRows: number;
  errors?: string[];
}

// -------------------------------------------------------------------------
// Weather-Based Types
// -------------------------------------------------------------------------

export interface WeatherConfig {
  eventType: string; // e.g., "hurricane", "flood", "tornado"
  polygonData: GeoJSONFeature;
  eventDate: string;
  eventName?: string;
  severity?: string;
}

export interface WeatherSourceConfig extends ListBuilderSourceConfigBase {
  configType: ListBuilderSourceType.WEATHER;
  weatherConfig: WeatherConfig;
}

export interface WeatherJobParams {
  weatherConfig: WeatherConfig;
  parcelLimit?: number;
}

export interface WeatherJobResults {
  totalProperties: number;
  processedProperties: number;
  contactsCreated: number;
  errors?: string[];
}

// -------------------------------------------------------------------------
// Enrichment Data Types
// -------------------------------------------------------------------------

export interface DomainData {
  domain: string;
  registrar?: string;
  creationDate?: string;
  expiryDate?: string;
  company?: {
    name?: string;
    description?: string;
    logo?: string;
    industry?: string;
    size?: string;
    founded?: string;
    socialProfiles?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
      [key: string]: string | undefined;
    };
  };
}

export interface AddressData {
  formatted: string;
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isValid: boolean;
  validationMethod?: string;
}

export interface PhoneData {
  formatted: string;
  countryCode?: string;
  nationalNumber?: string;
  extension?: string;
  type?: string; // mobile, landline, voip, etc.
  carrier?: string;
  isValid: boolean;
  validationMethod?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
  timezone?: string;
  country?: string;
  administrativeArea?: string;
  locality?: string;
}

export interface EnrichmentMetadata {
  lastEnriched?: Date;
  enrichmentSource?: string;
  confidenceScore?: number;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, any>;
}

// -------------------------------------------------------------------------
// Extended Models
// -------------------------------------------------------------------------

/**
 * Extended Contact model with enrichment data
 */
export interface EnrichedContact extends Contact {
  domainData?: DomainData;
  addressData?: AddressData;
  phoneData?: PhoneData;
  locationData?: LocationData;
  metadata?: EnrichmentMetadata;
  enrichmentStatus?: EnrichmentStatus;
  dataQualityScore?: number;
}

/**
 * Extended EmailList model with list builder data
 */
export interface ListBuilderList extends EmailList {
  isDynamic: boolean;
  refreshFrequency?: RefreshFrequency;
  lastRefreshed?: Date;
  nextRefreshDue?: Date;
  sourceType?: ListBuilderSourceType;
  sourceConfigId?: string;
  sourceConfig?: ListBuilderSourceConfigBase;
}

// -------------------------------------------------------------------------
// API Request/Response Types
// -------------------------------------------------------------------------

export interface CreateListBuilderJobRequest {
  sourceType: ListBuilderSourceType;
  listName: string;
  listDescription?: string;
  isDynamic?: boolean;
  refreshFrequency?: RefreshFrequency;
  params: MapJobParams | KeywordJobParams | CSVJobParams | WeatherJobParams;
}

export interface ListBuilderJobResponse extends ListBuilderJobBase {
  list?: EmailList;
}

export interface EnrichmentRequest {
  contactIds?: string[];
  listId?: string;
  enrichmentOptions?: {
    fetchDomainInfo?: boolean;
    validateAddresses?: boolean;
    validatePhones?: boolean;
    appendEmails?: boolean;
  };
}

export interface DataQualityStats {
  total: number;
  withEmail: number;
  withPhone: number;
  withAddress: number;
  withCompany: number;
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
  averageScore: number;
}

export interface ListBuilderReviewData {
  contacts: EnrichedContact[];
  stats: DataQualityStats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
