"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trophy,
  MapPin,
  Trash2,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";

interface AvailabilityEntry {
  id: string;
  date: string;
  isAvailable: boolean;
  notes: string | null;
  isRecurring: boolean;
  recurrencePattern: string | null;
}

interface TournamentAssignment {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: string;
}

interface DayData {
  date: Date;
  availability: AvailabilityEntry | null;
  assignments: TournamentAssignment[];
}

export default function AdminAvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availabilityData, setAvailabilityData] = useState<AvailabilityEntry[]>([]);
  const [assignmentsData, setAssignmentsData] = useState<TournamentAssignment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [isAvailable, setIsAvailable] = useState(true);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("weekly");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  useEffect(() => {
    fetchAvailabilityData();
  }, [currentMonth]);

  const fetchAvailabilityData = async () => {
    try {
      setLoading(true);
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      
      const response = await fetch(
        `/api/admin/availability?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        { credentials: "include" }
      );

      if (response.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailabilityData(data.availability || []);
          setAssignmentsData(data.assignments || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      toast.error("Failed to load availability data");
    } finally {
      setLoading(false);
    }
  };

  const getDayData = (date: Date): DayData => {
    const availability = availabilityData.find((a) => 
      isSameDay(new Date(a.date), date)
    ) || null;
    
    const assignments = assignmentsData.filter((a) => 
      isSameDay(new Date(a.date), date)
    );

    return { date, availability, assignments };
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    const dayData = getDayData(date);
    
    if (dayData.availability) {
      setIsAvailable(dayData.availability.isAvailable);
      setNotes(dayData.availability.notes || "");
      setIsRecurring(dayData.availability.isRecurring);
      setRecurrencePattern(dayData.availability.recurrencePattern || "weekly");
    } else {
      // Default values for new entry
      setIsAvailable(true);
      setNotes("");
      setIsRecurring(false);
      setRecurrencePattern("weekly");
    }
    
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    try {
      setSaving(true);
      const response = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          isAvailable,
          notes: notes || null,
          isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : null,
        }),
      });

      if (response.ok) {
        toast.success("Availability saved successfully");
        fetchAvailabilityData();
        setDialogOpen(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save availability");
      }
    } catch (error) {
      toast.error("Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDate) return;

    const dayData = getDayData(selectedDate);
    if (!dayData.availability) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/availability?id=${dayData.availability.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Availability removed");
        fetchAvailabilityData();
        setDialogOpen(false);
      } else {
        toast.error("Failed to remove availability");
      }
    } catch (error) {
      toast.error("Failed to remove availability");
    } finally {
      setSaving(false);
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get status color for a day
  const getDayStatusColor = (date: Date): string => {
    const dayData = getDayData(date);
    
    if (dayData.assignments.length > 0) {
      return dayData.availability?.isAvailable === false 
        ? "bg-red-100 border-red-300" 
        : "bg-blue-50 border-blue-200";
    }
    
    if (dayData.availability) {
      return dayData.availability.isAvailable 
        ? cn(primaryBgClass, primaryBorderClass)
        : "bg-red-50 border-red-200";
    }
    
    return "bg-white border-gray-100";
  };

  const getDayStatusIcon = (date: Date) => {
    const dayData = getDayData(date);
    
    if (dayData.assignments.length > 0) {
      return <Trophy className="w-3 h-3 text-blue-500" />;
    }
    
    if (dayData.availability) {
      return dayData.availability.isAvailable 
        ? <Check className="w-3 h-3 text-green-500" />
        : <X className="w-3 h-3 text-red-500" />;
    }
    
    return null;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="admin" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className={cn("w-7 h-7", primaryTextClass)} />
              Availability Calendar
            </h1>
            <p className="text-gray-500 mt-1">
              Mark your availability for tournament assignments
            </p>
          </div>

          {/* Legend */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-4 h-4 rounded border", primaryBgClass, primaryBorderClass)} />
                  <span className="text-sm text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-red-50 border-red-200" />
                  <span className="text-sm text-gray-600">Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-blue-50 border-blue-200" />
                  <span className="text-sm text-gray-600">Has Assignment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">Marked Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600">Marked Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-600">Tournament Assigned</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    {format(currentMonth, "MMMM yyyy")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty cells for days before month start */}
                      {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}
                      
                      {/* Day cells */}
                      {days.map((day) => {
                        const dayData = getDayData(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => handleDateSelect(day)}
                            className={cn(
                              "aspect-square rounded-lg border p-1 flex flex-col items-center justify-center transition-all hover:shadow-md",
                              getDayStatusColor(day),
                              isSelected && "ring-2 ring-offset-1 ring-primary",
                              isToday(day) && "font-bold"
                            )}
                          >
                            <span className={cn(
                              "text-sm",
                              isToday(day) && primaryTextClass
                            )}>
                              {format(day, "d")}
                            </span>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {getDayStatusIcon(day)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Selected Day Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a Date"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedDate ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Click on a date to view or edit availability</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const dayData = getDayData(selectedDate);
                      return (
                        <>
                          {/* Availability Status */}
                          <div className={cn(
                            "p-3 rounded-lg",
                            dayData.availability?.isAvailable ? primaryBgClass : "bg-red-50"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {dayData.availability 
                                  ? (dayData.availability.isAvailable ? "Available" : "Unavailable")
                                  : "Not Set"
                                }
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDateSelect(selectedDate)}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                            {dayData.availability?.notes && (
                              <p className="text-xs text-gray-500 mt-1">
                                {dayData.availability.notes}
                              </p>
                            )}
                            {dayData.availability?.isRecurring && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                Recurring: {dayData.availability.recurrencePattern}
                              </Badge>
                            )}
                          </div>

                          {/* Tournament Assignments */}
                          {dayData.assignments.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Tournament Assignments
                              </h4>
                              <ScrollArea className="h-48">
                                <div className="space-y-2">
                                  {dayData.assignments.map((tournament) => (
                                    <div
                                      key={tournament.id}
                                      className="p-3 rounded-lg border bg-white"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="font-medium text-sm">
                                            {tournament.name}
                                          </p>
                                          {tournament.location && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                              <MapPin className="w-3 h-3" />
                                              {tournament.location}
                                            </p>
                                          )}
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                          {tournament.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="flex gap-2">
                            <Button
                              className={cn("flex-1", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
                              onClick={() => {
                                setIsAvailable(true);
                                setDialogOpen(true);
                              }}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Mark Available
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setIsAvailable(false);
                                setDialogOpen(true);
                              }}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Mark Unavailable
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Set Availability"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Available Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="available">Available for Assignments</Label>
              <Switch
                id="available"
                checked={isAvailable}
                onCheckedChange={setIsAvailable}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., 'Available after 2 PM' or 'Prefer morning assignments'"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Recurring */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring">Recurring</Label>
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>
              
              {isRecurring && (
                <div className="pl-4 border-l-2 border-gray-200 mt-2">
                  <Label htmlFor="pattern">Repeat Pattern</Label>
                  <select
                    id="pattern"
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="weekly">Weekly (same day each week)</option>
                    <option value="biweekly">Bi-weekly (every 2 weeks)</option>
                    <option value="monthly">Monthly (same date each month)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              {getDayData(selectedDate || new Date())?.availability && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className={isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700"}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
