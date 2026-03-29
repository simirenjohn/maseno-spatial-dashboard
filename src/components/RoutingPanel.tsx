import { useState, useMemo, useCallback } from 'react';
import { Navigation, MapPin, Locate, X, Clock, Route } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LAYER_CONFIGS, type GeoDataState } from '@/hooks/useGeoData';
import type { RouteResult } from '@/lib/routing';

interface RoutingPanelProps {
  geoData: GeoDataState;
  onRoute: (fromLat: number, fromLng: number, toLat: number, toLng: number) => void;
  onClearRoute: () => void;
  onLocateUser: () => void;
  userLocation: [number, number] | null;
  routeResult: RouteResult | null;
  isLocating: boolean;
}

export default function RoutingPanel({
  geoData, onRoute, onClearRoute, onLocateUser, userLocation, routeResult, isLocating,
}: RoutingPanelProps) {
  const [destination, setDestination] = useState('');
  const [showResults, setShowResults] = useState(false);

  // All searchable features with their center coordinates
  const allFeatures = useMemo(() => {
    const results: { name: string; layerId: string; lat: number; lng: number; label: string }[] = [];
    LAYER_CONFIGS.forEach(cfg => {
      const fc = geoData[cfg.id];
      if (!fc) return;
      fc.features.forEach(f => {
        if (!f.geometry) return;
        const p = f.properties || {};
        const name = p[cfg.nameKey] || p.Name || p.name || p.NAME || cfg.label;
        let lat: number, lng: number;
        if (f.geometry.type === 'Point') {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          lng = coords[0]; lat = coords[1];
        } else {
          // Get centroid of polygon
          const bounds = getBounds(f.geometry);
          lat = (bounds.minLat + bounds.maxLat) / 2;
          lng = (bounds.minLng + bounds.maxLng) / 2;
        }
        results.push({ name, layerId: cfg.id, lat, lng, label: cfg.label });
      });
    });
    return results;
  }, [geoData]);

  const searchResults = useMemo(() => {
    if (!destination.trim()) return [];
    const q = destination.toLowerCase();
    return allFeatures.filter(f => f.name.toLowerCase().includes(q)).slice(0, 10);
  }, [destination, allFeatures]);

  const selectDestination = useCallback((feat: typeof allFeatures[0]) => {
    setDestination(feat.name);
    setShowResults(false);
    if (userLocation) {
      onRoute(userLocation[0], userLocation[1], feat.lat, feat.lng);
    }
  }, [userLocation, onRoute]);

  const clearRouting = () => {
    setDestination('');
    onClearRoute();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Get My Location */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs h-8"
        onClick={onLocateUser}
        disabled={isLocating}
      >
        <Locate className="h-3.5 w-3.5 mr-1.5" />
        {isLocating ? 'Locating...' : userLocation ? 'Location Found ✓' : 'Get My Location'}
      </Button>

      {/* Destination search */}
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={destination}
          onChange={e => { setDestination(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search destination..."
          className="pl-8 pr-8 h-8 text-xs"
        />
        {destination && (
          <button onClick={clearRouting} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {searchResults.map((r, i) => (
              <button
                key={`${r.layerId}-${r.name}-${i}`}
                onClick={() => selectDestination(r)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate font-medium">{r.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!userLocation && (
        <p className="text-[10px] text-muted-foreground">Tap "Get My Location" first, then search for a destination.</p>
      )}

      {/* Route result */}
      {routeResult && (
        <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Route className="h-3.5 w-3.5 text-primary" />
            Route Found
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDuration(routeResult.duration)}
            </span>
            <span>{formatDistance(routeResult.distance)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Walking speed: ~5 km/h</p>
        </div>
      )}
    </div>
  );
}

function getBounds(geometry: GeoJSON.Geometry) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const processCoords = (coords: any) => {
    if (typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      coords.forEach(processCoords);
    }
  };
  processCoords((geometry as any).coordinates);
  return { minLat, maxLat, minLng, maxLng };
}
