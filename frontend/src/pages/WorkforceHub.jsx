import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Plus, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useLocations, useCreateLocation, useDeleteLocation } from '../api/locations';
import { HolidayManager, PayHours } from './PayHours';
import { Shifts } from './Shifts';
import { SchadsCalculator } from './SchadsCalculator';
import { CostAnalysis } from './CostAnalysis';

const STEPS = [
  { id: '1', title: 'Location & holidays', short: 'Location' },
  { id: '2', title: 'Shifts roster', short: 'Shifts' },
  { id: '3', title: 'Pay hours', short: 'Pay hours' },
  { id: '4', title: 'Award calculator', short: 'Calculator' },
  { id: '5', title: 'Billing & cost', short: 'Cost' },
];

export function WorkforceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const step = searchParams.get('step') || '1';
  const setStep = useCallback((id) => {
    setSearchParams(id === '1' ? {} : { step: id }, { replace: true });
  }, [setSearchParams]);

  const [locationId, setLocationId] = useState('');
  const [hubStaffRatesMap, setHubStaffRatesMap] = useState(null);

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
          Roster, SCHADS pay hours, award rates, and billing cost in one place.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-lg bg-muted/50 border">
        {STEPS.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={step === s.id ? 'default' : 'ghost'}
            className="flex-1 min-w-[100px]"
            onClick={() => setStep(s.id)}
          >
            <span className="hidden sm:inline">{s.id}. {s.short}</span>
            <span className="sm:hidden">{s.id}</span>
          </Button>
        ))}
      </div>

      <div className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>
          Active location: <strong className="text-foreground">{locationLabel}</strong>
          {step !== '1' && (
            <button type="button" className="ml-2 text-primary underline text-xs" onClick={() => setStep('1')}>
              Change
            </button>
          )}
        </span>
      </div>

      {step === '1' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">1. Location &amp; public holidays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pick the site for uploads, pay-hour runs, and billing filters. Add public holidays before computing pay hours.
              </p>
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
          <div className="flex justify-end">
            <Button type="button" onClick={() => setStep('2')}>
              Next: Shifts <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === '2' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">2. Upload &amp; review shifts</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Uses the location selected in step 1 for tagged uploads. Export is available after data loads.
            </CardContent>
          </Card>
          <Shifts embedWorkforce locationId={locationId} setLocationId={setLocationId} />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep('1')}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep('3')}>
              Next: Pay hours <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === '3' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">3. Compute pay hours</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload the same ShiftCare CSV if needed, then run compute. Expand a staff row to see per-shift SCHADS buckets.
            </CardContent>
          </Card>
          <PayHours embedWorkforce locationId={locationId} setLocationId={setLocationId} />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep('2')}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep('4')}>
              Next: Calculator <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === '4' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">4. Award calculator &amp; rates</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload a per-staff rates workbook here; step 5 can reuse it for Staff revenue vs wages. Uses the same location filter as step 1.
            </CardContent>
          </Card>
          <SchadsCalculator locationId={locationId || undefined} onStaffRatesMapChange={setHubStaffRatesMap} />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep('3')}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep('5')}>
              Next: Cost analysis <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === '5' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">5. Billing &amp; cost analysis</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Upload billing export. Staff revenue vs wages defaults to <strong>award calculation</strong> (pay hours + rates + super %). Switch to payroll file if you need the export comparison.
            </CardContent>
          </Card>
          <CostAnalysis embedded locationId={locationId || undefined} hubStaffRatesMap={hubStaffRatesMap} />
          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => setStep('4')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
