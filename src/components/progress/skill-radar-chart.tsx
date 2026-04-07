'use client';

interface SkillRadarChartProps {
  skills: {
    attack: number;
    defense: number;
    consistency: number;
    clutch: number;
    endurance: number;
    versatility: number;
  };
  size?: number;
  theme?: string;
}

const SKILL_LABELS: Record<string, string> = {
  attack: 'Attack',
  defense: 'Defense',
  consistency: 'Consistency',
  clutch: 'Clutch Factor',
  endurance: 'Endurance',
  versatility: 'Versatility',
};

export function SkillRadarChart({ skills, size = 200, theme = 'teal' }: SkillRadarChartProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 30;

  const skillKeys = Object.keys(skills) as (keyof typeof skills)[];
  const angleStep = (2 * Math.PI) / skillKeys.length;

  // Calculate points for radar chart
  const points = skillKeys.map((key, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const value = skills[key] / 100;
    const x = centerX + radius * value * Math.cos(angle);
    const y = centerY + radius * value * Math.sin(angle);
    return { x, y, key, value: skills[key] };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Generate grid circles
  const gridLevels = [20, 40, 60, 80, 100];
  const gridCircles = gridLevels.map(level => {
    const r = (level / 100) * radius;
    return { r, level };
  });

  // Generate axis lines
  const axisLines = skillKeys.map((_, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x1: centerX, y1: centerY, x2: x, y2: y };
  });

  const themeColor = theme === 'cornhole' ? '#22c55e' : '#14b8a6';
  const themeColorLight = theme === 'cornhole' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(20, 184, 166, 0.2)';

  return (
    <div className="relative">
      <svg width={size} height={size} className="mx-auto">
        {/* Grid circles */}
        {gridCircles.map(({ r, level }) => (
          <circle
            key={level}
            cx={centerX}
            cy={centerY}
            r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray={level === 50 ? "none" : "4 4"}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Skill area */}
        <path
          d={pathData}
          fill={themeColorLight}
          stroke={themeColor}
          strokeWidth="2"
          className="transition-all duration-500"
        />

        {/* Skill points */}
        {points.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r="5"
            fill={themeColor}
            stroke="white"
            strokeWidth="2"
            className="transition-all duration-300"
          />
        ))}

        {/* Labels */}
        {skillKeys.map((key, index) => {
          const angle = angleStep * index - Math.PI / 2;
          const labelRadius = radius + 20;
          const x = centerX + labelRadius * Math.cos(angle);
          const y = centerY + labelRadius * Math.sin(angle);
          const textAnchor = Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1
            ? 'middle'
            : angle > 0 && angle < Math.PI
              ? 'start'
              : 'end';

          return (
            <text
              key={key}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="text-xs font-medium fill-gray-700"
            >
              {SKILL_LABELS[key]}
            </text>
          );
        })}
      </svg>

      {/* Skill values overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: themeColor }}>
            {Math.round(Object.values(skills).reduce((a, b) => a + b, 0) / 6)}
          </div>
          <div className="text-xs text-gray-500">Overall</div>
        </div>
      </div>
    </div>
  );
}

// Compact version for dashboard cards
export function SkillRadarChartMini({ skills, size = 120, theme = 'teal' }: SkillRadarChartProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 15;

  const skillKeys = Object.keys(skills) as (keyof typeof skills)[];
  const angleStep = (2 * Math.PI) / skillKeys.length;

  const points = skillKeys.map((key, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const value = skills[key] / 100;
    const x = centerX + radius * value * Math.cos(angle);
    const y = centerY + radius * value * Math.sin(angle);
    return { x, y };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const themeColor = theme === 'cornhole' ? '#22c55e' : '#14b8a6';
  const themeColorLight = theme === 'cornhole' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(20, 184, 166, 0.2)';

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid circle */}
      <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      
      {/* Skill area */}
      <path
        d={pathData}
        fill={themeColorLight}
        stroke={themeColor}
        strokeWidth="2"
      />

      {/* Skill points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill={themeColor}
        />
      ))}
    </svg>
  );
}
