import type { KillChainStage } from '../types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface Props {
  activeStage: KillChainStage | null;
  mitreTechnique?: string | null;
}

const STAGES: { key: KillChainStage; label: string; icon: string }[] = [
  { key: 'reconnaissance',        label: 'Recon',         icon: '🔍' },
  { key: 'weaponization',         label: 'Weaponize',     icon: '⚒️' },
  { key: 'delivery',              label: 'Delivery',      icon: '📧' },
  { key: 'exploitation',          label: 'Exploit',       icon: '💥' },
  { key: 'installation',          label: 'Install',       icon: '📦' },
  { key: 'c2',                    label: 'C2',            icon: '📡' },
  { key: 'actions_on_objectives', label: 'Actions',       icon: '🎯' },
];

export default function KillChainTimeline({ activeStage, mitreTechnique }: Props) {
  const activeIndex = activeStage ? STAGES.findIndex((s) => s.key === activeStage) : -1;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lockheed Martin Kill Chain</h3>
        {mitreTechnique && (
          <a
            href={`https://attack.mitre.org/techniques/${mitreTechnique.replace('.', '/')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Badge variant="outline" className="font-mono bg-background border-primary/30 text-primary group-hover:bg-primary/10">
              {mitreTechnique}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
              MITRE ATT&CK <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        )}
      </div>

      <div className="relative flex w-full justify-between" role="list">
        {/* Background track line */}
        <div className="absolute top-5 left-6 right-6 h-0.5 bg-secondary/50 -z-10 rounded-full" aria-hidden="true" />
        
        {/* Active track line */}
        {activeIndex >= 0 && (
          <div 
            className="absolute top-5 left-6 h-0.5 bg-primary -z-10 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            style={{ width: `calc(${(activeIndex / (STAGES.length - 1)) * 100}% - 3rem)` }}
            aria-hidden="true" 
          />
        )}

        {STAGES.map((stage, i) => {
          const isPast = activeIndex >= 0 && i < activeIndex;
          const isActive = i === activeIndex;

          return (
            <div
              key={stage.key}
              className="flex flex-col items-center gap-3 relative z-10 w-16"
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
            >
              <div 
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 bg-background",
                  isActive ? "border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-110" 
                  : isPast ? "border-primary text-primary" 
                  : "border-muted text-muted-foreground"
                )}
              >
                <span className={cn("text-lg", !isActive && !isPast && "opacity-50 grayscale")} aria-hidden="true">
                  {stage.icon}
                </span>
              </div>
              <span className={cn(
                "text-[10px] sm:text-xs font-medium text-center break-words leading-tight transition-colors duration-300",
                isActive ? "text-primary font-bold" : isPast ? "text-foreground" : "text-muted-foreground"
              )}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
