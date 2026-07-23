import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileCode, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { uploadEmail, uploadRawEmail, runAiAnalysis } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const PIPELINE_STEPS = [
  { label: 'Parsing email headers & body' },
  { label: 'Enriching IOCs via urlscan.io' },
  { label: 'Running AI analysis' },
  { label: 'Complete!' },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const runPipeline = useCallback(
    async (uploadFn: () => Promise<{ id: number }>) => {
      setProcessing(true);
      setError(null);
      setPipelineStep(0);

      try {
        // Step 0: Parse email
        const parsed = await uploadFn();
        const id = parsed.id;

        // Step 1-2: AI + enrichment
        setPipelineStep(1);
        try {
          await runAiAnalysis(id, true);
          setPipelineStep(3); // jump to complete
        } catch (aiErr: unknown) {
          // AI is optional — still navigate to result
          console.warn('AI analysis failed (non-blocking):', aiErr);
          setPipelineStep(3);
        }

        // Brief delay so user sees the "Complete" step
        await new Promise((r) => setTimeout(r, 600));
        navigate(`/result/${id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        setProcessing(false);
      }
    },
    [navigate]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      runPipeline(() => uploadEmail(file));
    },
    [runPipeline]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'message/rfc822': ['.eml'], 'application/octet-stream': ['.eml'] },
    maxFiles: 1,
    disabled: processing,
  });

  const handlePaste = () => {
    if (!rawText.trim()) return;
    runPipeline(() => uploadRawEmail(rawText.trim()));
  };

  return (
    <div className="container max-w-4xl py-12 px-4 sm:px-6 animate-fade-in-up pt-24">
      <div className="mb-10 space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60">
          Analyze Email
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Upload a <code className="bg-muted px-1.5 py-0.5 rounded-md text-primary font-mono text-sm">.eml</code> file or paste raw email source for automated phishing triage, powered by hybrid rule+AI analysis.
        </p>
      </div>

      {processing ? (
        <Card className="border-primary/20 shadow-lg shadow-primary/5 animate-fade-in-up bg-card/60 backdrop-blur-xl">
          <CardHeader className="text-center pb-8 pt-10">
            <CardTitle className="text-2xl">Analyzing Threat</CardTitle>
            <CardDescription>Please wait while we process the email data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10 px-8 pb-10">
            <Progress value={Math.max(10, ((pipelineStep + 1) / PIPELINE_STEPS.length) * 100)} className="h-3 bg-secondary/50" />
            
            <div className="space-y-5 max-w-md mx-auto">
              {PIPELINE_STEPS.map((step, index) => {
                const isPast = pipelineStep > index || pipelineStep === 3;
                const isActive = pipelineStep === index;
                const isPending = pipelineStep < index;
                
                return (
                  <div key={index} className={cn(
                    "flex items-center gap-4 transition-all duration-300",
                    isActive ? "opacity-100 scale-105 transform" : isPast ? "opacity-70" : "opacity-30"
                  )}>
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isActive ? "border-primary text-primary animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.3)]" : 
                      isPast ? "border-primary bg-primary text-primary-foreground" : 
                      "border-muted text-muted-foreground"
                    )}>
                      {isPast ? <CheckCircle2 className="h-5 w-5" /> : 
                       isActive ? <RefreshCw className="h-5 w-5 animate-spin" /> : 
                       <span className="text-sm font-semibold">{index + 1}</span>}
                    </div>
                    <span className={cn("font-medium", isActive && "text-primary font-semibold text-lg")}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {error && (
              <Alert variant="destructive" className="mt-8 animate-fade-in-up shadow-lg shadow-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error processing email</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-3">
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={() => { setProcessing(false); setPipelineStep(-1); setError(null); }} className="w-fit">
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl animate-fade-in-up">
          <Tabs defaultValue="file" className="w-full">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="file" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="paste" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  <FileCode className="mr-2 h-4 w-4" />
                  Paste Raw Source
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-8 pb-8 px-6 sm:px-8">
              <TabsContent value="file" className="mt-0 outline-none">
                <div
                  {...getRootProps()}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300 cursor-pointer overflow-hidden",
                    isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <input {...getInputProps()} />
                  
                  {/* Subtle background glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className={cn(
                    "rounded-full p-4 transition-colors duration-300 z-10",
                    isDragActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <FileUp className="h-10 w-10" />
                  </div>
                  <div className="space-y-1.5 z-10">
                    <p className="text-xl font-medium tracking-tight">
                      {isDragActive ? 'Drop your .eml file here' : 'Drag & drop a .eml file here'}
                    </p>
                    <p className="text-sm text-muted-foreground font-medium">
                      or click to browse from your computer
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground/60 z-10 bg-background/50 px-3 py-1 rounded-full border border-border/50">
                    Max file size: 10MB
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="mt-0 outline-none space-y-6">
                <div className="space-y-3">
                  <label htmlFor="raw-text-input" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Raw Email Source
                  </label>
                  <textarea
                    id="raw-text-input"
                    className="flex min-h-[300px] w-full rounded-xl border border-input bg-background/50 px-4 py-3 text-sm font-mono shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                    placeholder="Paste the full raw email source here (including all MIME boundaries and headers)..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button 
                    size="lg" 
                    disabled={!rawText.trim()} 
                    onClick={handlePaste}
                    className="w-full sm:w-auto shadow-lg shadow-primary/20"
                  >
                    Analyze Email Source
                  </Button>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}
