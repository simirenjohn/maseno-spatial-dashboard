import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useGeoData, LAYER_CONFIGS } from '@/hooks/useGeoData';
import MapView from '@/components/MapView';
import Sidebar from '@/components/Sidebar';
import UserGuide from '@/components/UserGuide';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, X, Box, Map as MapIcon } from 'lucide-react';

const MapView3D = lazy(() => import('@/components/MapView3D'));

import { RoadGraph, type RouteResult } from '@/lib/routing';
import { toast } from 'sonner';

export default function Index() {
  const { data, childTables, loading } = useGeoData();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYER_CONFIGS.map(l => [l.id, true]))
  );
  const [selectedFeature, setSelectedFeature] = useState<{ layerId: string; featureIndex: number } | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Record<string, number[]> | null>(null);

  // Routing state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<[number, number] | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const roadGraphRef = useRef<RoadGraph | null>(null);

  // Load road network
  useEffect(() => {
    fetch('/data/road_network.geojson')
      .then(r => r.json())
      .then(geojson => {
        const graph = new RoadGraph();
        graph.buildFromGeoJSON(geojson);
        roadGraphRef.current = graph;
      })
      .catch(err => console.error('Failed to load road network:', err));
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

  const selectFeature = useCallback((layerId: string, featureIndex: number) => {
    setSelectedFeature({ layerId, featureIndex });
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

  const handleRoute = useCallback((fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    const graph = roadGraphRef.current;
    if (!graph) {
      toast.error('Road network not loaded yet. Please wait...');
      return;
    }
    const result = graph.route(fromLat, fromLng, toLat, toLng);
    if (result) {
      setRouteResult(result);
      setDestinationLocation([toLat, toLng]);
    } else {
      toast.error('No route found between these locations.');
    }
  }, []);

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
        {viewMode === '2d' ? (
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
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Loading 3D view...</p>
                </div>
              </div>
            }
          >
            <MapView3D
              geoData={data}
              layerVisibility={layerVisibility}
              routeResult={routeResult}
              userLocation={userLocation}
              locationAccuracy={locationAccuracy}
              destinationLocation={destinationLocation}
            />
          </Suspense>
        )}

        {/* 2D / 3D toggle */}
        <button
          onClick={() => {
            if (viewMode === '2d' && !(window as any).WebGLRenderingContext) {
              return;
            }
            setViewMode((m) => (m === '2d' ? '3d' : '2d'));
          }}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 px-3 h-9 rounded-lg bg-card shadow-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
          title={viewMode === '2d' ? 'Switch to 3D' : 'Switch to 2D'}
        >
          {viewMode === '2d' ? <Box className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          {viewMode === '2d' ? '3D' : '2D'}
        </button>

        <UserGuide />
      </div>
    </div>
  );
}
