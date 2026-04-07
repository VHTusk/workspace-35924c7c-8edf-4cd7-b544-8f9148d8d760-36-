"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Trophy, Clock, MapPin, ChevronRight, Bell, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  type: "tournament" | "match" | "checkin";
  title: string;
  date: string;
  time: string;
  location: string;
  city: string;
  state: string;
  status: string;
  tournamentId: string;
  matchId?: string;
  opponent?: string;
  court?: string;
  requiresCheckin: boolean;
  checkedIn: boolean;
}

export default function EventsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [sport]);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/player/events", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data.events || []);
      setTodayEvents(data.todayEvents || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "tournament": return <Trophy className="w-5 h-5" />;
      case "match": return <Clock className="w-5 h-5" />;
      case "checkin": return <Bell className="w-5 h-5" />;
      default: return <CalendarDays className="w-5 h-5" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "tournament": return isCornhole ? "bg-green-100 text-green-700" : "bg-teal-100 text-teal-700";
      case "match": return "bg-blue-100 text-blue-700";
      case "checkin": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
      case "REGISTERED": return "bg-blue-100 text-blue-800";
      case "REGISTRATION_OPEN": return "bg-green-100 text-green-800";
      case "IN_PROGRESS": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-amber-100 text-amber-800";
      case "UPCOMING": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((e) => e.date === dateStr);
  };

  const upcomingEvents = events.filter((e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upcoming Events</h1>
        <p className="text-muted-foreground">Your tournament and match schedule</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Select Date</CardTitle></CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{ hasEvents: events.map((e) => new Date(e.date)) }}
              modifiersStyles={{ hasEvents: { fontWeight: "bold", textDecoration: "underline" } }}
            />
          </CardContent>
        </Card>

        {/* Selected Date Events */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</CardTitle>
            <CardDescription>{getEventsForDate(selectedDate!).length} event(s) scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            {getEventsForDate(selectedDate!).length > 0 ? (
              <div className="space-y-3">
                {getEventsForDate(selectedDate!).map((event) => (
                  <div key={event.id} className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50">
                    <div className={cn("p-2 rounded-lg", getEventTypeColor(event.type))}>{getEventTypeIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{event.title}</p>
                        <Badge variant="outline" className={getStatusColor(event.status)}>{event.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {event.time && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{event.time}</span>}
                        {event.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>}
                      </div>
                      {event.type === "match" && event.opponent && <p className="text-sm mt-1">vs <span className="font-medium">{event.opponent}</span></p>}
                      {event.requiresCheckin && (
                        <div className={cn("mt-2 flex items-center gap-1 text-sm", event.checkedIn ? "text-green-600" : "text-amber-600")}>
                          {event.checkedIn ? <><CheckCircle className="w-4 h-4" /><span>Checked in</span></> : <><AlertCircle className="w-4 h-4" /><span>Check-in required</span></>}
                        </div>
                      )}
                    </div>
                    <Link href={`/${sport}/tournaments/${event.tournamentId}`}>
                      <Button size="sm" variant="outline">View<ChevronRight className="w-4 h-4 ml-1" /></Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No events scheduled for this date</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <Card className={cn("border-l-4", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="w-5 h-5" />Today's Events</CardTitle>
            <CardDescription>You have {todayEvents.length} event(s) today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todayEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={cn("p-2 rounded-lg", getEventTypeColor(event.type))}>{getEventTypeIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle>All Upcoming Events</CardTitle>
          <CardDescription>Your scheduled tournaments and matches</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({upcomingEvents.length})</TabsTrigger>
              <TabsTrigger value="tournaments">Tournaments ({upcomingEvents.filter((e) => e.type === "tournament").length})</TabsTrigger>
              <TabsTrigger value="matches">Matches ({upcomingEvents.filter((e) => e.type === "match").length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="space-y-3">
                {upcomingEvents.length > 0 ? upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-start gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-2xl font-bold">{new Date(event.date).getDate()}</p>
                        <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString("en-IN", { month: "short" })}</p>
                      </div>
                      <div className={cn("p-2 rounded-lg", getEventTypeColor(event.type))}>{getEventTypeIcon(event.type)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{event.title}</p>
                          <Badge variant="outline" className={getStatusColor(event.status)}>{event.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {event.time && <span>{event.time}</span>}
                          {event.location && <span>{event.location}</span>}
                        </div>
                      </div>
                    </div>
                    <Link href={`/${sport}/tournaments/${event.tournamentId}`}>
                      <Button size="sm" className={cn("text-white", primaryClass)}>View Details<ChevronRight className="w-4 h-4 ml-1" /></Button>
                    </Link>
                  </div>
                )) : <p className="text-center text-muted-foreground py-8">No upcoming events</p>}
              </div>
            </TabsContent>

            <TabsContent value="tournaments" className="mt-4">
              <div className="space-y-3">
                {upcomingEvents.filter((e) => e.type === "tournament").length > 0 ? upcomingEvents.filter((e) => e.type === "tournament").map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg", getEventTypeColor(event.type))}>{getEventTypeIcon(event.type)}</div>
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} at {event.time}</p>
                      </div>
                    </div>
                    <Link href={`/${sport}/tournaments/${event.tournamentId}`}><Button size="sm" className={cn("text-white", primaryClass)}>View</Button></Link>
                  </div>
                )) : <p className="text-center text-muted-foreground py-8">No upcoming tournaments</p>}
              </div>
            </TabsContent>

            <TabsContent value="matches" className="mt-4">
              <div className="space-y-3">
                {upcomingEvents.filter((e) => e.type === "match").length > 0 ? upcomingEvents.filter((e) => e.type === "match").map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg", getEventTypeColor(event.type))}>{getEventTypeIcon(event.type)}</div>
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} at {event.time} • {event.location}</p>
                        {event.opponent && <p className="text-sm">vs <span className="font-medium">{event.opponent}</span></p>}
                      </div>
                    </div>
                    <Link href={`/${sport}/tournaments/${event.tournamentId}`}><Button size="sm" className={cn("text-white", primaryClass)}>View</Button></Link>
                  </div>
                )) : <p className="text-center text-muted-foreground py-8">No upcoming matches</p>}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
