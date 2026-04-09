"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Mail,
  Phone,
  MapPin,
  Calendar,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Crown,
  CreditCard,
  Edit2,
  X,
  Building2,
  Upload,
  Clock,
  FileText,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Heart,
  ChevronRight,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { VerificationBanners, useVerificationStatus } from "@/components/profile/verification-banners";
import { indianStates, getDistrictsForState } from "@/lib/indian-locations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ensureCsrfToken as ensureClientCsrfToken, fetchWithCsrf } from "@/lib/client-csrf";

interface Organization {
  id: string;
  name: string;
  type: string;
  district?: string;
  state?: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  photoUrl: string;
  bio: string;
  address: string;
  city: string;
  state: string;
  district: string;
  pinCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
  playerOrgType: string;
  verificationStatus: string;
  organizationId?: string | null;
  organization?: Organization | null;
  idDocumentUrl?: string | null;
  idDocumentType?: string | null;
  orgVerifiedAt?: string | null;
  verificationNotes?: string | null;
  profileUpdatedAt?: string | null;
  hasPassword?: boolean;
}

interface FormErrors {
  [key: string]: string;
}

interface SectionSaving {
  personal: boolean;
  address: boolean;
  emergency: boolean;
  organization: boolean;
  password: boolean;
}

const requiredFields = [
  { key: "firstName", label: "First Name", section: "personal" },
  { key: "lastName", label: "Last Name", section: "personal" },
  { key: "email", label: "Email", section: "personal" },
  { key: "phone", label: "Phone", section: "personal" },
  { key: "dob", label: "Date of Birth", section: "personal" },
  { key: "gender", label: "Gender", section: "personal" },
  { key: "state", label: "State", section: "address" },
  { key: "district", label: "District", section: "address" },
  { key: "pinCode", label: "PIN Code", section: "address" },
];

