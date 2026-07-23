import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, InboxIcon } from 'lucide-react';
import { getAnalyses } from '../api/client';
import type { AnalysisListItem, PaginatedResponse, ThreatLevel } from '../types';
import AuthBadge from '../components/AuthBadge';
import ThreatBadge from '../components/ThreatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const THREAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'benign', label: 'Benign' },
];

function scoreColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  const num = Number(score);
  if (num >= 75) return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  if (num >= 50) return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]';
  if (num >= 30) return 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]';
  if (num >= 10) return 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]';
  return 'text-cyan-500';
}

function getRowBg(level: string | null) {
  const norm = level?.toLowerCase();
  if (norm === 'critical') return 'bg-red-500/10 hover:bg-red-500/20 border-l-2 border-l-red-500';
  if (norm === 'high') return 'bg-orange-500/10 hover:bg-orange-500/20 border-l-2 border-l-orange-500';
  if (norm === 'medium') return 'bg-yellow-500/10 hover:bg-yellow-500/20 border-l-2 border-l-yellow-500';
  if (norm === 'low' || norm === 'benign') return 'bg-green-500/10 hover:bg-green-500/20 border-l-2 border-l-green-500';
  return 'hover:bg-muted/50 border-l-2 border-l-transparent';
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse<AnalysisListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [threatFilter, setThreatFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalyses(page, 20, {
        threatLevel: threatFilter !== 'all' ? threatFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      });
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [page, threatFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleRowClick = (id: number) => {
    navigate(`/result/${id}`);
  };

  return (
    <div className="container max-w-7xl py-12 px-4 sm:px-6 space-y-8 animate-fade-in-up">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">Analysis History</h1>
        <p className="text-muted-foreground text-lg">Browse and filter all previously analyzed emails</p>
      </div>

      {/* Filters */}
      <Card className="bg-card/40 backdrop-blur-md shadow-sm border-border/50">
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Threat Level</label>
            <Select value={threatFilter} onValueChange={(val) => { setThreatFilter(val); handleFilterChange(); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                {THREAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date From</label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date To</label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Subject or sender…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleFilterChange(); fetchData(); } }}
                />
              </div>
              <Button onClick={() => { handleFilterChange(); fetchData(); }}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-pulse">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p>Loading records…</p>
          </div>
        ) : error ? (
          <Card className="bg-destructive/10 border-destructive/20 text-destructive text-center py-12">
            <CardContent className="pt-6 space-y-4">
              <p>{error}</p>
              <Button variant="outline" onClick={fetchData} className="border-destructive/30 hover:bg-destructive/20 hover:text-destructive">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !data || data.data.length === 0 ? (
          <Card className="bg-card/40 border-dashed border-2 border-border/50 text-center py-20">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <InboxIcon className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">No analyses found</h2>
                <p className="text-muted-foreground">Upload an email or adjust your filters.</p>
              </div>
              <Button asChild className="mt-4">
                <Link to="/">Analyze Email</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/60 backdrop-blur-xl shadow-lg border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead className="max-w-[250px]">Subject</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Threat</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className={cn("cursor-pointer transition-colors duration-200", getRowBg(item.ai_threat_level))}
                    onClick={() => handleRowClick(item.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{item.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), 'HH:mm')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate font-medium text-foreground">
                      {item.subject ?? '(no subject)'}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {item.sender_email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <AuthBadge label="S" result={item.spf_result} />
                        <AuthBadge label="D" result={item.dkim_result} />
                        <AuthBadge label="M" result={item.dmarc_result} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <ThreatBadge level={item.ai_threat_level as ThreatLevel | null} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-mono font-bold text-lg tabular-nums", scoreColor(item.risk_score))}>
                        {item.risk_score != null ? Number(item.risk_score).toFixed(1) : '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{data.data.length}</span> of{' '}
                  <span className="font-medium text-foreground">{data.pagination.total}</span> records
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <div className="text-sm font-medium">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
