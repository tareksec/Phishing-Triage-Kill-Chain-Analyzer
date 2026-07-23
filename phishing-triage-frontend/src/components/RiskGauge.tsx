import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface Props {
  score: number | null | undefined; // 0 to 100
  size?: number;
  showBreakdown?: boolean;
  ruleScore?: number;
  aiScore?: number;
  aiConfidence?: number;
}

export default function RiskGauge({ 
  score, 
  size = 160, 
  showBreakdown = false,
  ruleScore,
  aiScore,
  aiConfidence
}: Props) {
  if (score == null) {
    return (
      <div 
        className="relative flex items-center justify-center rounded-full border-4 border-dashed border-muted/50 bg-muted/10"
        style={{ width: size, height: size }}
      >
        <div className="text-center">
          <span className="block text-xl">⏳</span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-2 block">Pending</span>
        </div>
      </div>
    );
  }

  const numScore = Number(score);
  const normalized = Math.max(0, Math.min(100, numScore));
  const strokeWidth = size * 0.12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // We want a gauge that is 75% of a full circle (270 degrees)
  const arcLength = circumference * 0.75;
  const offset = arcLength - (normalized / 100) * arcLength;
  const gapLength = circumference - arcLength;

  // Determine color based on score
  let colorClass = "text-green-500";
  let dropShadow = "drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]";
  if (normalized >= 90) {
    colorClass = "text-red-600";
    dropShadow = "drop-shadow-[0_0_12px_rgba(220,38,38,0.7)]";
  } else if (normalized >= 70) {
    colorClass = "text-red-500";
    dropShadow = "drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]";
  } else if (normalized >= 40) {
    colorClass = "text-amber-500";
    dropShadow = "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]";
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Background track */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-secondary/50"
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
          />
          {/* Active track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className={cn(colorClass, "transition-all duration-1000 ease-out", dropShadow)}
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>

        {/* Inner value */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={cn("text-4xl font-black tabular-nums tracking-tighter", colorClass, dropShadow)}>
            {normalized.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
            / 100
          </span>
        </div>
      </div>

      {showBreakdown && (
        <div className="w-full space-y-3 bg-secondary/20 p-4 rounded-xl border border-border/50">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Rules (max 70)</span>
            <Badge variant="outline" className="font-mono">{ruleScore ?? 0}</Badge>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">AI Score</span>
            <Badge variant="outline" className="font-mono">{aiScore ?? 0}/100</Badge>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">AI Confidence</span>
            <span className="font-mono font-medium text-foreground">
              {aiConfidence != null ? (aiConfidence * 100).toFixed(0) : 0}%
            </span>
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 text-[10.5px] leading-relaxed text-muted-foreground/90 bg-background/50 rounded p-2 text-center">
            Rule score: {ruleScore ?? 0}/70 (×0.5 weight) <br/>
            + AI score: {aiScore ?? 0}/100 (weighted at {(aiConfidence != null ? aiConfidence * 100 : 0).toFixed(0)}%) <br/>
            = <strong className="text-foreground">{score != null ? Number(score).toFixed(1) : 0}/100</strong>
          </div>
        </div>
      )}
    </div>
  );
}
