import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ShieldCheck, ShieldAlert, Skull } from 'lucide-react';

interface Props {
  level: string | null;
  size?: 'sm' | 'lg';
}

export default function ThreatBadge({ level, size = 'sm' }: Props) {
  const normalized = level?.toLowerCase() ?? 'pending';

  let variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' = 'outline';
  let colorClass = "text-muted-foreground";
  let dropShadow = "";
  let Icon = ShieldAlert;

  if (normalized === 'critical') {
    variant = 'destructive';
    colorClass = "text-red-600 bg-red-600/10 border-red-600/50";
    dropShadow = "drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]";
    Icon = Skull;
  } else if (normalized === 'high') {
    variant = 'destructive';
    colorClass = "text-red-500 bg-red-500/10 border-red-500/50";
    dropShadow = "drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]";
    Icon = AlertTriangle;
  } else if (normalized === 'medium') {
    variant = 'warning';
    colorClass = "text-amber-500 bg-amber-500/10 border-amber-500/50";
    dropShadow = "drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]";
    Icon = AlertTriangle;
  } else if (normalized === 'low') {
    variant = 'success';
    colorClass = "text-green-500 bg-green-500/10 border-green-500/50";
    Icon = ShieldCheck;
  } else if (normalized === 'benign') {
    variant = 'success';
    colorClass = "text-cyan-500 bg-cyan-500/10 border-cyan-500/50";
    Icon = ShieldCheck;
  }

  const isLarge = size === 'lg';

  return (
    <Badge 
      variant={variant} 
      className={cn(
        "uppercase font-bold tracking-widest gap-2 flex items-center border",
        isLarge ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-[10px]",
        colorClass,
        dropShadow
      )}
    >
      <Icon className={cn(isLarge ? "w-4 h-4" : "w-3 h-3")} />
      {normalized}
    </Badge>
  );
}
