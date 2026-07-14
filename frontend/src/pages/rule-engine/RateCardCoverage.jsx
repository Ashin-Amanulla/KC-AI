import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useRateCardCoverage } from '../../api/ruleEngine';
import { useLocations } from '../../api/locations';

export function RateCardCoverage() {
  const [locationId, setLocationId] = useState('');
  const { data: locationsData } = useLocations();
  const { data, isLoading, error } = useRateCardCoverage(locationId || null);

  const locations = locationsData?.locations ?? locationsData ?? [];
  const covered = data ? data.totalWithRateCards : 0;
  const total = data ? data.totalStaffWithShifts : 0;
  const pct = total ? Math.round((covered / total) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Staff who worked imported shifts but have <strong className="text-foreground">no SCHADS rate card</strong> fall
          back to default rates in cost analysis — a confirmed source of wrong pay figures. Fix by adding a
          rate row (or an alias for a different name spelling) on the Staff page.
        </p>
        {Array.isArray(locations) && locations.length > 0 && (
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <p className="text-sm text-destructive">Failed to load coverage.</p>}

      {data && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 py-4">
              <div>
                <div className="text-2xl font-bold tabular-nums">{pct}%</div>
                <div className="text-xs text-muted-foreground">rate-card coverage</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{covered}</div>
                <div className="text-xs text-muted-foreground">staff with rate cards</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-destructive">
                  {data.missingRateCard.length}
                </div>
                <div className="text-xs text-muted-foreground">missing / unmatched</div>
              </div>
              <div className="min-w-40 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {data.missingRateCard.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Staff without a matching rate card</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {data.missingRateCard.map((name) => (
                    <li key={name} className="rounded bg-destructive/5 px-2 py-1 text-destructive">
                      {name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
