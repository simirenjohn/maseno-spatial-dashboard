import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, LogOut, RefreshCw, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Report {
  id: string;
  facility_name: string;
  facility_type: string;
  issue_type: string;
  description: string | null;
  reporter_name: string | null;
  status: string;
  created_at: string;
  photo_url: string | null;
}

export default function Admin() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Check admin role
        setTimeout(() => checkAdminRole(session.user.id), 0);
      } else {
        setIsAdmin(false);
        setCheckingAuth(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminRole(session.user.id);
      } else {
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!error && !!data);
    setCheckingAuth(false);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('facility_reports')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('Failed to load reports'); return; }
    setReports(data || []);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchReports();
  }, [isAdmin, fetchReports]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginLoading(false);
    if (error) {
      toast.error(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('facility_reports')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) { toast.error('Update failed: ' + error.message); return; }
    toast.success(`Status updated to ${newStatus}`);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 p-6 bg-card rounded-xl border border-border shadow-lg">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-lg font-bold">Admin Portal</h1>
            <p className="text-xs text-muted-foreground">Sign in with your admin account</p>
          </div>
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@maseno.ac.ke" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">Password</Label>
            <div className="relative mt-1">
              <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" size="sm" disabled={loginLoading}>
            {loginLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    );
  }

  // Logged in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 p-6 bg-card rounded-xl border border-border shadow-lg max-w-sm">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">Your account does not have admin privileges.</p>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1">
            <LogOut className="h-3 w-3" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Admin dashboard
  const filtered = statusFilter === 'All' ? reports : reports.filter(r => r.status === statusFilter);
  const counts = { All: reports.length, Pending: 0, 'In Progress': 0, Resolved: 0 };
  reports.forEach(r => { if (r.status in counts) counts[r.status as keyof typeof counts]++; });
  const statusColor = (s: string) => s === 'Pending' ? 'text-amber-600 bg-amber-50' : s === 'In Progress' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold">📋 Report Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="gap-1 text-xs">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-xs">
            <LogOut className="h-3 w-3" /> Logout
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-4 gap-3">
          {(['All', 'Pending', 'In Progress', 'Resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`p-3 rounded-lg border text-center transition-colors ${statusFilter === s ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="text-lg font-bold">{counts[s]}</div>
              <div className="text-xs text-muted-foreground">{s}</div>
            </button>
          ))}
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs">Facility</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Issue</th>
                  <th className="text-left px-3 py-2 font-medium text-xs hidden md:table-cell">Description</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Photo</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Reporter</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">No reports found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.facility_name}</td>
                    <td className="px-3 py-2">{r.issue_type}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">{r.description || '—'}</td>
                    <td className="px-3 py-2">
                      {r.photo_url ? (
                        <button
                          onClick={() => setLightboxUrl(r.photo_url)}
                          className="block w-12 h-12 rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
                          aria-label="View photo"
                        >
                          <img src={r.photo_url} alt="Issue" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.reporter_name || 'Anonymous'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full appearance-none pr-6 cursor-pointer border-none ${statusColor(r.status)}`}>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                        <ChevronDown className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={lightboxUrl}
            alt="Report photo"
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
