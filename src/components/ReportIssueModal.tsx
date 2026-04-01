import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Maseno University campus center and geofence radius
const CAMPUS_CENTER = { lat: -0.0040, lng: 34.6050 };
const CAMPUS_RADIUS_M = 1500; // 1.5km from campus center
const FACILITY_RADIUS_M = 100;

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

  const handleOpen = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setChecking(false);
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        // Step 1: Check if user is within Maseno campus geofence
        const distToCampus = haversineDistance(userLat, userLng, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng);
        if (distToCampus > CAMPUS_RADIUS_M) {
          toast.error('You must be within Maseno University campus to submit a report.', {
            description: `You are ${(distToCampus / 1000).toFixed(1)}km from campus. Access denied.`,
            duration: 5000,
          });
          return;
        }

        // Step 2: If a facility is selected, check proximity to it
        if (facilityLocation) {
          const distToFacility = haversineDistance(userLat, userLng, facilityLocation[0], facilityLocation[1]);
          if (distToFacility > FACILITY_RADIUS_M) {
            toast.error('You must be near this facility to submit a report.', {
              description: `You are ${Math.round(distToFacility)}m away. Max allowed: ${FACILITY_RADIUS_M}m.`,
              duration: 5000,
            });
            return;
          }
        }

        setOpen(true);
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden [&>button.absolute]:hidden">
          <DialogHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Report an Issue</DialogTitle>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
