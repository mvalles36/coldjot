"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
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
import { toast } from "react-hot-toast";
import { Loader2, Map, MapPin, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MapArea,
  MapDrawMode,
  MapJobParams,
  RefreshFrequency,
  GeoJSONFeature,
} from "@coldjot/types";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Make sure leaflet is imported only on client side
const LeafletInitializer = () => {
  useEffect(() => {
    // Only import leaflet on client side
    import("leaflet").then((L) => {
      // Fix default icon issues with webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
        iconUrl: "/images/leaflet/marker-icon.png",
        shadowUrl: "/images/leaflet/marker-shadow.png",
      });
    });
  }, []);

  return null;
};

// Component to set the map view
const MapViewSetter = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
};

interface MapTargetProps {
  onNext: (params: {
    mapArea: MapArea;
    listName: string;
    listDescription: string;
    isDynamic: boolean;
    refreshFrequency?: RefreshFrequency;
    includeOwnerData: boolean;
    includePropertyDetails: boolean;
  }) => void;
}

export default function MapTarget({ onNext }: MapTargetProps) {
  // Map state
  const [drawMode, setDrawMode] = useState<MapDrawMode>(MapDrawMode.RECTANGLE);
  const [drawnItems, setDrawnItems] = useState<any>(null);
  const [areaSize, setAreaSize] = useState<number>(0);
  const [estimatedProperties, setEstimatedProperties] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const featureGroupRef = useRef<any>(null);
  
  // Form state
  const [listName, setListName] = useState<string>("");
  const [listDescription, setListDescription] = useState<string>("");
  const [isDynamic, setIsDynamic] = useState<boolean>(false);
  const [refreshFrequency, setRefreshFrequency] = useState<RefreshFrequency>(RefreshFrequency.WEEKLY);
  const [includeOwnerData, setIncludeOwnerData] = useState<boolean>(true);
  const [includePropertyDetails, setIncludePropertyDetails] = useState<boolean>(true);
  
  // Map configuration
  const mapCenter: [number, number] = [37.7749, -122.4194]; // Default center (San Francisco)
  const mapZoom = 12;
  
  // Calculate area size and estimated properties when a shape is drawn
  const calculateAreaStatistics = (layer: any) => {
    try {
      // Get the GeoJSON representation of the drawn shape
      const geoJSON = layer.toGeoJSON();
      
      // Calculate area in square meters (approximate)
      let area = 0;
      if (layer.getLatLngs) {
        const latlngs = layer.getLatLngs();
        
        // For rectangles and polygons
        if (Array.isArray(latlngs) && latlngs.length > 0) {
          // Use Leaflet's built-in area calculation if available
          if (typeof L !== 'undefined' && L.GeometryUtil && L.GeometryUtil.geodesicArea) {
            area = L.GeometryUtil.geodesicArea(latlngs[0]);
          } else {
            // Simple approximation for small areas
            // This is not accurate for large areas due to Earth's curvature
            const earthRadius = 6371000; // meters
            const degToRad = Math.PI / 180;
            let polygon = latlngs[0];
            
            // Ensure we have a closed polygon
            if (polygon.length > 2) {
              let totalArea = 0;
              for (let i = 0; i < polygon.length; i++) {
                const j = (i + 1) % polygon.length;
                const xi = polygon[i].lng * degToRad;
                const yi = polygon[i].lat * degToRad;
                const xj = polygon[j].lng * degToRad;
                const yj = polygon[j].lat * degToRad;
                totalArea += (xi * Math.sin(yj) - xj * Math.sin(yi));
              }
              area = Math.abs(totalArea * earthRadius * earthRadius / 2);
            }
          }
        }
      }
      
      // Convert to square kilometers
      const areaInSqKm = area / 1000000;
      setAreaSize(areaInSqKm);
      
      // Estimate number of properties (rough estimation)
      // Assuming average of 25 properties per square kilometer in urban areas
      const estimatedProps = Math.round(areaInSqKm * 25);
      setEstimatedProperties(estimatedProps);
      
      return {
        area: areaInSqKm,
        estimatedProperties: estimatedProps,
        geoJSON
      };
    } catch (error) {
      console.error("Error calculating area statistics:", error);
      return {
        area: 0,
        estimatedProperties: 0,
        geoJSON: null
      };
    }
  };
  
  // Handle draw events
  const handleCreated = (e: any) => {
    const { layer } = e;
    
    // Store the drawn layer
    setDrawnItems(layer);
    
    // Calculate area statistics
    calculateAreaStatistics(layer);
  };
  
  // Handle draw mode change
  const handleDrawModeChange = (mode: MapDrawMode) => {
    setDrawMode(mode);
    
    // Clear existing drawings when changing mode
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
      setDrawnItems(null);
      setAreaSize(0);
      setEstimatedProperties(0);
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!listName.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    
    if (!drawnItems) {
      toast.error("Please draw an area on the map");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get GeoJSON representation of the drawn area
      const geoJSON = drawnItems.toGeoJSON();
      
      // Create map area object
      const mapArea: MapArea = {
        type: drawMode,
        bounds: geoJSON as GeoJSONFeature,
        center: mapCenter,
        zoom: mapZoom,
      };
      
      // Call the onNext callback with the form data
      onNext({
        mapArea,
        listName,
        listDescription,
        isDynamic,
        refreshFrequency: isDynamic ? refreshFrequency : undefined,
        includeOwnerData,
        includePropertyDetails,
      });
      
    } catch (error) {
      console.error("Error submitting map area:", error);
      toast.error("Failed to process the selected area");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <LeafletInitializer />
      
      {/* Drawing Mode Selection */}
      <div className="flex items-center space-x-4 mb-4">
        <Label className="text-sm font-medium">Drawing Mode:</Label>
        <div className="flex space-x-2">
          <Button
            variant={drawMode === MapDrawMode.RECTANGLE ? "default" : "outline"}
            size="sm"
            onClick={() => handleDrawModeChange(MapDrawMode.RECTANGLE)}
          >
            Rectangle
          </Button>
          <Button
            variant={drawMode === MapDrawMode.POLYGON ? "default" : "outline"}
            size="sm"
            onClick={() => handleDrawModeChange(MapDrawMode.POLYGON)}
          >
            Polygon
          </Button>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p>Rectangle: Draw a simple rectangular area</p>
              <p>Polygon: Draw a custom shape (limited to 20,000 vertices)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Map Container */}
      <div className="relative h-[500px] w-full border rounded-md overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewSetter center={mapCenter} zoom={mapZoom} />
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              draw={{
                rectangle: drawMode === MapDrawMode.RECTANGLE,
                polygon: drawMode === MapDrawMode.POLYGON,
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
              }}
              edit={{
                edit: false,
                remove: true,
              }}
            />
          </FeatureGroup>
        </MapContainer>
        
        {/* Map overlay with instructions */}
        {!drawnItems && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
            <div className="bg-background p-4 rounded-md max-w-md text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-medium text-lg mb-1">Draw an Area</h3>
              <p className="text-sm text-muted-foreground">
                Use the drawing tools on the right to select an area on the map.
                {drawMode === MapDrawMode.RECTANGLE
                  ? " Click and drag to draw a rectangle."
                  : " Click to add points, double-click to complete the polygon."}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Area Statistics */}
      {drawnItems && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Area Size</Label>
                <div className="text-lg font-medium">
                  {areaSize.toFixed(2)} km²
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estimated Properties</Label>
                <div className="text-lg font-medium">
                  {estimatedProperties.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
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
                    <p>Dynamic lists automatically refresh on a schedule to capture new properties</p>
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
            
            <div className="space-y-4 pt-2">
              <h3 className="font-medium">Data Options</h3>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-owner-data"
                  checked={includeOwnerData}
                  onCheckedChange={setIncludeOwnerData}
                />
                <Label htmlFor="include-owner-data">
                  Include Owner Information
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-property-details"
                  checked={includePropertyDetails}
                  onCheckedChange={setIncludePropertyDetails}
                />
                <Label htmlFor="include-property-details">
                  Include Property Details
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!drawnItems || !listName.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Enrichment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
