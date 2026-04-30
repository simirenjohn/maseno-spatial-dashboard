import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAYER_CONFIGS, type GeoDataState, type ChildTables } from '@/hooks/useGeoData';
import type { RouteResult } from '@/lib/routing';
import ReportIssueModal from '@/components/ReportIssueModal';

const BASEMAPS = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors', label: 'OSM' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics', label: 'Satellite' },
};

// Photo mapping for buildings
const BUILDING_PHOTOS: Record<string, string> = {
  'Administarion office': '/images/administration_office.jpg',
  'NEW LIBRARY': '/images/new_library.jpg',
  'CHEMISTRY LAB': '/images/chemistry_lab.jpeg',
};

// Equator 1 hostel slideshow photos
const EQUATOR_1_PHOTOS = [
  { src: '/images/equator_1_room.jpeg', alt: 'Equator 1 Room' },
  { src: '/images/equator_1_bedding.jpeg', alt: 'Equator 1 Bedding' },
  { src: '/images/equator_1_shelf.jpeg', alt: 'Equator 1 Shelf/Storage' },
  { src: '/images/equator_1_room2.jpeg', alt: 'Equator 1 Study Area' },
  { src: '/images/equator_1_bedding2.jpeg', alt: 'Equator 1 Bunk Beds' },
  { src: '/images/equator_1_shelf2.jpeg', alt: 'Equator 1 Storage Cabinet' },
];

const CLINIC_PHOTO = '/images/university_clinic.jpeg';
const NL5_PHOTO = '/images/nl5_lecture_hall.jpeg';

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

function createWasteIcon(condition: string) {
  const colors: Record<string, string> = {
    'empty': '#22c55e',
    'partial': '#f59e0b',
    'full': '#ef4444',
    'overflowing': '#7f1d1d',
  };
  const color = colors[condition?.toLowerCase()] || '#78350f';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" width="24" height="28">
    <rect x="3" y="6" width="18" height="18" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
    <rect x="7" y="2" width="10" height="6" rx="1" fill="${color}" stroke="white" stroke-width="1"/>
    <line x1="8" y1="11" x2="8" y2="21" stroke="white" stroke-width="1.5"/>
    <line x1="12" y1="11" x2="12" y2="21" stroke="white" stroke-width="1.5"/>
    <line x1="16" y1="11" x2="16" y2="21" stroke="white" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 28], iconAnchor: [12, 28], popupAnchor: [0, -28] });
}

function createWifiIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
    <circle cx="14" cy="14" r="13" fill="#0ea5e9" stroke="white" stroke-width="1.5"/>
    <path d="M14 20a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill="white"/>
    <path d="M10 17.5a5.5 5.5 0 018 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M7 14.5a9 9 0 0114 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] });
}

function createParkingIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
    <rect x="2" y="2" width="24" height="24" rx="4" fill="#6366f1" stroke="white" stroke-width="1.5"/>
    <text x="14" y="20" text-anchor="middle" font-size="18" font-weight="bold" fill="white">P</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] });
}

function photoHtml(src: string, alt: string): string {
  return `<img src="${src}" alt="${alt}" style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;margin:8px 0 4px;" onerror="this.style.display='none'" />`;
}

function slideshowHtml(photos: { src: string; alt: string }[], slideshowId: string): string {
  if (photos.length === 0) return '';
  return `
    <div id="${slideshowId}" style="position:relative;width:100%;margin:8px 0 4px;">
      ${photos.map((p, i) => `
        <img src="${p.src}" alt="${p.alt}" 
          class="slideshow-img" 
          data-slide-idx="${i}"
          style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;display:${i === 0 ? 'block' : 'none'};" 
          onerror="this.style.display='none'" />
      `).join('')}
      <div style="display:flex;justify-content:center;gap:4px;margin-top:4px;">
        ${photos.map((_, i) => `
          <button onclick="(function(){
            var c=document.getElementById('${slideshowId}');
            c.querySelectorAll('.slideshow-img').forEach(function(img){img.style.display='none';});
            c.querySelector('[data-slide-idx=\\'${i}\\']').style.display='block';
            c.querySelectorAll('.slide-dot').forEach(function(d,j){d.style.background=j===${i}?'#2563eb':'#ccc';});
          })()" class="slide-dot" style="width:8px;height:8px;border-radius:50%;border:none;cursor:pointer;background:${i === 0 ? '#2563eb' : '#ccc'};"></button>
        `).join('')}
      </div>
    </div>`;
}

