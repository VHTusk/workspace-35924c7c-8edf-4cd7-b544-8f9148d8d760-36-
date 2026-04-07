'use client';

/**
 * Profession Profile Card (v3.53.0)
 * 
 * UI component for users to view and set their profession.
 * Supports association membership numbers and document upload.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Briefcase, 
  Check, 
  AlertCircle, 
  Clock, 
  Eye, 
  EyeOff,
  Loader2,
  Upload,
  FileText,
  Building2,
  X,
} from 'lucide-react';
import { Profession, ProfessionVerificationStatus } from '@prisma/client';

interface ProfessionInfo {
  profession: Profession | null;
  professionLabel: string | null;
  membershipNumber: string | null;
  governingBody: string | null;
  verificationStatus: ProfessionVerificationStatus;
  verifiedAt: string | null;
  showPublicly: boolean;
  canClaimRewards: boolean;
  documentUrl: string | null;
  availableProfessions: { value: Profession; label: string; governingBody: string }[];
}

interface ProfessionProfileCardProps {
  onProfessionChange?: (profession: Profession | null) => void;
}

export function ProfessionProfileCard({ onProfessionChange }: ProfessionProfileCardProps) {
  const [professionInfo, setProfessionInfo] = useState<ProfessionInfo | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<Profession | ''>('');
  const [membershipNumber, setMembershipNumber] = useState('');
  const [showPublicly, setShowPublicly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Document upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verificationNote, setVerificationNote] = useState('');

  // Fetch profession info
  useEffect(() => {
    fetchProfession();
  }, []);

  const fetchProfession = async () => {
    try {
      const response = await fetch('/api/users/me/profession');
      if (response.ok) {
        const data = await response.json();
        setProfessionInfo(data);
        setSelectedProfession(data.profession || '');
        setMembershipNumber(data.membershipNumber || '');
        setShowPublicly(data.showPublicly || false);
      }
    } catch (error) {
      console.error('Error fetching profession:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfession = async () => {
    if (!selectedProfession) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me/profession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profession: selectedProfession,
          membershipNumber: membershipNumber || null,
          showPublicly,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchProfession();
        onProfessionChange?.(selectedProfession);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save profession' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profession' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearProfession = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me/profession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profession cleared' });
        setSelectedProfession('');
        setMembershipNumber('');
        setShowPublicly(false);
        fetchProfession();
        onProfessionChange?.(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear profession' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear profession' });
    } finally {
      setSaving(false);
    }
  };

  const handleVisibilityChange = async (checked: boolean) => {
    try {
      const response = await fetch('/api/users/me/profession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setVisibility', showPublicly: checked }),
      });

      if (response.ok) {
        setShowPublicly(checked);
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setMessage({ type: 'error', text: 'Invalid file type. Please upload JPG, PNG, or PDF.' });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File too large. Maximum size is 5MB.' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setMessage(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'profession');

      // Upload to file API
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const uploadData = await uploadResponse.json();
      const documentUrl = uploadData.url;

      // Update profession with document
      const response = await fetch('/api/users/me/profession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadDocument',
          documentUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Document uploaded successfully. Verification pending.' });
        setShowUploadModal(false);
        setSelectedFile(null);
        fetchProfession();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update document' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload document' });
    } finally {
      setUploading(false);
    }
  };

  const getVerificationBadge = () => {
    if (!professionInfo) return null;

    switch (professionInfo.verificationStatus) {
      case 'VERIFIED':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Verification Pending
          </Badge>
        );
      case 'SELF_DECLARED':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Briefcase className="w-3 h-3 mr-1" />
            Self-declared
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get selected profession info for display
  const getSelectedProfessionInfo = () => {
    if (!selectedProfession || !professionInfo?.availableProfessions) return null;
    return professionInfo.availableProfessions.find(p => p.value === selectedProfession);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Profession
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Profession
          </CardTitle>
          <CardDescription>
            Declare your profession to participate in profession-exclusive tournaments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          {professionInfo?.profession && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getProfessionEmoji(professionInfo.profession)}
                  </span>
                  <div>
                    <p className="font-medium">{professionInfo.professionLabel}</p>
                    {professionInfo.governingBody && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {professionInfo.governingBody}
                      </p>
                    )}
                  </div>
                </div>
                {getVerificationBadge()}
              </div>
              
              {/* Membership Number */}
              {professionInfo.membershipNumber && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Membership No: </span>
                  <span className="font-mono">{professionInfo.membershipNumber}</span>
                </div>
              )}

              {/* Document Status */}
              {professionInfo.documentUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Document uploaded</span>
                  <a 
                    href={professionInfo.documentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Message Alert */}
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Profession Selector by Category */}
          <div className="space-y-2">
            <Label htmlFor="profession">Select Your Profession</Label>
            <Select
              value={selectedProfession}
              onValueChange={(value) => setSelectedProfession(value as Profession)}
            >
              <SelectTrigger id="profession">
                <SelectValue placeholder="Choose your profession" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {Object.entries(getProfessionsByCategory(professionInfo?.availableProfessions || [])).map(([category, professions]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                      {category}
                    </div>
                    {professions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span>{getProfessionEmoji(p.value)}</span>
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Governing Body Display */}
          {selectedProfession && getSelectedProfessionInfo() && (
            <Alert>
              <Building2 className="w-4 h-4" />
              <AlertDescription>
                <strong>Governing Body:</strong> {getSelectedProfessionInfo()?.governingBody}
              </AlertDescription>
            </Alert>
          )}

          {/* Membership Number Input */}
          {selectedProfession && selectedProfession !== 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="membership-number">
                Association Membership Number (Optional)
              </Label>
              <Input
                id="membership-number"
                placeholder="e.g., MCI-12345, BCI-2024-001"
                value={membershipNumber}
                onChange={(e) => setMembershipNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your registration/membership number from the governing body
              </p>
            </div>
          )}

          <Separator />

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                {showPublicly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Show Profession Publicly
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow others to see your profession on your profile
              </p>
            </div>
            <Switch
              checked={showPublicly}
              onCheckedChange={handleVisibilityChange}
              disabled={!selectedProfession}
            />
          </div>

          {/* Verification Notice & Upload Button */}
          {selectedProfession && professionInfo?.verificationStatus !== 'VERIFIED' && (
            <div className="space-y-3">
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-sm">
                  <strong>Note:</strong> To claim prizes, rankings, or official titles from 
                  profession-exclusive tournaments, you&apos;ll need to verify your profession 
                  by uploading supporting documents.
                </AlertDescription>
              </Alert>

              {/* Document Upload Button */}
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(true)}
                disabled={!selectedProfession}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {professionInfo?.documentUrl ? 'Update Document' : 'Upload Verification Document'}
              </Button>
            </div>
          )}

          {/* Verification Notes Section */}
          {professionInfo?.verificationStatus === 'REJECTED' && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Verification Rejected</strong>
                <p className="text-sm mt-1">
                  Your document was not accepted. Please upload a valid document showing 
                  your membership in the governing body.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveProfession}
              disabled={!selectedProfession || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profession
            </Button>
            {professionInfo?.profession && (
              <Button
                variant="outline"
                onClick={handleClearProfession}
                disabled={saving}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Verification Document
            </DialogTitle>
            <DialogDescription>
              Upload your professional ID card, membership certificate, or license
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Profession Info */}
            {selectedProfession && getSelectedProfessionInfo() && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{getSelectedProfessionInfo()?.label}</p>
                <p className="text-sm text-muted-foreground">
                  {getSelectedProfessionInfo()?.governingBody}
                </p>
              </div>
            )}

            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="document-upload">Select Document</Label>
              <Input
                id="document-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: JPG, PNG, PDF (max 5MB)
              </p>
            </div>

            {/* Selected File Preview */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Verification Notes */}
            <div className="space-y-2">
              <Label htmlFor="verification-note">Additional Notes (Optional)</Label>
              <Textarea
                id="verification-note"
                placeholder="Any additional information about your document..."
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                rows={3}
              />
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Make sure the document clearly shows your name, profession, and membership number.
                Verification typically takes 1-2 business days.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDocumentUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper function to get profession emoji
function getProfessionEmoji(profession: Profession): string {
  const emojis: Record<Profession, string> = {
    DOCTOR: '🏥',
    DENTIST: '🦷',
    NURSE: '👩‍⚕️',
    PHARMACIST: '💊',
    PHYSIOTHERAPIST: '🏃',
    RADIOLOGIST: '🔬',
    AYURVEDIC_DOCTOR: '🌿',
    HOMEOPATHIC_DOCTOR: '🍃',
    LAWYER: '⚖️',
    COMPANY_SECRETARY: '📋',
    NOTARY: '📜',
    CHARTERED_ACCOUNTANT: '📊',
    COST_ACCOUNTANT: '📈',
    ACTUARY: '🧮',
    ARCHITECT: '🏗️',
    ENGINEER: '🔧',
    TOWN_PLANNER: '🏘️',
    TEACHER: '📚',
    PROFESSOR: '🎓',
    JOURNALIST: '📰',
    REAL_ESTATE_AGENT: '🏠',
    INSURANCE_AGENT: '🛡️',
    STOCK_BROKER: '📈',
    MUTUAL_FUND_DISTRIBUTOR: '💹',
    PILOT: '✈️',
    AIRCRAFT_ENGINEER: '🔩',
    AIR_TRAFFIC_CONTROLLER: '🗼',
    STRUCTURAL_ENGINEER: '🏗️',
    CONTRACTOR: '🔨',
    AGRICULTURAL_SCIENTIST: '🌾',
    VETERINARIAN: '🐾',
    COACH: '🏅',
    REFEREE: '哨',
    OTHER: '📋',
  };
  return emojis[profession] || '📋';
}

// Helper function to group professions by category
function getProfessionsByCategory(professions: { value: Profession; label: string; governingBody: string }[]): Record<string, { value: Profession; label: string; governingBody: string }[]> {
  const categories: Record<string, string[]> = {
    'Medical & Allied': ['DOCTOR', 'DENTIST', 'NURSE', 'PHARMACIST', 'PHYSIOTHERAPIST', 'RADIOLOGIST', 'AYURVEDIC_DOCTOR', 'HOMEOPATHIC_DOCTOR'],
    'Legal': ['LAWYER', 'COMPANY_SECRETARY', 'NOTARY'],
    'Finance & Audit': ['CHARTERED_ACCOUNTANT', 'COST_ACCOUNTANT', 'ACTUARY'],
    'Engineering & Architecture': ['ARCHITECT', 'ENGINEER', 'TOWN_PLANNER', 'STRUCTURAL_ENGINEER'],
    'Education': ['TEACHER', 'PROFESSOR'],
    'Media': ['JOURNALIST'],
    'Real Estate': ['REAL_ESTATE_AGENT'],
    'Technical & Finance': ['INSURANCE_AGENT', 'STOCK_BROKER', 'MUTUAL_FUND_DISTRIBUTOR'],
    'Aviation': ['PILOT', 'AIRCRAFT_ENGINEER', 'AIR_TRAFFIC_CONTROLLER'],
    'Construction': ['CONTRACTOR'],
    'Agriculture': ['AGRICULTURAL_SCIENTIST', 'VETERINARIAN'],
    'Sports': ['COACH', 'REFEREE'],
    'Other': ['OTHER'],
  };

  const result: Record<string, { value: Profession; label: string; governingBody: string }[]> = {};

  for (const [category, professionValues] of Object.entries(categories)) {
    const categoryProfessions = professions.filter(p => professionValues.includes(p.value));
    if (categoryProfessions.length > 0) {
      result[category] = categoryProfessions;
    }
  }

  return result;
}
