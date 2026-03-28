import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAYER_CONFIGS, type GeoDataState, type ChildTables } from '@/hooks/useGeoData';

const BASEMAPS = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors', label: 'OSM' },
  voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© CartoDB', label: 'Voyager' },
  positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CartoDB', label: 'Light' },
};

function createSvgIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

function getPopupContent(
  feature: GeoJSON.Feature,
  layerId: string,
  childTables: ChildTables
): string {
  const p = feature.properties || {};

  if (layerId === 'clinic') {
    return `<div class="campus-popup">
      <h3>Maseno University Health Services</h3>
      <span class="badge" style="background:#fce4ec;color:#c62828;">Clinic</span>
      <table>
        <tr><td>Hours</td><td>24 Hours, 7 Days a Week</td></tr>
        <tr><td>Phone</td><td>${p.PHONE || '0776 388 439'}</td></tr>
        <tr><td>Visiting AM</td><td>${p.visit_AM || '6:00AM–7:00AM'}</td></tr>
        <tr><td>Visiting PM</td><td>${p['visit_PM 1'] || '1:00PM–2:00PM'}</td></tr>
        <tr><td>Visiting Eve</td><td>${p['visit_PM 2'] || '5:00PM–6:00PM'}</td></tr>
        <tr><td>Population</td><td>Staff, Dependants, Students, Community</td></tr>
        <tr><td>Services</td><td style="font-size:11px;">${p.SERVICES || ''}</td></tr>
        <tr><td>Client Rights</td><td style="font-size:11px;">Quality Service, Right to Information, Complain/Compliment, Privacy, Access</td></tr>
        <tr><td>Feedback</td><td>Direct Feedback, Suggestion Box, Exit Interviews</td></tr>
      </table>
    </div>`;
  }

  const layerCfg = LAYER_CONFIGS.find(l => l.id === layerId);
  const color = layerCfg?.color || '#666';
  const name = p[layerCfg?.nameKey || 'Name'] || p.Name || p.name || p.NAME || 'Unknown';

  const badgeColors: Record<string, string> = {
    hostels: 'background:#e3f2fd;color:#1565c0;',
    lecture_halls: 'background:#fff3e0;color:#e65100;',
    administration: 'background:#f3e5f5;color:#6a1b9a;',
    labs: 'background:#e8f5e9;color:#2e7d32;',
    religious: 'background:#fce4ec;color:#c62828;',
    workers: 'background:#fff8e1;color:#f57f17;',
    clinic: 'background:#fce4ec;color:#c62828;',
  };

  let content = `<div class="campus-popup">
    <h3>${name}</h3>
    <span class="badge" style="${badgeColors[layerId] || ''}">${layerCfg?.label || layerId}</span>`;

  if (layerId === 'hostels') {
    content += `<table>
      <tr><td>Gender</td><td>${p.Gender || 'N/A'}</td></tr>
      <tr><td>Price (KES)</td><td>${p.Price ? p.Price.toLocaleString() : 'N/A'}</td></tr>
      <tr><td>Capacity/Room</td><td>${p['Capacity Per Room'] || 'N/A'}</td></tr>
    </table>`;
  } else if (layerId === 'lecture_halls') {
    const buildingId = p.building_id;
    // Check for New Library (building_id = 0)
    if (buildingId === 0 && childTables.newLibrary) {
      content += `<p style="font-size:12px;color:#666;margin:4px 0;">Multi-storey building with lecture rooms</p>`;
      content += buildRoomTable(childTables.newLibrary, 'New Library');
    } else if (buildingId === 11 && childTables.pgm) {
      content += `<p style="font-size:12px;color:#666;margin:4px 0;">Multi-storey building with lecture rooms</p>`;
      content += buildRoomTable(childTables.pgm, 'Prof. George Magoha');
    } else {
      content += `<table>
        <tr><td>Lecture Capacity</td><td>${p['LECTURE CAPACITY'] ?? 'N/A'}</td></tr>
        <tr><td>Exam Capacity</td><td>${p['EXAMINATION CAPACITY'] ?? 'N/A'}</td></tr>
        <tr><td>Current Seats</td><td>${p['CURRENT NUMBER OF SEATS'] ?? 'N/A'}</td></tr>
      </table>`;
    }
  } else if (layerId === 'administration') {
    content += `<table>
      <tr><td>Type</td><td>${p.type || 'N/A'}</td></tr>
    </table>`;
  } else if (layerId === 'labs') {
    content += `<table>
      <tr><td>Capacity</td><td>${p.CAPACITY || 'N/A'}</td></tr>
    </table>`;
  }

  content += '</div>';
  return content;
}

