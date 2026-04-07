"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  Trophy,
  Users,
  ArrowRight,
  Loader2,
  Star,
  Bell,
  Bookmark,
} from "lucide-react";

interface SavedTournament {
  id: string;
  tournamentId: string;
  createdAt: string;
  tournament: {
    id: string;
    name: string;
    startDate: string;
    location: string;
  };
}

interface SpectatorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  playerAccountType: string;
  createdAt: string;
}

export default function SpectatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SpectatorProfile | null>(null);
  const [savedTournaments, setSavedTournaments] = useState<SavedTournament[]>([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [sport]);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const response = await fetch("/api/spectator/upgrade", {
        method: "POST",
      });
      
      if (response.ok) {
        router.push(`/${sport}/dashboard`);
      } else {
        const data = await response.json();
        console.error("Upgrade failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to upgrade:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Spectator Profile</h1>
            <p className="text-gray-500">View tournaments, follow players, and track leaderboards</p>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Eye className="w-3 h-3 mr-1" />
            Spectator Account
          </Badge>
        </div>

        {/* Upgrade Banner */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Ready to Compete?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Upgrade to a full player account to register for tournaments, track your stats, 
                    and compete for prizes!
                  </p>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {["Register for tournaments", "Track your ELO & stats", "Win prizes", "Join organizations"].map((benefit) => (
                      <li key={benefit} className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="w-3 h-3 text-amber-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={upgradeLoading}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {upgradeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Upgrade to Play
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Name</span>
                  <p className="font-medium">{profile.firstName} {profile.lastName}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Email</span>
                  <p className="font-medium">{profile.email || "Not set"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Phone</span>
                  <p className="font-medium">{profile.phone || "Not set"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Member Since</span>
                  <p className="font-medium">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="saved">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="saved">
              <Bookmark className="w-4 h-4 mr-2" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="following">
              <Users className="w-4 h-4 mr-2" />
              Following
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No saved tournaments yet</p>
                  <Button
                    variant="link"
                    className="text-green-600"
                    onClick={() => router.push(`/${sport}/tournaments`)}
                  >
                    Browse tournaments
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">You&apos;re not following anyone yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Follow players and organizations to get updates
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Tournament Updates</p>
                      <p className="text-xs text-gray-500">New tournaments from followed orgs</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">On</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Match Results</p>
                      <p className="text-xs text-gray-500">Results from followed players</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">On</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Bracket Updates</p>
                      <p className="text-xs text-gray-500">Live bracket changes</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">On</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
