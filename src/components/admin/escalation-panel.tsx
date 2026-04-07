'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  UserX, 
  ArrowRight, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  UserCheck,
  XCircle
} from 'lucide-react';
import { SportType, AdminRole, EmergencyTriggerType, EmergencyStatus } from '@prisma/client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

interface EscalationPanelProps {
  sport?: SportType;
  stateCode?: string;
  onEmergencyInitiated?: () => void;
  onEmergencyResolved?: () => void;
}

interface EmergencyControlStatus {
  id: string;
  status: EmergencyStatus;
  originalAdmin?: {
    id: string;
    role: AdminRole;
    stateCode?: string;
    districtName?: string;
  };
  assumingAdmin: {
    id: string;
    userId: string;
    role: AdminRole;
  };
  triggerType: EmergencyTriggerType;
  triggeredAt: Date | string;
  duration: string;
  affectedResources: number;
}

interface AdminOption {
  id: string;
  userId: string;
  name: string;
  role: AdminRole;
  stateCode?: string;
  districtName?: string;
  isActive: boolean;
}

interface EscalationAlert {
  id: string;
  type: 'inactivity' | 'dispute' | 'system';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date | string;
  adminId?: string;
  adminRole?: AdminRole;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EscalationPanel({ 
  sport, 
  stateCode,
  onEmergencyInitiated,
  onEmergencyResolved 
}: EscalationPanelProps) {
  // State
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyControlStatus[]>([]);
  const [escalationAlerts, setEscalationAlerts] = useState<EscalationAlert[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Emergency Control Form
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [triggerType, setTriggerType] = useState<EmergencyTriggerType>(EmergencyTriggerType.ADMIN_DISABLED);
  const [triggerDescription, setTriggerDescription] = useState('');
  const [suggestedAdmin, setSuggestedAdmin] = useState<AdminOption | null>(null);
  
  // Voluntary Transfer Form
  const [voluntaryReason, setVoluntaryReason] = useState('');
  const [voluntaryDuration, setVoluntaryDuration] = useState('24');
  const [voluntaryReplacement, setVoluntaryReplacement] = useState('');
  
  // Resolve Emergency
  const [resolveNotes, setResolveNotes] = useState('');
  const [restoreOriginal, setRestoreOriginal] = useState(false);
  
  // Dialogs
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyControlStatus | null>(null);
  
  // Notifications
  const [notification, setNotification] = useState<{type: 'success' | 'error'; message: string} | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch active emergencies
      const emergenciesUrl = new URL('/api/admin/governance', window.location.origin);
      emergenciesUrl.searchParams.set('action', 'active-emergencies');
      if (sport) emergenciesUrl.searchParams.set('sport', sport);
      
      const emergenciesRes = await fetch(emergenciesUrl.toString());
      const emergenciesData = await emergenciesRes.json();
      
      if (emergenciesData.success) {
        setActiveEmergencies(emergenciesData.emergencies || []);
      }

      // Fetch escalation alerts (using inactive admins as proxy)
      const alertsUrl = new URL('/api/admin/governance', window.location.origin);
      alertsUrl.searchParams.set('action', 'inactive-admins');
      if (sport) alertsUrl.searchParams.set('sport', sport);
      if (stateCode) alertsUrl.searchParams.set('stateCode', stateCode);
      
      const alertsRes = await fetch(alertsUrl.toString());
      const alertsData = await alertsRes.json();
      
      if (alertsData.success && alertsData.admins) {
        // Convert inactive admins to alerts
        const alerts: EscalationAlert[] = alertsData.admins.map((admin: AdminOption) => ({
          id: admin.id,
          type: 'inactivity' as const,
          message: `${admin.role} has been inactive and may need attention`,
          severity: 'medium' as const,
          createdAt: new Date(),
          adminId: admin.id,
          adminRole: admin.role
        }));
        setEscalationAlerts(alerts);
      }

      // Fetch admins for selection
      const adminsUrl = new URL('/api/admin/assignments', window.location.origin);
      if (sport) adminsUrl.searchParams.set('sport', sport);
      
      const adminsRes = await fetch(adminsUrl.toString());
      const adminsData = await adminsRes.json();
      
      if (adminsData.success && adminsData.assignments) {
        setAdmins(adminsData.assignments);
      }
    } catch (error) {
      console.error('Error fetching escalation data:', error);
    } finally {
      setLoading(false);
    }
  }, [sport, stateCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleInitiateEmergency = async () => {
    if (!selectedAdmin || !triggerDescription.trim()) {
      setNotification({ type: 'error', message: 'Please select an admin and provide a reason' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/governance?action=initiate-emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: selectedAdmin,
          triggerType,
          triggerDescription,
          triggeredById: 'current-user' // Would be actual user ID
        })
      });

      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: data.message });
        setShowEmergencyDialog(false);
        fetchData();
        onEmergencyInitiated?.();
      } else {
        setNotification({ type: 'error', message: data.message || 'Failed to initiate emergency' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to initiate emergency control' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveEmergency = async () => {
    if (!selectedEmergency) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/governance?action=resolve-emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergencyId: selectedEmergency.id,
          resolvedById: 'current-user',
          restoreOriginal,
          notes: resolveNotes
        })
      });

      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: data.message });
        setShowResolveDialog(false);
        setSelectedEmergency(null);
        setResolveNotes('');
        setRestoreOriginal(false);
        fetchData();
        onEmergencyResolved?.();
      } else {
        setNotification({ type: 'error', message: data.message || 'Failed to resolve emergency' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to resolve emergency' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSelect = (adminId: string) => {
    setSelectedAdmin(adminId);
    
    // Find the selected admin and suggest next level admin
    const admin = admins.find(a => a.id === adminId);
    if (admin) {
      const higherLevelAdmin = admins.find(a => 
        getRoleLevel(a.role) < getRoleLevel(admin.role) && a.isActive
      );
      setSuggestedAdmin(higherLevelAdmin || null);
    }
  };

  // Helper function to get role level (lower number = higher authority)
  const getRoleLevel = (role: AdminRole): number => {
    const hierarchy: AdminRole[] = [
      AdminRole.SUPER_ADMIN,
      AdminRole.SPORT_ADMIN,
      AdminRole.STATE_ADMIN,
      AdminRole.DISTRICT_ADMIN,
      AdminRole.TOURNAMENT_DIRECTOR,
    ];
    return hierarchy.indexOf(role);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTriggerTypeLabel = (type: EmergencyTriggerType) => {
    const labels: Record<EmergencyTriggerType, string> = {
      [EmergencyTriggerType.ADMIN_DISABLED]: 'Admin Disabled',
      [EmergencyTriggerType.INACTIVITY_TIMEOUT]: 'Inactivity Timeout',
      [EmergencyTriggerType.SYSTEM_FAILURE]: 'System Failure',
      [EmergencyTriggerType.REGIONAL_EMERGENCY]: 'Regional Emergency',
      [EmergencyTriggerType.SECURITY_INCIDENT]: 'Security Incident',
      [EmergencyTriggerType.VOLUNTARY_TRANSFER]: 'Voluntary Transfer',
      [EmergencyTriggerType.SCHEDULE_CONFLICT]: 'Schedule Conflict',
    };
    return labels[type] || type;
  };

  const getRoleLabel = (role: AdminRole) => {
    return role.replace(/_/g, ' ').replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{notification.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Escalation Alerts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle>Escalation Alerts</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Pending escalations and admin issues that need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : escalationAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No pending escalations</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {escalationAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alert.message}</span>
                      <Badge variant="outline" className={getSeverityBadge(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </div>
                    {alert.adminRole && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Role: {getRoleLabel(alert.adminRole)}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedAdmin(alert.adminId || '');
                      setShowEmergencyDialog(true);
                    }}
                  >
                    Take Action
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <CardTitle>Emergency Control Panel</CardTitle>
          </div>
          <CardDescription>
            Initiate emergency control transfer when an admin is unavailable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Initiate Emergency Transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Initiate Emergency Control</DialogTitle>
                <DialogDescription>
                  This will transfer authority from an unavailable admin to the next level in the hierarchy.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Admin to Transfer FROM */}
                <div className="space-y-2">
                  <Label htmlFor="admin-from">Admin to Transfer FROM</Label>
                  <Select value={selectedAdmin} onValueChange={handleAdminSelect}>
                    <SelectTrigger id="admin-from">
                      <SelectValue placeholder="Select admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          <div className="flex items-center gap-2">
                            <span>{admin.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {getRoleLabel(admin.role)}
                            </Badge>
                            {!admin.isActive && (
                              <Badge variant="destructive" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-suggested Admin to Transfer TO */}
                {suggestedAdmin && (
                  <Alert>
                    <ArrowRight className="h-4 w-4" />
                    <AlertTitle>Suggested Transfer Target</AlertTitle>
                    <AlertDescription>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-medium">{suggestedAdmin.name}</span>
                        <Badge variant="outline">{getRoleLabel(suggestedAdmin.role)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This admin is at the next level up in the hierarchy
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Trigger Type */}
                <div className="space-y-2">
                  <Label htmlFor="trigger-type">Trigger Type</Label>
                  <Select 
                    value={triggerType} 
                    onValueChange={(v) => setTriggerType(v as EmergencyTriggerType)}
                  >
                    <SelectTrigger id="trigger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmergencyTriggerType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {getTriggerTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Required)</Label>
                  <Textarea
                    id="reason"
                    value={triggerDescription}
                    onChange={(e) => setTriggerDescription(e.target.value)}
                    placeholder="Explain why emergency transfer is needed..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowEmergencyDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleInitiateEmergency}
                  disabled={submitting || !selectedAdmin || !triggerDescription.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Confirm Transfer
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Voluntary Transfer Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-blue-500" />
            <CardTitle>Voluntary Transfer Request</CardTitle>
          </div>
          <CardDescription>
            Request a temporary transfer of authority
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours)</Label>
              <Select value={voluntaryDuration} onValueChange={setVoluntaryDuration}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="24">1 day</SelectItem>
                  <SelectItem value="48">2 days</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="replacement">Specific Replacement (Optional)</Label>
              <Select value={voluntaryReplacement} onValueChange={setVoluntaryReplacement}>
                <SelectTrigger id="replacement">
                  <SelectValue placeholder="Auto-select from hierarchy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-select</SelectItem>
                  {admins
                    .filter(a => a.isActive)
                    .map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name} ({getRoleLabel(admin.role)})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <Label htmlFor="voluntary-reason">Reason</Label>
            <Textarea
              id="voluntary-reason"
              value={voluntaryReason}
              onChange={(e) => setVoluntaryReason(e.target.value)}
              placeholder="Explain why you need a temporary transfer..."
              rows={2}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full"
            disabled={!voluntaryReason.trim() || submitting}
            onClick={async () => {
              // This would call the voluntary transfer API
              setNotification({ type: 'success', message: 'Transfer request submitted' });
              setVoluntaryReason('');
            }}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Request Transfer
          </Button>
        </CardFooter>
      </Card>

      {/* Active Emergencies / Resolve Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle>Active Emergencies</CardTitle>
            {activeEmergencies.length > 0 && (
              <Badge variant="destructive">{activeEmergencies.length}</Badge>
            )}
          </div>
          <CardDescription>
            Currently active emergency control situations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeEmergencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No active emergencies</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeEmergencies.map((emergency) => (
                <div 
                  key={emergency.id}
                  className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="font-medium">
                          {getTriggerTypeLabel(emergency.triggerType)}
                        </span>
                        <Badge variant="destructive">Active</Badge>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p className="flex items-center gap-2">
                          <UserX className="h-3 w-3 text-muted-foreground" />
                          <span>From: </span>
                          <Badge variant="outline">
                            {emergency.originalAdmin?.role ? getRoleLabel(emergency.originalAdmin.role) : 'Unknown'}
                          </Badge>
                          {emergency.originalAdmin?.stateCode && (
                            <span className="text-muted-foreground">
                              ({emergency.originalAdmin.stateCode})
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span>To: </span>
                          <Badge variant="outline">
                            {getRoleLabel(emergency.assumingAdmin.role)}
                          </Badge>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {emergency.duration}
                        </span>
                        <span>{emergency.affectedResources} affected resources</span>
                      </div>
                    </div>
                    
                    <Dialog 
                      open={showResolveDialog && selectedEmergency?.id === emergency.id}
                      onOpenChange={(open) => {
                        setShowResolveDialog(open);
                        if (open) setSelectedEmergency(emergency);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve Emergency</DialogTitle>
                          <DialogDescription>
                            Restore normal operations and optionally return authority to the original admin.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id="restore-original"
                              checked={restoreOriginal}
                              onChange={(e) => setRestoreOriginal(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="restore-original">
                              Restore authority to original admin
                            </Label>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="resolve-notes">Notes</Label>
                            <Textarea
                              id="resolve-notes"
                              value={resolveNotes}
                              onChange={(e) => setResolveNotes(e.target.value)}
                              placeholder="Add any notes about the resolution..."
                              rows={3}
                            />
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setShowResolveDialog(false);
                              setSelectedEmergency(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            variant="default"
                            onClick={handleResolveEmergency}
                            disabled={submitting}
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Resolving...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirm Resolution
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear notification button */}
      {notification && (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setNotification(null)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

export default EscalationPanel;
