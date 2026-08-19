# Alternative routes + live blue-dot tracking

## 1. Two alternative routes

Every "Navigate here" (and the directions panel) returns up to 2 routes instead of 1:

- **Route A (fastest)** — the current shortest path, drawn as a solid primary-coloured line.
- **Route B (alternative)** — a second, meaningfully different path found by penalising the edges used by Route A and re-running the search. Drawn as a dashed, lighter line.

Behaviour:
- If no genuinely different second path exists (e.g. only one footpath leads there), only Route A is shown and the panel says "No alternative route available".
- The routing panel lists both options as tappable cards with distance and walking time; the selected one becomes solid/highlighted, the other dims.
- Tapping either card on the map or in the panel switches the active route.

## 2. Live position updates (blue dot)

- The user marker becomes a classic **blue dot** with a white ring and soft glow, plus a translucent blue accuracy circle around it.
- When a route is active, continuous location tracking starts automatically so the dot moves in real time as the person walks; the accuracy circle resizes with each fix.
- A subtle heading/pulse animation shows the dot is live, and the map gently keeps the dot in view while navigating (without fighting manual panning).
- Remaining distance and time in the panel recalculate as the position updates.
- Tracking stops when the route is cleared.

## Technical notes

- `src/lib/routing.ts`: add `routeAlternatives(from, to, count = 2)` — runs Dijkstra, then re-runs with a weight multiplier (~3x) on Route A's edges, keeping the result only if it differs enough (>15% distinct nodes). Returns `RouteResult[]`.
- `src/pages/Index.tsx`: `routeResult` becomes `routes: RouteResult[]` + `activeRouteIndex`; `handleRoute` calls `routeAlternatives`; auto-start `watchPosition` tracking when routes exist, clear on route clear; recompute remaining distance from the live position.
- `src/components/MapView.tsx`: draw all routes (inactive dashed/faded, active solid with shadow), click handler on inactive polylines to activate; restyle the user marker as a blue dot with pulse; keep-in-view logic on position change while navigating.
- `src/components/RoutingPanel.tsx`: render route option cards (A/B) with distance, duration and select action.
- `src/index.css`: blue-dot pulse animation.
- No backend or data changes.
