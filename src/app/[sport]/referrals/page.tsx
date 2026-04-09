'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/sidebar';
import { Gift, Copy, Share2, Users, CheckCircle, Clock, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ReferralData {
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalPointsEarned: number;
  referrals: Array<{
    id: string;
    referee: {
      firstName: string;
      lastName: string;
    };
    status: string;
    rewardPoints: number;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export default function ReferralsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);

  const referralLink = data?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${sport}/register?ref=${encodeURIComponent(data.referralCode)}`
    : '';

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const res = await fetch('/api/referrals');
      const responseData = await res.json();
      if (res.ok) {
        setData(responseData);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (data?.referralCode) {
      await navigator.clipboard.writeText(data.referralCode);
      setCopiedField('code');
      toast.success('Referral code copied!');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const copyReferralLink = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      setCopiedField('link');
      toast.success('Referral link copied!');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const shareReferral = async () => {
    if (navigator.share && data?.referralCode && referralLink) {
      try {
        await navigator.share({
          title: 'Join VALORHIVE',
          text: `Join me on VALORHIVE and start competing! Use my referral code: ${data.referralCode}`,
          url: referralLink,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      copyReferralLink();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-2xl font-bold text-${theme}-600 flex items-center gap-2`}>
            <Gift className="h-6 w-6" />
            Referral Program
          </h1>
          <p className="text-gray-500 mt-1">
            Invite friends and earn bonus points
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Referral Share Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Share Your Referral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Referral Code</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        value={data?.referralCode || 'Generate a code'}
                        readOnly
                        className="text-lg font-mono text-center tracking-wider"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={copyReferralCode}
                      className="shrink-0"
                    >
                      {copiedField === 'code' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Referral Link</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        value={referralLink || 'Referral link will appear here'}
                        readOnly
                        className="text-sm"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={copyReferralLink}
                      className="shrink-0"
                      disabled={!referralLink}
                    >
                      {copiedField === 'link' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={shareReferral}
                    className={`shrink-0 bg-${theme}-500 hover:bg-${theme}-600`}
                    disabled={!referralLink}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Referral
                  </Button>
                </div>

                <Tabs defaultValue="how-it-works" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="how-it-works">How It Works</TabsTrigger>
                    <TabsTrigger value="benefits">Benefits</TabsTrigger>
                  </TabsList>
                  <TabsContent value="how-it-works" className="mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <ol className="text-sm text-gray-600 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>1.</span>
                          Share your referral code or direct referral link with friends
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>2.</span>
                          They register using your code or by opening your referral link
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>3.</span>
                          Once they complete their first eligible tournament, both of you receive bonus points
                        </li>
                      </ol>
                    </div>
                  </TabsContent>
                  <TabsContent value="benefits" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border bg-gray-50 p-4">
                        <h4 className="font-medium text-gray-900">Benefits for you</h4>
                        <ul className="mt-3 space-y-2 text-sm text-gray-600">
                          <li>Earn bonus reward points when a referral completes their first eligible tournament.</li>
                          <li>Track every referral from pending to completed in one place.</li>
                          <li>Keep sharing the same code and link across future invites.</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border bg-gray-50 p-4">
                        <h4 className="font-medium text-gray-900">Benefits for your friend</h4>
                        <ul className="mt-3 space-y-2 text-sm text-gray-600">
                          <li>Join quickly using a ready-to-use referral link or code.</li>
                          <li>Receive a welcome reward after their first eligible tournament.</li>
                          <li>Start with a smoother onboarding path into upcoming competitions.</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className={`h-6 w-6 mx-auto mb-2 text-${theme}-500`} />
                  <p className="text-2xl font-bold text-gray-900">{data?.totalReferrals || 0}</p>
                  <p className="text-xs text-gray-500">Total Referrals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-gray-900">{data?.completedReferrals || 0}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold text-gray-900">{data?.pendingReferrals || 0}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Award className={`h-6 w-6 mx-auto mb-2 text-${theme}-500`} />
                  <p className="text-2xl font-bold text-gray-900">{data?.totalPointsEarned || 0}</p>
                  <p className="text-xs text-gray-500">Points Earned</p>
                </CardContent>
              </Card>
            </div>

            {/* Referrals List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Referrals</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.referrals || data.referrals.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No referrals yet</h3>
                    <p className="text-gray-500">
                      Share your referral code to start earning bonus points
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.referrals.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full bg-${theme}-100 flex items-center justify-center`}>
                            <span className={`text-sm font-medium text-${theme}-600`}>
                              {ref.referee.firstName.charAt(0)}{ref.referee.lastName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {ref.referee.firstName} {ref.referee.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Referred on {formatDate(ref.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={ref.status === 'COMPLETED' ? 'default' : 'secondary'}
                            className={ref.status === 'COMPLETED' ? `bg-${theme}-500` : ''}
                          >
                            {ref.status}
                          </Badge>
                          {ref.rewardPoints > 0 && (
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              +{ref.rewardPoints} pts
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </main>
    </div>
  );
}
