// Client-side Dijkstra routing on road network GeoJSON with binary heap

export interface RouteResult {
  path: [number, number][]; // [lat, lng] pairs for Leaflet
  distance: number; // meters
  duration: number; // seconds (walking ~5km/h)
}

interface GraphNode {
  id: string;
  lng: number;
  lat: number;
  edges: { nodeId: string; weight: number }[];
}

function coordKey(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Binary min-heap for Dijkstra
class MinHeap {
  private heap: { id: string; dist: number }[] = [];

  push(item: { id: string; dist: number }) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; dist: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get length() { return this.heap.length; }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[i].dist < this.heap[parent].dist) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private _sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].dist < this.heap[smallest].dist) smallest = l;
      if (r < n && this.heap[r].dist < this.heap[smallest].dist) smallest = r;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}

export class RoadGraph {
  nodes: Map<string, GraphNode> = new Map();

  buildFromGeoJSON(geojson: GeoJSON.FeatureCollection) {
    for (const feature of geojson.features) {
      if (!feature.geometry || feature.geometry.type !== 'LineString') continue;
      const coords = (feature.geometry as GeoJSON.LineString).coordinates;

      for (let i = 0; i < coords.length; i++) {
        const [lng, lat] = coords[i];
        const key = coordKey(lng, lat);
        if (!this.nodes.has(key)) {
          this.nodes.set(key, { id: key, lng, lat, edges: [] });
        }

        if (i > 0) {
          const [pLng, pLat] = coords[i - 1];
          const prevKey = coordKey(pLng, pLat);
          const dist = haversine(pLat, pLng, lat, lng);

          const node = this.nodes.get(key)!;
          const prevNode = this.nodes.get(prevKey)!;

          if (!node.edges.some(e => e.nodeId === prevKey)) {
            node.edges.push({ nodeId: prevKey, weight: dist });
          }
          if (!prevNode.edges.some(e => e.nodeId === key)) {
            prevNode.edges.push({ nodeId: key, weight: dist });
          }
        }
      }
    }
    // Connect disconnected components by bridging nearby nodes
    this._connectComponents();
    console.log(`Road graph built: ${this.nodes.size} nodes`);
  }

  private _connectComponents() {
    // Find connected components via BFS
    const visited = new Set<string>();
    const componentOf = new Map<string, number>();
    const components: string[][] = [];

    for (const key of this.nodes.keys()) {
      if (visited.has(key)) continue;
      const comp: string[] = [];
      const queue = [key];
      const compIdx = components.length;
      while (queue.length > 0) {
        const n = queue.pop()!;
        if (visited.has(n)) continue;
        visited.add(n);
        comp.push(n);
        componentOf.set(n, compIdx);
        const node = this.nodes.get(n);
        if (node) {
          for (const e of node.edges) {
            if (!visited.has(e.nodeId)) queue.push(e.nodeId);
          }
        }
      }
      components.push(comp);
    }

    if (components.length <= 1) return;

    // For each smaller component, find the nearest node in the largest component and bridge them
    // Also bridge any remaining disconnected pairs within 200m
    const largest = components[0];
    const BRIDGE_THRESHOLD = 200; // meters

    for (let ci = 1; ci < components.length; ci++) {
      const comp = components[ci];
      let bestDist = Infinity;
      let bestA: string | null = null;
      let bestB: string | null = null;

      // Sample up to 20 nodes from smaller component for speed
      const sample = comp.length <= 20 ? comp : comp.filter((_, i) => i % Math.ceil(comp.length / 20) === 0);

      for (const aKey of sample) {
        const aNode = this.nodes.get(aKey)!;
        // Search all nodes not in same component
        for (const bKey of largest.length <= 200 ? largest : largest.filter((_, i) => i % Math.ceil(largest.length / 200) === 0)) {
          const bNode = this.nodes.get(bKey)!;
          const d = haversine(aNode.lat, aNode.lng, bNode.lat, bNode.lng);
          if (d < bestDist) {
            bestDist = d;
            bestA = aKey;
            bestB = bKey;
          }
        }
      }

      // Bridge if within threshold, or always bridge to avoid disconnected routes
      if (bestA && bestB && bestDist < BRIDGE_THRESHOLD) {
        const aNode = this.nodes.get(bestA)!;
        const bNode = this.nodes.get(bestB)!;
        aNode.edges.push({ nodeId: bestB, weight: bestDist });
        bNode.edges.push({ nodeId: bestA, weight: bestDist });
      } else if (bestA && bestB) {
        // Even if far, connect it so routing doesn't fail
        const aNode = this.nodes.get(bestA)!;
        const bNode = this.nodes.get(bestB)!;
        aNode.edges.push({ nodeId: bestB, weight: bestDist });
        bNode.edges.push({ nodeId: bestA, weight: bestDist });
      }
    }

    console.log(`Bridged ${components.length - 1} disconnected components`);
  }

  findNearest(lat: number, lng: number, maxDist = Infinity): string | null {
    let minDist = maxDist;
    let nearest: string | null = null;
    for (const [key, node] of this.nodes) {
      const d = haversine(lat, lng, node.lat, node.lng);
      if (d < minDist) {
        minDist = d;
        nearest = key;
      }
    }
    return nearest;
  }

  dijkstra(startKey: string, endKey: string): RouteResult | null {
    if (!this.nodes.has(startKey) || !this.nodes.has(endKey)) return null;
    if (startKey === endKey) {
      const n = this.nodes.get(startKey)!;
      return { path: [[n.lat, n.lng]], distance: 0, duration: 0 };
    }

    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const visited = new Set<string>();
    const queue = new MinHeap();

    dist.set(startKey, 0);
    queue.push({ id: startKey, dist: 0 });

    while (queue.length > 0) {
      const current = queue.pop()!;

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      if (current.id === endKey) break;

      const node = this.nodes.get(current.id);
      if (!node) continue;

      for (const edge of node.edges) {
        if (visited.has(edge.nodeId)) continue;
        const alt = current.dist + edge.weight;
        const existing = dist.get(edge.nodeId);
        if (existing === undefined || alt < existing) {
          dist.set(edge.nodeId, alt);
          prev.set(edge.nodeId, current.id);
          queue.push({ id: edge.nodeId, dist: alt });
        }
      }
    }

    const endDist = dist.get(endKey);
    if (endDist === undefined) return null;

    // Reconstruct path
    const path: [number, number][] = [];
    let curr: string | null | undefined = endKey;
    while (curr) {
      const node = this.nodes.get(curr);
      if (!node) break;
      path.unshift([node.lat, node.lng]);
      curr = prev.get(curr);
    }

    const walkingSpeed = 5 / 3.6; // 5 km/h in m/s
    return {
      path,
      distance: endDist,
      duration: endDist / walkingSpeed,
    };
  }

  route(fromLat: number, fromLng: number, toLat: number, toLng: number): RouteResult | null {
    const startKey = this.findNearest(fromLat, fromLng);
    const endKey = this.findNearest(toLat, toLng);
    if (!startKey || !endKey) return null;
    return this.dijkstra(startKey, endKey);
  }
}
