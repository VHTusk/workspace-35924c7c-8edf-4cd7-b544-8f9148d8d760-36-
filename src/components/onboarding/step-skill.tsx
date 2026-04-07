"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Trophy, 
  Clock, 
  Star,
  TrendingUp,
  Award
} from "lucide-react";

interface StepSkillProps {
  data: {
    skillLevel: string;
    yearsExperience: string;
    hasTournamentExp: boolean;
  };
  onChange: (data: Partial<StepSkillProps["data"]>) => void;
  sport: string;
}

const skillLevels = [
  {
    id: "BEGINNER",
    name: "Beginner",
    icon: "🌱",
    description: "New to competitive play, learning the basics",
    eloHint: "Starting your journey",
  },
  {
    id: "INTERMEDIATE",
    name: "Intermediate",
    icon: "⭐",
    description: "Regular player with some experience",
    eloHint: "Building your skills",
  },
  {
    id: "ADVANCED",
    name: "Advanced",
    icon: "🔥",
    description: "Experienced competitor with strong skills",
    eloHint: "Seasoned player",
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    icon: "🏆",
    description: "Competes at the highest level",
    eloHint: "Elite competitor",
  },
];

export function StepSkill({ data, onChange, sport }: StepSkillProps) {
  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  const handleSkillSelect = (skillId: string) => {
    onChange({ skillLevel: skillId });
  };

  return (
    <div className="space-y-6">
      {/* Skill Level */}
      <div className="space-y-3">
        <Label className="text-gray-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Self-Assessed Skill Level *
        </Label>
        <p className="text-sm text-gray-500">
          This helps us match you with appropriate tournaments and opponents
        </p>
        <div className="grid grid-cols-2 gap-3">
          {skillLevels.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => handleSkillSelect(level.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                data.skillLevel === level.id
                  ? `${primaryBorderClass} ${primaryBgClass} ${primaryTextClass} font-medium`
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-2xl">{level.icon}</span>
              <span className="block mt-1 font-medium">{level.name}</span>
              <span className="block text-xs text-gray-500 mt-1">
                {level.description}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 italic">
          Note: Your skill level helps seed your initial rating. Your actual rating will adjust based on match performance.
        </p>
      </div>

      {/* Years of Experience */}
      <div className="space-y-2">
        <Label htmlFor="yearsExperience" className="text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Years of Experience
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="yearsExperience"
            type="number"
            min="0"
            max="50"
            placeholder="0"
            value={data.yearsExperience}
            onChange={(e) => onChange({ yearsExperience: e.target.value })}
            className="w-24 border-gray-200 focus-visible:ring-green-500"
          />
          <span className="text-gray-500">years</span>
        </div>
        <p className="text-xs text-gray-500">
          How long have you been playing {isCornhole ? "cornhole" : "darts"}?
        </p>
      </div>

      {/* Tournament Experience */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start gap-3">
          <Checkbox
            id="hasTournamentExp"
            checked={data.hasTournamentExp}
            onCheckedChange={(checked) => onChange({ hasTournamentExp: checked as boolean })}
          />
          <div className="flex-1">
            <Label htmlFor="hasTournamentExp" className="text-gray-700 cursor-pointer flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              I have previous tournament experience
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              Have you participated in any organized tournaments before?
            </p>
          </div>
        </div>
      </div>

      {/* Skill Tips */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <Award className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">How skill levels work</h4>
            <p className="text-xs text-blue-700 mt-1">
              Your self-assessed skill level helps us place you in the right competitive tier. 
              As you play matches, your rating will adjust based on your performance. 
              Don't worry if you're not sure - your rating will find its natural level over time!
            </p>
          </div>
        </div>
      </div>

      {/* Skill Level Preview */}
      {data.skillLevel && (
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isCornhole ? "bg-green-100 text-green-600" : "bg-teal-100 text-teal-600"
            }`}>
              <Star className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {skillLevels.find(l => l.id === data.skillLevel)?.name} Level
              </h4>
              <p className="text-sm text-gray-500">
                {skillLevels.find(l => l.id === data.skillLevel)?.eloHint}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
