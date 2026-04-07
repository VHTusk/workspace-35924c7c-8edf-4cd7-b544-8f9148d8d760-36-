"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  MessageSquare,
  Bell,
  Send,
  Users,
  Trophy,
  Calendar,
  Megaphone,
  Loader2,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  type: "email" | "push" | "whatsapp" | "in_app";
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  targetAudience: string;
  recipientCount: number;
  sentCount?: number;
  openedCount?: number;
  clickedCount?: number;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
}

const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "State Championship Announcement",
    type: "email",
    status: "sent",
    targetAudience: "All Players",
    recipientCount: 15000,
    sentCount: 14850,
    openedCount: 8500,
    clickedCount: 3200,
    sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    name: "Tournament Reminder - This Weekend",
    type: "push",
    status: "scheduled",
    targetAudience: "Registered Players",
    recipientCount: 250,
    scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    name: "Payment Success Notification",
    type: "whatsapp",
    status: "sending",
    targetAudience: "Recent Registrations",
    recipientCount: 150,
    sentCount: 89,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

const audienceOptions = [
  { value: "all_players", label: "All Players", count: 15000 },
  { value: "active_players", label: "Active Players (30 days)", count: 8500 },
  { value: "tournament_participants", label: "Tournament Participants", count: 3200 },
  { value: "premium_subscribers", label: "Premium Subscribers", count: 1200 },
  { value: "org_admins", label: "Organization Admins", count: 450 },
  { value: "inactive_players", label: "Inactive Players (60+ days)", count: 4200 },
  { value: "waitlist_users", label: "Waitlist Users", count: 350 },
];

