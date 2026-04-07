"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  Sun,
  Sunset,
  Moon,
  Check
} from "lucide-react";

interface StepAvailabilityProps {
  data: {
    preferredDays: string[];
    preferredTimes: string[];
  };
  onChange: (data: Partial<StepAvailabilityProps["data"]>) => void;
  sport: string;
}

const dayOptions = [
  { id: "WEEKDAY", name: "Weekdays", description: "Mon - Fri", icon: "📅" },
  { id: "WEEKEND", name: "Weekends", description: "Sat - Sun", icon: "🎉" },
];

const timeOptions = [
  { 
    id: "MORNING", 
    name: "Morning", 
    time: "6:00 AM - 12:00 PM",
    icon: Sun,
    color: "text-amber-500",
  },
  { 
    id: "AFTERNOON", 
    name: "Afternoon", 
    time: "12:00 PM - 6:00 PM",
    icon: Sunset,
    color: "text-orange-500",
  },
  { 
    id: "EVENING", 
    name: "Evening", 
    time: "6:00 PM - 10:00 PM",
    icon: Moon,
    color: "text-indigo-500",
  },
];

export function StepAvailability({ data, onChange, sport }: StepAvailabilityProps) {
  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  const toggleDay = (dayId: string) => {
    const current = data.preferredDays;
    const updated = current.includes(dayId)
      ? current.filter(d => d !== dayId)
      : [...current, dayId];
    onChange({ preferredDays: updated });
  };

  const toggleTime = (timeId: string) => {
    const current = data.preferredTimes;
    const updated = current.includes(timeId)
      ? current.filter(t => t !== timeId)
      : [...current, timeId];
    onChange({ preferredTimes: updated });
  };

  const selectAllDays = () => {
    onChange({ preferredDays: dayOptions.map(d => d.id) });
  };

  const selectAllTimes = () => {
    onChange({ preferredTimes: timeOptions.map(t => t.id) });
  };

  const clearAllDays = () => {
    onChange({ preferredDays: [] });
  };

  const clearAllTimes = () => {
    onChange({ preferredTimes: [] });
  };

  return (
    <div className="space-y-6">
      {/* Preferred Days */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Preferred Days
          </Label>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllDays}
              className="text-xs h-7"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllDays}
              className="text-xs h-7 text-gray-500"
            >
              Clear
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          When are you usually available to play?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {dayOptions.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => toggleDay(day.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all relative ${
                data.preferredDays.includes(day.id)
                  ? `${primaryBorderClass} ${primaryBgClass} ${primaryTextClass} font-medium`
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-2xl">{day.icon}</span>
              <span className="block mt-1 font-medium">{day.name}</span>
              <span className="block text-xs text-gray-500">
                {day.description}
              </span>
              {data.preferredDays.includes(day.id) && (
                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full ${isCornhole ? "bg-green-600" : "bg-teal-600"} text-white flex items-center justify-center`}>
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Times */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Preferred Time Slots
          </Label>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllTimes}
              className="text-xs h-7"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllTimes}
              className="text-xs h-7 text-gray-500"
            >
              Clear
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          What times of day work best for you?
        </p>
        <div className="space-y-2">
          {timeOptions.map((time) => {
            const IconComponent = time.icon;
            return (
              <button
                key={time.id}
                type="button"
                onClick={() => toggleTime(time.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${
                  data.preferredTimes.includes(time.id)
                    ? `${primaryBorderClass} ${primaryBgClass} ${primaryTextClass} font-medium`
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-6 h-6 ${time.color}`} />
                  <div>
                    <span className="block font-medium">{time.name}</span>
                    <span className="block text-xs text-gray-500">
                      {time.time}
                    </span>
                  </div>
                </div>
                {data.preferredTimes.includes(time.id) && (
                  <div className={`w-6 h-6 rounded-full ${isCornhole ? "bg-green-600" : "bg-teal-600"} text-white flex items-center justify-center`}>
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Integration Note */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start gap-2">
          <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-700">Calendar Integration</h4>
            <p className="text-xs text-gray-500 mt-1">
              Your availability preferences will help us suggest tournaments that match your schedule. 
              You can update these anytime from your settings.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      {(data.preferredDays.length > 0 || data.preferredTimes.length > 0) && (
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Availability Summary</h4>
          <div className="flex flex-wrap gap-2">
            {data.preferredDays.map((day) => (
              <span
                key={day}
                className={`px-2 py-1 text-xs rounded-full ${primaryBgClass} ${primaryTextClass}`}
              >
                {dayOptions.find(d => d.id === day)?.name}
              </span>
            ))}
            {data.preferredTimes.map((time) => (
              <span
                key={time}
                className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
              >
                {timeOptions.find(t => t.id === time)?.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
