## Part 1 — Photo Uploads in Report Issue

Let students attach a photo (camera or gallery) when reporting an issue, e.g. a broken chair.

**Backend (Lovable Cloud)**
- Create a public storage bucket `report-photos` (5 MB limit, image/* only).
- RLS policies on `storage.objects` for that bucket:
  - Anyone (public) can `INSERT` (matches the existing "Anyone can submit reports" policy).
  - Anyone can `SELECT` (so admins can view photos without auth complications).
  - Only admins can `DELETE`.
- Migration: add `photo_url text` (nullable) column to `facility_reports`.

**Frontend — `src/components/ReportIssueModal.tsx`**
- New "Add Photo (optional)" field below Description:
  - Hidden `<input type="file" accept="image/*" capture="environment">` so phones open the camera directly, with a "Choose from gallery" alternative.
  - Show thumbnail preview after selection + a "Remove" button.
  - Client-side validation: must be image, ≤ 5 MB. Auto-compress large images via `<canvas>` (max 1600px wide, JPEG quality 0.8) before upload to keep things fast on student phones.
- On submit:
  1. If photo present → upload to `report-photos/{uuid}.jpg`, get public URL.
  2. Insert row into `facility_reports` including `photo_url`.
  3. Show upload progress spinner; if upload fails, allow submit without photo.

**Frontend — `src/pages/Admin.tsx`**
- In each report card, when `photo_url` exists, show a small thumbnail that opens a lightbox (Dialog) on click for full-size viewing.

---

## Part 2 — 3D Map View

Add an optional 3D buildings mode that **does not break** the current Leaflet map, routing, search, filters, or location features.

**Approach: separate MapLibre GL view, toggled via a button**
- Reasons: Leaflet is 2D-only. Adding true 3D (extruded buildings, pitch/tilt) requires a WebGL map. MapLibre GL JS is free, no token required, and supports 3D building extrusions out of the box.
- We keep the existing Leaflet `MapView` 100% untouched as the default. A new `MapView3D` component renders only when 3D mode is on. Switching modes preserves the current center/zoom and selected layers.

**New component: `src/components/MapView3D.tsx`**
- Uses `maplibre-gl` with a free vector style (e.g. `https://demotiles.maplibre.org/style.json`) and an OSM raster fallback.
- Renders the same GeoJSON layers (hostels, lecture halls, admin, labs, religious, workers, campus areas) as filled polygons with `fill-extrusion` so each building has a height (default 8 m, taller for library / lecture halls).
- Shows user location dot + accuracy circle.
- Shows route line if `routeResult` is present.
- Click on a building → same popup style as 2D (name + facility info), and triggers the same `onSelectFeature` callback so the sidebar stays in sync.

**Toggle UI — `src/pages/Index.tsx` + `src/components/MapView.tsx`**
- Add a small floating button on the map (top-right, next to basemap switcher): `2D ⇄ 3D`.
- State `viewMode: '2d' | '3d'` lives in `Index.tsx`. Sidebar, search, filters, routing, location all keep working — they only feed props down; the active map component consumes them.
- Mobile: same toggle, slightly larger tap target.

**Non-interference guarantees**
- Leaflet bundle is not affected; MapLibre is loaded only when 3D is first activated (dynamic `import()` to avoid bloating initial JS).
- Routing logic, geolocation, child tables, report-issue modal, user guide — all unchanged. The 3D component re-uses the same hooks/props.
- Falls back to 2D automatically if WebGL is unavailable, with a toast: "3D not supported on this device".

---

## Technical details

**Files to create**
- `supabase/migrations/<timestamp>_report_photos.sql` — adds `photo_url` column + creates `report-photos` bucket + RLS policies.
- `src/components/MapView3D.tsx` — MapLibre-based 3D view.
- `src/lib/imageCompress.ts` — small canvas-based compressor.

**Files to edit**
- `src/components/ReportIssueModal.tsx` — photo input, preview, upload.
- `src/pages/Admin.tsx` — photo thumbnail + lightbox.
- `src/pages/Index.tsx` — `viewMode` state, 2D/3D switching.
- `src/components/MapView.tsx` — expose 2D/3D toggle button (or add it in Index overlay).

**Dependencies**
- Add `maplibre-gl` (no API key needed).

**No changes to**
- `src/components/Sidebar.tsx`, `src/lib/routing.ts`, road network, geolocation logic, search, filters, user-roles system.

---

## Verification checklist
1. Submit a report with a photo from mobile → photo appears in Admin panel.
2. Submit without a photo → still works as before.
3. Toggle 3D → buildings extrude, can pitch/rotate (right-click drag or two-finger).
4. Toggle back to 2D → original Leaflet map intact, route still drawn, location still shown.
5. Routing, search, filters, "Locate Me", "How to use", report-issue all work in both modes.
