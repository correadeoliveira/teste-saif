import React, { useEffect, useRef } from "react";
import { CrimeMap } from "../../map/CrimeMap.js";
import { heatmapLoader } from "../../data/HeatmapLoader.js";

// We keep these imports for types or just use global L
declare global {
  interface Window {
    L: any;
  }
}

interface RealMapProps {
  activeTypes: Set<string>;
  activeLayers: Set<string>; // changed from activeLayer string
  activeGroups: Set<string>;
  activeTimes: Set<string>;
  blockedSafePoints?: Set<string>;
  customSafePoints?: any[];
  customRiskAreas?: any[];
}

export function RealMap({ 
  activeTypes, activeLayers, activeGroups, activeTimes,
  blockedSafePoints = new Set(), customSafePoints = [], customRiskAreas = []
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crimeMapRef = useRef<any>(null);

  useEffect(() => {
    if (mapContainerRef.current && !crimeMapRef.current) {
      crimeMapRef.current = new CrimeMap();
      crimeMapRef.current.init();
    }

    return () => {
      if (crimeMapRef.current?.map) {
        crimeMapRef.current.map.remove();
        crimeMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (crimeMapRef.current) {
      const filters = {
        types: Array.from(activeTypes).map(t => t.toLowerCase()),
        period: activeTimes.size === 1 ? Array.from(activeTimes)[0].toLowerCase() : 'all',
      };
      crimeMapRef.current.applyFilters(filters);

      crimeMapRef.current.showHeatmap(activeLayers.has("heat"));
      crimeMapRef.current.markerManager.showSafePoints(activeLayers.has("safe"));
      
      if (activeLayers.has("luz")) {
        crimeMapRef.current.lightingLayer.show();
      } else {
        crimeMapRef.current.lightingLayer.hide();
      }
      
      if (activeLayers.has("bus")) {
        crimeMapRef.current.markerManager.showTransport(true);
      } else {
        crimeMapRef.current.markerManager.showTransport(false);
      }

      crimeMapRef.current.updateCustomPoints(blockedSafePoints, customSafePoints, customRiskAreas);
    }
  }, [activeTypes, activeLayers, activeGroups, activeTimes, blockedSafePoints, customSafePoints, customRiskAreas]);

  return (
    <div 
      id="map" 
      ref={mapContainerRef} 
      className="absolute inset-0 w-full h-full z-0" 
      style={{ backgroundColor: '#000c01' }}
    />
  );
}