export function MassCommunicationTool() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<"email" | "push" | "whatsapp" | "in_app">("email");
  const [targetAudience, setTargetAudience] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleFor, setScheduleFor] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return Mail;
      case "push":
        return Bell;
      case "whatsapp":
        return MessageSquare;
      case "in_app":
        return Megaphone;
      default:
        return Send;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "sending":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "scheduled":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !targetAudience || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (campaignType === "email" && !subject) {
      toast.error("Email campaigns require a subject line");
      return;
    }

    setSending(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const audience = audienceOptions.find(a => a.value === targetAudience);
    
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: campaignName,
      type: campaignType,
      status: isScheduled ? "scheduled" : "sending",
      targetAudience: audience?.label || targetAudience,
      recipientCount: audience?.count || 0,
      scheduledFor: isScheduled ? scheduleFor : undefined,
      createdAt: new Date().toISOString(),
    };
    
    setCampaigns(prev => [newCampaign, ...prev]);
    setShowCreateDialog(false);
    resetForm();
    setSending(false);
    toast.success(isScheduled ? "Campaign scheduled successfully" : "Campaign started");
  };

  const handleCancelCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    toast.success("Campaign cancelled");
  };

  const resetForm = () => {
    setCampaignName("");
    setCampaignType("email");
    setTargetAudience("");
    setSubject("");
    setMessage("");
    setScheduleFor("");
    setIsScheduled(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stats = {
    totalSent: campaigns.filter(c => c.status === "sent").reduce((sum, c) => sum + (c.sentCount || 0), 0),
    scheduled: campaigns.filter(c => c.status === "scheduled").length,
    avgOpenRate: 42,
    avgClickRate: 18,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <Send className="w-5 h-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{stats.scheduled}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <Eye className="w-5 h-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{stats.avgOpenRate}%</p>
            <p className="text-xs text-muted-foreground">Avg. Open Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{stats.avgClickRate}%</p>
            <p className="text-xs text-muted-foreground">Avg. Click Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Megaphone className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns List */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>Manage your mass communication campaigns</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {campaigns.map((campaign) => {
              const TypeIcon = getTypeIcon(campaign.type);
              return (
                <div key={campaign.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        campaign.type === "email" && "bg-blue-100 dark:bg-blue-900/30",
                        campaign.type === "push" && "bg-purple-100 dark:bg-purple-900/30",
                        campaign.type === "whatsapp" && "bg-green-100 dark:bg-green-900/30",
                        campaign.type === "in_app" && "bg-amber-100 dark:bg-amber-900/30",
                      )}>
                        <TypeIcon className={cn(
                          "w-5 h-5",
                          campaign.type === "email" && "text-blue-600",
                          campaign.type === "push" && "text-purple-600",
                          campaign.type === "whatsapp" && "text-green-600",
                          campaign.type === "in_app" && "text-amber-600",
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{campaign.name}</p>
                          <Badge className={cn("text-xs", getStatusColor(campaign.status))}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="capitalize">{campaign.type}</span>
                          <span>{campaign.targetAudience}</span>
                          <span>{campaign.recipientCount.toLocaleString()} recipients</span>
                        </div>
                        
                        {/* Stats for sent campaigns */}
                        {campaign.status === "sent" && campaign.sentCount && (
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-green-600">
                              {((campaign.openedCount! / campaign.sentCount) * 100).toFixed(1)}% opened
                            </span>
                            <span className="text-blue-600">
                              {((campaign.clickedCount! / campaign.sentCount) * 100).toFixed(1)}% clicked
                            </span>
                          </div>
                        )}
                        
                        {/* Progress for sending */}
                        {campaign.status === "sending" && campaign.sentCount && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(campaign.sentCount / campaign.recipientCount) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {campaign.sentCount} / {campaign.recipientCount} sent
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        {campaign.status === "scheduled" && campaign.scheduledFor
                          ? `Scheduled: ${formatDate(campaign.scheduledFor)}`
                          : campaign.sentAt
                          ? `Sent: ${formatDate(campaign.sentAt)}`
                          : `Created: ${formatDate(campaign.createdAt)}`}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setShowPreviewDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(campaign.status === "scheduled" || campaign.status === "draft") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleCancelCampaign(campaign.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Mass Communication</DialogTitle>
            <DialogDescription>
              Send messages to multiple users at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Campaign Type Selection */}
            <div className="space-y-2">
              <Label>Communication Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: "email", icon: Mail, label: "Email" },
                  { type: "push", icon: Bell, label: "Push" },
                  { type: "whatsapp", icon: MessageSquare, label: "WhatsApp" },
                  { type: "in_app", icon: Megaphone, label: "In-App" },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setCampaignType(type as typeof campaignType)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                      campaignType === type
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn(
                      "w-6 h-6",
                      campaignType === type ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="e.g., Tournament Announcement"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  {audienceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} ({option.count.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject (for email) */}
            {campaignType === "email" && (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message Content</Label>
              <Textarea
                id="message"
                placeholder="Write your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              {campaignType === "whatsapp" && (
                <p className="text-xs text-muted-foreground">
                  WhatsApp messages are limited to 1000 characters. Current: {message.length}/1000
                </p>
              )}
            </div>

            {/* Schedule Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Schedule for Later</Label>
                  <p className="text-xs text-muted-foreground">
                    Send at a specific date and time
                  </p>
                </div>
                <Switch
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
              </div>
              
              {isScheduled && (
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule Date & Time</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduleFor}
                    onChange={(e) => setScheduleFor(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Warning */}
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Before You Send
                  </p>
                  <ul className="mt-1 text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Review your message for accuracy and tone</li>
                    <li>• Ensure the target audience is correct</li>
                    <li>• Mass communications cannot be undone once sent</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isScheduled ? (
                <Clock className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isScheduled ? "Schedule Campaign" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedCampaign.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedCampaign.status)}>
                    {selectedCampaign.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Audience</p>
                  <p className="font-medium">{selectedCampaign.targetAudience}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recipients</p>
                  <p className="font-medium">{selectedCampaign.recipientCount.toLocaleString()}</p>
                </div>
              </div>
              
              {selectedCampaign.status === "sent" && selectedCampaign.sentCount && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Performance</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="font-semibold">{((selectedCampaign.openedCount! / selectedCampaign.sentCount) * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Opened</p>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="font-semibold">{((selectedCampaign.clickedCount! / selectedCampaign.sentCount) * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Clicked</p>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="font-semibold">{selectedCampaign.sentCount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
