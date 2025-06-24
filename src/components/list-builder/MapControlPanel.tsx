/**
 * MapControlPanel Component
 * 
 * This component consolidates various map controls, including drawing tools,
 * heatmap toggles, and polygon filters, providing a centralized control panel
 * for the map interface. It uses shadcn/ui components for consistent styling
 * and is designed to be responsive across different screen sizes.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MapDrawMode } from '@coldjot/types'; // Assuming MapDrawMode is defined here

// Define the props interface for the MapControlPanel
interface PropertyValueStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
  count: number;
}

interface MapControlPanelProps {
  /**
   * Current active draw mode (e.g., 'rectangle', 'polygon')
   */
  activeDrawMode: MapDrawMode | null;
  /**
   * Callback function when the draw mode changes
   */
  onDrawModeChange: (mode: MapDrawMode | null) => void;
  /**
   * Whether the property heatmap is currently active
   */
  isHeatmapActive: boolean;
  /**
   * Callback function to toggle the heatmap visibility
   */
  onToggleHeatmap: (active: boolean) => void;
  /**
   * Property value statistics to display when heatmap is active
   */
  propertyStats?: PropertyValueStats;
  /**
   * Callback for applying polygon filters (placeholder)
   */
  onApplyPolygonFilter?: () => void;
  /**
   * Callback for clearing polygon filters (placeholder)
   */
  onClearPolygonFilter?: () => void;
}

/**
 * MapControlPanel component for managing map-related features.
 */
const MapControlPanel: React.FC<MapControlPanelProps> = ({
  activeDrawMode,
  onDrawModeChange,
  isHeatmapActive,
  onToggleHeatmap,
  propertyStats,
  onApplyPolygonFilter,
  onClearPolygonFilter,
}) => {
  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="w-full md:w-80 lg:w-96 shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-lg font-semibold">Map Controls</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {/* Drawing Tools Section */}
        <div>
          <h3 className="text-md font-medium mb-3">Drawing Tools</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={activeDrawMode === MapDrawMode.RECTANGLE ? 'default' : 'outline'}
              onClick={() => onDrawModeChange(MapDrawMode.RECTANGLE)}
              className="w-full"
            >
              Draw Rectangle
            </Button>
            <Button
              variant={activeDrawMode === MapDrawMode.POLYGON ? 'default' : 'outline'}
              onClick={() => onDrawModeChange(MapDrawMode.POLYGON)}
              className="w-full"
            >
              Draw Polygon
            </Button>
            <Button
              variant="outline"
              onClick={() => onDrawModeChange(null)}
              disabled={activeDrawMode === null}
              className="col-span-2"
            >
              Clear Drawing
            </Button>
          </div>
        </div>

        <Separator />

        {/* Heatmap Section */}
        <div>
          <h3 className="text-md font-medium mb-3">Property Heatmap</h3>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="heatmap-toggle">Show Value Heatmap</Label>
            <Switch
              id="heatmap-toggle"
              checked={isHeatmapActive}
              onCheckedChange={onToggleHeatmap}
            />
          </div>
          {isHeatmapActive && propertyStats && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
              <p className="font-semibold mb-1">Property Value Stats:</p>
              <p>Min: {formatCurrency(propertyStats.min)}</p>
              <p>Max: {formatCurrency(propertyStats.max)}</p>
              <p>Avg: {formatCurrency(propertyStats.avg)}</p>
              <p>Total Properties: {propertyStats.count}</p>
            </div>
          )}
          {isHeatmapActive && !propertyStats && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              No property data available for heatmap.
            </p>
          )}
        </div>

        <Separator />

        {/* Polygon Filters Section (Placeholder) */}
        <div>
          <h3 className="text-md font-medium mb-3">Polygon Filters</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              (Future: Add controls for filtering properties within drawn polygons, e.g., by year built, property type)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onApplyPolygonFilter} className="flex-1" disabled>
                Apply Filters
              </Button>
              <Button variant="outline" onClick={onClearPolygonFilter} className="flex-1" disabled>
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapControlPanel;
