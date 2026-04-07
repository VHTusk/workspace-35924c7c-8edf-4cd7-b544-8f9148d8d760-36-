"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { indianStates, districtsByState } from "@/lib/indian-locations";
import { SportType } from "@prisma/client";

// Types
export interface GeographicScopeValue {
  sport?: SportType | "ALL";
  sectorId?: string;
  zoneId?: string;
  stateCode?: string;
  districtName?: string;
}

export interface GeographicScopeSelectorProps {
  value: GeographicScopeValue;
  onChange: (value: GeographicScopeValue) => void;
  showSport?: boolean;
  showSector?: boolean;
  showZone?: boolean;
  showDistrict?: boolean;
  minLevel?: "sport" | "sector" | "zone" | "state" | "district";
  disabled?: boolean;
  className?: string;
}

// Types for API responses
interface Sector {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  zones?: Zone[];
}

interface Zone {
  id: string;
  name: string;
  code: string;
  states: string[];
  sector: {
    id: string;
    name: string;
    code: string;
  };
  isActive: boolean;
}

export function GeographicScopeSelector({
  value,
  onChange,
  showSport = true,
  showSector = false,
  showZone = false,
  showDistrict = true,
  minLevel,
  disabled = false,
  className = "",
}: GeographicScopeSelectorProps) {
  // State for fetched data
  const [sectors, setSectors] = React.useState<Sector[]>([]);
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [loadingSectors, setLoadingSectors] = React.useState(false);
  const [loadingZones, setLoadingZones] = React.useState(false);

  // Fetch sectors on mount (if showSector is true)
  React.useEffect(() => {
    if (showSector) {
      fetchSectors();
    }
  }, [showSector]);

  // Fetch zones when sector changes (if showZone is true)
  React.useEffect(() => {
    if (showZone && value.sectorId) {
      fetchZones(value.sectorId);
    } else if (showZone && !value.sectorId) {
      // Fetch all zones if no sector selected
      fetchZones();
    }
  }, [showZone, value.sectorId]);

  const fetchSectors = async () => {
    setLoadingSectors(true);
    try {
      const response = await fetch("/api/admin/sectors");
      if (response.ok) {
        const data = await response.json();
        setSectors(data.sectors || []);
      }
    } catch (error) {
      console.error("Failed to fetch sectors:", error);
    } finally {
      setLoadingSectors(false);
    }
  };

  const fetchZones = async (sectorId?: string) => {
    setLoadingZones(true);
    try {
      const url = sectorId
        ? `/api/admin/zones?sectorId=${sectorId}`
        : "/api/admin/zones";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setZones(data.zones || []);
      }
    } catch (error) {
      console.error("Failed to fetch zones:", error);
    } finally {
      setLoadingZones(false);
    }
  };

  // Get available states based on selected zone or all states
  const availableStates = React.useMemo(() => {
    if (value.zoneId) {
      const selectedZone = zones.find((z) => z.id === value.zoneId);
      if (selectedZone && selectedZone.states) {
        return indianStates.filter((s) => selectedZone.states.includes(s.code));
      }
    }
    return indianStates;
  }, [value.zoneId, zones]);

  // Get districts for selected state
  const availableDistricts = React.useMemo(() => {
    if (value.stateCode) {
      return districtsByState[value.stateCode] || [];
    }
    return [];
  }, [value.stateCode]);

  // Handle change with cascading resets
  const handleSportChange = (sport: SportType | "ALL") => {
    onChange({
      sport,
      // Reset downstream values
      sectorId: undefined,
      zoneId: undefined,
      stateCode: undefined,
      districtName: undefined,
    });
  };

  const handleSectorChange = (sectorId: string) => {
    onChange({
      ...value,
      sectorId: sectorId || undefined,
      // Reset downstream values
      zoneId: undefined,
      stateCode: undefined,
      districtName: undefined,
    });
  };

  const handleZoneChange = (zoneId: string) => {
    const selectedZone = zones.find((z) => z.id === zoneId);
    onChange({
      ...value,
      zoneId: zoneId || undefined,
      // Reset downstream values
      stateCode: undefined,
      districtName: undefined,
    });
  };

  const handleStateChange = (stateCode: string) => {
    onChange({
      ...value,
      stateCode: stateCode || undefined,
      // Reset downstream values
      districtName: undefined,
    });
  };

  const handleDistrictChange = (districtName: string) => {
    onChange({
      ...value,
      districtName: districtName || undefined,
    });
  };

  // Determine if a field should be shown based on minLevel
  const shouldShow = (level: "sport" | "sector" | "zone" | "state" | "district"): boolean => {
    if (!minLevel) return true;

    const levels: Array<"sport" | "sector" | "zone" | "state" | "district"> = [
      "sport",
      "sector",
      "zone",
      "state",
      "district",
    ];
    const minIndex = levels.indexOf(minLevel);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= minIndex;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sport Selector */}
      {showSport && shouldShow("sport") && (
        <div className="space-y-2">
          <Label htmlFor="sport-select">Sport</Label>
          <Select
            value={value.sport || ""}
            onValueChange={handleSportChange}
            disabled={disabled}
          >
            <SelectTrigger id="sport-select" className="w-full">
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sports</SelectItem>
              <SelectItem value="CORNHOLE">Cornhole</SelectItem>
              <SelectItem value="DARTS">Darts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sector Selector (Super Admin only) */}
      {showSector && shouldShow("sector") && (
        <div className="space-y-2">
          <Label htmlFor="sector-select">Sector</Label>
          <Select
            value={value.sectorId || ""}
            onValueChange={handleSectorChange}
            disabled={disabled || loadingSectors}
          >
            <SelectTrigger id="sector-select" className="w-full">
              <SelectValue placeholder={
                loadingSectors ? "Loading sectors..." : "Select sector"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sectors</SelectItem>
              {sectors
                .filter((s) => s.isActive)
                .map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>
                    {sector.name} ({sector.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Zone Selector */}
      {showZone && shouldShow("zone") && (
        <div className="space-y-2">
          <Label htmlFor="zone-select">Zone</Label>
          <Select
            value={value.zoneId || ""}
            onValueChange={handleZoneChange}
            disabled={disabled || loadingZones}
          >
            <SelectTrigger id="zone-select" className="w-full">
              <SelectValue placeholder={
                loadingZones ? "Loading zones..." : "Select zone"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Zones</SelectItem>
              {zones
                .filter((z) => z.isActive)
                .map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name} ({zone.code})
                    {zone.sector && ` - ${zone.sector.name}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* State Selector */}
      {shouldShow("state") && (
        <div className="space-y-2">
          <Label htmlFor="state-select">State</Label>
          <Select
            value={value.stateCode || ""}
            onValueChange={handleStateChange}
            disabled={disabled}
          >
            <SelectTrigger id="state-select" className="w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="">All States</SelectItem>
              {availableStates.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name}
                  {state.type === "UT" && " (UT)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* District Selector */}
      {showDistrict && shouldShow("district") && (
        <div className="space-y-2">
          <Label htmlFor="district-select">District</Label>
          <Select
            value={value.districtName || ""}
            onValueChange={handleDistrictChange}
            disabled={disabled || !value.stateCode}
          >
            <SelectTrigger id="district-select" className="w-full">
              <SelectValue placeholder={
                !value.stateCode
                  ? "Select a state first"
                  : "Select district"
              } />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="">All Districts</SelectItem>
              {availableDistricts.map((district) => (
                <SelectItem key={district} value={district}>
                  {district}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// Export a simpler version for common use cases
export function StateDistrictSelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: { stateCode?: string; districtName?: string };
  onChange: (value: { stateCode?: string; districtName?: string }) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <GeographicScopeSelector
      value={value}
      onChange={onChange}
      showSport={false}
      showSector={false}
      showZone={false}
      showDistrict={true}
      disabled={disabled}
      className={className}
    />
  );
}

// Export a full admin scope selector with all options
export function AdminScopeSelector({
  value,
  onChange,
  isSuperAdmin = false,
  disabled = false,
  className = "",
}: {
  value: GeographicScopeValue;
  onChange: (value: GeographicScopeValue) => void;
  isSuperAdmin?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <GeographicScopeSelector
      value={value}
      onChange={onChange}
      showSport={isSuperAdmin}
      showSector={isSuperAdmin}
      showZone={true}
      showDistrict={true}
      disabled={disabled}
      className={className}
    />
  );
}

export default GeographicScopeSelector;
