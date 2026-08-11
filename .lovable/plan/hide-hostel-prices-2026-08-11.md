# Hide hostel prices

Remove hostel price from everything the user sees, while leaving the price values in the GeoJSON data so they can be re-enabled later.

## Changes

1. **Map popup** (`src/components/MapView.tsx`) — remove the "Price (KES)" row from the hostel popup table.
2. **Sidebar filters** (`src/components/Sidebar.tsx`)
   - Remove the "Price (KES)" filter dropdown from the Hostels filter panel.
   - Remove the `hostelPrice` filter state, its default, the price-options list, and the price condition in the filter matcher.
   - Change the hostel result subtitle from `MALE • KES 7,000` to just the gender (and capacity where already shown).

## Notes

- `public/data/hostels.geojson` is untouched — `Price` stays in the data.
- Gender and capacity filters keep working exactly as before.
