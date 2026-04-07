"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  Database,
  Cloud,
  Shield,
  Zap,
  RefreshCw,
  Calendar,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  uptime: number;
  lastIncident?: string;
  description: string;
}

const services: ServiceStatus[] = [
  {
    name: "API Services",
    status: "operational",
    uptime: 99.98,
    description: "Core API endpoints for all platform features",
  },
  {
    name: "Database",
    status: "operational",
    uptime: 99.99,
    description: "PostgreSQL database cluster",
  },
  {
    name: "Payment Processing",
    status: "operational",
    uptime: 99.95,
    description: "Razorpay payment gateway integration",
  },
  {
    name: "Authentication",
    status: "operational",
    uptime: 99.99,
    description: "User login and session management",
  },
  {
    name: "Real-time Updates",
    status: "operational",
    uptime: 99.90,
    description: "WebSocket connections for live updates",
  },
  {
    name: "File Storage",
    status: "operational",
    uptime: 99.95,
    description: "Image and document uploads",
  },
  {
    name: "Email Notifications",
    status: "degraded",
    uptime: 98.50,
    description: "Email delivery service",
    lastIncident: "2 hours ago",
  },
  {
    name: "Push Notifications",
    status: "operational",
    uptime: 99.80,
    description: "Mobile and browser push alerts",
  },
];

export default function StatusPage() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const overallStatus = services.every(s => s.status === "operational")
    ? "operational"
    : services.some(s => s.status === "outage")
    ? "outage"
    : "degraded";

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "outage":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "maintenance":
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      operational: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      degraded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      outage: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      maintenance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return styles[status] || styles.operational;
  };

  const getServiceIcon = (name: string) => {
    if (name.includes("API")) return Server;
    if (name.includes("Database")) return Database;
    if (name.includes("Payment")) return Zap;
    if (name.includes("Auth")) return Shield;
    if (name.includes("Real-time")) return Activity;
    if (name.includes("Email") || name.includes("Push")) return Cloud;
    return Server;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">VALORHIVE Status</h1>
                <p className="text-sm text-muted-foreground">Real-time system health monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Overall Status Banner */}
        <Card className={cn(
          "mb-8",
          overallStatus === "operational" && "border-green-500/50 bg-green-50 dark:bg-green-950/30",
          overallStatus === "degraded" && "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30",
          overallStatus === "outage" && "border-red-500/50 bg-red-50 dark:bg-red-950/30"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {getStatusIcon(overallStatus)}
              <div>
                <h2 className="text-xl font-semibold">
                  {overallStatus === "operational" && "All Systems Operational"}
                  {overallStatus === "degraded" && "Some Systems Degraded"}
                  {overallStatus === "outage" && "Major Outage Detected"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {overallStatus === "operational"
                    ? "All services are running normally"
                    : "We are aware of the issue and working on a fix"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Service Status</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {services.map((service) => {
                  const Icon = getServiceIcon(service.name);
                  return (
                    <div key={service.name} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{service.uptime}% uptime</span>
                        <Badge className={getStatusBadge(service.status)}>
                          {getStatusIcon(service.status)}
                          <span className="ml-1 capitalize">{service.status}</span>
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Uptime Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-500">99.95%</p>
              <p className="text-sm text-muted-foreground">30-day Uptime</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">2</p>
              <p className="text-sm text-muted-foreground">Incidents (30 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">45m</p>
              <p className="text-sm text-muted-foreground">Avg. Resolution Time</p>
            </CardContent>
          </Card>
        </div>

        {/* Subscribe to Updates */}
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Stay Updated</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get notified when there are service disruptions or maintenance windows.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm">
                  Subscribe via Email
                </Button>
                <Button variant="outline" size="sm">
                  RSS Feed
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
