import { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronRight, Eye, EyeOff, MapPin, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LAYER_CONFIGS, type GeoDataState, type ChildTables } from '@/hooks/useGeoData';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import RoutingPanel from '@/components/RoutingPanel';
import type { RouteResult } from '@/lib/routing';

interface SidebarProps {
  geoData: GeoDataState;
  childTables: ChildTables;
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
  onSelectFeature: (layerId: string, featureIndex: number) => void;
  onFilterChange: (filtered: Record<string, number[]> | null) => void;
  onRoute: (fromLat: number, fromLng: number, toLat: number, toLng: number) => void;
  onClearRoute: () => void;
  onLocateUser: () => void;
  userLocation: [number, number] | null;
  routeResult: RouteResult | null;
  isLocating: boolean;
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
}

interface Filters {
  hostelGender: string;
  hostelPrice: string;
  hostelCapacity: string;
  lectureCapacity: string;
  examCapacity: string;
  adminType: string;
  labType: string;
  wasteCondition: string;
  wasteType: string;
}

const DEFAULT_FILTERS: Filters = {
  hostelGender: 'all',
  hostelPrice: 'all',
  hostelCapacity: 'all',
  lectureCapacity: 'all',
  examCapacity: 'all',
  adminType: 'all',
  labType: 'all',
  wasteCondition: 'all',
  wasteType: 'all',
};

