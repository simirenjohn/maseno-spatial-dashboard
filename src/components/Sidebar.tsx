import { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronRight, Eye, EyeOff, MapPin, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LAYER_CONFIGS, type GeoDataState } from '@/hooks/useGeoData';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SidebarProps {
  geoData: GeoDataState;
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
  onSelectFeature: (layerId: string, featureIndex: number) => void;
  onFilterChange: (filtered: Record<string, number[]> | null) => void;
}

interface Filters {
  hostelGender: string;
  hostelPrice: string;
  hostelCapacity: string;
  lectureCapacity: string;
  examCapacity: string;
  adminType: string;
  labType: string;
}

const DEFAULT_FILTERS: Filters = {
  hostelGender: 'all',
  hostelPrice: 'all',
  hostelCapacity: 'all',
  lectureCapacity: 'all',
  examCapacity: 'all',
  adminType: 'all',
  labType: 'all',
};

export default function Sidebar({ geoData, layerVisibility, onToggleLayer, onSelectFeature, onFilterChange }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({ hostels: true });

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
        const typeVal = p.type || p.TYPE || cfg.label || '';
        const searchText = `${name} ${typeVal} ${cfg.label}`.toLowerCase();
        if (searchText.includes(q)) {
          results.push({ layerId: cfg.id, featureIndex: idx, name: name || cfg.label, layerLabel: cfg.label, color: cfg.color });
        }
      });
    });
    return results.slice(0, 20);
  }, [search, geoData]);

  // Apply filters
  const applyFilters = () => {
    const hasActiveFilter = Object.values(filters).some(v => v !== 'all');
    if (!hasActiveFilter) {
      onFilterChange(null);
      return;
    }

    const result: Record<string, number[]> = {};

    // Hostel filters
    if (filters.hostelGender !== 'all' || filters.hostelPrice !== 'all' || filters.hostelCapacity !== 'all') {
      const indices: number[] = [];
      geoData.hostels?.features.forEach((f, idx) => {
        const p = f.properties || {};
        let match = true;
        if (filters.hostelGender !== 'all' && p.Gender?.toUpperCase() !== filters.hostelGender.toUpperCase()) match = false;
        if (filters.hostelPrice !== 'all' && String(p.Price) !== filters.hostelPrice) match = false;
        if (filters.hostelCapacity !== 'all' && String(p['Capacity Per Room']) !== filters.hostelCapacity) match = false;
        if (match) indices.push(idx);
      });
      result.hostels = indices;
    }

    // Lecture hall filters
    if (filters.lectureCapacity !== 'all' || filters.examCapacity !== 'all') {
      const indices: number[] = [];
      geoData.lecture_halls?.features.forEach((f, idx) => {
        const p = f.properties || {};
        let match = true;
        if (filters.lectureCapacity !== 'all' && p['LECTURE CAPACITY'] !== Number(filters.lectureCapacity)) match = false;
        if (filters.examCapacity !== 'all' && p['EXAMINATION CAPACITY'] !== Number(filters.examCapacity)) match = false;
        if (match) indices.push(idx);
      });
      result.lecture_halls = indices;
    }

    // Admin filters
    if (filters.adminType !== 'all') {
      const indices: number[] = [];
      geoData.administration?.features.forEach((f, idx) => {
        if (f.properties?.type === filters.adminType) indices.push(idx);
      });
      result.administration = indices;
    }

    // Lab filters
    if (filters.labType !== 'all') {
      const indices: number[] = [];
      geoData.labs?.features.forEach((f, idx) => {
        if (f.properties?.NAME === filters.labType) indices.push(idx);
      });
      result.labs = indices;
    }

    onFilterChange(Object.keys(result).length > 0 ? result : null);
  };

  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
    onFilterChange(null);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    // Auto-apply
    setTimeout(() => {
      const hasActive = Object.values(next).some(v => v !== 'all');
      if (!hasActive) { onFilterChange(null); return; }
      // Re-run filter logic inline
      const result: Record<string, number[]> = {};
      if (next.hostelGender !== 'all' || next.hostelPrice !== 'all' || next.hostelCapacity !== 'all') {
        const indices: number[] = [];
        geoData.hostels?.features.forEach((f, idx) => {
          const p = f.properties || {};
          let match = true;
          if (next.hostelGender !== 'all' && p.Gender?.toUpperCase() !== next.hostelGender.toUpperCase()) match = false;
          if (next.hostelPrice !== 'all' && String(p.Price) !== next.hostelPrice) match = false;
          if (next.hostelCapacity !== 'all' && String(p['Capacity Per Room']) !== next.hostelCapacity) match = false;
          if (match) indices.push(idx);
        });
        result.hostels = indices;
      }
      if (next.lectureCapacity !== 'all' || next.examCapacity !== 'all') {
        const indices: number[] = [];
        geoData.lecture_halls?.features.forEach((f, idx) => {
          const p = f.properties || {};
          let match = true;
          if (next.lectureCapacity !== 'all' && p['LECTURE CAPACITY'] !== Number(next.lectureCapacity)) match = false;
          if (next.examCapacity !== 'all' && p['EXAMINATION CAPACITY'] !== Number(next.examCapacity)) match = false;
          if (match) indices.push(idx);
        });
        result.lecture_halls = indices;
      }
      if (next.adminType !== 'all') {
        const indices: number[] = [];
        geoData.administration?.features.forEach((f, idx) => {
          if (f.properties?.type === next.adminType) indices.push(idx);
        });
        result.administration = indices;
      }
      if (next.labType !== 'all') {
        const indices: number[] = [];
        geoData.labs?.features.forEach((f, idx) => {
          if (f.properties?.NAME === next.labType) indices.push(idx);
        });
        result.labs = indices;
      }
      onFilterChange(Object.keys(result).length > 0 ? result : null);
    }, 0);
  };

  const getMatchCount = (layerId: string): number | null => {
    const f = filters;
    if (layerId === 'hostels' && (f.hostelGender !== 'all' || f.hostelPrice !== 'all' || f.hostelCapacity !== 'all')) {
      let count = 0;
      geoData.hostels?.features.forEach(feat => {
        const p = feat.properties || {};
        let match = true;
        if (f.hostelGender !== 'all' && p.Gender?.toUpperCase() !== f.hostelGender.toUpperCase()) match = false;
        if (f.hostelPrice !== 'all' && String(p.Price) !== f.hostelPrice) match = false;
        if (f.hostelCapacity !== 'all' && String(p['Capacity Per Room']) !== f.hostelCapacity) match = false;
        if (match) count++;
      });
      return count;
    }
    return null;
  };

  const toggleExpanded = (id: string) => {
    setExpandedLayers(prev => ({ ...prev, [id]: !prev[id] }));
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
      <div className="px-4 py-3 border-b border-border">
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

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-popover">
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

          return (
            <div key={cfg.id} className="border-b border-border">
              {/* Layer header */}
              <div className="flex items-center px-4 py-2.5 hover:bg-muted/50 transition-colors">
                <button onClick={() => toggleExpanded(cfg.id)} className="mr-2 text-muted-foreground">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <div
                  className="w-3 h-3 rounded-full mr-2 shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
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

              {/* Expanded: filters */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {cfg.id === 'hostels' && (
                    <>
                      <FilterSelect
                        label="Gender"
                        value={filters.hostelGender}
                        onChange={v => updateFilter('hostelGender', v)}
                        options={[
                          { value: 'all', label: 'All' },
                          { value: 'MALE', label: 'Male' },
                          { value: 'FEMALE', label: 'Female' },
                          { value: 'MIXED', label: 'Mixed' },
                        ]}
                      />
                      <FilterSelect
                        label="Price (KES)"
                        value={filters.hostelPrice}
                        onChange={v => updateFilter('hostelPrice', v)}
                        options={[
                          { value: 'all', label: 'All Prices' },
                          ...hostelPrices.map(p => ({ value: String(p), label: `KES ${p.toLocaleString()}` })),
                        ]}
                      />
                      <FilterSelect
                        label="Capacity/Room"
                        value={filters.hostelCapacity}
                        onChange={v => updateFilter('hostelCapacity', v)}
                        options={[
                          { value: 'all', label: 'All' },
                          ...hostelCapacities.map(c => ({ value: String(c), label: `${c} per room` })),
                        ]}
                      />
                    </>
                  )}

                  {cfg.id === 'lecture_halls' && (
                    <>
                      <FilterSelect
                        label="Lecture Capacity"
                        value={filters.lectureCapacity}
                        onChange={v => updateFilter('lectureCapacity', v)}
                        options={[
                          { value: 'all', label: 'All' },
                          ...lectureCapacities.map(c => ({ value: String(c), label: `${c} seats` })),
                        ]}
                      />
                      <FilterSelect
                        label="Exam Capacity"
                        value={filters.examCapacity}
                        onChange={v => updateFilter('examCapacity', v)}
                        options={[
                          { value: 'all', label: 'All' },
                          ...examCapacities.map(c => ({ value: String(c), label: `${c} seats` })),
                        ]}
                      />
                    </>
                  )}

                  {cfg.id === 'administration' && (
                    <FilterSelect
                      label="Department Type"
                      value={filters.adminType}
                      onChange={v => updateFilter('adminType', v)}
                      options={[
                        { value: 'all', label: 'All Types' },
                        ...adminTypes.map(t => ({ value: t, label: t })),
                      ]}
                    />
                  )}

                  {cfg.id === 'labs' && (
                    <FilterSelect
                      label="Lab Type"
                      value={filters.labType}
                      onChange={v => updateFilter('labType', v)}
                      options={[
                        { value: 'all', label: 'All Labs' },
                        ...labTypes.map(t => ({ value: t, label: t })),
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Get Directions placeholder */}
        <div className="border-b border-border">
          <div className="flex items-center px-4 py-2.5 text-muted-foreground">
            <Navigation className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Get Directions</span>
            <Badge variant="secondary" className="ml-auto text-[10px] py-0">Coming Soon</Badge>
          </div>
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
