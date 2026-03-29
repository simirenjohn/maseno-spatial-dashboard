// Client-side Dijkstra routing on road network GeoJSON

interface GraphNode {
  id: string;
  lng: number;
  lat: number;
  edges: { nodeId: string; weight: number }[];
}

export interface RouteResult {
  path: [number, number][]; // [lat, lng] pairs for Leaflet
  distance: number; // meters
  duration: number; // seconds (walking ~5km/h)
}

function coordKey(lng: number, lat: number): string {
  return `${lng.toFixed(7)},${lat.toFixed(7)}`;
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

export class RoadGraph {
  nodes: Map<string, GraphNode> = new Map();

  buildFromGeoJSON(geojson: GeoJSON.FeatureCollection) {
    geojson.features.forEach(feature => {
      if (!feature.geometry || feature.geometry.type !== 'LineString') return;
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

          if (!node.edges.find(e => e.nodeId === prevKey)) {
            node.edges.push({ nodeId: prevKey, weight: dist });
          }
          if (!prevNode.edges.find(e => e.nodeId === key)) {
            prevNode.edges.push({ nodeId: key, weight: dist });
          }
        }
      }
    });
  }

  findNearest(lat: number, lng: number): string | null {
    let minDist = Infinity;
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

    // Simple priority queue using sorted array
    const queue: { id: string; dist: number }[] = [];

    for (const key of this.nodes.keys()) {
      dist.set(key, Infinity);
      prev.set(key, null);
    }
    dist.set(startKey, 0);
    queue.push({ id: startKey, dist: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.dist - b.dist);
      const current = queue.shift()!;

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      if (current.id === endKey) break;

      const node = this.nodes.get(current.id)!;
      for (const edge of node.edges) {
        if (visited.has(edge.nodeId)) continue;
        const alt = dist.get(current.id)! + edge.weight;
        if (alt < dist.get(edge.nodeId)!) {
          dist.set(edge.nodeId, alt);
          prev.set(edge.nodeId, current.id);
          queue.push({ id: edge.nodeId, dist: alt });
        }
      }
    }

    if (dist.get(endKey) === Infinity) return null;

    // Reconstruct path
    const path: [number, number][] = [];
    let curr: string | null = endKey;
    while (curr) {
      const node = this.nodes.get(curr)!;
      path.unshift([node.lat, node.lng]);
      curr = prev.get(curr) || null;
    }

    const totalDist = dist.get(endKey)!;
    const walkingSpeed = 5 / 3.6; // 5 km/h in m/s
    return {
      path,
      distance: totalDist,
      duration: totalDist / walkingSpeed,
    };
  }

  route(fromLat: number, fromLng: number, toLat: number, toLng: number): RouteResult | null {
    const startKey = this.findNearest(fromLat, fromLng);
    const endKey = this.findNearest(toLat, toLng);
    if (!startKey || !endKey) return null;
    return this.dijkstra(startKey, endKey);
  }
}
