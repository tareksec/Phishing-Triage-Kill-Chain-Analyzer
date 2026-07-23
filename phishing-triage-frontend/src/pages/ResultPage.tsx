import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Flag, BrainCircuit, Link as LinkIcon, Paperclip } from 'lucide-react';
import { getAnalysis } from '../api/client';
import type { AnalysisRecord } from '../types';
import AuthBadge from '../components/AuthBadge';
import ThreatBadge from '../components/ThreatBadge';
import RiskGauge from '../components/RiskGauge';
import KillChainTimeline from '../components/KillChainTimeline';
import CollapsibleSection from '../components/CollapsibleSection';
import ReportExport from '../components/ReportExport';
import Chatbot from '../components/Chatbot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 m-8 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg whitespace-pre-wrap font-mono text-sm">
          <h2 className="font-bold text-lg mb-4">React Render Error</h2>
          {this.state.error?.toString()}{'\n'}
          {this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getAnalysis(Number(id))
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container max-w-7xl py-12 px-4 sm:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-medium">Loading analysis…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-3xl py-12 px-4 sm:px-6">
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive shadow-lg shadow-destructive/5 p-6">
          <AlertTitle className="text-xl font-bold mb-2">Analysis Not Found</AlertTitle>
          <AlertDescription className="text-base flex flex-col gap-6">
            <p>{error ?? 'The requested analysis does not exist or has been deleted.'}</p>
            <Button asChild variant="outline" className="w-fit border-destructive/30 hover:bg-destructive/20 hover:text-destructive">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Go back</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasAi = !!data.ai_threat_level;
  const bd = data.risk_score_breakdown;

  return (
    <ErrorBoundary>
      <div className="container max-w-7xl py-8 px-4 sm:px-6 space-y-8 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in-up">
        <Link to="/history" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> History
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Case #{data.id}</span>
      </div>

      {/* ===== Header Summary Card ===== */}
      <Card className="border-primary/20 bg-card/60 backdrop-blur-xl shadow-lg shadow-primary/5 animate-fade-in-up overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <CardContent className="p-6 sm:p-8 flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-4 flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground line-clamp-2">
              {data.subject ?? '(no subject)'}
            </h1>
            
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                From: <span className="text-foreground font-medium">
                  {data.sender_display_name
                    ? <>{data.sender_display_name} <span className="opacity-70">&lt;{data.sender_email}&gt;</span></>
                    : data.sender_email ?? 'Unknown sender'}
                </span>
              </span>
              <span className="text-muted-foreground flex items-center gap-2">
                Date: <span className="text-foreground">{format(new Date(data.created_at), 'PPpp')}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Badge variant="secondary" className="font-mono text-[10px] bg-secondary/40 text-secondary-foreground border-border/50">
                {data.filename}
              </Badge>
              {data.reply_to_mismatch && (
                <Badge variant="warning" className="text-[10px]">⚠️ Reply-To Mismatch</Badge>
              )}
              {data.display_name_domain_mismatch && (
                <Badge variant="warning" className="text-[10px]">⚠️ Display Name Spoofing</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-6 border-t lg:border-t-0 lg:border-l border-border/50 pt-6 lg:pt-0 lg:pl-6 shrink-0">
            <div className="w-full">
              <ThreatBadge level={data.ai_threat_level} size="lg" />
            </div>
            
            {/* Auth badges */}
            <div className="flex items-center gap-3 w-full justify-between lg:justify-end">
              <AuthBadge label="SPF" result={data.spf_result} />
              <AuthBadge label="DKIM" result={data.dkim_result} />
              <AuthBadge label="DMARC" result={data.dmarc_result} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Main Grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column (Main content) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Kill Chain Timeline */}
          <Card className="bg-card/40 backdrop-blur-md shadow-sm border-border/50 animate-fade-in-up stagger-1 overflow-hidden">
            <CardContent className="p-6">
              <KillChainTimeline
                activeStage={data.ai_kill_chain_stage}
                mitreTechnique={data.ai_mitre_technique}
              />
            </CardContent>
          </Card>

          {/* Red Flags & AI Explanation */}
          {hasAi && data.ai_red_flags && data.ai_red_flags.length > 0 && (
            <Card className="bg-destructive/5 border-destructive/20 shadow-sm animate-fade-in-up stagger-2">
              <CardHeader className="pb-3 border-b border-destructive/10 bg-destructive/10 flex flex-row items-center gap-2">
                <Flag className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg text-destructive">Red Flags Identified</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <ul className="space-y-3">
                  {data.ai_red_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground/90">
                      <span className="shrink-0 mt-0.5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" aria-hidden="true">⚠️</span>
                      <span className="leading-relaxed">{flag}</span>
                    </li>
                  ))}
                </ul>

                {data.ai_explanation && (
                  <div className="pt-6 border-t border-destructive/10 space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-destructive/80 flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4" /> Analyst Reasoning
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{data.ai_explanation}</p>
                    {data.ai_model_used && (
                      <Badge variant="outline" className="text-[10px] font-mono mt-2 bg-background/50 border-destructive/20 text-muted-foreground">
                        Model: {data.ai_model_used}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* URL Reputation */}
          {data.extracted_urls && data.extracted_urls.length > 0 && (
            <Card className="bg-card/40 backdrop-blur-md shadow-sm border-border/50 animate-fade-in-up stagger-3">
              <CardHeader className="pb-4 border-b border-border/50 flex flex-row items-center gap-2">
                <LinkIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Extracted URLs & Reputation</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap table-fixed">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-[25%] sm:w-[35%]">URL</th>
                      <th className="px-4 py-3 font-semibold w-[15%] sm:w-[20%]">Domain</th>
                      <th className="px-2 py-3 font-semibold w-[20%] sm:w-[15%]">Mismatch / Flags</th>
                      <th className="px-2 py-3 font-semibold text-center w-[20%] sm:w-[15%]">VirusTotal</th>
                      <th className="px-2 py-3 font-semibold text-center w-[20%] sm:w-[15%]">urlscan.io</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.extracted_urls?.map((u, i) => {
                      const vtRep = data.url_reputation?.find((r) => r.url === u.url);
                      const scanRep = data.urlscan_reputation?.find((r) => r.url === u.url);
                      
                      const vtMalicious = vtRep?.status === 'malicious' || (vtRep?.status == null && vtRep?.malicious === true);
                      const scanMalicious = scanRep?.status === 'malicious';
                      const vtClean = vtRep?.status === 'clean' || (vtRep?.status == null && vtRep?.malicious === false);
                      const scanClean = scanRep?.status === 'clean';
                      
                      const conflict = (vtMalicious && scanClean) || (vtClean && scanMalicious);

                      return (
                        <tr key={i} className={cn("hover:bg-muted/30 transition-colors", (u.textHrefMismatch || conflict) && "bg-destructive/5")}>
                          <td className="px-4 py-4 font-mono text-[10px] text-muted-foreground truncate" title={u.url}>{u.url}</td>
                          <td className="px-4 py-4 truncate" title={u.domain}>{u.domain}</td>
                          <td className="px-2 py-4">
                            <div className="flex flex-col gap-1">
                              {u.textHrefMismatch && (
                                <span className="inline-flex items-center gap-1.5 text-warning font-medium text-xs">
                                  ⚠️ {u.displayText}
                                </span>
                              )}
                              {conflict && (
                                <Badge variant="warning" className="w-fit text-[9px] px-1.5 py-0">
                                  ⚠️ Sources disagree
                                </Badge>
                              )}
                              {!u.textHrefMismatch && !conflict && <span className="text-muted-foreground/50">—</span>}
                            </div>
                          </td>
                          <td className="px-2 py-4 text-center">
                            {(vtRep?.status === 'malicious' || (vtRep?.status == null && vtRep?.malicious === true)) && <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-transparent text-[10px]">🔴 Malicious</Badge>}
                            {(vtRep?.status === 'clean' || (vtRep?.status == null && vtRep?.malicious === false)) && <Badge variant="success" title="No detections yet — does not guarantee safety" className="bg-green-500/20 text-green-500 border-transparent text-[10px] cursor-help">🟢 Clean</Badge>}
                            {(vtRep?.status === 'unknown' || (vtRep?.status == null && vtRep?.malicious == null)) && <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-transparent text-[10px]">⚪ No data</Badge>}
                          </td>
                          <td className="px-2 py-4 text-center">
                            {scanRep?.status === 'malicious' && <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-transparent text-[10px]">🔴 Malicious</Badge>}
                            {scanRep?.status === 'clean' && <Badge variant="success" className="bg-green-500/20 text-green-500 border-transparent text-[10px]">🟢 Clean</Badge>}
                            {(scanRep == null || scanRep.status === 'unknown') && <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-transparent text-[10px]">⚪ No data</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Report Export */}
          <div className="animate-fade-in-up stagger-4 pt-4 border-t border-border/50">
            <ReportExport analysis={data} />
          </div>
          
          {/* Chatbot */}
          <div className="animate-fade-in-up stagger-5" id="chatbot">
            <Chatbot analysisId={data.id} />
          </div>

        </div>

        {/* Right column (Sidebar) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Risk Gauge */}
          <Card className="bg-card/40 backdrop-blur-md shadow-sm border-border/50 animate-fade-in-up stagger-1">
            <CardHeader className="pb-2 text-center border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Threat Score</CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex justify-center">
              <RiskGauge
                score={data.risk_score}
                size={220}
                showBreakdown={hasAi}
                ruleScore={bd?.ruleScore}
                aiScore={bd?.aiScore}
                aiConfidence={bd?.aiConfidence}
              />
            </CardContent>
          </Card>

          {/* Attachments */}
          {data.extracted_attachments && data.extracted_attachments.length > 0 && (
            <Card className="bg-card/40 backdrop-blur-md shadow-sm border-border/50 animate-fade-in-up stagger-2">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Attachments ({data.extracted_attachments.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/50">
                {data.extracted_attachments.map((a, i) => (
                  <div key={i} className="p-4 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                    <span className="font-medium text-sm text-foreground break-all">{a.filename}</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase">
                      <span>{a.contentType}</span>
                      <span>•</span>
                      <span>{(a.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground/60 break-all mt-1 bg-background/50 p-1 rounded">
                      {a.sha256}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* ===== Collapsible Technical Data ===== */}
      <div className="space-y-4 pt-8 border-t border-border/50 animate-fade-in-up stagger-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-2">Raw Analysis Data</h3>
        
        <CollapsibleSection title="Received Chain Hops" icon="📡" id="received-chain">
          <div className="space-y-4">
            {data.received_chain && data.received_chain.length > 0 ? data.received_chain.map((hop) => (
              <div key={hop.index} className="flex gap-4 p-4 rounded-lg bg-muted/20 border border-border/50 text-sm">
                <span className="font-mono text-primary font-bold">#{hop.index}</span>
                <div className="space-y-1 text-muted-foreground flex-1 overflow-hidden">
                  {hop.from && <div className="truncate"><strong className="text-foreground">From:</strong> {hop.from}</div>}
                  {hop.by && <div className="truncate"><strong className="text-foreground">By:</strong> {hop.by}</div>}
                  {hop.date && <div className="text-xs mt-2 text-muted-foreground/70">{hop.date}</div>}
                </div>
              </div>
            )) : <p className="text-muted-foreground italic text-sm p-4">No received hops parsed.</p>}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Raw Email Headers" icon="📄" id="raw-headers">
          <pre className="p-4 rounded-lg bg-muted/30 border border-border/50 text-[10px] sm:text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border">
            {data.raw_headers}
          </pre>
        </CollapsibleSection>
      </div>
    </div>
    </ErrorBoundary>
  );
}
