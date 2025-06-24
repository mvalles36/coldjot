/**
 * PropertyHeatmapLayer Component
 * 
 * This component renders a heatmap overlay on a Leaflet map to visualize property values
 * within drawn regions. It supports customizable appearance, tooltips with value statistics,
 * and is optimized for large datasets.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { useMap } from 'react-leaflet';
import { debounce } from 'lodash';

// Import necessary types
import { PropertyRecord } from '@coldjot/types';

// Define the props interface
interface PropertyHeatmapLayerProps {
  /**
   * Array of property records with location and value data
   */
  properties: PropertyRecord[];
  
  /**
   * Whether the heatmap should be visible
   */
  visible: boolean;
  
  /**
   * Custom gradient colors for the heatmap (default: blue to red)
   */
  gradient?: Record<number, string>;
  
  /**
   * Radius of each heatmap point in pixels (default: 25)
   */
  radius?: number;
  
  /**
   * Maximum intensity value (default: auto-calculated)
   */
  max?: number;
  
  /**
   * Blur factor (default: 15)
   */
  blur?: number;
  
  /**
   * Property field to use for intensity values (default: 'totalValue')
   */
  valueField?: keyof PropertyRecord;
  
  /**
   * Callback when heatmap statistics are calculated
   */
  onStatsCalculated?: (stats: PropertyValueStats) => void;
}

// Define the statistics interface
interface PropertyValueStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
  count: number;
}

/**
 * Component for rendering a property value heatmap on a leaflet map
 */
const PropertyHeatmapLayer: React.FC<PropertyHeatmapLayerProps> = ({
  properties,
  visible = true,
  gradient = {
    0.4: 'blue',
    0.6: 'cyan',
    0.7: 'lime',
    0.8: 'yellow',
    1.0: 'red'
  },
  radius = 25,
  max,
  blur = 15,
  valueField = 'totalValue',
  onStatsCalculated
}) => {
  // Get the Leaflet map instance
  const map = useMap();
  
  // Refs for the heatmap layer and tooltip
  const heatmapLayerRef = useRef<L.HeatLayer | null>(null);
  const tooltipRef = useRef<L.Tooltip | null>(null);
  
  // State for tracking mouse position
  const [mousePosition, setMousePosition] = useState<L.LatLng | null>(null);
  
  // Calculate heatmap points and statistics from properties
  const { heatmapPoints, stats } = useMemo(() => {
    if (!properties || properties.length === 0) {
      return {
        heatmapPoints: [],
        stats: {
          min: 0,
          max: 0,
          avg: 0,
          median: 0,
          total: 0,
          count: 0
        }
      };
    }
    
    // Extract values for statistics
    const validProperties = properties.filter(p => 
      p.location?.coordinates && 
      p[valueField] !== undefined && 
      p[valueField] !== null
    );
    
    if (validProperties.length === 0) {
      return {
        heatmapPoints: [],
        stats: {
          min: 0,
          max: 0,
          avg: 0,
          median: 0,
          total: 0,
          count: 0
        }
      };
    }
    
    // Extract values for statistics calculation
    const values = validProperties.map(p => Number(p[valueField]) || 0);
    values.sort((a, b) => a - b);
    
    const min = values[0];
    const max = values[values.length - 1];
    const total = values.reduce((sum, val) => sum + val, 0);
    const avg = total / values.length;
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];
    
    // Create heatmap points [lat, lng, intensity]
    const points = validProperties.map(property => {
      // Leaflet uses [lat, lng] while GeoJSON uses [lng, lat]
      const lat = property.location?.coordinates[1];
      const lng = property.location?.coordinates[0];
      
      // Normalize the value for intensity (0-1 range)
      const value = Number(property[valueField]) || 0;
      const normalizedValue = max > min ? (value - min) / (max - min) : 0;
      
      return [lat, lng, normalizedValue] as [number, number, number];
    });
    
    return {
      heatmapPoints: points,
      stats: {
        min,
        max,
        avg,
        median,
        total,
        count: validProperties.length
      }
    };
  }, [properties, valueField]);
  
  // Notify parent component of statistics
  useEffect(() => {
    if (onStatsCalculated && stats) {
      onStatsCalculated(stats);
    }
  }, [stats, onStatsCalculated]);
  
  // Create or update the heatmap layer when data or visibility changes
  useEffect(() => {
    // Remove existing layer if it exists
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }
    
    // Create new layer if visible and we have points
    if (visible && heatmapPoints.length > 0) {
      // @ts-ignore - leaflet.heat types are not fully compatible with @types/leaflet
      heatmapLayerRef.current = L.heatLayer(heatmapPoints, {
        radius,
        blur,
        max: max || stats.max,
        gradient,
        minOpacity: 0.4
      }).addTo(map);
    }
    
    // Cleanup on unmount
    return () => {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
    };
  }, [map, visible, heatmapPoints, radius, blur, max, gradient, stats.max]);
  
  // Handle tooltip display
  useEffect(() => {
    // Create tooltip if it doesn't exist
    if (!tooltipRef.current && visible) {
      tooltipRef.current = L.tooltip({
        permanent: false,
        direction: 'top',
        className: 'property-heatmap-tooltip'
      });
    }
    
    // Update tooltip position and content
    const handleMouseMove = debounce((e: L.LeafletMouseEvent) => {
      setMousePosition(e.latlng);
      
      if (tooltipRef.current && visible && heatmapPoints.length > 0) {
        // Find nearby properties (within ~100m)
        const nearbyProperties = findNearbyProperties(e.latlng, properties, 0.1);
        
        if (nearbyProperties.length > 0) {
          // Calculate local statistics
          const localValues = nearbyProperties.map(p => Number(p[valueField]) || 0);
          const localMin = Math.min(...localValues);
          const localMax = Math.max(...localValues);
          const localAvg = localValues.reduce((sum, val) => sum + val, 0) / localValues.length;
          
          // Format currency values
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          });
          
          // Update tooltip content
          tooltipRef.current
            .setLatLng(e.latlng)
            .setContent(`
              <div class="property-heatmap-tooltip-content">
                <strong>Property Values (${nearbyProperties.length} properties)</strong>
                <div>Min: ${formatter.format(localMin)}</div>
                <div>Max: ${formatter.format(localMax)}</div>
                <div>Avg: ${formatter.format(localAvg)}</div>
              </div>
            `)
            .openOn(map);
        } else {
          map.closeTooltip(tooltipRef.current);
        }
      }
    }, 100);
    
    // Add mouse move listener
    if (visible) {
      map.on('mousemove', handleMouseMove);
    }
    
    // Cleanup
    return () => {
      map.off('mousemove', handleMouseMove);
      if (tooltipRef.current) {
        map.closeTooltip(tooltipRef.current);
      }
    };
  }, [map, visible, properties, valueField, heatmapPoints.length]);
  
  // Helper function to find properties near a point
  const findNearbyProperties = (
    point: L.LatLng,
    properties: PropertyRecord[],
    radiusKm: number
  ): PropertyRecord[] => {
    return properties.filter(property => {
      if (!property.location?.coordinates) return false;
      
      // Calculate distance using Haversine formula
      const lat1 = point.lat;
      const lon1 = point.lng;
      const lat2 = property.location.coordinates[1];
      const lon2 = property.location.coordinates[0];
      
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= radiusKm;
    });
  };
  
  // This component doesn't render anything directly, it just manages the Leaflet layers
  return null;
};

export default PropertyHeatmapLayer;
