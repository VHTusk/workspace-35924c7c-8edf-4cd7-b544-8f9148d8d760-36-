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
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareReferral = async () => {
    if (navigator.share && data?.referralCode) {
      try {
        await navigator.share({
          title: 'Join VALORHIVE',
          text: `Join me on VALORHIVE and start competing! Use my referral code: ${data.referralCode}`,
          url: window.location.origin,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      copyReferralCode();
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
            {/* Referral Code Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Your Referral Code</CardTitle>
              </CardHeader>
              <CardContent>
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
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={shareReferral}
                    className={`shrink-0 bg-${theme}-500 hover:bg-${theme}-600`}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
                  <ol className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>1.</span>
                      Share your referral code with friends
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>2.</span>
                      They enter your code when registering
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-medium ${theme === 'green' ? 'text-green-600' : 'text-teal-600'}`}>3.</span>
                      Once they play their first tournament, you both earn bonus points!
                    </li>
                  </ol>
                </div>
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
