'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  IndianRupee,
  TrendingUp,
  Users,
  Trophy,
  Calendar,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface RevenueData {
  summary: {
    totalRevenue: number;
    thisMonth: number;
    subscriptions: number;
    tournamentFees: number;
  };
  subscriptions: {
    active: number;
    players: number;
    organizations: number;
  };
  revenueBySource: {
    subscriptions: number;
    tournamentFees: number;
    other: number;
  };
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    gst: number;
  }>;
  gst: {
    totalCollected: number;
    cgst: number;
    sgst: number;
  };
}

export default function RevenuePage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/revenue');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        setError('Failed to fetch revenue data');
      }
    } catch (err) {
      setError('Failed to connect to revenue API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';
  const primaryColor = theme === 'green' ? '#16a34a' : '#0d9488';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short' });
  };

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const sourceData = data ? [
    { name: 'Subscriptions', value: data.revenueBySource.subscriptions },
    { name: 'Tournament Fees', value: data.revenueBySource.tournamentFees },
    { name: 'Other', value: data.revenueBySource.other },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", primaryTextClass)}>
            Revenue Analytics
          </h1>
          <p className="text-gray-500">Financial overview and trends</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-red-600">{error}</CardContent>
        </Card>
      )}

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className={cn("w-5 h-5", primaryTextClass)} />
              <span className="text-sm text-gray-500">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.summary.totalRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">This Month</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.summary.thisMonth || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500">Subscriptions</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.summary.subscriptions || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500">Tournament Fees</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.summary.tournamentFees || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => formatMonth(label as string)}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={primaryColor}
                  strokeWidth={2}
                  dot={{ fill: primaryColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Source & GST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill={primaryColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              GST Summary (18%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total GST Collected</p>
              <p className="text-3xl font-bold">{formatCurrency(data?.gst.totalCollected || 0)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">CGST (9%)</p>
                <p className="text-xl font-semibold">{formatCurrency(data?.gst.cgst || 0)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">SGST (9%)</p>
                <p className="text-xl font-semibold">{formatCurrency(data?.gst.sgst || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-3xl font-bold">{data?.subscriptions.active || 0}</p>
              <p className="text-sm text-gray-500">Total Active</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-3xl font-bold">{data?.subscriptions.players || 0}</p>
              <p className="text-sm text-gray-500">Players</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-3xl font-bold">{data?.subscriptions.organizations || 0}</p>
              <p className="text-sm text-gray-500">Organizations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
