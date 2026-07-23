import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, Shield, ShieldX } from 'lucide-react';

interface Props {
  label: string;
  result: string | null;
}

export default function AuthBadge({ label, result }: Props) {
  const normalized = result?.toLowerCase() ?? 'none';
  
  let variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' = 'secondary';
  let Icon = Shield;
  let text = 'None';

  if (normalized === 'pass') {
    variant = 'success';
    Icon = ShieldCheck;
    text = 'Pass';
  } else if (normalized === 'fail' || normalized === 'hardfail') {
    variant = 'destructive';
    Icon = ShieldX;
    text = 'Fail';
  } else if (normalized === 'softfail') {
    variant = 'warning';
    Icon = ShieldAlert;
    text = 'Softfail';
  } else if (normalized === 'neutral') {
    variant = 'outline';
    text = 'Neutral';
  } else {
    text = result || 'None';
  }

  return (
    <div className="flex flex-col gap-1 items-center bg-secondary/20 p-2 rounded-lg border border-border/50">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Badge variant={variant} className="gap-1 px-2 uppercase tracking-wide text-[10px]">
        <Icon className={cn("w-3 h-3", variant === 'success' && "text-green-500", variant === 'destructive' && "text-destructive", variant === 'warning' && "text-yellow-500")} />
        {text}
      </Badge>
    </div>
  );
}
