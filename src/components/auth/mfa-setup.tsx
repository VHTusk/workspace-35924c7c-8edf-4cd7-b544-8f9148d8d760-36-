"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  KeyRound,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Smartphone,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { fetchWithCsrf } from "@/lib/client-csrf";

interface MfaSetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface MfaStatus {
  enabled: boolean;
  setup: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
}

export function MfaSetup({ onComplete, onCancel }: MfaSetupProps) {
  const [step, setStep] = useState<'intro' | 'setup' | 'verify' | 'recovery' | 'complete'>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // MFA data
  const [secret, setSecret] = useState("");
  const [otpAuthUrl, setOtpAuthUrl] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  // Existing MFA status
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch current MFA status on mount
  useEffect(() => {
    const fetchMfaStatus = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const response = await fetch('/api/admin/mfa/status', { signal });
        if (signal.aborted) return;
        const data = await response.json();
        if (data.success && !signal.aborted) {
          setMfaStatus(data.data);
          if (data.data.enabled) {
            setStep('complete');
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to fetch MFA status:', err);
      }
    };

    fetchMfaStatus();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const startSetup = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/admin/mfa/setup', {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start MFA setup');
      }

      setSecret(data.data.secret);
      setOtpAuthUrl(data.data.otpAuthUrl);
      setRecoveryCodes(data.data.recoveryCodes);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchWithCsrf('/api/admin/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      // Update recovery codes from response if provided
      if (data.data?.recoveryCodes) {
        setRecoveryCodes(data.data.recoveryCodes);
      }

      setStep('recovery');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setSuccess("MFA has been successfully enabled for your account!");
    setMfaStatus({ ...mfaStatus!, enabled: true, setup: true });
    setStep('complete');
    
    if (onComplete) {
      onComplete();
    }
  };

  const handleCopyAllCodes = () => {
    const codesText = recoveryCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setSuccess("All recovery codes copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  };

  // Render based on current step
  if (step === 'complete' && mfaStatus?.enabled) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Two-Factor Authentication Enabled</h3>
              <p className="text-sm text-muted-foreground">
                Your account is protected with MFA
              </p>
            </div>
            <Badge variant="default" className="bg-green-500 ml-auto">
              Active
            </Badge>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Recovery codes remaining:</span>
            <Badge variant={mfaStatus.recoveryCodesRemaining > 3 ? "secondary" : "destructive"}>
              {mfaStatus.recoveryCodesRemaining} of 8
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Add an extra layer of security to your admin account
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">{success}</AlertDescription>
          </Alert>
        )}

        {step === 'intro' && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Two-Factor Authentication (2FA) is required for admin accounts. 
                This adds an extra layer of security by requiring a code from your 
                authenticator app when you sign in.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">What you'll need:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  An authenticator app (Google Authenticator, Authy, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Your phone to scan a QR code
                </li>
                <li className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  A safe place to store recovery codes
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Cancel
                </Button>
              )}
              <Button onClick={startSetup} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Enable 2FA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h4 className="font-medium">Scan this QR code</h4>
              <p className="text-sm text-muted-foreground">
                Use your authenticator app to scan the code below
              </p>
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center">
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border border-border">
                <div className="text-center text-xs text-muted-foreground p-4">
                  <QrCode className="w-24 h-24 mx-auto mb-2 opacity-50" />
                  <p>QR Code</p>
                  <p className="text-[10px]">Scan with your app</p>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Or enter this code manually:
            </div>

            {/* Secret Key Display */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md p-3 font-mono text-sm break-all">
                {showSecret ? secret : '•••• •••• •••• •••• ••••'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(secret)}
              >
                {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <Separator />

            {/* Verification Code Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter verification code</label>
              <Input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code shown in your authenticator app
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('intro')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-4">
            <Alert className="border-amber-500 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600">
                Save these recovery codes in a secure location. You won't be able to see them again!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Recovery Codes</h4>
                <Button variant="ghost" size="sm" onClick={handleCopyAllCodes}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-muted rounded-md p-4">
                {recoveryCodes.map((code, index) => (
                  <div
                    key={index}
                    className="font-mono text-sm bg-background rounded px-2 py-1 text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Each recovery code can only be used once. If you lose access to your 
              authenticator app, you can use these codes to sign in.
            </p>

            <Button onClick={handleComplete} className="w-full">
              <Check className="w-4 h-4 mr-2" />
              I've Saved My Recovery Codes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// MFA Settings Component for viewing/managing existing MFA
export function MfaSettings() {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchMfaStatus = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setLoading(true);
      try {
        const response = await fetch('/api/admin/mfa/status', { signal });
        if (signal.aborted) return;
        const data = await response.json();
        if (data.success && !signal.aborted) {
          setMfaStatus(data.data);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to fetch MFA status:', err);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchMfaStatus();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refreshKey]);

  const refreshMfaStatus = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showSetup || !mfaStatus?.enabled) {
    return <MfaSetup onComplete={() => { setShowSetup(false); refreshMfaStatus(); }} onCancel={mfaStatus?.enabled ? () => setShowSetup(false) : undefined} />;
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mfaStatus.enabled ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
            <Shield className={`w-5 h-5 ${mfaStatus.enabled ? 'text-green-500' : 'text-amber-500'}`} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {mfaStatus.enabled ? 'Your account is protected with 2FA' : '2FA is not enabled'}
            </CardDescription>
          </div>
          <Badge variant={mfaStatus.enabled ? "default" : "secondary"} className={mfaStatus.enabled ? "bg-green-500" : ""}>
            {mfaStatus.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {mfaStatus.enabled && (
          <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-md">
            <span className="text-muted-foreground">Recovery codes remaining:</span>
            <Badge variant={mfaStatus.recoveryCodesRemaining > 3 ? "secondary" : "destructive"}>
              {mfaStatus.recoveryCodesRemaining} of 8
            </Badge>
          </div>
        )}

        <div className="flex gap-2">
          {!mfaStatus.enabled && (
            <Button onClick={() => setShowSetup(true)} className="w-full">
              <Shield className="w-4 h-4 mr-2" />
              Enable 2FA
            </Button>
          )}
          {mfaStatus.enabled && (
            <>
              <Button variant="outline" onClick={() => setShowSetup(true)} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Codes
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
