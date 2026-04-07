'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Activity,
  Users,
  Trophy,
  AlertTriangle,
  Database,
  Server,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface HealthData {
  timestamp: string;
  stats: {
    activeUsers: number;
    liveTournaments: number;
    pendingRegistrations: number;
    totalUsers: number;
    totalOrganizations: number;
    matchesToday: number;
    pendingDisputes: number;
    pendingEloJobs: number;
  };
  health: {
    database: string;
    api: string;
    websocket: string;
    cron: string;
  };
  performance: {
    api: number;
    database: number;
  };
  uptime: number | null;
}

export default function HealthPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        setError('Failed to fetch health data');
      }
    } catch (err) {
      setError('Failed to connect to health API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = theme === 'green' ? 'bg-green-50' : 'bg-teal-50';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Degraded</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", primaryTextClass)}>
            System Health
          </h1>
          <p className="text-gray-500">Real-time platform monitoring</p>
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

      {/* System Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-5 h-5 text-gray-500" />
              {getStatusBadge(data?.health.database || 'unknown')}
            </div>
            <p className="text-sm text-gray-500">Database</p>
            <p className="text-lg font-semibold">{data?.performance.database || 0}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Server className="w-5 h-5 text-gray-500" />
              {getStatusBadge(data?.health.api || 'unknown')}
            </div>
            <p className="text-sm text-gray-500">API</p>
            <p className="text-lg font-semibold">{data?.performance.api || 0}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-gray-500" />
              {getStatusBadge(data?.health.websocket || 'unknown')}
            </div>
            <p className="text-sm text-gray-500">WebSocket</p>
            <p className="text-lg font-semibold">Port 3003</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-gray-500" />
              {getStatusBadge(data?.health.cron || 'unknown')}
            </div>
            <p className="text-sm text-gray-500">Cron Service</p>
            <p className="text-lg font-semibold">{formatUptime(data?.uptime || null)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
              <p className="text-3xl font-bold">{data?.stats.activeUsers || 0}</p>
              <p className="text-sm text-gray-500">Active Users</p>
            </div>
            <div className="text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-3xl font-bold">{data?.stats.liveTournaments || 0}</p>
              <p className="text-sm text-gray-500">Live Tournaments</p>
            </div>
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-3xl font-bold">{data?.stats.matchesToday || 0}</p>
              <p className="text-sm text-gray-500">Matches Today</p>
            </div>
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="text-3xl font-bold">{data?.stats.pendingDisputes || 0}</p>
              <p className="text-sm text-gray-500">Pending Disputes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Users</span>
              <span className="font-semibold">{data?.stats.totalUsers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Organizations</span>
              <span className="font-semibold">{data?.stats.totalOrganizations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active Now</span>
              <span className="font-semibold">{data?.stats.activeUsers || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tournament Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Live Tournaments</span>
              <span className="font-semibold">{data?.stats.liveTournaments || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pending Registrations</span>
              <span className="font-semibold">{data?.stats.pendingRegistrations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pending ELO Jobs</span>
              <span className="font-semibold">{data?.stats.pendingEloJobs || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      {data?.timestamp && (
        <p className="text-center text-sm text-gray-400">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