export default function Sidebar({
  geoData, childTables, layerVisibility, onToggleLayer, onSelectFeature, onFilterChange,
  onRoute, onClearRoute, onLocateUser, userLocation, routeResult, isLocating,
  isTracking, onStartTracking, onStopTracking,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [routingExpanded, setRoutingExpanded] = useState(false);

  // Dynamic filter options
  const hostelPrices = useMemo(() => {
    const prices = new Set<number>();
    geoData.hostels?.features.forEach(f => { if (f.properties?.Price) prices.add(f.properties.Price); });
    return [...prices].sort((a, b) => a - b);
  }, [geoData.hostels]);

  const hostelCapacities = useMemo(() => {
    const caps = new Set<number>();
    geoData.hostels?.features.forEach(f => { if (f.properties?.['Capacity Per Room']) caps.add(f.properties['Capacity Per Room']); });
    return [...caps].sort((a, b) => a - b);
  }, [geoData.hostels]);

  const lectureCapacities = useMemo(() => {
    const caps = new Set<number>();
    geoData.lecture_halls?.features.forEach(f => { if (f.properties?.['LECTURE CAPACITY']) caps.add(f.properties['LECTURE CAPACITY']); });
    return [...caps].sort((a, b) => a - b);
  }, [geoData.lecture_halls]);

  const examCapacities = useMemo(() => {
    const caps = new Set<number>();
    geoData.lecture_halls?.features.forEach(f => { if (f.properties?.['EXAMINATION CAPACITY']) caps.add(f.properties['EXAMINATION CAPACITY']); });
    return [...caps].sort((a, b) => a - b);
  }, [geoData.lecture_halls]);

  const adminTypes = useMemo(() => {
    const types = new Set<string>();
    geoData.administration?.features.forEach(f => { if (f.properties?.type) types.add(f.properties.type); });
    return [...types].sort();
  }, [geoData.administration]);

  const labTypes = useMemo(() => {
    const names = new Set<string>();
    geoData.labs?.features.forEach(f => { if (f.properties?.NAME) names.add(f.properties.NAME); });
    return [...names].sort();
  }, [geoData.labs]);

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: { layerId: string; featureIndex: number; name: string; layerLabel: string; color: string }[] = [];

    LAYER_CONFIGS.forEach(cfg => {
      const fc = geoData[cfg.id];
      if (!fc) return;
      fc.features.forEach((f, idx) => {
        const p = f.properties || {};
        const name = p[cfg.nameKey] || p.Name || p.name || p.NAME || '';
        const nameStr = typeof name === 'string' ? name : String(name);
        const typeVal = p.type || p.TYPE || cfg.label || '';
        const searchText = `${nameStr} ${typeVal} ${cfg.label}`.toLowerCase();
        if (searchText.includes(q)) {
          results.push({ layerId: cfg.id, featureIndex: idx, name: nameStr || cfg.label, layerLabel: cfg.label, color: cfg.color });
        }
      });
    });
    return results.slice(0, 20);
  }, [search, geoData]);

  // Child table search results (New Library + PGM rooms)
  const childSearchResults = useMemo(() => {
    if (!childSearch.trim()) return [];
    const q = childSearch.toLowerCase();
    const results: { building: string; roomName: string; floor: number; lecCap: string; examCap: string }[] = [];

    const searchChild = (fc: GeoJSON.FeatureCollection | null, buildingName: string) => {
      if (!fc) return;
      fc.features.forEach(f => {
        const p = f.properties || {};
        const roomName = p.lecture_room_name || p['LECTURE ROOM NAME'] || '';
        if (roomName.toLowerCase().includes(q)) {
          results.push({
            building: buildingName,
            roomName,
            floor: p.floor_number ?? 0,
            lecCap: p.lecture_capacity ?? p['LECTURE CAPACITY'] ?? '—',
            examCap: p.examination_capacity ?? p['EXAMINATION CAPACITY'] ?? '—',
          });
        }
      });
    };

    searchChild(childTables.newLibrary, 'New Library');
    searchChild(childTables.pgm, 'Prof. George Magoha');
    return results;
  }, [childSearch, childTables]);

  // Get filtered feature indices for a layer
  const getFilteredIndices = (layerId: string, f: Filters): number[] => {
    const fc = geoData[layerId];
    if (!fc) return [];
    const indices: number[] = [];

    if (layerId === 'hostels') {
      fc.features.forEach((feat, idx) => {
        const p = feat.properties || {};
        let match = true;
        if (f.hostelGender !== 'all' && p.Gender?.toUpperCase() !== f.hostelGender.toUpperCase()) match = false;
        if (f.hostelPrice !== 'all' && String(p.Price) !== f.hostelPrice) match = false;
        if (f.hostelCapacity !== 'all' && String(p['Capacity Per Room']) !== f.hostelCapacity) match = false;
        if (match) indices.push(idx);
      });
    } else if (layerId === 'lecture_halls') {
      fc.features.forEach((feat, idx) => {
        const p = feat.properties || {};
        let match = true;
        if (f.lectureCapacity !== 'all' && p['LECTURE CAPACITY'] !== Number(f.lectureCapacity)) match = false;
        if (f.examCapacity !== 'all' && p['EXAMINATION CAPACITY'] !== Number(f.examCapacity)) match = false;
        if (match) indices.push(idx);
      });
    } else if (layerId === 'administration') {
      fc.features.forEach((feat, idx) => {
        if (f.adminType === 'all' || feat.properties?.type === f.adminType) indices.push(idx);
      });
    } else if (layerId === 'labs') {
      fc.features.forEach((feat, idx) => {
        if (f.labType === 'all' || feat.properties?.NAME === f.labType) indices.push(idx);
      });
    } else if (layerId === 'waste') {
      fc.features.forEach((feat, idx) => {
        const p = feat.properties || {};
        let match = true;
        if (f.wasteCondition !== 'all' && p.Condition?.toLowerCase() !== f.wasteCondition) match = false;
        if (f.wasteType !== 'all' && p['Waste type']?.toLowerCase() !== f.wasteType) match = false;
        if (match) indices.push(idx);
      });
    }
    return indices;
  };

  // Filtered items for display
  const filteredItems = useMemo(() => {
    const result: Record<string, { idx: number; name: string; detail?: string }[]> = {};

    // Hostels
    if (filters.hostelGender !== 'all' || filters.hostelPrice !== 'all' || filters.hostelCapacity !== 'all') {
      const indices = getFilteredIndices('hostels', filters);
      result.hostels = indices.map(idx => {
        const p = geoData.hostels?.features[idx]?.properties || {};
        return { idx, name: p.Name || 'Unknown', detail: `${p.Gender || ''} • KES ${p.Price?.toLocaleString() || '?'}` };
      });
    }

    // Lecture halls
    if (filters.lectureCapacity !== 'all' || filters.examCapacity !== 'all') {
      const indices = getFilteredIndices('lecture_halls', filters);
      result.lecture_halls = indices.map(idx => {
        const p = geoData.lecture_halls?.features[idx]?.properties || {};
        return { idx, name: p.Name || 'Unknown', detail: `Lec: ${p['LECTURE CAPACITY'] ?? '?'} • Exam: ${p['EXAMINATION CAPACITY'] ?? '?'}` };
      });
    }

    // Admin
    if (filters.adminType !== 'all') {
      const indices = getFilteredIndices('administration', filters);
      result.administration = indices.map(idx => {
        const p = geoData.administration?.features[idx]?.properties || {};
        return { idx, name: p.name || 'Unknown', detail: p.type || '' };
      });
    }

    // Labs
    if (filters.labType !== 'all') {
      const indices = getFilteredIndices('labs', filters);
      result.labs = indices.map(idx => {
        const p = geoData.labs?.features[idx]?.properties || {};
        return { idx, name: p.NAME || 'Unknown', detail: `Capacity: ${p.CAPACITY || '?'}` };
      });
    }

    // Waste
    if (filters.wasteCondition !== 'all' || filters.wasteType !== 'all') {
      const indices = getFilteredIndices('waste', filters);
      result.waste = indices.map(idx => {
        const p = geoData.waste?.features[idx]?.properties || {};
        return { idx, name: p['Waste type'] || 'Waste Point', detail: p.Condition || '' };
      });
    }

    return result;
  }, [filters, geoData]);

  // Apply filters
  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setTimeout(() => {
      const hasActive = Object.values(next).some(v => v !== 'all');
      if (!hasActive) { onFilterChange(null); return; }
      const result: Record<string, number[]> = {};

      if (next.hostelGender !== 'all' || next.hostelPrice !== 'all' || next.hostelCapacity !== 'all') {
        result.hostels = getFilteredIndices('hostels', next);
      }
      if (next.lectureCapacity !== 'all' || next.examCapacity !== 'all') {
        result.lecture_halls = getFilteredIndices('lecture_halls', next);
      }
      if (next.adminType !== 'all') {
        result.administration = getFilteredIndices('administration', next);
      }
      if (next.labType !== 'all') {
        result.labs = getFilteredIndices('labs', next);
      }
      if (next.wasteCondition !== 'all' || next.wasteType !== 'all') {
        result.waste = getFilteredIndices('waste', next);
      }
      onFilterChange(Object.keys(result).length > 0 ? result : null);
    }, 0);
  };

  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
    setChildSearch('');
    onFilterChange(null);
  };

  const getMatchCount = (layerId: string): number | null => {
    const items = filteredItems[layerId];
    if (items) return items.length;
    return null;
  };

  const toggleExpanded = (id: string) => {
    setExpandedLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Get feature name helper
  const getFeatureName = (layerId: string, idx: number): string => {
    const cfg = LAYER_CONFIGS.find(l => l.id === layerId);
    const f = geoData[layerId]?.features[idx];
    if (!f || !cfg) return 'Unknown';
    const p = f.properties || {};
    return p[cfg.nameKey] || p.Name || p.name || p.NAME || cfg.label;
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
          Maseno Campus Explorer
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Interactive Campus Map</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search buildings, labs, hostels..."
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-popover">
            {searchResults.map((r, i) => (
              <button
                key={`${r.layerId}-${r.featureIndex}-${i}`}
                onClick={() => { onSelectFeature(r.layerId, r.featureIndex); setSearch(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: r.color }} />
                <span className="truncate font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">{r.layerLabel}</span>
              </button>
            ))}
          </div>
        )}

        {/* Child table room search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={childSearch}
            onChange={e => setChildSearch(e.target.value)}
            placeholder="Search lecture rooms (NL, PGM)..."
            className="pl-9 pr-8 h-8 text-xs"
          />
          {childSearch && (
            <button onClick={() => setChildSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {childSearchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-popover text-xs">
            {childSearchResults.map((r, i) => (
              <div key={i} className="px-3 py-2 border-b border-border last:border-0 hover:bg-muted/50">
                <div className="font-medium">{r.roomName}</div>
                <div className="text-muted-foreground">
                  {r.building} • Floor {r.floor} • Lec: {r.lecCap} • Exam: {r.examCap}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear All */}
      {Object.values(filters).some(v => v !== 'all') && (
        <div className="px-4 py-2 border-b border-border">
          <Button variant="outline" size="sm" onClick={clearAll} className="w-full text-xs h-7">
            <X className="h-3 w-3 mr-1" /> Clear All Filters
          </Button>
        </div>
      )}

      {/* Layer list with filters */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {LAYER_CONFIGS.map(cfg => {
          const isExpanded = expandedLayers[cfg.id] || false;
          const featureCount = geoData[cfg.id]?.features?.length || 0;
          const matchCount = getMatchCount(cfg.id);
          const isVisible = layerVisibility[cfg.id] !== false;
          const items = filteredItems[cfg.id];
          const showListing = cfg.id === 'workers' || cfg.id === 'clinic' || cfg.id === 'parking';

          return (
            <div key={cfg.id} className="border-b border-border">
              <div className="flex items-center px-4 py-2.5 hover:bg-muted/50 transition-colors">
                <button onClick={() => toggleExpanded(cfg.id)} className="mr-2 text-muted-foreground">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <div className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: cfg.color }} />
                <button onClick={() => toggleExpanded(cfg.id)} className="flex-1 text-left">
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    {matchCount !== null ? `${matchCount} match` : `(${featureCount})`}
                  </span>
                </button>
                <button
                  onClick={() => onToggleLayer(cfg.id)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                  title={isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {/* Filters */}
                  {cfg.id === 'hostels' && (
                    <>
                      <FilterSelect label="Gender" value={filters.hostelGender} onChange={v => updateFilter('hostelGender', v)} options={[
                        { value: 'all', label: 'All' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'MIXED', label: 'Mixed' },
                      ]} />
                      <FilterSelect label="Price (KES)" value={filters.hostelPrice} onChange={v => updateFilter('hostelPrice', v)} options={[
                        { value: 'all', label: 'All Prices' }, ...hostelPrices.map(p => ({ value: String(p), label: `KES ${p.toLocaleString()}` })),
                      ]} />
                      <FilterSelect label="Capacity/Room" value={filters.hostelCapacity} onChange={v => updateFilter('hostelCapacity', v)} options={[
                        { value: 'all', label: 'All' }, ...hostelCapacities.map(c => ({ value: String(c), label: `${c} per room` })),
                      ]} />
                    </>
                  )}
                  {cfg.id === 'lecture_halls' && (
                    <>
                      <FilterSelect label="Lecture Capacity" value={filters.lectureCapacity} onChange={v => updateFilter('lectureCapacity', v)} options={[
                        { value: 'all', label: 'All' }, ...lectureCapacities.map(c => ({ value: String(c), label: `${c} seats` })),
                      ]} />
                      <FilterSelect label="Exam Capacity" value={filters.examCapacity} onChange={v => updateFilter('examCapacity', v)} options={[
                        { value: 'all', label: 'All' }, ...examCapacities.map(c => ({ value: String(c), label: `${c} seats` })),
                      ]} />
                    </>
                  )}
                  {cfg.id === 'administration' && (
                    <FilterSelect label="Department Type" value={filters.adminType} onChange={v => updateFilter('adminType', v)} options={[
                      { value: 'all', label: 'All Types' }, ...adminTypes.map(t => ({ value: t, label: t })),
                    ]} />
                  )}
                  {cfg.id === 'labs' && (
                    <FilterSelect label="Lab Type" value={filters.labType} onChange={v => updateFilter('labType', v)} options={[
                      { value: 'all', label: 'All Labs' }, ...labTypes.map(t => ({ value: t, label: t })),
                    ]} />
                  )}
                  {cfg.id === 'waste' && (
                    <>
                      <FilterSelect label="Condition" value={filters.wasteCondition} onChange={v => updateFilter('wasteCondition', v)} options={[
                        { value: 'all', label: 'All Conditions' },
                        { value: 'empty', label: '🟢 Empty' },
                        { value: 'partial', label: '🟡 Partial' },
                        { value: 'full', label: '🔴 Full' },
                        { value: 'overflowing', label: '⚫ Overflowing' },
                      ]} />
                      <FilterSelect label="Type" value={filters.wasteType} onChange={v => updateFilter('wasteType', v)} options={[
                        { value: 'all', label: 'All Types' },
                        { value: 'bin', label: 'Bin' },
                        { value: 'dump site', label: 'Dump Site' },
                      ]} />
                    </>
                  )}

                  {/* Filtered results listing */}
                  {items && items.length > 0 && (
                    <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-border bg-popover">
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
                        {items.length} result{items.length !== 1 ? 's' : ''} found
                      </div>
                      {items.map((item, i) => (
                        <button
                          key={`${cfg.id}-${item.idx}-${i}`}
                          onClick={() => onSelectFeature(cfg.id, item.idx)}
                          className="w-full flex flex-col px-2.5 py-1.5 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <span className="text-xs font-medium truncate">{item.name}</span>
                          {item.detail && <span className="text-[10px] text-muted-foreground">{item.detail}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Listing for workers & clinic (always list when expanded) */}
                  {showListing && !items && (
                    <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-popover">
                      {geoData[cfg.id]?.features.map((f, idx) => {
                        const name = getFeatureName(cfg.id, idx);
                        return (
                          <button
                            key={`${cfg.id}-list-${idx}`}
                            onClick={() => onSelectFeature(cfg.id, idx)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted transition-colors border-b border-border last:border-0"
                          >
                            <MapPin className="h-3 w-3 shrink-0" style={{ color: cfg.color }} />
                            <span className="truncate font-medium">
                              {cfg.id === 'clinic' ? 'University Clinic' : cfg.id === 'parking' ? `Parking Spot #${idx + 1}` : `${name} #${idx + 1}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Get Directions */}
        <div className="border-b border-border">
          <div
            className="flex items-center px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setRoutingExpanded(!routingExpanded)}
          >
            <button className="mr-2 text-muted-foreground">
              {routingExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <Navigation className="h-4 w-4 mr-2 text-primary" />
            <span className="text-sm font-semibold">Get Directions</span>
          </div>
          {routingExpanded && (
            <RoutingPanel
              geoData={geoData}
              onRoute={onRoute}
              onClearRoute={onClearRoute}
              onLocateUser={onLocateUser}
              userLocation={userLocation}
              routeResult={routeResult}
              isLocating={isLocating}
              isTracking={isTracking}
              onStartTracking={onStartTracking}
              onStopTracking={onStopTracking}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
