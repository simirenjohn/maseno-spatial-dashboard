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
  const [selectedFeature, setSelectedFeature] = useState<{ layerId: string; featureIndex: number } | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Record<string, number[]> | null>(null);

  // Routing state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
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

  // One-time high accuracy location
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation([lat, lng]);
        setIsLocating(false);
        toast.success(`Location found! ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      },
      (err) => {
        setIsLocating(false);
        toast.error('Enable location services: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Continuous tracking with high accuracy
  const handleStartTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
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
          destinationLocation={destinationLocation}
        />
        <UserGuide />
      </div>
    </div>
  );
}