function reportButtonHtml(facilityName: string, facilityType: string): string {
  const escapedName = facilityName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<button onclick="window.dispatchEvent(new CustomEvent('open-report',{detail:{name:'${escapedName}',type:'${facilityType}'}}))" style="margin-top:8px;width:100%;padding:6px 12px;font-size:12px;font-weight:600;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">⚠️ Report Issue</button>`;
}

function getPopupContent(
  feature: GeoJSON.Feature,
  layerId: string,
  childTables: ChildTables
): string {
  const p = feature.properties || {};

  if (layerId === 'clinic') {
    return `<div class="campus-popup">
      ${photoHtml(CLINIC_PHOTO, 'University Clinic')}
      <h3>Maseno University Health Services</h3>
      <span class="badge" style="background:#fce4ec;color:#c62828;">Clinic</span>
      <table>
        <tr><td>Hours</td><td>24 Hours, 7 Days a Week</td></tr>
        <tr><td>Phone</td><td>${p.PHONE || '0776 388 439'}</td></tr>
        <tr><td>Visiting AM</td><td>${p.visit_AM || '6:00AM–7:00AM'}</td></tr>
        <tr><td>Visiting PM</td><td>${p['visit_PM 1'] || '1:00PM–2:00PM'}</td></tr>
        <tr><td>Visiting Eve</td><td>${p['visit_PM 2'] || '5:00PM–6:00PM'}</td></tr>
        <tr><td>Population</td><td>Staff, Dependants, Students, Community</td></tr>
        <tr><td>Services</td><td style="font-size:11px;">${p.SERVICES || 'Outpatient, Inpatient, HIV Care, Laboratory, Pharmacy, Counselling, Antenatal, MCH, Family Planning, Maternity, Emergency, Ambulance'}</td></tr>
      </table>
      ${reportButtonHtml('Maseno University Health Services', 'clinic')}
    </div>`;
  }

  if (layerId === 'waste') {
    const condColor: Record<string, string> = { 'empty': '#22c55e', 'partial': '#f59e0b', 'full': '#ef4444', 'overflowing': '#7f1d1d' };
    const cond = (p.Condition || 'unknown').toLowerCase();
    return `<div class="campus-popup">
      <h3>🗑️ ${p['Waste type'] || 'Waste Point'}</h3>
      <span class="badge" style="background:#fef3c7;color:#78350f;">Waste Management</span>
      <table>
        <tr><td>Type</td><td>${p['Waste type'] || 'N/A'}</td></tr>
        <tr><td>Condition</td><td><span style="color:${condColor[cond] || '#666'};font-weight:600;text-transform:capitalize;">${p.Condition || 'N/A'}</span></td></tr>
      </table>
      ${reportButtonHtml(p['Waste type'] || 'Waste Point', 'waste')}
    </div>`;
  }

  if (layerId === 'wifi') {
    return `<div class="campus-popup">
      <h3>📶 ${p.wifi_name || 'WiFi Point'}</h3>
      <span class="badge" style="background:#e0f2fe;color:#0369a1;">WiFi</span>
      <table>
        <tr><td>Network</td><td>${p.wifi_name || 'N/A'}</td></tr>
        <tr><td>Password</td><td><code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:12px;">${p.PASSWORD || 'N/A'}</code></td></tr>
      </table>
      ${reportButtonHtml(p.wifi_name || 'WiFi Point', 'wifi')}
    </div>`;
  }

  if (layerId === 'parking') {
    return `<div class="campus-popup">
      <h3>🅿️ Parking Spot</h3>
      <span class="badge" style="background:#eef2ff;color:#4338ca;">Parking</span>
      <table>
        <tr><td>Purpose</td><td>${p.PURPOSE || 'Parking space'}</td></tr>
        <tr><td>ID</td><td>#${p.fid || 'N/A'}</td></tr>
      </table>
      ${reportButtonHtml(p.PURPOSE || 'Parking Spot', 'parking')}
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

  const buildingPhoto = BUILDING_PHOTOS[name] || '';
  // Check for Equator 1 hostel slideshow
  const isEquator1 = typeof name === 'string' && name.toLowerCase().includes('equator') && name.includes('1');

  let content = `<div class="campus-popup">`;
  if (isEquator1) {
    content += slideshowHtml(EQUATOR_1_PHOTOS, 'eq1-slideshow');
  } else if (buildingPhoto) {
    content += photoHtml(buildingPhoto, name);
  }
  content += `<h3>${name}</h3>
    <span class="badge" style="${badgeColors[layerId] || ''}">${layerCfg?.label || layerId}</span>`;

  if (layerId === 'hostels') {
    content += `<table>
      <tr><td>Gender</td><td>${p.Gender || 'N/A'}</td></tr>
      <tr><td>Price (KES)</td><td>${p.Price ? p.Price.toLocaleString() : 'N/A'}</td></tr>
      <tr><td>Capacity/Room</td><td>${p['Capacity Per Room'] || 'N/A'}</td></tr>
    </table>`;
  } else if (layerId === 'lecture_halls') {
    const buildingId = p.building_id;
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
    content += `<table><tr><td>Type</td><td>${p.type || 'N/A'}</td></tr></table>`;
  } else if (layerId === 'labs') {
    content += `<table><tr><td>Capacity</td><td>${p.CAPACITY || 'N/A'}</td></tr></table>`;
  }

  content += reportButtonHtml(name, layerId);
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
      const roomName = rp[roomNameKey] || 'N/A';
      const isNL5 = roomName === 'NL 5';
      html += `<tr>
        <td style="text-align:left;font-weight:500;">${roomName}${isNL5 ? ' 📷' : ''}</td>
        <td>${rp[lecCapKey] ?? '—'}</td>
        <td>${rp[examCapKey] ?? '—'}</td>
      </tr>`;
      if (isNL5) {
        html += `<tr><td colspan="3" style="padding:2px 4px;">${photoHtml(NL5_PHOTO, 'NL 5 Lecture Hall')}</td></tr>`;
      }
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
  routeResult: RouteResult | null;
  userLocation: [number, number] | null;
  destinationLocation: [number, number] | null;
}

