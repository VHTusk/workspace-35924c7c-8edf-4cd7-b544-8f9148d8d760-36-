'use client';

/**
 * Push Notification Permission Component
 * Handles FCM token registration and permission flow
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Smartphone, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface PushNotificationPermissionProps {
  userId: string;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  showPrompt?: boolean;
}

type PermissionState = 'default' | 'granted' | 'denied';

export function PushNotificationPermission({
  userId,
  onPermissionGranted,
  onPermissionDenied,
  showPrompt = true,
}: PushNotificationPermissionProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>('default');
  const [isRegistering, setIsRegistering] = useState(false);
  const [devices, setDevices] = useState<Array<{
    id: string;
    platform: string;
    deviceName: string | null;
    lastUsedAt: Date | null;
    notificationsEnabled: boolean;
  }>>([]);
  const [showBanner, setShowBanner] = useState(false);

  // Check current permission state
  useEffect(() => {
    const checkPermission = async () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermissionState(Notification.permission as PermissionState);
        
        // Show banner if permission is default
        if (Notification.permission === 'default' && showPrompt) {
          // Check if user has dismissed before
          const dismissed = localStorage.getItem('push-banner-dismissed');
          if (!dismissed) {
            setTimeout(() => setShowBanner(true), 2000);
          }
        }
      }

      // Fetch registered devices
      try {
        const response = await fetch('/api/user/push-token');
        if (response.ok) {
          const data = await response.json();
          setDevices(data.data || []);
        }
      } catch {
        // Ignore fetch errors
      }
    };

    checkPermission();
  }, [showPrompt]);

  // Request permission and register token
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }

    setIsRegistering(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PermissionState);

      if (permission === 'granted') {
        // Get FCM token (would need Firebase SDK in production)
        // For now, generate a mock token
        const token = await getFCMToken();
        
        if (token) {
          // Register with backend
          const response = await fetch('/api/user/push-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              platform: getPlatform(),
              deviceName: getDeviceName(),
            }),
          });

          if (response.ok) {
            toast.success('Push notifications enabled!');
            onPermissionGranted?.();
            
            // Refresh devices
            const devicesRes = await fetch('/api/user/push-token');
            if (devicesRes.ok) {
              const data = await devicesRes.json();
              setDevices(data.data || []);
            }
          } else {
            toast.error('Failed to register device');
          }
        }
      } else if (permission === 'denied') {
        toast.error('Push notifications blocked. Enable in browser settings.');
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Permission request error:', error);
      toast.error('Failed to request permission');
    } finally {
      setIsRegistering(false);
    }
  }, [onPermissionGranted, onPermissionDenied]);

  // Unregister device
  const unregisterDevice = useCallback(async (device: { id: string; platform: string }) => {
    try {
      // If it's the current device, remove from local storage too
      const currentToken = localStorage.getItem('fcm-token');
      
      const response = await fetch(`/api/user/push-token?token=${currentToken || device.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDevices(prev => prev.filter(d => d.id !== device.id));
        toast.success('Device unregistered');
      }
    } catch {
      toast.error('Failed to unregister device');
    }
  }, []);

  // Dismiss banner
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('push-banner-dismissed', 'true');
  }, []);

  return (
    <>
      {/* Permission Banner */}
      <AnimatePresence>
        {showBanner && permissionState === 'default' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
          >
            <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Stay Updated
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={dismissBanner}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enable push notifications to get instant updates about matches, 
                  tournaments, and your achievements.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={requestPermission}
                    disabled={isRegistering}
                    className="flex-1"
                  >
                    {isRegistering ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Enabling...
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        Enable Notifications
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={dismissBanner}>
                    Not Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {permissionState === 'granted' ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
              ) : permissionState === 'denied' ? (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <BellOff className="h-5 w-5 text-red-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-gray-600" />
                </div>
              )}
              <div>
                <p className="font-medium">
                  {permissionState === 'granted'
                    ? 'Notifications Enabled'
                    : permissionState === 'denied'
                    ? 'Notifications Blocked'
                    : 'Notifications Not Enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {permissionState === 'granted'
                    ? `${devices.length} device(s) registered`
                    : permissionState === 'denied'
                    ? 'Enable in browser settings'
                    : 'Get instant match & tournament updates'}
                </p>
              </div>
            </div>
            
            {permissionState === 'default' && (
              <Button onClick={requestPermission} disabled={isRegistering}>
                Enable
              </Button>
            )}
            
            {permissionState === 'denied' && (
              <Button variant="outline" asChild>
                <a
                  href="https://support.google.com/chrome/answer/3220216"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How to Enable
                </a>
              </Button>
            )}
          </div>

          {/* Registered Devices */}
          {devices.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Registered Devices</h4>
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {device.deviceName || `${device.platform} device`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {device.lastUsedAt 
                            ? new Date(device.lastUsedAt).toLocaleDateString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unregisterDevice(device)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Helper functions
async function getFCMToken(): Promise<string | null> {
  // In production, this would use Firebase SDK:
  // const messaging = getMessaging(app);
  // return await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY });

  // For development, generate a mock token
  const mockToken = `mock_fcm_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  localStorage.setItem('fcm-token', mockToken);
  return mockToken;
}

function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  
  const ua = navigator.userAgent;
  
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'ios';
  } else if (/Android/.test(ua)) {
    return 'android';
  }
  
  return 'web';
}

function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  
  const ua = navigator.userAgent;
  
  // Try to extract device name from UA
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?;\s*([^;)]+)/);
    return match ? match[1] : 'Android Device';
  }
  
  // Desktop browsers
  if (/Chrome/.test(ua)) return 'Chrome Browser';
  if (/Firefox/.test(ua)) return 'Firefox Browser';
  if (/Safari/.test(ua)) return 'Safari Browser';
  if (/Edge/.test(ua)) return 'Edge Browser';
  
  return 'Web Browser';
}

// Permission prompt button component
export function EnableNotificationsButton({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}) {
  // Get initial permission state synchronously to avoid effect cascading
  const getInitialPermission = (): PermissionState => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as PermissionState;
    }
    return 'default';
  };
  
  const [permissionState, setPermissionState] = useState<PermissionState>(getInitialPermission);

  const handleClick = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    setPermissionState(permission as PermissionState);

    if (permission === 'granted') {
      toast.success('Notifications enabled!');
    } else if (permission === 'denied') {
      toast.error('Notifications blocked');
    }
  }, []);

  if (permissionState === 'granted') {
    return (
      <Button variant={variant} className={className} disabled>
        <Check className="h-4 w-4 mr-2" />
        Notifications On
      </Button>
    );
  }

  if (permissionState === 'denied') {
    return (
      <Button variant={variant} className={className} disabled>
        <BellOff className="h-4 w-4 mr-2" />
        Blocked
      </Button>
    );
  }

  return (
    <Button variant={variant} className={className} onClick={handleClick}>
      <Bell className="h-4 w-4 mr-2" />
      Enable Notifications
    </Button>
  );
}
