'use client';

/**
 * QR Code Scanner Component for Tournament Check-in
 * Allows tournament directors to scan player QR codes for venue check-in
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { QrCode, Check, X, AlertCircle, Camera, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface QRScannerProps {
  tournamentId: string;
  tournamentName: string;
  onCheckIn?: (player: { id: string; name: string }) => void;
}

interface ScanResult {
  success: boolean;
  status: 'checked_in' | 'already_checked_in' | 'invalid_token' | 'expired' | 'not_registered';
  message: string;
  player?: {
    id: string;
    name: string;
    checkedInAt?: string;
  };
}

export function QRCodeScanner({ tournamentId, tournamentName, onCheckIn }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [checkInStats, setCheckInStats] = useState<{
    total: number;
    checkedIn: number;
    percentage: number;
  } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch check-in stats on mount
  useEffect(() => {
    let mounted = true;
    
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/verify-checkin`);
        if (response.ok && mounted) {
          const data = await response.json();
          setCheckInStats(data.data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
    
    return () => { mounted = false; };
  }, [tournamentId]);

  // Start camera for QR scanning
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsScanning(true);
    } catch {
      toast.error('Unable to access camera. Please check permissions.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Parse QR code data
  const parseQRData = (data: string): { tournamentId: string; playerId: string; token: string } | null => {
    try {
      // Expected format: https://valorhive.com/checkin?t=TOURNAMENT_ID&p=PLAYER_ID&token=TOKEN
      const url = new URL(data);
      const t = url.searchParams.get('t');
      const p = url.searchParams.get('p');
      const token = url.searchParams.get('token');

      if (t && p && token) {
        return { tournamentId: t, playerId: p, token };
      }
    } catch {
      // Try parsing as JSON
      try {
        const parsed = JSON.parse(data);
        if (parsed.tournamentId && parsed.playerId && parsed.checkInToken) {
          return {
            tournamentId: parsed.tournamentId,
            playerId: parsed.playerId,
            token: parsed.checkInToken,
          };
        }
      } catch {
        // Not valid JSON
      }
    }
    return null;
  };

  // Process check-in
  const processCheckIn = useCallback(async (playerId: string, token: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/verify-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, checkInToken: token }),
      });

      const result = await response.json();
      setLastScan(result.data || result);

      if (result.success) {
        toast.success(result.data.message);
        if (result.data.player && onCheckIn) {
          onCheckIn(result.data.player);
        }
        fetchStats(); // Refresh stats
      } else {
        toast.error(result.error || 'Check-in failed');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to process check-in');
    }
  }, [tournamentId, onCheckIn, fetchStats]);

  // Handle manual code entry
  const handleManualCheckIn = useCallback(async () => {
    if (!manualCode.trim()) {
      toast.error('Please enter a check-in code');
      return;
    }

    // Parse the manual code
    const parsed = parseQRData(manualCode.trim());
    if (!parsed) {
      toast.error('Invalid check-in code format');
      return;
    }

    await processCheckIn(parsed.playerId, parsed.token);
    setManualCode('');
  }, [manualCode, processCheckIn]);

  // Simulate QR scan (in production, use a library like html5-qrcode)
  const handleSimulatedScan = useCallback(async () => {
    // This would be replaced with actual QR scanning logic
    // For now, prompt user to enter code manually
    const code = prompt('Enter QR code data (or use manual entry below):');
    if (code) {
      const parsed = parseQRData(code);
      if (parsed) {
        await processCheckIn(parsed.playerId, parsed.token);
      } else {
        toast.error('Invalid QR code format');
      }
    }
  }, [processCheckIn]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      {checkInStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Check-in Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{checkInStats.checkedIn}/{checkInStats.total}</span>
              <Badge variant={checkInStats.percentage >= 80 ? 'default' : 'secondary'}>
                {checkInStats.percentage}%
              </Badge>
            </div>
            <Progress value={checkInStats.percentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Players checked in for {tournamentName}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scanner Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isScanning ? (
            <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white rounded-lg opacity-50" />
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="absolute bottom-4 right-4"
                onClick={stopCamera}
              >
                <X className="h-4 w-4 mr-2" />
                Stop Scanner
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center">
                <Camera className="h-12 w-12 text-muted-foreground" />
              </div>
              <Button onClick={startCamera} className="gap-2">
                <QrCode className="h-4 w-4" />
                Start Scanner
              </Button>
              <Button variant="outline" onClick={handleSimulatedScan}>
                Scan QR Code (Demo)
              </Button>
            </div>
          )}

          {/* Manual Code Entry */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Or enter check-in code manually:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Paste QR code data here..."
                className="flex-1 px-3 py-2 border rounded-md text-sm"
              />
              <Button onClick={handleManualCheckIn} disabled={!manualCode.trim()}>
                Check In
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Scan Result */}
      {lastScan && (
        <Alert variant={lastScan.success ? 'default' : 'destructive'}>
          {lastScan.success ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {lastScan.success ? 'Check-in Successful' : 'Check-in Failed'}
          </AlertTitle>
          <AlertDescription>
            {lastScan.player && (
              <div className="mt-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{lastScan.player.name}</span>
                {lastScan.status === 'already_checked_in' && lastScan.player.checkedInAt && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Already checked in at{' '}
                    {new Date(lastScan.player.checkedInAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
            <p className="mt-1">{lastScan.message}</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Player QR Code Display Component
 * Shows the player's QR code for tournament check-in
 */
interface PlayerQRCodeProps {
  tournamentId: string;
  tournamentName: string;
  playerId: string;
  sport: 'CORNHOLE' | 'DARTS';
  isCheckedIn?: boolean;
  checkedInAt?: Date;
}

export function PlayerQRCode({
  tournamentId,
  tournamentName,
  playerId,
  sport,
  isCheckedIn,
  checkedInAt,
}: PlayerQRCodeProps) {
  const [qrData, setQrData] = useState<{
    qrCodeUrl: string;
    expiresAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQRCode = async () => {
      try {
        const response = await fetch(
          `/api/tournaments/${tournamentId}/player-qr?playerId=${playerId}`
        );
        if (response.ok) {
          const data = await response.json();
          setQrData({
            qrCodeUrl: data.data.qrCode.imageUrl,
            expiresAt: data.data.qrCode.expiresAt,
          });
        }
      } catch (error) {
        console.error('Failed to fetch QR code:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, [tournamentId, playerId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading QR code...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-lg">{tournamentName}</CardTitle>
        <Badge variant="outline" className="w-fit mx-auto">
          {sport}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {isCheckedIn ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-semibold text-green-600">Checked In</p>
            {checkedInAt && (
              <p className="text-sm text-muted-foreground">
                at {new Date(checkedInAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        ) : qrData ? (
          <>
            <img
              src={qrData.qrCodeUrl}
              alt="Check-in QR Code"
              className="w-48 h-48 rounded-lg"
            />
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Show this QR code to the tournament director for check-in
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Valid until {new Date(qrData.expiresAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">QR code not available</p>
        )}
      </CardContent>
    </Card>
  );
}
