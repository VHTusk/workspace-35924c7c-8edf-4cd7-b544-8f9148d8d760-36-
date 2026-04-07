"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  MapPin, 
  Camera, 
  Loader2,
  Target
} from "lucide-react";

interface StepProfileProps {
  data: {
    displayName: string;
    avatarUrl: string;
    sportPreferences: string[];
    city: string;
    state: string;
  };
  onChange: (data: Partial<StepProfileProps["data"]>) => void;
  sport: string;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
    sport: string;
  };
}

const sports = [
  { id: "CORNHOLE", name: "Cornhole", icon: "🎯" },
  { id: "DARTS", name: "Darts", icon: "🎯" },
];

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep"
].sort();

export function StepProfile({ data, onChange, sport, user }: StepProfileProps) {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  const handleSportToggle = (sportId: string) => {
    const current = data.sportPreferences;
    const updated = current.includes(sportId)
      ? current.filter(s => s !== sportId)
      : [...current, sportId];
    onChange({ sportPreferences: updated });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    setUploadingAvatar(true);

    try {
      // Convert to base64 for demo (in production, upload to cloud storage)
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ avatarUrl: reader.result as string });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadingAvatar(false);
    }
  };

  const getInitials = () => {
    if (data.displayName) {
      const parts = data.displayName.split(' ');
      return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return "U";
  };

  return (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
            <AvatarImage src={data.avatarUrl} alt="Avatar" />
            <AvatarFallback className="text-lg bg-gray-200">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
            className={`absolute bottom-0 right-0 w-8 h-8 rounded-full ${isCornhole ? "bg-green-600" : "bg-teal-600"} text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity`}
          >
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <p className="text-sm text-gray-500 mt-2">Upload a profile photo (optional)</p>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="displayName" className="text-gray-700 flex items-center gap-2">
          <User className="w-4 h-4" />
          Display Name
        </Label>
        <Input
          id="displayName"
          placeholder="How should others see your name?"
          value={data.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          className="border-gray-200 focus-visible:ring-green-500"
        />
        <p className="text-xs text-gray-500">
          This is how your name will appear on leaderboards and profiles
        </p>
      </div>

      {/* Sport Preferences */}
      <div className="space-y-3">
        <Label className="text-gray-700 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Sport Preferences *
        </Label>
        <p className="text-sm text-gray-500">
          Select the sports you're interested in competing in
        </p>
        <div className="grid grid-cols-2 gap-3">
          {sports.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSportToggle(s.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                data.sportPreferences.includes(s.id)
                  ? `${primaryBorderClass} ${primaryBgClass} ${primaryTextClass} font-medium`
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="block mt-1">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <Label className="text-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location (for tournament recommendations)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm text-gray-600">City</Label>
            <Input
              id="city"
              placeholder="e.g., Mumbai"
              value={data.city}
              onChange={(e) => onChange({ city: e.target.value })}
              className="border-gray-200 focus-visible:ring-green-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className="text-sm text-gray-600">State</Label>
            <select
              id="state"
              value={data.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className="w-full h-10 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Select State</option>
              {indianStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          We'll recommend tournaments near your location
        </p>
      </div>
    </div>
  );
}