export default function MapView({
  geoData, childTables, layerVisibility, selectedFeature, filteredFeatures,
  routeResult, userLocation, destinationLocation,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFacility, setReportFacility] = useState({ name: '', type: '' });

  // Listen for report button clicks from popups
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReportFacility({ name: detail.name, type: detail.type });
      setReportOpen(true);
    };
    window.addEventListener('open-report', handler);
    return () => window.removeEventListener('open-report', handler);
  }, []);

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
    routeLayerRef.current.addTo(map);

    // Load study area boundaries
    const studyAreaFiles = [
      '/data/college_campus_study_area.geojson',
      '/data/niles_study_area.geojson',
      '/data/siriba_study_area.geojson',
    ];
    studyAreaFiles.forEach(file => {
      fetch(file)
        .then(r => r.json())
        .then(geojson => {
          L.geoJSON(geojson, {
            style: { color: '#dc2626', weight: 2.5, fillOpacity: 0, opacity: 0.9, dashArray: '6, 4' },
          }).addTo(map);
        })
        .catch(err => console.warn('Study area load error:', err));
    });

    mapRef.current = map;

    // Basemap switcher
    const BasemapControl = L.Control.extend({
      options: { position: 'topright' as L.ControlPosition },
      onAdd() {
        const container = L.DomUtil.create('div', 'basemap-control');
        L.DomEvent.disableClickPropagation(container);
        const keys = Object.keys(BASEMAPS) as (keyof typeof BASEMAPS)[];
        keys.forEach((key, i) => {
          const btn = L.DomUtil.create('button', i === 0 ? 'active' : '', container);
          btn.title = BASEMAPS[key].label;
          btn.style.background = key === 'osm' ? '#ddd' : '#1e293b';
          btn.style.color = key === 'osm' ? '#000' : '#fff';
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

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Object.keys(geoData).length) return;

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
          let icon: L.DivIcon;
          if (cfg.id === 'waste') {
            icon = createWasteIcon(feature.properties?.Condition);
          } else if (cfg.id === 'wifi') {
            icon = createWifiIcon();
          } else if (cfg.id === 'parking') {
            icon = createParkingIcon();
          } else {
            icon = createSvgIcon(cfg.color);
          }
          const marker = L.marker([coords[1], coords[0]], { icon });
          marker.bindPopup(() => getPopupContent(feature, cfg.id, childTables), { maxWidth: 380 });
          group.addLayer(marker);
        } else {
          const geoLayer = L.geoJSON(feature, {
            style: {
              color: cfg.color, weight: 2, fillColor: cfg.color, fillOpacity: 0.25, opacity: 0.8,
            },
          });
          geoLayer.bindPopup(() => getPopupContent(feature, cfg.id, childTables), { maxWidth: 380 });
          group.addLayer(geoLayer);
        }
      });

      if (visible) { group.addTo(map); } else { group.remove(); }
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

    const group = layerGroupsRef.current[layerId];
    if (group && !map.hasLayer(group)) group.addTo(map);

    const tempLayer = L.geoJSON(feature);
    const bounds = tempLayer.getBounds();
    map.flyToBounds(bounds, { maxZoom: 18, padding: [50, 50], duration: 0.8 });

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
        if (f?.geometry) allBounds.push(L.geoJSON(f).getBounds());
      });
    });

    if (allBounds.length > 0) {
      let combined = allBounds[0];
      allBounds.slice(1).forEach(b => combined.extend(b));
      map.flyToBounds(combined, { maxZoom: 17, padding: [40, 40], duration: 0.8 });
    }
  }, [filteredFeatures, geoData]);

  // Route display - blue with shadow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayerRef.current.clearLayers();

    if (routeResult && routeResult.path.length > 1) {
      const shadow = L.polyline(routeResult.path, {
        color: '#1e40af', weight: 8, opacity: 0.3,
      });
      const polyline = L.polyline(routeResult.path, {
        color: '#4285F4', weight: 5, opacity: 0.9,
      });
      routeLayerRef.current.addLayer(shadow);
      routeLayerRef.current.addLayer(polyline);
      map.flyToBounds(polyline.getBounds(), { padding: [60, 60], duration: 0.8 });
    }
  }, [routeResult]);

  // User location marker with pulse
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }

    if (userLocation) {
      const icon = L.divIcon({
        html: `<div class="pulse-marker-container">
          <div class="pulse-ring"></div>
          <div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(37,99,235,0.5);position:relative;z-index:2;"></div>
        </div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 20],
      });
      userMarkerRef.current = L.marker(userLocation, { icon, zIndexOffset: 1000 }).addTo(map);
      userMarkerRef.current.bindPopup('<b>📍 You are here</b>');
    }
  }, [userLocation]);

  // Destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (destMarkerRef.current) { destMarkerRef.current.remove(); destMarkerRef.current = null; }

    if (destinationLocation) {
      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="44">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#dc2626" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="white" opacity="0.9"/>
          <text x="12" y="14" text-anchor="middle" font-size="9" fill="#dc2626" font-weight="bold">B</text>
        </svg>`,
        className: '', iconSize: [32, 44], iconAnchor: [16, 44], popupAnchor: [0, -44],
      });
      destMarkerRef.current = L.marker(destinationLocation, { icon, zIndexOffset: 999 }).addTo(map);
      destMarkerRef.current.bindPopup('<b>🏁 Destination</b>').openPopup();
    }
  }, [destinationLocation]);

  return (
    <>
      <div ref={mapContainerRef} className="w-full h-full" />
      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        facilityName={reportFacility.name}
        facilityType={reportFacility.type}
      />
    </>
  );
}
