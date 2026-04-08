import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CAMPUS_CENTER = { lat: -0.0040, lng: 34.6050 };
const CAMPUS_RADIUS_M = 1500;

const ISSUE_TYPES: Record<string, string[]> = {
  waste: ['Bin is full/overflowing', 'Bin is damaged/broken', 'Bad odor', 'Bin is missing', 'Area is littered'],
  lecture_halls: ['Projector not working', 'Seats are broken', 'No power/lights out', 'Overcrowded', 'Microphone not working'],
  clinic: ['No staff present', 'Out of medicine', 'Long waiting queue', 'Closed during hours', 'Emergency needed'],
  hostels: ['Water shortage', 'Power outage', 'Broken furniture', 'Security concern', 'Drainage blocked'],
  parking: ['Overcrowded', 'Damaged surface', 'Poor lighting', 'Security concern'],
  wifi: ['No internet connection', 'Slow connection', 'Router is off', 'Coverage is poor'],
  administration: ['Office closed', 'Long queue', 'Staff unavailable', 'System down'],
  labs: ['Equipment broken', 'No power', 'Safety hazard', 'Overcrowded'],
  religious: ['Facility closed', 'Maintenance needed', 'Noise complaint'],
  workers: ['Maintenance needed', 'Security concern', 'Infrastructure damage'],
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ReportIssueModalProps {
  open: boolean;
  onClose: () => void;
  facilityName: string;
  facilityType: string;
}

export default function ReportIssueModal({ open, onClose, facilityName, facilityType }: ReportIssueModalProps) {
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const issues = ISSUE_TYPES[facilityType] || ['General issue', 'Maintenance needed', 'Safety concern'];

  const handleVerifyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setChecking(false);
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng);
        if (dist > CAMPUS_RADIUS_M) {
          toast.error('You are outside the campus perimeter.', {
            description: `You are ${(dist / 1000).toFixed(1)}km from campus.`,
            duration: 5000,
          });
          return;
        }
        setVerified(true);
      },
      (err) => {
        setChecking(false);
        toast.error('Enable location services: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async () => {
    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('facility_reports').insert({
      facility_name: facilityName,
      facility_type: facilityType,
      issue_type: issueType,
      description: description || '',
      reporter_name: reporterName || 'Anonymous',
    });
    setSubmitting(false);
    if (error) {
      toast.error('Failed to submit report: ' + error.message);
    } else {
      toast.success('Report submitted successfully!');
      handleClose();
    }
  };

  const handleClose = () => {
    setVerified(false);
    setIssueType('');
    setDescription('');
    setReporterName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden [&>button.absolute]:hidden">
        <DialogHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Report Issue — {facilityName}
          </DialogTitle>
          <button onClick={handleClose} className="rounded-full p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3">
          {!verified ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                We need to verify you're on campus before submitting a report.
              </p>
              <Button onClick={handleVerifyLocation} disabled={checking} size="sm" className="gap-2">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                {checking ? 'Verifying...' : 'Verify My Location'}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Facility</label>
                <input value={facilityName} readOnly className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-md border border-border" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Issue Type *</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background rounded-md border border-border"
                >
                  <option value="">Select an issue...</option>
                  {issues.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background rounded-md border border-border resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Your Name (optional)</label>
                <input
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Anonymous"
                  className="w-full mt-1 px-3 py-2 text-sm bg-background rounded-md border border-border"
                />
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="sm">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
