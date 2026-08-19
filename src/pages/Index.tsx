import { useState, useCallback, useEffect, useRef } from 'react';
import { useGeoData, LAYER_CONFIGS } from '@/hooks/useGeoData';
import MapView from '@/components/MapView';
import Sidebar from '@/components/Sidebar';
import UserGuide from '@/components/UserGuide';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, X } from 'lucide-react';

import { RoadGraph, type RouteResult } from '@/lib/routing';
import { toast } from 'sonner';

export default function Index() {
  const { data, childTables, loading } = useGeoData();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYER_CONFIGS.map(l => [l.id, true]))
  );
  const [selectedFeature, setSelectedFeature] = useState<{ layerId: string; featureIndex: number; roomName?: string | null } | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Record<string, number[]> | null>(null);

  // Routing state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<[number, number] | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const roadGraphRef = useRef<RoadGraph | null>(null);

  const routeResult = routes[activeRouteIndex] ?? null;


  // Road network is loaded lazily (only when a route is first requested) so the
  // 320KB graph never costs anything for visitors who just browse the map.
  const roadGraphPromiseRef = useRef<Promise<RoadGraph> | null>(null);

  const getRoadGraph = useCallback(() => {
    if (!roadGraphPromiseRef.current) {
      roadGraphPromiseRef.current = fetch('/data/road_network.geojson')
        .then(r => r.json())
        .then(geojson => {
          const graph = new RoadGraph();
          graph.buildFromGeoJSON(geojson);
          roadGraphRef.current = graph;
          return graph;
        })
        .catch(err => {
          roadGraphPromiseRef.current = null;
          throw err;
        });
    }
    return roadGraphPromiseRef.current;
  }, []);


  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setLayerVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectFeature = useCallback((layerId: string, featureIndex: number, roomName?: string | null) => {
    // Re-select the same feature by giving the object a fresh identity so the
    // map re-zooms and re-highlights even when the pick did not change.
    setSelectedFeature({ layerId, featureIndex, roomName: roomName ?? null });
    setLayerVisibility(prev => ({ ...prev, [layerId]: true }));
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleFilterChange = useCallback((filtered: Record<string, number[]> | null) => {
    setFilteredFeatures(filtered);
  }, []);

  // High-accuracy: sample multiple readings (~6s) and pick the most accurate
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    let best: GeolocationPosition | null = null;
    const started = Date.now();
    const MAX_MS = 8000;
    const TARGET_ACCURACY = 10; // metres

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        const elapsed = Date.now() - started;
        if ((best && best.coords.accuracy <= TARGET_ACCURACY) || elapsed >= MAX_MS) {
          navigator.geolocation.clearWatch(watchId);
          if (best) {
            const lat = best.coords.latitude;
            const lng = best.coords.longitude;
            setUserLocation([lat, lng]);
            setLocationAccuracy(best.coords.accuracy);
            setIsLocating(false);
            toast.success(`Location found (±${Math.round(best.coords.accuracy)}m): ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          } else {
            setIsLocating(false);
            toast.error('Could not get a location fix');
          }
        }
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        setIsLocating(false);
        toast.error('Enable location services: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Hard stop fallback
    setTimeout(() => {
      if (isLocating) {
        navigator.geolocation.clearWatch(watchId);
        if (best) {
          setUserLocation([best.coords.latitude, best.coords.longitude]);
          setLocationAccuracy(best.coords.accuracy);
          toast.success(`Location found (±${Math.round(best.coords.accuracy)}m)`);
        }
        setIsLocating(false);
      }
    }, MAX_MS + 500);
  }, [isLocating]);

  // Continuous tracking with high accuracy
  const handleStartTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationAccuracy(pos.coords.accuracy);
      },
      () => toast.error('Tracking error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const handleStopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const handleRoute = useCallback(async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    let graph = roadGraphRef.current;
    if (!graph) {
      try {
        graph = await getRoadGraph();
      } catch {
        toast.error('Could not load the campus road network. Please try again.');
        return;
      }
    }
    const results = graph.routeAlternatives(fromLat, fromLng, toLat, toLng, 2);
    if (results.length > 0) {
      setRoutes(results);
      setActiveRouteIndex(0);
      setDestinationLocation([toLat, toLng]);
      // Keep the blue dot live while navigating
      if (watchIdRef.current === null && navigator.geolocation) {
        setIsTracking(true);
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            setLocationAccuracy(pos.coords.accuracy);
          },
          () => { /* keep last known position */ },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
      if (results.length === 1) toast.info('Only one walking route is available to this place.');
    } else {
      toast.error('No route found between these locations.');
    }
  }, [getRoadGraph]);



  // "Navigate here" from any building popup: route from the user's position,
  // asking for a location fix first when we do not have one yet.
  const pendingDestRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail as { lat: number; lng: number };
      if (userLocation) {
        handleRoute(userLocation[0], userLocation[1], lat, lng);
      } else {
        pendingDestRef.current = [lat, lng];
        toast.info('Getting your location to start navigation...');
        handleLocateUser();
      }
    };
    window.addEventListener('navigate-to', handler);
    return () => window.removeEventListener('navigate-to', handler);
  }, [userLocation, handleRoute, handleLocateUser]);

  useEffect(() => {
    if (userLocation && pendingDestRef.current) {
      const [lat, lng] = pendingDestRef.current;
      pendingDestRef.current = null;
      handleRoute(userLocation[0], userLocation[1], lat, lng);
    }
  }, [userLocation, handleRoute]);

  const handleClearRoute = useCallback(() => {
    setRouteResult(null);
    setDestinationLocation(null);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Loading campus data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden relative">
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-3 left-3 z-[1001] w-10 h-10 rounded-lg bg-card shadow-lg border border-border flex items-center justify-center"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}

      <div
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-[1000] w-80 transform transition-transform duration-300' : 'relative w-80 shrink-0'}
          ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        <Sidebar
          geoData={data}
          childTables={childTables}
          layerVisibility={layerVisibility}
          onToggleLayer={toggleLayer}
          onSelectFeature={selectFeature}
          onFilterChange={handleFilterChange}
          onRoute={handleRoute}
          onClearRoute={handleClearRoute}
          onLocateUser={handleLocateUser}
          userLocation={userLocation}
          locationAccuracy={locationAccuracy}
          routeResult={routeResult}
          isLocating={isLocating}
          isTracking={isTracking}
          onStartTracking={handleStartTracking}
          onStopTracking={handleStopTracking}
        />
      </div>

      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[999]" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 relative">
        <MapView
          geoData={data}
          childTables={childTables}
          layerVisibility={layerVisibility}
          selectedFeature={selectedFeature}
          filteredFeatures={filteredFeatures}
          routeResult={routeResult}
          userLocation={userLocation}
          locationAccuracy={locationAccuracy}
          destinationLocation={destinationLocation}
        />

        <UserGuide />
      </div>
    </div>
  );
}