function buildRoomTable(childTable: GeoJSON.FeatureCollection, buildingName: string): string {
  const features = childTable.features;
  const roomNameKey = features[0]?.properties?.lecture_room_name !== undefined ? 'lecture_room_name' : 'LECTURE ROOM NAME';
  const floorKey = 'floor_number';
  const lecCapKey = features[0]?.properties?.lecture_capacity !== undefined ? 'lecture_capacity' : 'LECTURE CAPACITY';
  const examCapKey = features[0]?.properties?.examination_capacity !== undefined ? 'examination_capacity' : 'EXAMINATION CAPACITY';

  const floors = new Map<number, typeof features>();
  features.forEach(f => {
    const floor = f.properties?.[floorKey] ?? 0;
    if (!floors.has(floor)) floors.set(floor, []);
    floors.get(floor)!.push(f);
  });

  const sortedFloors = [...floors.entries()].sort((a, b) => a[0] - b[0]);

  let html = '<div class="room-table">';
  sortedFloors.forEach(([floor, rooms]) => {
    html += `<div class="floor-header">Floor ${floor}</div>`;
    html += `<table><tr><th>Room</th><th>Lec. Cap</th><th>Exam Cap</th></tr>`;
    rooms.forEach(r => {
      const rp = r.properties || {};
      html += `<tr>
        <td style="text-align:left;font-weight:500;">${rp[roomNameKey] || 'N/A'}</td>
        <td>${rp[lecCapKey] ?? '—'}</td>
        <td>${rp[examCapKey] ?? '—'}</td>
      </tr>`;
    });
    html += '</table>';
  });
  html += '</div>';
  return html;
}

interface MapViewProps {
  geoData: GeoDataState;
  childTables: ChildTables;
  layerVisibility: Record<string, boolean>;
  selectedFeature: { layerId: string; featureIndex: number } | null;
  filteredFeatures: Record<string, number[]> | null;
}

