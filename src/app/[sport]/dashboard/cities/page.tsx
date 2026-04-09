'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, MapPin, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { indianStates, getDistrictsForState } from '@/lib/indian-locations';
import { fetchWithCsrf } from '@/lib/client-csrf';
import { toast } from 'sonner';

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  state?: string;
  district?: string;
}

export default function DistrictsBrowsePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === 'cornhole';

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [redirectingToDistrict, setRedirectingToDistrict] = useState(false);

  const primaryTextClass = isCornhole ? 'text-green-600' : 'text-teal-600';
  const primaryBtnClass = isCornhole
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-teal-600 hover:bg-teal-700';

  const userDistrictUrl = useMemo(() => {
    if (!userData?.district || !userData?.state) {
      return null;
    }

    const normalizedDistrict = userData.district
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const normalizedState = userData.state.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sportCode = sport.toUpperCase();
    return `/${sport}/dashboard/district/VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`;
  }, [sport, userData?.district, userData?.state]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const sportUpper = sport.toUpperCase();
        const response = await fetch(`/api/player/me?sport=${sportUpper}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          toast.error('Unable to load challenger profile details');
        }
      } catch (error) {
        toast.error('Unable to load challenger profile details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [sport]);

  useEffect(() => {
    if (selectedState) {
      const stateObj = indianStates.find((state) => state.name === selectedState);
      setAvailableDistricts(stateObj ? getDistrictsForState(stateObj.code) : []);
    } else {
      setAvailableDistricts([]);
    }

    setSelectedDistrict('');
  }, [selectedState]);

  useEffect(() => {
    if (userDistrictUrl) {
      setRedirectingToDistrict(true);
      router.replace(userDistrictUrl);
    }
  }, [router, userDistrictUrl]);

  const handleSaveLocation = async () => {
    if (!selectedState || !selectedDistrict) {
      toast.error('Please select both state and district');
      return;
    }

    setSaving(true);
    try {
      const response = await fetchWithCsrf('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          district: selectedDistrict,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to save challenger location');
        return;
      }

      toast.success('Location saved successfully');
      const nextUserData = {
        ...userData,
        state: selectedState,
        district: selectedDistrict,
      } as UserData;
      setUserData(nextUserData);

      const normalizedDistrict = selectedDistrict.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normalizedState = selectedState.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sportCode = sport.toUpperCase();
      router.replace(
        `/${sport}/dashboard/district/VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`,
      );
    } catch (error) {
      toast.error('Failed to save challenger location');
    } finally {
      setSaving(false);
    }
  };

  const needsLocationSetup =
    !loading && !redirectingToDistrict && (!userData?.state || !userData?.district);

  return (
    <div className="p-6 max-w-4xl">
      <Dialog open={needsLocationSetup}>
        <DialogContent
          className="sm:max-w-xl"
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className={cn('h-5 w-5', primaryTextClass)} />
              Select your challenger location
            </DialogTitle>
            <DialogDescription>
              Choose the state and district you want to play from. Once saved, challenger
              mode will open your district page directly next time.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">State you want to play from</label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the state you want to play from" />
                </SelectTrigger>
                <SelectContent>
                  {indianStates.map((state) => (
                    <SelectItem key={state.code} value={state.name}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">District you want to play from</label>
              <Select
                value={selectedDistrict}
                onValueChange={setSelectedDistrict}
                disabled={!selectedState}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedState
                        ? 'Choose the district you want to play from'
                        : 'Choose your playing state first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableDistricts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveLocation}
              disabled={!selectedState || !selectedDistrict || saving}
              className={cn('text-white', primaryBtnClass)}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Save & Open My District
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl',
              isCornhole ? 'bg-green-50 text-green-600' : 'bg-teal-50 text-teal-600',
            )}
          >
            {loading || redirectingToDistrict ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Zap className="h-7 w-7" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Challenger Mode</h1>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading your challenger setup...
              </p>
            ) : redirectingToDistrict ? (
              <p className="text-sm text-muted-foreground">
                Opening your district challenger zone directly.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set your playing district once and challenger mode will always open in the
                right district page automatically.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