const emergencyRelationOptions = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Other",
];

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idDocInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showDeletePhotoDialog, setShowDeletePhotoDialog] = useState(false);
  
  // Per-section editing states
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionSaving, setSectionSaving] = useState<SectionSaving>({
    personal: false,
    address: false,
    emergency: false,
    organization: false,
    password: false,
  });
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Verification status for banners
  const verificationStatus = useVerificationStatus();

  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    photoUrl: "",
    bio: "",
    address: "",
    city: "",
    state: "",
    district: "",
    pinCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    isSubscribed: false,
    subscriptionPlan: null,
    playerOrgType: "INDEPENDENT",
    verificationStatus: "NONE",
    organizationId: null,
    organization: null,
    idDocumentUrl: null,
    idDocumentType: null,
    hasPassword: true,
  });

  // Edit form for each section
  const [personalForm, setPersonalForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    bio: "",
  });

  const [addressForm, setAddressForm] = useState({
    address: "",
    city: "",
    state: "",
    district: "",
    pinCode: "",
  });

  const [emergencyForm, setEmergencyForm] = useState({
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  });

  const [orgForm, setOrgForm] = useState({
    organizationId: "",
    playerOrgType: "INDEPENDENT",
    idDocumentUrl: "",
    idDocumentType: "",
  });

  useEffect(() => {
    fetchProfile();
    fetchOrganizations();
    ensureCsrfToken();
  }, []);

  const ensureCsrfToken = async () => {
    try {
      await ensureClientCsrfToken();
    } catch (err) {
      console.error("Failed to fetch CSRF token:", err);
    }
  };

  const fetchProfile = async () => {
    try {
      const sportUpper = (sport as string).toUpperCase();
      const response = await fetch(`/api/player/me?sport=${sportUpper}`);
      if (response.ok) {
        const data = await response.json();
        const profileData: ProfileData = {
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phone: data.phone || "",
          dob: data.dob ? new Date(data.dob).toISOString().split("T")[0] : "",
          gender: data.gender || "",
          photoUrl: data.photoUrl || "",
          bio: data.bio || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          district: data.district || "",
          pinCode: data.pinCode || "",
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactPhone: data.emergencyContactPhone || "",
          emergencyContactRelation: data.emergencyContactRelation || "",
          isSubscribed: data.isSubscribed || false,
          subscriptionPlan: data.subscriptionPlan || null,
          playerOrgType: data.playerOrgType || "INDEPENDENT",
          verificationStatus: data.verificationStatus || "NONE",
          organizationId: data.affiliatedOrgId || null,
          organization: data.affiliatedOrg || null,
          idDocumentUrl: data.idDocumentUrl || null,
          idDocumentType: data.idDocumentType || null,
          orgVerifiedAt: data.orgVerifiedAt || null,
          verificationNotes: data.verificationNotes || null,
          profileUpdatedAt: data.profileUpdatedAt || null,
          hasPassword: data.hasPassword ?? true,
        };
        setProfile(profileData);
        
        // Initialize section forms
        setPersonalForm({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone,
          dob: profileData.dob,
          gender: profileData.gender,
          bio: profileData.bio || "",
        });
        
        setAddressForm({
          address: profileData.address || "",
          city: profileData.city || "",
          state: profileData.state,
          district: profileData.district,
          pinCode: profileData.pinCode || "",
        });
        
        setEmergencyForm({
          emergencyContactName: profileData.emergencyContactName || "",
          emergencyContactPhone: profileData.emergencyContactPhone || "",
          emergencyContactRelation: profileData.emergencyContactRelation || "",
        });
        
        setOrgForm({
          organizationId: profileData.organizationId || "",
          playerOrgType: profileData.playerOrgType || "INDEPENDENT",
          idDocumentUrl: profileData.idDocumentUrl || "",
          idDocumentType: profileData.idDocumentType || "",
        });
        
        // Load districts for the state
        if (data.state) {
          const stateObj = indianStates.find(s => s.name === data.state);
          if (stateObj) {
            setDistricts(getDistrictsForState(stateObj.code));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const sportUpper = (sport as string).toUpperCase();
      const response = await fetch(`/api/search/orgs?sport=${sportUpper}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        const orgs = data.data?.results || data.organizations || [];
        setOrganizations(orgs);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  const calculateCompletion = () => {
    let filled = 0;
    requiredFields.forEach(field => {
      if (profile[field.key as keyof ProfileData]) {
        filled++;
      }
    });
    return Math.round((filled / requiredFields.length) * 100);
  };

  const completionPercentage = calculateCompletion();

  const getMissingFields = () => {
    return requiredFields.filter(field => !profile[field.key as keyof ProfileData]);
  };

  const handleStateChange = (stateName: string) => {
    const stateObj = indianStates.find(s => s.name === stateName);
    setAddressForm(prev => ({
      ...prev,
      state: stateName,
      district: "",
    }));
    
    if (stateObj) {
      setDistricts(getDistrictsForState(stateObj.code));
    } else {
      setDistricts([]);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profilePhoto');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Update profile with new photo URL immediately
        await updateProfileField('photoUrl', data.url);
        toast.success("Profile photo updated!");
      } else {
        toast.error(data.error || "Failed to upload image");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await updateProfileField('photoUrl', '');
      toast.success("Profile photo removed");
      setShowDeletePhotoDialog(false);
    } catch (err) {
      toast.error("Failed to remove photo");
    }
  };

  const handleIdDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error("Please upload an image or PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'idDocument');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        setOrgForm(prev => ({ ...prev, idDocumentUrl: data.url }));
        toast.success("ID document uploaded!");
      } else {
        toast.error(data.error || "Failed to upload document");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload document");
    }
  };

  // Generic profile field update
  const updateProfileField = async (field: string, value: any) => {
    const response = await fetchWithCsrf("/api/player/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [field]: value }),
    });

    if (response.ok) {
      setProfile(prev => ({ ...prev, [field]: value }));
      return true;
    }
    return false;
  };

  // Section-specific save functions
  const savePersonalSection = async () => {
    setSectionSaving(prev => ({ ...prev, personal: true }));
    setFormErrors({});

    const updates: Record<string, string> = {};
    if (personalForm.firstName !== profile.firstName) updates.firstName = personalForm.firstName;
    if (personalForm.lastName !== profile.lastName) updates.lastName = personalForm.lastName;
    if (personalForm.email !== profile.email) updates.email = personalForm.email;
    if (personalForm.phone !== profile.phone) updates.phone = personalForm.phone;
    if (personalForm.dob !== profile.dob) updates.dob = personalForm.dob;
    if (personalForm.gender !== profile.gender) updates.gender = personalForm.gender;
    if ((personalForm.bio || "") !== (profile.bio || "")) updates.bio = personalForm.bio;

    if (Object.keys(updates).length === 0) {
      setSectionSaving(prev => ({ ...prev, personal: false }));
      setEditingSection(null);
      toast("No changes to save");
      return;
    }
    
    // Validation
    const errors: FormErrors = {};
    if ("email" in updates && updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      errors.email = "Invalid email format";
    }
    if ("phone" in updates && updates.phone) {
      const cleanPhone = updates.phone.replace(/[\s-]/g, '');
      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) errors.phone = "Invalid phone number";
    }
    if ("bio" in updates && updates.bio && updates.bio.length > 500) errors.bio = "Bio must be 500 characters or less";
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSectionSaving(prev => ({ ...prev, personal: false }));
      toast.error("Please fix the errors");
      return;
    }
    
    try {
      const response = await fetchWithCsrf("/api/player/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update profile");
        if (data.errors) setFormErrors(data.errors);
        return;
      }

      setProfile(prev => ({
        ...prev,
        ...updates,
        profileUpdatedAt: new Date().toISOString(),
      }));
      
      setEditingSection(null);
      toast.success("Personal information updated!");
    } catch (err) {
      toast.error("An error occurred");
      console.error(err);
    } finally {
      setSectionSaving(prev => ({ ...prev, personal: false }));
    }
  };

  const saveAddressSection = async () => {
    setSectionSaving(prev => ({ ...prev, address: true }));
    setFormErrors({});

    const updates: Record<string, string> = {};
    if ((addressForm.address || "") !== (profile.address || "")) updates.address = addressForm.address;
    if ((addressForm.city || "") !== (profile.city || "")) updates.city = addressForm.city;
    if ((addressForm.state || "") !== (profile.state || "")) updates.state = addressForm.state;
    if ((addressForm.district || "") !== (profile.district || "")) updates.district = addressForm.district;
    if ((addressForm.pinCode || "") !== (profile.pinCode || "")) updates.pinCode = addressForm.pinCode;

    if (Object.keys(updates).length === 0) {
      setSectionSaving(prev => ({ ...prev, address: false }));
      setEditingSection(null);
      toast("No changes to save");
      return;
    }
    
    // Validation
    const errors: FormErrors = {};
    if ("pinCode" in updates && updates.pinCode && !/^\d{6}$/.test(updates.pinCode)) {
      errors.pinCode = "PIN code must be 6 digits";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSectionSaving(prev => ({ ...prev, address: false }));
      toast.error("Please fix the errors");
      return;
    }
    
    try {
      const response = await fetchWithCsrf("/api/player/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update address");
        return;
      }

      setProfile(prev => ({
        ...prev,
        ...updates,
        profileUpdatedAt: new Date().toISOString(),
      }));
      
      setEditingSection(null);
      toast.success("Address updated!");
    } catch (err) {
      toast.error("An error occurred");
      console.error(err);
    } finally {
      setSectionSaving(prev => ({ ...prev, address: false }));
    }
  };

  const saveEmergencySection = async () => {
    setSectionSaving(prev => ({ ...prev, emergency: true }));
    setFormErrors({});

    const updates: Record<string, string> = {};
    if ((emergencyForm.emergencyContactName || "") !== (profile.emergencyContactName || "")) {
      updates.emergencyContactName = emergencyForm.emergencyContactName;
    }
    if ((emergencyForm.emergencyContactPhone || "") !== (profile.emergencyContactPhone || "")) {
      updates.emergencyContactPhone = emergencyForm.emergencyContactPhone;
    }
    if ((emergencyForm.emergencyContactRelation || "") !== (profile.emergencyContactRelation || "")) {
      updates.emergencyContactRelation = emergencyForm.emergencyContactRelation;
    }

    if (Object.keys(updates).length === 0) {
      setSectionSaving(prev => ({ ...prev, emergency: false }));
      setEditingSection(null);
      toast("No changes to save");
      return;
    }
    
    // Validation
    const errors: FormErrors = {};
    if ("emergencyContactPhone" in updates && updates.emergencyContactPhone) {
      const cleanPhone = updates.emergencyContactPhone.replace(/[\s-]/g, '');
      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
        errors.emergencyContactPhone = "Invalid phone number";
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSectionSaving(prev => ({ ...prev, emergency: false }));
      toast.error("Please fix the errors");
      return;
    }
    
    try {
      const response = await fetchWithCsrf("/api/player/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update emergency contact");
        return;
      }

      setProfile(prev => ({
        ...prev,
        ...updates,
        profileUpdatedAt: new Date().toISOString(),
      }));
      
      setEditingSection(null);
      toast.success("Emergency contact updated!");
    } catch (err) {
      toast.error("An error occurred");
      console.error(err);
    } finally {
      setSectionSaving(prev => ({ ...prev, emergency: false }));
    }
  };

  const saveOrganizationSection = async () => {
    setSectionSaving(prev => ({ ...prev, organization: true }));

    const profileUpdates: Record<string, string> = {};
    if (orgForm.playerOrgType !== profile.playerOrgType) {
      profileUpdates.playerOrgType = orgForm.playerOrgType;
    }
    const organizationChanged = (orgForm.organizationId || "") !== (profile.organizationId || "");
    const documentChanged =
      (orgForm.idDocumentUrl || "") !== (profile.idDocumentUrl || "") ||
      (orgForm.idDocumentType || "") !== (profile.idDocumentType || "");

    if (Object.keys(profileUpdates).length === 0 && !organizationChanged && !documentChanged) {
      setSectionSaving(prev => ({ ...prev, organization: false }));
      setEditingSection(null);
      toast("No changes to save");
      return;
    }

    try {
      // First update basic profile
      if (Object.keys(profileUpdates).length > 0) {
        const response = await fetchWithCsrf("/api/player/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileUpdates),
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Failed to update organization");
          return;
        }
      }

      // If organization changed, submit verification request
      if (organizationChanged && orgForm.organizationId && orgForm.idDocumentUrl) {
        const orgResponse = await fetchWithCsrf("/api/player/organization", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationId: orgForm.organizationId,
            idDocumentUrl: orgForm.idDocumentUrl,
            idDocumentType: orgForm.idDocumentType || "other",
            playerOrgType: orgForm.playerOrgType || "EMPLOYEE",
          }),
        });

        if (!orgResponse.ok) {
          const orgData = await orgResponse.json();
          toast.error(orgData.error || "Failed to update organization");
          return;
        }
      }

      // Update local state
      const selectedOrg = organizations.find(o => o.id === orgForm.organizationId);
      setProfile(prev => ({
        ...prev,
        ...profileUpdates,
        organizationId: orgForm.organizationId || null,
        organization: selectedOrg || null,
        idDocumentUrl: orgForm.idDocumentUrl,
        idDocumentType: orgForm.idDocumentType,
        profileUpdatedAt: new Date().toISOString(),
      }));
      
      setEditingSection(null);
      toast.success("Organization updated!");
    } catch (err) {
      toast.error("An error occurred");
      console.error(err);
    } finally {
      setSectionSaving(prev => ({ ...prev, organization: false }));
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("All password fields are required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Password strength validation
    const passwordErrors: string[] = [];
    if (passwordData.newPassword.length < 8) passwordErrors.push("At least 8 characters");
    if (!/[A-Z]/.test(passwordData.newPassword)) passwordErrors.push("At least 1 uppercase letter");
    if (!/[a-z]/.test(passwordData.newPassword)) passwordErrors.push("At least 1 lowercase letter");
    if (!/[0-9]/.test(passwordData.newPassword)) passwordErrors.push("At least 1 number");

    if (passwordErrors.length > 0) {
      toast.error(`Password must have: ${passwordErrors.join(", ")}`);
      return;
    }

    setSectionSaving(prev => ({ ...prev, password: true }));

    try {
      const response = await fetchWithCsrf("/api/player/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
    } catch (err) {
      console.error(err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setSectionSaving(prev => ({ ...prev, password: false }));
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not Verified</Badge>;
    }
  };

  const getPlayerTypeBadge = (type: string) => {
    switch (type) {
      case "EMPLOYEE":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Employee</Badge>;
      case "CONTRACTED":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Contracted</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Independent</Badge>;
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatLastUpdated = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const cancelEdit = (section: string) => {
    // Reset form to current profile values
    switch (section) {
      case 'personal':
        setPersonalForm({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          dob: profile.dob,
          gender: profile.gender,
          bio: profile.bio || "",
        });
        break;
      case 'address':
        setAddressForm({
          address: profile.address || "",
          city: profile.city || "",
          state: profile.state,
          district: profile.district,
          pinCode: profile.pinCode || "",
        });
        if (profile.state) {
          const stateObj = indianStates.find(s => s.name === profile.state);
          if (stateObj) setDistricts(getDistrictsForState(stateObj.code));
        }
        break;
      case 'emergency':
        setEmergencyForm({
          emergencyContactName: profile.emergencyContactName || "",
          emergencyContactPhone: profile.emergencyContactPhone || "",
          emergencyContactRelation: profile.emergencyContactRelation || "",
        });
        break;
      case 'organization':
        setOrgForm({
          organizationId: profile.organizationId || "",
          playerOrgType: profile.playerOrgType || "INDEPENDENT",
          idDocumentUrl: profile.idDocumentUrl || "",
          idDocumentType: profile.idDocumentType || "",
        });
        break;
    }
    setEditingSection(null);
    setFormErrors({});
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Profile Picture with Drag and Drop */}
              <div 
                className="relative cursor-pointer"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className={cn(
                  "h-20 w-20 border-4 transition-all",
                  isDragging ? "border-primary scale-105" : "border-muted",
                  "hover:border-primary"
                )}>
                  <AvatarImage src={profile.photoUrl} />
                  <AvatarFallback className={cn("text-2xl font-bold", primaryBgClass, primaryTextClass)}>
                    {profile.firstName?.charAt(0) || "U"}{profile.lastName?.charAt(0) || ""}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute inset-0 rounded-full flex items-center justify-center transition-opacity bg-black/50 opacity-0 hover:opacity-100"
                )}>
                  {uploadingPhoto ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : isDragging ? (
                    <Upload className="h-6 w-6 text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                {profile.photoUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeletePhotoDialog(true);
                    }}
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="text-muted-foreground">Manage your profile settings</p>
                {profile.profileUpdatedAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <RefreshCw className="h-3 w-3" />
                    Last updated: {formatLastUpdated(profile.profileUpdatedAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Subscription Status */}
              {profile.isSubscribed ? (
                <Link href={`/${sport}/subscription`}>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-4 py-2 text-sm cursor-pointer hover:bg-emerald-200 transition-colors">
                    <Crown className="w-4 h-4 mr-2" />
                    {profile.subscriptionPlan} Member
                  </Badge>
                </Link>
              ) : (
                <Link href={`/${sport}/subscription`}>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-4 py-2 text-sm cursor-pointer hover:bg-amber-200 transition-colors">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Rookie
                  </Badge>
                </Link>
              )}
            </div>
          </div>

          {/* Verification Banners */}
          <VerificationBanners 
            className="mb-6" 
            profileComplete={verificationStatus.profileComplete}
            emailVerified={verificationStatus.emailVerified}
            phoneVerified={verificationStatus.phoneVerified}
          />

          {/* Profile Completion Card */}
          <Card className={cn("mb-6", primaryBorderClass)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className={cn("w-5 h-5", primaryTextClass)} />
                  <span className="font-medium text-foreground">Profile Completion</span>
                </div>
                <Badge className={cn(primaryBgClass, primaryTextClass)}>
                  {completionPercentage}%
                </Badge>
              </div>
              <Progress value={completionPercentage} className="h-2 mb-2" />
              {completionPercentage < 100 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Missing:</span>
                  {getMissingFields().map(field => (
                    <button
                      key={field.key}
                      onClick={() => {
                        setEditingSection(field.section);
                        setTimeout(() => scrollToSection(field.section), 100);
                      }}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {field.label}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
              {completionPercentage === 100 && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Your profile is complete!
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Personal Information */}
            <Card id="personal" className="bg-card border-border shadow-sm scroll-mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Your basic personal details</CardDescription>
                </div>
                {editingSection !== 'personal' ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingSection('personal')}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => cancelEdit('personal')}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={savePersonalSection}
                      disabled={sectionSaving.personal}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {sectionSaving.personal ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <>
                        <Input
                          value={personalForm.firstName}
                          onChange={(e) => {
                            setPersonalForm(prev => ({ ...prev, firstName: e.target.value }));
                            if (formErrors.firstName) setFormErrors(prev => ({ ...prev, firstName: '' }));
                          }}
                          placeholder="Enter your first name"
                          className={cn("border-input", formErrors.firstName && "border-red-500")}
                        />
                        {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
                      </>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.firstName || "-"}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <>
                        <Input
                          value={personalForm.lastName}
                          onChange={(e) => {
                            setPersonalForm(prev => ({ ...prev, lastName: e.target.value }));
                            if (formErrors.lastName) setFormErrors(prev => ({ ...prev, lastName: '' }));
                          }}
                          placeholder="Enter your last name"
                          className={cn("border-input", formErrors.lastName && "border-red-500")}
                        />
                        {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
                      </>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.lastName || "-"}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={personalForm.email}
                            onChange={(e) => {
                              setPersonalForm(prev => ({ ...prev, email: e.target.value }));
                              if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                            }}
                            placeholder="your@email.com"
                            className={cn("pl-10 border-input", formErrors.email && "border-red-500")}
                          />
                        </div>
                        {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                      </>
                    ) : (
                      <div className="p-2 text-foreground bg-muted rounded-md flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {profile.email || "-"}
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Phone <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={personalForm.phone}
                            onChange={(e) => {
                              setPersonalForm(prev => ({ ...prev, phone: e.target.value }));
                              if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                            }}
                            placeholder="+91 98765 43210"
                            className={cn("pl-10 border-input", formErrors.phone && "border-red-500")}
                          />
                        </div>
                        {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                      </>
                    ) : (
                      <div className="p-2 text-foreground bg-muted rounded-md flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {profile.phone || "-"}
                      </div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Date of Birth <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={personalForm.dob}
                          onChange={(e) => setPersonalForm(prev => ({ ...prev, dob: e.target.value }))}
                          className="pl-10 border-input"
                        />
                      </div>
                    ) : (
                      <div className="p-2 text-foreground bg-muted rounded-md flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {profile.dob ? new Date(profile.dob).toLocaleDateString() : "-"}
                      </div>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Gender <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'personal' ? (
                      <Select
                        value={personalForm.gender}
                        onValueChange={(value) => setPersonalForm(prev => ({ ...prev, gender: value }))}
                      >
                        <SelectTrigger className="border-input">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="MIXED">Mixed</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">
                        {profile.gender ? profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase() : "-"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label className="text-foreground">About Me</Label>
                  {editingSection === 'personal' ? (
                    <>
                      <Textarea
                        value={personalForm.bio}
                        onChange={(e) => {
                          setPersonalForm(prev => ({ ...prev, bio: e.target.value }));
                          if (formErrors.bio) setFormErrors(prev => ({ ...prev, bio: '' }));
                        }}
                        placeholder="Tell us about yourself, your interests, and sports experience..."
                        className={cn("border-input min-h-[100px]", formErrors.bio && "border-red-500")}
                        maxLength={500}
                      />
                      <div className="flex justify-between">
                        {formErrors.bio ? (
                          <p className="text-xs text-red-500">{formErrors.bio}</p>
                        ) : (
                          <span></span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {personalForm.bio?.length || 0}/500
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="p-2 text-foreground bg-muted rounded-md min-h-[60px] whitespace-pre-wrap">
                      {profile.bio || "No bio added yet"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card id="address" className="bg-card border-border shadow-sm scroll-mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Address Information
                  </CardTitle>
                  <CardDescription>Your location details</CardDescription>
                </div>
                {editingSection !== 'address' ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingSection('address')}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => cancelEdit('address')}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={saveAddressSection}
                      disabled={sectionSaving.address}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {sectionSaving.address ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Full Address */}
                <div className="space-y-2">
                  <Label className="text-foreground">Full Address</Label>
                  {editingSection === 'address' ? (
                    <Textarea
                      value={addressForm.address}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter your full address (street, building, area, etc.)"
                      className="border-input min-h-[80px]"
                      rows={3}
                    />
                  ) : (
                    <p className="p-2 text-foreground bg-muted rounded-md min-h-[60px]">{profile.address || "-"}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* State */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      State <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'address' ? (
                      <Select
                        value={addressForm.state}
                        onValueChange={handleStateChange}
                      >
                        <SelectTrigger className="border-input">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {indianStates.map((state) => (
                            <SelectItem key={state.code} value={state.name}>
                              {state.name}
                              {state.type === "UT" && " (UT)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.state || "-"}</p>
                    )}
                  </div>

                  {/* District */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      District <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'address' ? (
                      <Select
                        value={addressForm.district}
                        onValueChange={(value) => setAddressForm(prev => ({ ...prev, district: value }))}
                        disabled={!addressForm.state || districts.length === 0}
                      >
                        <SelectTrigger className="border-input">
                          <SelectValue placeholder={districts.length > 0 ? "Select district" : "Select state first"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {districts.map((district) => (
                            <SelectItem key={district} value={district}>
                              {district}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.district || "-"}</p>
                    )}
                  </div>

                  {/* PIN Code */}
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      PIN Code <span className="text-red-500">*</span>
                    </Label>
                    {editingSection === 'address' ? (
                      <>
                        <Input
                          value={addressForm.pinCode}
                          onChange={(e) => {
                            setAddressForm(prev => ({ ...prev, pinCode: e.target.value }));
                            if (formErrors.pinCode) setFormErrors(prev => ({ ...prev, pinCode: '' }));
                          }}
                          placeholder="Enter PIN code"
                          className={cn("border-input", formErrors.pinCode && "border-red-500")}
                          maxLength={6}
                        />
                        {formErrors.pinCode && <p className="text-xs text-red-500">{formErrors.pinCode}</p>}
                      </>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.pinCode || "-"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    Emergency Contact
                  </CardTitle>
                  <CardDescription>For tournament safety purposes</CardDescription>
                </div>
                {editingSection !== 'emergency' ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingSection('emergency')}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => cancelEdit('emergency')}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={saveEmergencySection}
                      disabled={sectionSaving.emergency}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {sectionSaving.emergency ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Contact Name */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Contact Name</Label>
                    {editingSection === 'emergency' ? (
                      <Input
                        value={emergencyForm.emergencyContactName}
                        onChange={(e) => setEmergencyForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                        placeholder="Emergency contact name"
                        className="border-input"
                      />
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.emergencyContactName || "-"}</p>
                    )}
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Contact Phone</Label>
                    {editingSection === 'emergency' ? (
                      <>
                        <Input
                          value={emergencyForm.emergencyContactPhone}
                          onChange={(e) => {
                            setEmergencyForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }));
                            if (formErrors.emergencyContactPhone) setFormErrors(prev => ({ ...prev, emergencyContactPhone: '' }));
                          }}
                          placeholder="+91 98765 43210"
                          className={cn("border-input", formErrors.emergencyContactPhone && "border-red-500")}
                        />
                        {formErrors.emergencyContactPhone && <p className="text-xs text-red-500">{formErrors.emergencyContactPhone}</p>}
                      </>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.emergencyContactPhone || "-"}</p>
                    )}
                  </div>

                  {/* Relationship */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Relationship</Label>
                    {editingSection === 'emergency' ? (
                      <Select
                        value={emergencyForm.emergencyContactRelation}
                        onValueChange={(value) => setEmergencyForm(prev => ({ ...prev, emergencyContactRelation: value }))}
                      >
                        <SelectTrigger className="border-input">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          {emergencyRelationOptions.map((relation) => (
                            <SelectItem key={relation} value={relation}>
                              {relation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 text-foreground bg-muted rounded-md">{profile.emergencyContactRelation || "-"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Organization Information */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Organization
                  </CardTitle>
                  <CardDescription>Your organization affiliation</CardDescription>
                </div>
                {editingSection !== 'organization' ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingSection('organization')}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => cancelEdit('organization')}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={saveOrganizationSection}
                      disabled={sectionSaving.organization}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {sectionSaving.organization ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Organization Selection */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Organization</Label>
                    {editingSection === 'organization' ? (
                      <Select
                        value={orgForm.organizationId || "NONE"}
                        onValueChange={(value) => setOrgForm(prev => ({ ...prev, organizationId: value === "NONE" ? "" : value }))}
                      >
                        <SelectTrigger className="border-border">
                          <SelectValue placeholder="Select your organization" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="NONE">None (Independent)</SelectItem>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name} ({org.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 text-foreground bg-muted rounded-md flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {profile.organization?.name || "Independent"}
                      </div>
                    )}
                  </div>

                  {/* Player Type */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Player Type</Label>
                    {editingSection === 'organization' && orgForm.organizationId ? (
                      <Select
                        value={orgForm.playerOrgType}
                        onValueChange={(value) => setOrgForm(prev => ({ ...prev, playerOrgType: value }))}
                      >
                        <SelectTrigger className="border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="CONTRACTED">Contracted Player</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 bg-muted rounded-md">
                        {getPlayerTypeBadge(profile.playerOrgType)}
                      </div>
                    )}
                  </div>

                  {/* Verification Status */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Verification Status</Label>
                    <div className="p-2 bg-muted rounded-md">
                      {getVerificationBadge(profile.verificationStatus)}
                    </div>
                  </div>

                  {/* ID Document Type */}
                  <div className="space-y-2">
                    <Label className="text-foreground">ID Document Type</Label>
                    {editingSection === 'organization' && orgForm.organizationId ? (
                      <Select
                        value={orgForm.idDocumentType || ""}
                        onValueChange={(value) => setOrgForm(prev => ({ ...prev, idDocumentType: value }))}
                      >
                        <SelectTrigger className="border-border">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee_id">Employee ID Card</SelectItem>
                          <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="pan">PAN Card</SelectItem>
                          <SelectItem value="driving_license">Driving License</SelectItem>
                          <SelectItem value="other">Other Government ID</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 text-foreground bg-muted rounded-md flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {profile.idDocumentType?.replace("_", " ") || "Not uploaded"}
                      </div>
                    )}
                  </div>
                </div>

                {/* ID Document Upload - Always visible when editing organization or when no org selected */}
                {(editingSection === 'organization' && orgForm.organizationId) && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-foreground">ID Document</Label>
                    <div 
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => idDocInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {orgForm.idDocumentUrl ? "Change document" : "Click to upload ID document"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports: JPG, PNG, PDF (max 10MB)
                      </p>
                    </div>
                    <input
                      ref={idDocInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleIdDocUpload}
                      className="hidden"
                    />
                    {orgForm.idDocumentUrl && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Document uploaded - Ready to save
                      </p>
                    )}
                  </div>
                )}

                {/* Show existing document status in view mode */}
                {editingSection !== 'organization' && profile.idDocumentUrl && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      ID Document: {profile.idDocumentType?.replace("_", " ") || "Uploaded"}
                    </p>
                  </div>
                )}

                {/* Verification Notes */}
                {profile.verificationNotes && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Admin Note:</strong> {profile.verificationNotes}
                    </p>
                  </div>
                )}

                {/* Info message when editing organization */}
                {editingSection === 'organization' && orgForm.organizationId && orgForm.organizationId !== profile.organizationId && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <strong>Note:</strong> Submitting a new organization will require verification from the organization admin.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Change Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Password</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.hasPassword ? "Change your password" : "Set up a password for your account"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                  >
                    {showPasswordForm ? "Cancel" : "Change Password"}
                  </Button>
                </div>

                {/* Password Change Form */}
                {showPasswordForm && (
                  <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Current Password */}
                    <div className="space-y-2">
                      <Label className="text-foreground">Current Password</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Enter current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                      <Label className="text-foreground">New Password</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Password strength indicator */}
                      <div className="space-y-1">
                        {[
                          { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
                          { test: (p: string) => /[A-Z]/.test(p), label: "1 uppercase letter" },
                          { test: (p: string) => /[a-z]/.test(p), label: "1 lowercase letter" },
                          { test: (p: string) => /[0-9]/.test(p), label: "1 number" },
                        ].map((req, i) => (
                          <p key={i} className={cn(
                            "text-xs flex items-center gap-1",
                            req.test(passwordData.newPassword) ? "text-green-600" : "text-muted-foreground"
                          )}>
                            {req.test(passwordData.newPassword) ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-current" />
                            )}
                            {req.label}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label className="text-foreground">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className={cn(
                            "pr-10",
                            passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && "border-red-500"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <p className="text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>

                    <Button
                      onClick={handleChangePassword}
                      disabled={sectionSaving.password}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {sectionSaving.password ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links Card */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Account Settings
                </CardTitle>
                <CardDescription>Manage your account preferences and security</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    href={`/${sport}/settings`}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                      <Lock className={cn("w-5 h-5", primaryTextClass)} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Settings</p>
                      <p className="text-sm text-muted-foreground">Notifications, privacy, rules</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                  </Link>
                  <Link
                    href={`/${sport}/settings?tab=security`}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                      <Shield className={cn("w-5 h-5", primaryTextClass)} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Security</p>
                      <p className="text-sm text-muted-foreground">Sessions, account deletion</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Delete Photo Confirmation Dialog */}
      <Dialog open={showDeletePhotoDialog} onOpenChange={setShowDeletePhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Profile Photo?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your profile photo? You can always upload a new one later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePhotoDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePhoto}>
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
