import { useEffect, useRef } from "react";
import { CrimeMap } from "../../map/CrimeMap.js";

interface RealMapProps {
  activeTypes: Set<string>;
  activeLayers: Set<string>;
  activeTimes: Set<string>;
  blockedSafePoints?: Set<string>;
  customSafePoints?: any[];
  customRiskAreas?: any[];
}

export function RealMap({ 
  activeTypes, activeLayers, activeTimes,
  blockedSafePoints = new Set(), customSafePoints = [], customRiskAreas = []
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crimeMapRef = useRef<CrimeMap | null>(null);
  const period = activeTimes.size === 1 ? Array.from(activeTimes)[0] : "all";

  useEffect(() => {
    if (mapContainerRef.current && !crimeMapRef.current) {
      crimeMapRef.current = new CrimeMap();
      crimeMapRef.current.init();
    }

    return () => {
      if (crimeMapRef.current?.map) {
        crimeMapRef.current.destroy();
        crimeMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    crimeMapRef.current?.applyFilters({ types: Array.from(activeTypes), period });
  }, [activeTypes, period]);

  useEffect(() => {
    const map = crimeMapRef.current;
    if (!map) return;
    map.showHeatmap(activeLayers.has("heat"));
    map.markerManager.showSafePoints(activeLayers.has("safe"));
    map.markerManager.showTransport(activeLayers.has("bus"));
    if (activeLayers.has("luz")) map.lightingLayer.show();
    else map.lightingLayer.hide();
    if (activeLayers.has("flow")) map.flowLayer.show(period);
    else map.flowLayer.hide();
    if (activeLayers.has("routes")) map.routeManager.show();
    else map.routeManager.hide();
  }, [activeLayers, period]);

  useEffect(() => {
    crimeMapRef.current?.updateCustomPoints(blockedSafePoints, customSafePoints, customRiskAreas);
  }, [blockedSafePoints, customSafePoints, customRiskAreas]);

  return (
    <div 
      id="map" 
      ref={mapContainerRef} 
      className="absolute inset-0 w-full h-full z-0" 
      style={{ backgroundColor: '#000c01' }}
    />
  );
}
