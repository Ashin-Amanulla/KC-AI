import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MapPin, Plus, Trash2, ChevronRight, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useLocations, useCreateLocation, useDeleteLocation } from '../api/locations';
import { HolidayManager, PayHours } from './PayHours';
import { SchadsCalculator } from './SchadsCalculator';
import { CostAnalysis } from './CostAnalysis';

/** Canonical tabs; numeric ?step= values are legacy (1–5) and mapped on read. */
const STEP_IDS = ['setup', 'calculator', 'cost'];

const LEGACY_STEP = {
  '1': 'setup',
  '2': 'setup',
  '3': 'setup',
  '4': 'calculator',
  '5': 'cost',
};

function parseWorkforceStep(searchParams) {
  const s = searchParams.get('step');
  if (STEP_IDS.includes(s)) return s;
  if (s && LEGACY_STEP[s]) return LEGACY_STEP[s];
  return 'setup';
}

const STEPS = [
  { id: 'setup', title: 'Location, roster & pay hours', short: 'Setup' },
  { id: 'calculator', title: 'Award calculator', short: 'Calculator' },
  { id: 'cost', title: 'Billing & cost', short: 'Cost' },
];

export function WorkforceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const step = parseWorkforceStep(searchParams);
  const setStep = useCallback(
    (id) => {
      if (id === 'setup') setSearchParams({}, { replace: true });
      else setSearchParams({ step: id }, { replace: true });
    },
    [setSearchParams]
  );

  const [locationId, setLocationId] = useState('');
  const [hubStaffRatesMap, setHubStaffRatesMap] = useState(null);
  const [payHoursJobId, setPayHoursJobId] = useState(null);

  const { data: locationsData } = useLocations();
  const locations = locationsData?.locations || [];
  const createLocationMutation = useCreateLocation();
  const deleteLocationMutation = useDeleteLocation();
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocTz, setNewLocTz] = useState('Australia/Brisbane');

  const handleCreateLocation = async () => {
    if (!newLocName.trim() || !newLocCode.trim()) return;
    try {
      await createLocationMutation.mutateAsync({
        name: newLocName.trim(),
        code: newLocCode.trim().toUpperCase(),
        timezone: newLocTz,
      });
      toast.success(`Location "${newLocName.trim()}" created`);
      setNewLocName('');
      setNewLocCode('');
      setShowNewLocation(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create location');
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (!window.confirm(`Delete location "${name}"? This cannot be undone.`)) return;
    try {
      await deleteLocationMutation.mutateAsync(id);
      if (locationId === id) setLocationId('');
      toast.success('Location deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete location');
    }
  };

  useEffect(() => {
    setHubStaffRatesMap(null);
  }, [locationId]);

  useEffect(() => {
    setPayHoursJobId(null);
  }, [locationId]);

  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    if (!id || step !== 'setup') return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, step]);

  const locationLabel = useMemo(() => {
    const loc = locations.find((l) => l._id === locationId);
    if (!locationId) return 'All locations';
    return loc ? `${loc.name} (${loc.code})` : 'Location';
  }, [locationId, locations]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Workforce</h1>
        <p className="text-muted-foreground text-sm mt-1">
          One setup area for site, holidays, roster and pay hours — then calculator and cost.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-lg bg-muted/50 border">
        {STEPS.map((s, i) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={step === s.id ? 'default' : 'ghost'}
            className="flex-1 min-w-[100px]"
            onClick={() => setStep(s.id)}
          >
            <span className="hidden sm:inline">
              {i + 1}. {s.short}
            </span>
            <span className="sm:hidden">{i + 1}</span>
          </Button>
        ))}
      </div>

      {step !== 'setup' && (
        <div className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            Active location: <strong className="text-foreground">{locationLabel}</strong>
            <button type="button" className="ml-2 text-primary underline text-xs" onClick={() => setStep('setup')}>
              Change in Setup
            </button>
          </span>
        </div>
      )}

      {step === 'setup' && (
        <div className="space-y-6">
          {!locationId && (
            <div
              className="rounded-lg border border-amber-200/80 bg-amber-50/90 dark:bg-amber-950/25 dark:border-amber-800/50 px-4 py-3 text-sm text-amber-950 dark:text-amber-100/90"
              role="status"
            >
              <span className="font-medium">Tip:</span>{' '}
              Choose a <strong>location</strong> below so shifts and pay hours are tagged to the right site. Use{' '}
              <strong>All locations</strong> only if you intentionally want data shared across every site.
            </div>
          )}

          <Card id="workforce-setup" className="scroll-mt-6 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="text-xl">Workforce setup</CardTitle>
              <p className="text-sm text-muted-foreground font-normal leading-relaxed mt-2">
                Pick your <strong className="text-foreground font-medium">site</strong> and <strong className="text-foreground font-medium">public holidays</strong>, then use the{' '}
                <strong className="text-foreground font-medium">Shifts &amp; pay hours</strong> block: one upload, one staff table (expand rows for individual shifts).
              </p>
            </CardHeader>
            <CardContent className="space-y-10 pt-6">
              <div id="workforce-location" className="scroll-mt-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Site &amp; holidays</h3>
                <Card className="shadow-sm border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Active site</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Location</span>
                      <select
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
                      >
                        <option value="">All locations</option>
                        {locations.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => setShowNewLocation((v) => !v)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add location
                      </Button>
                      {locationId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(locationId, locations.find((l) => l._id === locationId)?.name)}
                          className="text-xs text-destructive hover:underline ml-auto"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                          Delete selected
                        </button>
                      )}
                    </div>
                    {showNewLocation && (
                      <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Name</label>
                          <Input
                            placeholder="e.g. Brisbane Office"
                            value={newLocName}
                            onChange={(e) => setNewLocName(e.target.value)}
                            className="h-8 w-44 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Code</label>
                          <Input
                            placeholder="e.g. BRISBANE"
                            value={newLocCode}
                            onChange={(e) => setNewLocCode(e.target.value)}
                            className="h-8 w-32 text-sm uppercase"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Timezone</label>
                          <select
                            value={newLocTz}
                            onChange={(e) => setNewLocTz(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="Australia/Brisbane">Brisbane</option>
                            <option value="Australia/Sydney">Sydney</option>
                            <option value="Australia/Melbourne">Melbourne</option>
                            <option value="Australia/Perth">Perth</option>
                            <option value="Australia/Adelaide">Adelaide</option>
                            <option value="Australia/Darwin">Darwin</option>
                            <option value="Australia/Hobart">Hobart</option>
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleCreateLocation}
                          disabled={createLocationMutation.isPending || !newLocName.trim() || !newLocCode.trim()}
                        >
                          {createLocationMutation.isPending ? 'Creating…' : 'Create'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowNewLocation(false)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <HolidayManager locationId={locationId} locations={locations} />
              </div>

              <div className="border-t pt-8 space-y-4">
                <PayHours
                  embedWorkforce
                  locationId={locationId}
                  setLocationId={setLocationId}
                  payHoursJobId={payHoursJobId}
                  setPayHoursJobId={setPayHoursJobId}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Done with pay hours? Continue to enter <strong className="text-foreground font-medium">award rates</strong> and then{' '}
              <strong className="text-foreground font-medium">billing &amp; cost</strong>.
            </p>
            <Button type="button" size="lg" className="shrink-0 gap-2" onClick={() => setStep('calculator')}>
              Next: Award calculator
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'calculator' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Award calculator &amp; rates</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload a per-staff rates workbook here; billing &amp; cost can reuse it for staff revenue vs wages. Uses the same location as Setup.
            </CardContent>
          </Card>
          <SchadsCalculator locationId={locationId || undefined} onStaffRatesMapChange={setHubStaffRatesMap} />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep('setup')}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep('cost')}>
              Next: Cost analysis <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 'cost' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Billing &amp; cost analysis</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload billing export. Staff revenue vs wages defaults to <strong>award calculation</strong> (pay hours + rates + super %). Switch to payroll file if you need the export comparison.
            </CardContent>
          </Card>
          <CostAnalysis embedded locationId={locationId || undefined} hubStaffRatesMap={hubStaffRatesMap} />
          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => setStep('calculator')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
