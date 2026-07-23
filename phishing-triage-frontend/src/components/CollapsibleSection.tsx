import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  icon?: string;
  id?: string;
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, icon, id, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full" id={id}>
      <Card className="border-border/50 bg-card/40 backdrop-blur-md shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/20 transition-colors rounded-xl">
          <div className="flex items-center gap-3">
            {icon && <span className="text-xl" aria-hidden="true">{icon}</span>}
            <span className="font-semibold text-sm tracking-wide text-foreground">{title}</span>
          </div>
          <div className="text-muted-foreground transition-transform duration-200">
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down overflow-hidden">
          <CardContent className="pt-0 pb-4 px-4 border-t border-border/50 mt-2">
            <div className="pt-4">
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
