import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Search, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { InfoHint } from '../../components/InfoHint';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { StatCard } from '../../ui/stat-card';
import { useRateCardCoverage } from '../../api/ruleEngine';
import { useLocations } from '../../api/locations';

const ALL_LOCATIONS = '__all__';

export function RateCardCoverage() {
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const { data: locationsData } = useLocations();
  const { data, isLoading, error } = useRateCardCoverage(locationId || null);

  const locations = locationsData?.locations ?? locationsData ?? [];
  const covered = data?.totalWithRateCards ?? 0;
  const total = data?.totalStaffWithShifts ?? 0;
  const missing = data?.missingRateCard ?? [];
  const pct = total ? Math.round((covered / total) * 100) : 100;

  const filteredMissing = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return missing;
    return missing.filter((name) => name.toLowerCase().includes(q));
  }, [missing, search]);

  return (
    <div className="page-stack-tight">
      <div className="filter-toolbar flex-wrap">
        <InfoHint
          content="Staff with shifts but no SCHADS rate card fall back to defaults in cost analysis. Add rates on the Staff page, or aliases when ShiftCare names differ from your rate file."
          label="About rate card coverage"
          variant="help"
        />
        {Array.isArray(locations) && locations.length > 0 && (
          <>
            <span className="text-2xs text-muted-foreground">Location</span>
            <Select
              value={locationId || ALL_LOCATIONS}
              onValueChange={(v) => setLocationId(v === ALL_LOCATIONS ? '' : v)}
            >
              <SelectTrigger className="filter-control h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc._id} value={loc._id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Button asChild variant="outline" size="sm" className="ml-auto h-8 gap-1.5">
          <Link to="/staff">
            Staff rates
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="py-8">
          <LoadingScreen message="Loading coverage…" />
        </div>
      )}

      {error && (
        <QueryErrorState error={error} title="Failed to load coverage" className="border-0 shadow-none" />
      )}

      {data && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Shift staff"
              value={total}
              sub={`${pct}% with rate cards`}
              className="px-3 py-2"
            />
            <StatCard
              icon={CheckCircle2}
              tone="success"
              label="Rate cards saved"
              value={covered}
              className="px-3 py-2"
            />
            <StatCard
              icon={AlertCircle}
              tone={missing.length > 0 ? 'warning' : 'default'}
              label="Unmatched"
              value={missing.length}
              sub={missing.length ? 'Need rates or aliases' : 'All matched'}
              className="px-3 py-2"
            />
          </div>

          {total > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {missing.length === 0 ? (
            <div className="muted-strip flex items-center gap-2 text-2sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              Every staff member with shifts has a matching rate card
              {locationId ? ' at this location' : ''}.
            </div>
          ) : (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Unmatched staff</span>
                  <Badge variant="warning">{missing.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter names…"
                    className="filter-control h-8 w-44 pl-7"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {filteredMissing.length === 0 ? (
                  <p className="px-4 py-6 text-center text-2sm text-muted-foreground">
                    No names match your filter.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff name (from shifts)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMissing.map((name) => (
                        <TableRow key={name}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            <Badge variant="warning" className="uppercase">
                              No rate card
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
