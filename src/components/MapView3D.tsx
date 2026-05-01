import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LAYER_CONFIGS, type GeoDataState } from '@/hooks/useGeoData';
import type { RouteResult } from '@/lib/routing';

// Heights (in metres) per layer for extrusion
const LAYER_HEIGHTS: Record<string, number> = {
  hostels: 12,
  lecture_halls: 10,
  administration: 9,
  labs: 8,
  religious: 14,
  workers: 6,
  clinic: 8,
};

// OSM raster style — works without API keys
const RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

interface MapView3DProps {
  geoData: GeoDataState;
  layerVisibility: Record<string, boolean>;
  routeResult: RouteResult | null;
  userLocation: [number, number] | null;
  locationAccuracy?: number | null;
  destinationLocation: [number, number] | null;
}

export default function MapView3D({
  geoData,
  layerVisibility,
  routeResult,
  userLocation,
  locationAccuracy,
  destinationLocation,
}: MapView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const styleLoadedRef = useRef(false);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: RASTER_STYLE,
      center: [34.6050, -0.0040],
      zoom: 16,
      pitch: 55,
      bearing: -20,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.touchZoomRotate.enableRotation();

    map.on('load', () => {
      styleLoadedRef.current = true;
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
  }, []);

  // Render building extrusions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      LAYER_CONFIGS.forEach((cfg) => {
        const fc = geoData[cfg.id];
        if (!fc) return;
        const sourceId = `src-${cfg.id}`;
        const fillId = `fill-${cfg.id}`;
        const lineId = `line-${cfg.id}`;

        // Filter to polygons only (skip points)
        const polyFeatures = fc.features.filter(
          (f) =>
            f.geometry &&
            (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        );
        if (polyFeatures.length === 0) return;

        const fcPoly = { type: 'FeatureCollection' as const, features: polyFeatures };
        const height = LAYER_HEIGHTS[cfg.id] ?? 7;
        const visible = layerVisibility[cfg.id] !== false;

        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(fcPoly as any);
        } else {
          map.addSource(sourceId, { type: 'geojson', data: fcPoly as any });
          map.addLayer({
            id: fillId,
            type: 'fill-extrusion',
            source: sourceId,
            paint: {
              'fill-extrusion-color': cfg.color,
              'fill-extrusion-height': height,
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85,
            },
          });
          map.addLayer({
            id: lineId,
            type: 'line',
            source: sourceId,
            paint: { 'line-color': cfg.color, 'line-width': 1.5, 'line-opacity': 0.9 },
          });

          // Click popup with name
          map.on('click', fillId, (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties || {};
            const nameKey = cfg.nameKey;
            const name = p[nameKey] || p.Name || p.name || p.NAME || cfg.label;
            new maplibregl.Popup({ closeButton: true })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:'DM Sans',sans-serif;min-width:160px;">
                  <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${name}</div>
                  <div style="font-size:11px;color:#666;">${cfg.label}</div>
                </div>`
              )
              .addTo(map);
          });
          map.on('mouseenter', fillId, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', fillId, () => (map.getCanvas().style.cursor = ''));
        }

        const vis = visible ? 'visible' : 'none';
        if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis);
        if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis);
      });
    };

    if (styleLoadedRef.current) apply();
    else map.once('load', apply);
  }, [geoData, layerVisibility]);

  // Route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const sourceId = 'route-src';
      const layerId = 'route-line';
      const data = routeResult && routeResult.path.length > 1
        ? {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: routeResult.path.map((p) => [p[1], p[0]]),
            },
            properties: {},
          }
        : { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: [] }, properties: {} };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data as any);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: data as any });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: { 'line-color': '#4285F4', 'line-width': 6, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
      }
    };
    if (styleLoadedRef.current) apply();
    else map.once('load', apply);
  }, [routeResult]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userLocation) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(37,99,235,0.6);';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation[1], userLocation[0]] as LngLatLike)
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setHTML(
            `<b>📍 You are here</b>${
              locationAccuracy != null ? `<br/><span style="font-size:11px;color:#555;">Accuracy: ±${Math.round(locationAccuracy)}m</span>` : ''
            }`
          )
        )
        .addTo(map);
      userMarkerRef.current = marker;
    }
  }, [userLocation, locationAccuracy]);

  // Destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (destinationLocation) {
      destMarkerRef.current = new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat([destinationLocation[1], destinationLocation[0]] as LngLatLike)
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML('<b>🏁 Destination</b>'))
        .addTo(map);
    }
  }, [destinationLocation]);

  return <div ref={containerRef} className="w-full h-full" />;
}
