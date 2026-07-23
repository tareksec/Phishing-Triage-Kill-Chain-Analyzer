import type { AnalysisRecord } from '../types';
import { Download } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  analysis: AnalysisRecord;
}

export default function ReportExport({ analysis }: Props) {
  return (
    <div className="flex justify-end mt-8">
      <Button asChild size="lg" className="shadow-lg shadow-primary/20 gap-2">
        <a 
          href={`/api/analyses/${analysis.id}/report.pdf`} 
          download={`phishing-report-${analysis.id}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download className="w-4 h-4" />
          Download Analyst Report (PDF)
        </a>
      </Button>
    </div>
  );
}
