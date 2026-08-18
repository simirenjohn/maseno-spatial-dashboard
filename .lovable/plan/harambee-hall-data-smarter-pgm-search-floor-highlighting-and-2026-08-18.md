# Harambee Hall data, smarter PGM search, floor highlighting, and "Navigate here"

## 1. New uploaded data

The uploaded file is in a local projected coordinate system (Arc 1960 / UTM zone 36S), so every shape is first converted to standard lat/long before being merged into the map data. Placement will be checked visually against the existing campus layers.

Where each shape goes:
- **Harambee hall** -> Lecture Halls layer. It takes over the details of the current "HARAMBEE HALL" record (lecture capacity 140, exam capacity 70, current seats 70, building id 9).
- **Existing HARAMBEE HALL polygon** -> renamed to **MUSIC STUDIO**, keeping its shape but no longer carrying the Harambee capacity figures.
- **FARM DEPARTMENT** -> Administration layer, merged with the existing farm department record so it appears as one entry (single combined shape, one catalogue item).
- **CAFETERIA (x2), washrooms** -> new **Amenities** layer.
- **GSQ GROUND, mosque field, HOCKEY PITCH** -> new **Sports & Grounds** layer.

Both new layers get their own colour, legend entry, toggle, and search coverage like existing layers.

## 2. Flexible PGM / room search

Search text and room names are both normalised (lowercase, punctuation and spaces stripped) before matching, so all of these find PGM-LH 1:
`pgm lh1`, `pgmlh1`, `PGM LH 1`, `pgm-lh1`, `lh1`.
A digit-aware match keeps "lh1" from also matching LH 10-19 unless nothing better exists; exact-number matches are ranked first. The same normalisation applies to New Library rooms and all building names.

## 3. Zoom + floor indication for rooms

When a room is picked from the search results:
- the map zooms to the parent building and the building outline is highlighted with a pulsing halo,
- the popup opens with a prominent floor badge (e.g. "Floor 2 - Ground / 1st / 2nd" wording), plus capacity details,
- a floor-grouped room list for that building is shown, with the selected room underlined and scrolled into view.

## 4. "Navigate here" on every building

Every feature popup gets two buttons, in this order:
1. **Navigate here** - starts routing to that building from the user's current position. If the location is not yet known, it asks for location first, then routes automatically.
2. **Report issue** - existing behaviour.

This works from map clicks and from search-result popups, so no need to open the directions panel and type a destination.

## Technical notes

- Reprojection: EPSG:21036 -> EPSG:4326 done once with a script, output written into the geojson files under `public/data/` (`lecture_halls.geojson`, `administration.geojson`, new `amenities.geojson`, `sports_grounds.geojson`). No runtime projection code.
- `src/hooks/useGeoData.ts`: two new `LAYER_CONFIGS` entries.
- `src/components/Sidebar.tsx`: shared `normalize()` helper used by building and child-table search, ranking logic, floor-grouped room list.
- `src/components/MapView.tsx`: popup builder gains a "Navigate here" button that fires a `navigate-to` window event with the feature centroid; floor badge and highlight styling for selected features.
- `src/pages/Index.tsx`: listens for `navigate-to`, ensures a user fix (reusing the existing high-accuracy locate flow), then calls the existing `handleRoute`.
- No database or backend changes.
