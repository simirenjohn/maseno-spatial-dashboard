import { useState, useCallback } from 'react';
import { useGeoData, LAYER_CONFIGS } from '@/hooks/useGeoData';
import MapView from '@/components/MapView';
import Sidebar from '@/components/Sidebar';
import UserGuide from '@/components/UserGuide';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, X } from 'lucide-react';

export default function Index() {
  const { data, childTables, loading } = useGeoData();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYER_CONFIGS.map(l => [l.id, true]))
  );
  const [selectedFeature, setSelectedFeature] = useState<{ layerId: string; featureIndex: number } | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Record<string, number[]> | null>(null);

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
      {/* Mobile toggle */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-3 left-3 z-[1001] w-10 h-10 rounded-lg bg-card shadow-lg border border-border flex items-center justify-center"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-[1000] w-80 transform transition-transform duration-300' : 'relative w-80 shrink-0'}
          ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        <Sidebar
          geoData={data}
          layerVisibility={layerVisibility}
          onToggleLayer={toggleLayer}
          onSelectFeature={selectFeature}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[999]" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          geoData={data}
          childTables={childTables}
          layerVisibility={layerVisibility}
          selectedFeature={selectedFeature}
          filteredFeatures={filteredFeatures}
        />
        <UserGuide />
      </div>
    </div>
  );
}
