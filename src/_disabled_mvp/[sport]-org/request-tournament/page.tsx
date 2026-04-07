"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  MapPin,
  Users,
  Trophy,
  Clock,
  Info,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function RequestTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: "CITY",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    registrationDeadline: undefined as Date | undefined,
    location: "",
    city: "",
    state: "",
    pinCode: "",
    maxPlayers: "32",
    entryFee: "200",
    prizeDetails: "",
    format: "SINGLE_ELIMINATION",
    contactName: "",
    contactPhone: "",
    additionalNotes: "",
  });

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/org/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate?.toISOString(),
          endDate: formData.endDate?.toISOString(),
          registrationDeadline: formData.registrationDeadline?.toISOString(),
          maxPlayers: parseInt(formData.maxPlayers),
          entryFee: parseInt(formData.entryFee),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Failed to submit request:", error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className={cn("w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6", isCornhole ? "bg-green-100" : "bg-teal-100")}>
          <CheckCircle className={cn("w-10 h-10", primaryTextClass)} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Request Submitted!</h1>
        <p className="text-muted-foreground mb-6">
          Your tournament request has been submitted for admin approval. You will be notified once it's reviewed.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => router.push(`/${sport}/org/requests`)}>
            View Requests
          </Button>
          <Button className={cn("text-white", primaryClass)} onClick={() => setSubmitted(false)}>
            Submit Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Request Tournament</h1>
        <p className="text-muted-foreground">Submit a request to host an INTRA_ORG tournament</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {["Tournament Details", "Date & Location", "Settings", "Review"].map((label, index) => (
          <div key={index} className="flex items-center">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
              step > index + 1 ? (isCornhole ? "bg-green-600" : "bg-teal-600") + " text-white" :
              step === index + 1 ? (isCornhole ? "bg-green-100 text-green-600" : "bg-teal-100 text-teal-600") :
              "bg-gray-100 text-gray-400"
            )}>
              {step > index + 1 ? <CheckCircle className="w-5 h-5" /> : index + 1}
            </div>
            <span className={cn("ml-2 text-sm hidden sm:block", step >= index + 1 ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {index < 3 && <div className={cn("w-12 h-1 mx-2", step > index + 1 ? (isCornhole ? "bg-green-600" : "bg-teal-600") : "bg-gray-200")} />}
          </div>
        ))}
      </div>

      {/* Form Steps */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Tournament Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Tournament Details</h2>
              
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual Club Championship 2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the tournament"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scope *</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CITY">City</SelectItem>
                      <SelectItem value="DISTRICT">District</SelectItem>
                      <SelectItem value="STATE">State</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format *</Label>
                  <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_ELIMINATION">Single Elimination</SelectItem>
                      <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Date & Location */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Date & Location</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.startDate ? format(formData.startDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.startDate}
                        onSelect={(d) => setFormData({ ...formData, startDate: d })}
                        disabled={(d) => d < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.endDate ? format(formData.endDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.endDate}
                        onSelect={(d) => setFormData({ ...formData, endDate: d })}
                        disabled={(d) => d < (formData.startDate || new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Registration Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.registrationDeadline ? format(formData.registrationDeadline, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.registrationDeadline}
                      onSelect={(d) => setFormData({ ...formData, registrationDeadline: d })}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (d < today) return true;
                        if (formData.startDate && d > formData.startDate) return true;
                        return false;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Venue/Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Club Sports Complex"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pinCode">PIN Code</Label>
                  <Input id="pinCode" value={formData.pinCode} onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Settings */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Tournament Settings</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">Max Players *</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    value={formData.maxPlayers}
                    onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entryFee">Entry Fee (₹) *</Label>
                  <Input
                    id="entryFee"
                    type="number"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prizeDetails">Prize Distribution</Label>
                <Textarea
                  id="prizeDetails"
                  value={formData.prizeDetails}
                  onChange={(e) => setFormData({ ...formData, prizeDetails: e.target.value })}
                  placeholder="e.g., 1st: ₹5000, 2nd: ₹3000, 3rd: ₹2000"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person *</Label>
                  <Input id="contactName" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone *</Label>
                  <Input id="contactPhone" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Additional Notes</Label>
                <Textarea
                  id="additionalNotes"
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  placeholder="Any special requirements or notes for the admin"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Review Your Request</h2>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tournament Name</p>
                    <p className="font-medium">{formData.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scope</p>
                    <p className="font-medium">{formData.scope}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formData.startDate ? format(formData.startDate, "PPP") : "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">{formData.endDate ? format(formData.endDate, "PPP") : "-"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{formData.location}, {formData.city}, {formData.state}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Format</p>
                    <p className="font-medium">{formData.format.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Max Players</p>
                    <p className="font-medium">{formData.maxPlayers}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Entry Fee</p>
                    <p className="font-medium">₹{formData.entryFee}</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Important:</p>
                    <p>Your tournament will be created in DRAFT status and requires admin approval before it goes live.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            {step < 4 ? (
              <Button className={cn("text-white", primaryClass)} onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button className={cn("text-white", primaryClass)} onClick={handleSubmit} disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
