"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Phone,
  Mail,
  Key,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DirectorInfo {
  name: string;
  phone: string;
  email?: string | null;
  username?: string;
  credentialsSent: boolean;
  assignedAt?: string | null;
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface TournamentDirectorCardProps {
  tournamentId: string;
  tournamentName: string;
  director: DirectorInfo | null;
  onDirectorChange?: () => void;
  onCreateMode?: boolean; // If true, shows compact form for creation
  onCreateAssign?: (director: { name: string; phone: string; email?: string }) => void;
}

export function TournamentDirectorCard({
  tournamentId,
  tournamentName,
  director,
  onDirectorChange,
  onCreateMode = false,
  onCreateAssign,
}: TournamentDirectorCardProps) {
  const { toast } = useToast();
  const [isAssigning, setIsAssigning] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
  };

  const handleAssign = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    // In creation mode, just pass the data up
    if (onCreateMode && onCreateAssign) {
      onCreateAssign({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined });
      return;
    }

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: director ? "update" : "assign",
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCredentials(data.credentials);
        setShowCredentialsDialog(true);
        toast({
          title: "Success",
          description: director ? "Director updated successfully" : "Director assigned successfully",
        });
        setName("");
        setPhone("");
        setEmail("");
        onDirectorChange?.();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to assign director",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign director",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove this director?")) return;

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Director removed successfully",
        });
        onDirectorChange?.();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to remove director",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove director",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRegenerateCredentials = async () => {
    if (!confirm("Generate new credentials? The old ones will stop working.")) return;

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          regenerateCredentials: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCredentials(data.credentials);
        setShowCredentialsDialog(true);
        toast({
          title: "Success",
          description: "New credentials generated",
        });
        onDirectorChange?.();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to regenerate credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate credentials",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Creation mode - compact form
  if (onCreateMode) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Tournament Director
              </CardTitle>
              <CardDescription>Optional - Assign now or add later</CardDescription>
            </div>
            <Badge variant="outline">Optional</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dir-name" className="text-xs">Director Name</Label>
              <Input
                id="dir-name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-phone" className="text-xs">Phone Number</Label>
              <Input
                id="dir-phone"
                placeholder="+91-9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir-email" className="text-xs">Email (optional)</Label>
            <Input
              id="dir-email"
              type="email"
              placeholder="director@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Login credentials will be auto-generated and displayed after tournament creation.
          </p>
        </CardContent>
      </Card>
    );
  }

  // View/Edit mode
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Tournament Director
              </CardTitle>
              <CardDescription>
                Manage director assignment and credentials
              </CardDescription>
            </div>
            {director && (
              <Badge variant={director.credentialsSent ? "default" : "secondary"}>
                {director.credentialsSent ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Credentials Sent
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {director ? (
            // Director assigned
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{director.name}</h4>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {director.phone}
                    </span>
                    {director.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {director.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      <Key className="h-3 w-3 mr-1" />
                      {director.username}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Credentials info */}
              {!director.credentialsSent && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Credentials have not been shared with the director yet. Share them manually.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCredentialsDialog(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Credentials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateCredentials}
                  disabled={isAssigning}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isAssigning}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>

              {/* Assignment info */}
              {director.assignedAt && (
                <p className="text-xs text-muted-foreground">
                  Assigned {new Date(director.assignedAt).toLocaleDateString()}
                  {director.assignedBy && ` by ${director.assignedBy.firstName} ${director.assignedBy.lastName}`}
                </p>
              )}
            </div>
          ) : (
            // No director - show assignment form
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No director assigned. Tournament can operate without one, but a director can manage match scores and venue operations.
                </AlertDescription>
              </Alert>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Assign Director</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Director Name *</Label>
                    <Input
                      id="name"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      placeholder="+91-9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="director@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={isAssigning || !name.trim() || !phone.trim()}
                >
                  <User className="h-4 w-4 mr-2" />
                  Assign Director
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Director Credentials
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the tournament director. They can login at /director/login
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tournament info */}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{tournamentName}</p>
              <p className="text-xs text-muted-foreground">Tournament ID: {tournamentId}</p>
            </div>

            {/* Credentials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-mono font-medium">{director?.username || credentials?.username}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(director?.username || credentials?.username || "", "Username")}
                >
                  {copied === "Username" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {credentials && (
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-xs text-muted-foreground">Password</p>
                    <p className="font-mono font-medium">
                      {showCredentials ? credentials.password : "••••••••••"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCredentials(!showCredentials)}
                    >
                      {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(credentials.password, "Password")}
                    >
                      {copied === "Password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Message template */}
            <div className="space-y-2">
              <Label className="text-xs">Share Message</Label>
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="whitespace-pre-line text-xs">
{`🎯 VALORHIVE Tournament Director Access

You have been assigned as the Tournament Director for:
📋 ${tournamentName}

Your login credentials:
👤 Username: ${director?.username || credentials?.username}
🔑 Password: ${credentials ? (showCredentials ? credentials.password : "[shown above]") : "[regenerate to view]"}

Login at: valorhive.com/director/login`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const message = `🎯 VALORHIVE Tournament Director Access\n\nYou have been assigned as the Tournament Director for:\n📋 ${tournamentName}\n\nYour login credentials:\n👤 Username: ${director?.username || credentials?.username}\n🔑 Password: ${credentials?.password || "[regenerate to view]"}\n\nLogin at: valorhive.com/director/login`;
                  navigator.clipboard.writeText(message);
                  toast({ title: "Message copied!", description: "Share this with the director" });
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Full Message
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
