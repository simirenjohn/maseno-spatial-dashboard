import { useState } from 'react';
import { HelpCircle, X, Search, Filter, MapPin, Layers, Navigation, MousePointer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const steps = [
  { icon: Search, title: 'Search', desc: 'Type a building name or category (e.g. "chemistry") in the search bar to find any facility.' },
  { icon: Filter, title: 'Filter', desc: 'Expand a layer in the sidebar and use dropdowns to filter by gender, price, capacity, or type.' },
  { icon: MousePointer, title: 'Select', desc: 'Click a search result or filtered item to zoom to it on the map and view its details.' },
  { icon: Layers, title: 'Layers', desc: 'Toggle layer visibility using the eye icon next to each layer name.' },
  { icon: MapPin, title: 'Basemap', desc: 'Switch between OpenStreetMap, CartoDB Voyager, and CartoDB Light using the buttons on the top-right of the map.' },
  { icon: Navigation, title: 'Directions', desc: 'Routing with turn-by-turn navigation will be available soon in the "Get Directions" panel.' },
];

export default function UserGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[1000] w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        title="User Guide"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">How to Use the Map</DialogTitle>
            <DialogDescription>Quick guide to navigate Maseno Campus Explorer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <step.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{step.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
