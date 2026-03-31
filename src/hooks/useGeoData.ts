import { useState, useEffect } from 'react';

export interface LayerConfig {
  id: string;
  label: string;
  color: string;
  file: string;
  visible: boolean;
  nameKey: string;
  typeKey?: string;
}

export const LAYER_CONFIGS: LayerConfig[] = [
  { id: 'hostels', label: 'Hostels', color: '#2563eb', file: '/data/hostels.geojson', visible: true, nameKey: 'Name' },
  { id: 'lecture_halls', label: 'Lecture Halls', color: '#ea580c', file: '/data/lecture_halls.geojson', visible: true, nameKey: 'Name' },
  { id: 'administration', label: 'Administration', color: '#7c3aed', file: '/data/administration.geojson', visible: true, nameKey: 'name', typeKey: 'type' },
  { id: 'labs', label: 'Labs', color: '#059669', file: '/data/labs.geojson', visible: true, nameKey: 'NAME' },
  { id: 'religious', label: 'Religious Centres', color: '#dc2626', file: '/data/religious_centres.geojson', visible: true, nameKey: 'Name' },
  { id: 'workers', label: 'Workers Quarters', color: '#ca8a04', file: '/data/workers_quarter.geojson', visible: true, nameKey: 'name' },
  { id: 'clinic', label: 'University Clinic', color: '#e11d48', file: '/data/university_clinic.geojson', visible: true, nameKey: 'id' },
  { id: 'waste', label: 'Waste Management', color: '#78350f', file: '/data/waste_management.geojson', visible: true, nameKey: 'Waste type' },
  { id: 'wifi', label: 'WiFi Points', color: '#0ea5e9', file: '/data/wifi_points.geojson', visible: true, nameKey: 'wifi_name' },
];

export interface GeoDataState {
  [layerId: string]: GeoJSON.FeatureCollection;
}

export interface ChildTables {
  newLibrary: GeoJSON.FeatureCollection | null;
  pgm: GeoJSON.FeatureCollection | null;
}

export function useGeoData() {
  const [data, setData] = useState<GeoDataState>({});
  const [childTables, setChildTables] = useState<ChildTables>({ newLibrary: null, pgm: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const results: GeoDataState = {};
        const promises = LAYER_CONFIGS.map(async (layer) => {
          const res = await fetch(layer.file);
          const json = await res.json();
          results[layer.id] = json;
        });

        const [nlRes, pgmRes] = await Promise.all([
          fetch('/data/new_library_lecture_halls.geojson').then(r => r.json()),
          fetch('/data/pgm_lecture_rooms.geojson').then(r => r.json()),
          ...promises,
        ]);

        setData(results);
        setChildTables({ newLibrary: nlRes, pgm: pgmRes });
      } catch (err) {
        console.error('Failed to load GeoJSON data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  return { data, childTables, loading };
}
