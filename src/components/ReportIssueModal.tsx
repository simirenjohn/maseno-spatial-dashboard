import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ReportIssueModalProps {
  facilityLocation?: [number, number] | null;
}

export default function ReportIssueModal({ facilityLocation }: ReportIssueModalProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const handleOpen = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setChecking(false);
        if (!facilityLocation) {
          // No facility selected — allow anyway
          setAllowed(true);
          setOpen(true);
          return;
        }
        const dist = haversineDistance(
          pos.coords.latitude, pos.coords.longitude,
          facilityLocation[0], facilityLocation[1]
        );
        if (dist <= 100) {
          setAllowed(true);
          setOpen(true);
        } else {
          setAllowed(false);
          toast.error('You must be near this facility to submit a report.', {
            description: `You are ${Math.round(dist)}m away. Max allowed: 100m.`,
            duration: 5000,
          });
        }
      },
      (err) => {
        setChecking(false);
        toast.error('Enable location services: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="h-8 text-xs gap-1.5 shadow-md"
        onClick={handleOpen}
        disabled={checking}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {checking ? 'Checking...' : 'Report Issue'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Report an Issue</DialogTitle>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          {allowed && (
            <div className="w-full" style={{ height: '70vh' }}>
              <iframe
                src="https://tally.so/embed/q4WDqO?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Report Issue Form"
                style={{ border: 'none' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
