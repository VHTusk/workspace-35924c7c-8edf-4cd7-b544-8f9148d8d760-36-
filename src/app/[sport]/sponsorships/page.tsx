"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Handshake,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Sparkles,
  Crown,
  Medal,
  Award,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { SPONSORSHIP_TIERS, type SponsorTier } from "@/lib/sponsorship";

interface Tournament {
  id: string;
  name: string;
  sport: string;
  scope: string;
  startDate: string;
  location: string;
  expectedParticipants: number;
}

interface SponsorshipData {
  sponsorships: Tournament[];
  tiers: typeof SPONSORSHIP_TIERS;
}

export default function SponsorshipsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";
  const primaryBgLight = isCornhole ? "bg-green-50" : "bg-teal-50";

  const [loading, setLoading] = useState(true);
  const [sponsorshipData, setSponsorshipData] = useState<SponsorshipData | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SponsorTier>("gold");
  const [amount, setAmount] = useState(25000);
  const [submitting, setSubmitting] = useState(false);

  // Sponsor form
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorPhone, setSponsorPhone] = useState("");
  const [sponsorIndustry, setSponsorIndustry] = useState("");
  const [customBenefits, setCustomBenefits] = useState("");

  useEffect(() => {
    fetchSponsorships();
  }, [sport]);

  const fetchSponsorships = async () => {
    try {
      const response = await fetch(`/api/sponsorships?sport=${sport.toUpperCase()}`);
      const data = await response.json();
      if (data.success) {
        setSponsorshipData(data.data);
      }
    } catch (error) {
      console.error("Error fetching sponsorships:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRequest = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedTournament) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/sponsorships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournament.id,
          sponsorId: "guest", // In real app, use logged-in sponsor ID
          tier: selectedTier,
          amount,
          customBenefits: customBenefits ? customBenefits.split("\n") : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowRequestModal(false);
        alert("Sponsorship request submitted! Our team will contact you shortly.");
      }
    } catch (error) {
      console.error("Error submitting sponsorship:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getTierIcon = (tier: SponsorTier) => {
    switch (tier) {
      case "title": return <Crown className="w-5 h-5" />;
      case "gold": return <Sparkles className="w-5 h-5" />;
      case "silver": return <Medal className="w-5 h-5" />;
      case "bronze": return <Award className="w-5 h-5" />;
    }
  };

  const getTierColor = (tier: SponsorTier) => {
    switch (tier) {
      case "title": return "bg-purple-500";
      case "gold": return "bg-amber-500";
      case "silver": return "bg-gray-400";
      case "bronze": return "bg-orange-600";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        {/* Back Link */}
        <Link
          href={`/${sport}/dashboard`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${primaryBgLight}`}>
            <Handshake className={`w-8 h-8 ${primaryTextClass}`} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sponsorship Marketplace
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Connect with tournaments and gain visibility for your brand. Choose from multiple sponsorship tiers.
          </p>
        </div>

        {/* Sponsorship Tiers */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Sponsorship Tiers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(SPONSORSHIP_TIERS) as [SponsorTier, typeof SPONSORSHIP_TIERS.title][]).map(([tierKey, tier]) => (
              <Card
                key={tierKey}
                className={`relative bg-white ${tier.recommended ? `ring-2 ${isCornhole ? "ring-green-500" : "ring-teal-500"}` : ""}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge className={`${primaryBgClass} text-white`}>Recommended</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white ${getTierColor(tierKey)}`}>
                    {getTierIcon(tierKey)}
                  </div>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>
                    {formatPrice(tier.priceMin)} - {formatPrice(tier.priceMax)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <ul className="space-y-1 text-xs text-gray-600">
                    {tier.benefits.slice(0, 4).map((benefit, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {benefit}
                      </li>
                    ))}
                    {tier.benefits.length > 4 && (
                      <li className="text-gray-400">+{tier.benefits.length - 4} more benefits</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Available Tournaments */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Tournaments Open for Sponsorship
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : !sponsorshipData?.sponsorships.length ? (
            <Card className="bg-white border-gray-200 text-center py-12">
              <CardContent>
                <Handshake className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No tournaments currently open for sponsorship.</p>
                <p className="text-sm text-gray-400 mt-2">Check back soon for new opportunities!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sponsorshipData.sponsorships.map((tournament) => (
                <Card key={tournament.id} className="bg-white border-gray-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-gray-900">{tournament.name}</CardTitle>
                        <CardDescription className="text-gray-500">
                          {tournament.sport} • {tournament.scope}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-gray-600">
                        Open
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(tournament.startDate)}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {tournament.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        ~{tournament.expectedParticipants} participants
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={`w-full ${primaryBgClass} text-white`}
                      onClick={() => handleOpenRequest(tournament)}
                    >
                      <IndianRupee className="w-4 h-4 mr-2" />
                      Sponsor This Tournament
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sponsorship Request</DialogTitle>
            <DialogDescription>
              {selectedTournament?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tier Selection */}
            <div className="space-y-2">
              <Label>Sponsorship Tier</Label>
              <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as SponsorTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPONSORSHIP_TIERS).map(([key, tier]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {tier.name} ({formatPrice(tier.priceMin)} - {formatPrice(tier.priceMax)})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Sponsorship Amount (₹)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Enter amount"
              />
              {SPONSORSHIP_TIERS[selectedTier] && (
                <p className="text-xs text-gray-500">
                  Range: {formatPrice(SPONSORSHIP_TIERS[selectedTier].priceMin)} - {formatPrice(SPONSORSHIP_TIERS[selectedTier].priceMax)}
                </p>
              )}
            </div>

            {/* Sponsor Details */}
            <div className="space-y-2">
              <Label>Company/Brand Name</Label>
              <Input
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={sponsorEmail}
                onChange={(e) => setSponsorEmail(e.target.value)}
                placeholder="contact@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={sponsorPhone}
                onChange={(e) => setSponsorPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={sponsorIndustry} onValueChange={setSponsorIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sports">Sports & Fitness</SelectItem>
                  <SelectItem value="food">Food & Beverage</SelectItem>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="finance">Banking & Finance</SelectItem>
                  <SelectItem value="realestate">Real Estate</SelectItem>
                  <SelectItem value="automotive">Automotive</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custom Benefits (Optional, one per line)</Label>
              <Textarea
                value={customBenefits}
                onChange={(e) => setCustomBenefits(e.target.value)}
                placeholder="Logo on event banners&#10;Product sampling booth&#10;Social media shoutout"
                rows={3}
              />
            </div>

            {/* Benefits Preview */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Included Benefits:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {SPONSORSHIP_TIERS[selectedTier].benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <Button
              className={`w-full ${primaryBgClass} text-white`}
              onClick={handleSubmitRequest}
              disabled={submitting || !sponsorName || !sponsorEmail || !amount}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Sponsorship Request"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
