"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  IndianRupee,
  Calculator,
  Upload,
  Download,
  Check,
  Loader2,
  FileSpreadsheet,
  Building2,
  School,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { MINIMUM_PARTICIPANTS, MAXIMUM_PARTICIPANTS, INSTITUTION_PACKAGE_BENEFITS } from "@/lib/institution-package";

interface PricingQuote {
  tier: string;
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  savingsPercent: number;
  benefits: string[];
}

export default function InstitutionPackagesPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";
  const primaryBgLight = isCornhole ? "bg-green-50" : "bg-teal-50";

  const [participantCount, setParticipantCount] = useState(25);
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState<Array<{ name: string; email: string; phone: string; studentId?: string }>>([]);

  // Form state
  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState<"school" | "college" | "university">("college");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch pricing quote when participant count changes
  const fetchQuote = useCallback(async (count: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/institution-packages?participants=${count}`);
      const data = await response.json();
      if (data.success) {
        setPricingQuote(data.data);
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useState(() => {
    fetchQuote(participantCount);
  });

  const handleSliderChange = (value: number[]) => {
    const count = value[0] ?? 25;
    setParticipantCount(count);
    fetchQuote(count);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const data = lines.slice(1).map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        return {
          name: parts[0] || "",
          email: parts[1] || "",
          phone: parts[2] || "",
          studentId: parts[3] || undefined,
        };
      });
      setCsvData(data);
      setParticipantCount(data.length);
      fetchQuote(data.length);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/institution-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName,
          institutionType,
          contactName,
          contactEmail,
          contactPhone,
          sport: sport.toUpperCase(),
          participantCount,
          notes,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Error submitting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getInstitutionIcon = (type: string) => {
    switch (type) {
      case "school": return <School className="w-5 h-5" />;
      case "college": return <Building2 className="w-5 h-5" />;
      case "university": return <Landmark className="w-5 h-5" />;
      default: return <GraduationCap className="w-5 h-5" />;
    }
  };

  const downloadTemplate = () => {
    const template = `Name,Email,Phone,Student ID
John Doe,john@school.edu,9876543210,STU001
Jane Smith,jane@school.edu,9876543211,STU002
...`;
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participant_template.csv";
    a.click();
  };

  if (submitted) {
    return (
      <div className="min-h-screen py-12 px-4 bg-gray-50">
        <div className="container mx-auto max-w-lg">
          <Card className="bg-white border-gray-200 text-center">
            <CardContent className="pt-12 pb-8">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${primaryBgLight}`}>
                <Check className={`w-8 h-8 ${primaryTextClass}`} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Our team will review your request and contact you within 24 hours with a customized package.
              </p>
              <Button asChild className={primaryBgClass}>
                <Link href={`/${sport}/dashboard`}>Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <GraduationCap className={`w-8 h-8 ${primaryTextClass}`} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            College/School Tournament Packages
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Bulk registration for educational institutions. Get discounts up to 30% for groups of 10+ players.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pricing Calculator */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Pricing Calculator
              </CardTitle>
              <CardDescription>
                Adjust the participant count to see your discount
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Number of Participants</Label>
                  <Badge variant="outline" className="text-lg font-bold">
                    {participantCount}
                  </Badge>
                </div>
                <Slider
                  value={[participantCount]}
                  onValueChange={handleSliderChange}
                  min={MINIMUM_PARTICIPANTS}
                  max={MAXIMUM_PARTICIPANTS}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{MINIMUM_PARTICIPANTS}</span>
                  <span>{MAXIMUM_PARTICIPANTS}</span>
                </div>
              </div>

              {/* Pricing Tiers Visual */}
              <div className="flex gap-1">
                {[
                  { min: 10, max: 24, discount: "10%" },
                  { min: 25, max: 49, discount: "15%" },
                  { min: 50, max: 99, discount: "20%" },
                  { min: 100, max: 199, discount: "25%" },
                  { min: 200, max: 500, discount: "30%" },
                ].map((tier, i) => (
                  <div
                    key={i}
                    className={`flex-1 text-center py-2 rounded text-xs ${
                      participantCount >= tier.min && participantCount <= tier.max
                        ? `${isCornhole ? "bg-green-500" : "bg-teal-500"} text-white`
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tier.discount}
                  </div>
                ))}
              </div>

              {/* Quote Display */}
              {pricingQuote && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Original Price</span>
                    <span className="text-gray-400 line-through">
                      {formatPrice(pricingQuote.originalPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Discount ({pricingQuote.savingsPercent}%)</span>
                    <span className="text-green-600">-{formatPrice(pricingQuote.savings)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Final Price</span>
                    <span className={`text-2xl font-bold ${primaryTextClass}`}>
                      {formatPrice(pricingQuote.discountedPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    ₹{Math.round(pricingQuote.discountedPrice / participantCount).toLocaleString()} per player
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Request Form */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Request Package
              </CardTitle>
              <CardDescription>
                Fill in your institution details to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Institution Name */}
              <div className="space-y-2">
                <Label>Institution Name *</Label>
                <Input
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g., Delhi Public School, IIT Delhi"
                />
              </div>

              {/* Institution Type */}
              <div className="space-y-2">
                <Label>Institution Type *</Label>
                <Select value={institutionType} onValueChange={(v) => setInstitutionType(v as typeof institutionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4" />
                        School (K-12)
                      </div>
                    </SelectItem>
                    <SelectItem value="college">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        College
                      </div>
                    </SelectItem>
                    <SelectItem value="university">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4" />
                        University
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <Label>Contact Person Name *</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Sports Coordinator name"
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="sports@institution.edu"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label>Contact Phone *</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific requirements or questions..."
                  rows={3}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button
                className={`w-full ${primaryBgClass} text-white`}
                onClick={handleSubmit}
                disabled={submitting || !institutionName || !contactEmail || !contactPhone || !contactName}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <IndianRupee className="w-4 h-4 mr-2" />
                    Request Quote ({participantCount} players)
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* CSV Upload Section */}
        <Card className="bg-white border-gray-200 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Upload Participant List (Optional)
            </CardTitle>
            <CardDescription>
              Upload a CSV file with participant details to auto-fill the count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {csvData.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Parsed {csvData.length} participants
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-gray-600">
                  {csvData.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <span>{p.name}</span>
                      <span className="text-gray-400">{p.email}</span>
                    </div>
                  ))}
                  {csvData.length > 5 && (
                    <p className="text-gray-400">...and {csvData.length - 5} more</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card className="bg-white border-gray-200 mt-8">
          <CardHeader>
            <CardTitle>What&apos;s Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INSTITUTION_PACKAGE_BENEFITS.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className={`w-4 h-4 ${primaryTextClass} flex-shrink-0`} />
                  {benefit}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