export default function MapView({ geoData, childTables, layerVisibility, selectedFeature, filteredFeatures }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const baseTileRef = useRef<L.TileLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-0.0040, 34.6050],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const baseTile = L.tileLayer(BASEMAPS.osm.url, { attribution: BASEMAPS.osm.attr, maxZoom: 19 });
    baseTile.addTo(map);
    baseTileRef.current = baseTile;

    mapRef.current = map;

    // Add basemap switcher
    const BasemapControl = L.Control.extend({
      options: { position: 'topright' as L.ControlPosition },
      onAdd() {
        const container = L.DomUtil.create('div', 'basemap-control');
        L.DomEvent.disableClickPropagation(container);
        const keys = Object.keys(BASEMAPS) as (keyof typeof BASEMAPS)[];
        keys.forEach((key, i) => {
          const btn = L.DomUtil.create('button', i === 0 ? 'active' : '', container);
          btn.title = BASEMAPS[key].label;
          btn.style.background = key === 'osm' ? '#ddd' : key === 'voyager' ? '#e8dcc8' : '#f0f0f0';
          btn.innerHTML = `<span style="font-size:9px;font-weight:700;">${BASEMAPS[key].label.charAt(0)}</span>`;
          btn.onclick = () => {
            baseTileRef.current?.remove();
            const newTile = L.tileLayer(BASEMAPS[key].url, { attribution: BASEMAPS[key].attr, maxZoom: 19 });
            newTile.addTo(map);
            baseTileRef.current = newTile;
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          };
        });
        return container;
      },
    });
    new BasemapControl().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Object.keys(geoData).length) return;

    // Clear existing layers
    Object.values(layerGroupsRef.current).forEach(lg => lg.clearLayers());

    LAYER_CONFIGS.forEach(cfg => {
      const fc = geoData[cfg.id];
      if (!fc) return;

      if (!layerGroupsRef.current[cfg.id]) {
        layerGroupsRef.current[cfg.id] = L.layerGroup();
      }
      const group = layerGroupsRef.current[cfg.id];
      group.clearLayers();

      const visible = layerVisibility[cfg.id] !== false;
      const filteredIndices = filteredFeatures?.[cfg.id];

      fc.features.forEach((feature, idx) => {
        if (!feature.geometry) return;
        if (filteredIndices && !filteredIndices.includes(idx)) return;

        const geomType = feature.geometry.type;

        if (geomType === 'Point') {
          const coords = (feature.geometry as GeoJSON.Point).coordinates;
          const marker = L.marker([coords[1], coords[0]], { icon: createSvgIcon(cfg.color) });
          marker.bindPopup(() => getPopupContent(feature, cfg.id, childTables), { maxWidth: 380 });
          group.addLayer(marker);
        } else {
          const geoLayer = L.geoJSON(feature, {
            style: {
              color: cfg.color,
              weight: 2,
              fillColor: cfg.color,
              fillOpacity: 0.25,
              opacity: 0.8,
            },
          });
          geoLayer.bindPopup(() => getPopupContent(feature, cfg.id, childTables), { maxWidth: 380 });
          group.addLayer(geoLayer);
        }
      });

      if (visible) {
        group.addTo(map);
      } else {
        group.remove();
      }
    });
  }, [geoData, childTables, layerVisibility, filteredFeatures]);

  // Handle selected feature
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFeature) return;

    const { layerId, featureIndex } = selectedFeature;
    const fc = geoData[layerId];
    if (!fc) return;
    const feature = fc.features[featureIndex];
    if (!feature || !feature.geometry) return;

    const cfg = LAYER_CONFIGS.find(l => l.id === layerId);
    if (!cfg) return;

    // Ensure layer is visible
    const group = layerGroupsRef.current[layerId];
    if (group && !map.hasLayer(group)) {
      group.addTo(map);
    }

    // Zoom to feature
    const tempLayer = L.geoJSON(feature);
    const bounds = tempLayer.getBounds();
    map.flyToBounds(bounds, { maxZoom: 18, padding: [50, 50], duration: 0.8 });

    // Open popup at center
    setTimeout(() => {
      const center = bounds.getCenter();
      L.popup({ maxWidth: 380 })
        .setLatLng(center)
        .setContent(getPopupContent(feature, layerId, childTables))
        .openOn(map);
    }, 900);
  }, [selectedFeature, geoData, childTables]);

  // Zoom to filtered features
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filteredFeatures) return;

    const allBounds: L.LatLngBounds[] = [];
    Object.entries(filteredFeatures).forEach(([layerId, indices]) => {
      const fc = geoData[layerId];
      if (!fc) return;
      indices.forEach(idx => {
        const f = fc.features[idx];
        if (f?.geometry) {
          allBounds.push(L.geoJSON(f).getBounds());
        }
      });
    });

    if (allBounds.length > 0) {
      let combined = allBounds[0];
      allBounds.slice(1).forEach(b => combined.extend(b));
      map.flyToBounds(combined, { maxZoom: 17, padding: [40, 40], duration: 0.8 });
    }
  }, [filteredFeatures, geoData]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
