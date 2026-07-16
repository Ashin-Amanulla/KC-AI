import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MapPin, Plus, Trash2, ChevronRight, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PageHeader } from '../components/PageHeader';
import { CardTitleHint } from '../components/InfoHint';
import { useLocations, useCreateLocation, useDeleteLocation } from '../api/locations';
import { getErrorMessage } from '../utils/api';
import { HolidayManager, PayHours } from './PayHours';
import { SchadsCalculator } from './SchadsCalculator';
import { CostAnalysis } from './CostAnalysis';
import { usePermissions } from '../hooks/usePermissions';

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
  const { canViewWorkforceCost } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const step = parseWorkforceStep(searchParams);
  const visibleSteps = useMemo(
    () => (canViewWorkforceCost ? STEPS : STEPS.filter((s) => s.id !== 'cost')),
    [canViewWorkforceCost]
  );
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
      toast.error(getErrorMessage(err) || 'Failed to create location');
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (!window.confirm(`Delete location "${name}"? This cannot be undone.`)) return;
    try {
      await deleteLocationMutation.mutateAsync(id);
      if (locationId === id) setLocationId('');
      toast.success('Location deleted');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete location');
    }
  };

  useEffect(() => {
    setHubStaffRatesMap(null);
  }, [locationId]);

  useEffect(() => {
    setPayHoursJobId(null);
  }, [locationId]);

  useEffect(() => {
    if (step === 'cost' && !canViewWorkforceCost) {
      setStep('calculator');
    }
  }, [step, canViewWorkforceCost, setStep]);

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
    <div className="page-stack-tight">
      <PageHeader
        title="Workforce"
        hint={
          canViewWorkforceCost
            ? 'Setup → award calculator → billing & cost. Pick a location before uploading shifts; use All locations only when data should span every site.'
            : 'Setup → award calculator. Pick a location before uploading shifts; use All locations only when data should span every site.'
        }
      />

      <Tabs value={step} onValueChange={setStep}>
        <TabsList>
          {visibleSteps.map((s, i) => (
            <TabsTrigger key={s.id} value={s.id} className="text-2sm py-1">
              <span className="hidden sm:inline">
                {i + 1}. {s.short}
              </span>
              <span className="sm:hidden">{i + 1}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {step !== 'setup' && (
          <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-2sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong className="text-foreground font-medium">{locationLabel}</strong>
              <button type="button" className="ml-2 text-primary underline text-2xs" onClick={() => setStep('setup')}>
                Change
              </button>
            </span>
          </div>
        )}

      <TabsContent value="setup" className="space-y-3 mt-3">
          {!locationId && (
            <p className="flex items-center gap-1.5 text-2xs text-warning" role="status">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Pick a location so shifts tag to the right site.
            </p>
          )}

          <div id="workforce-setup" className="grid gap-3 md:grid-cols-2 scroll-mt-4">
            <div id="workforce-location" className="rounded-lg border bg-card p-3 space-y-2.5">
              <CardTitleHint
                titleClassName="text-2sm"
                hint="Site used for shift uploads, pay hours, and public holidays."
              >
                Active site
              </CardTitleHint>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={locationId || 'all'} onValueChange={(v) => setLocationId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 min-w-[180px] w-auto text-2sm">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {loc.name} ({loc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-2sm" onClick={() => setShowNewLocation((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
                {locationId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(locationId, locations.find((l) => l._id === locationId)?.name)}
                    className="text-2xs text-destructive hover:underline"
                  >
                    <Trash2 className="h-3 w-3 inline mr-0.5" />
                    Delete
                  </button>
                )}
              </div>
              {showNewLocation && (
                <div className="flex flex-wrap items-end gap-2 border-t pt-2">
                  <Input
                    placeholder="Name"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    className="h-8 w-36 text-2sm"
                  />
                  <Input
                    placeholder="Code"
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value)}
                    className="h-8 w-28 text-2sm uppercase"
                  />
                  <Select value={newLocTz} onValueChange={setNewLocTz}>
                    <SelectTrigger className="h-8 w-32 text-2sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Australia/Brisbane">Brisbane</SelectItem>
                      <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                      <SelectItem value="Australia/Melbourne">Melbourne</SelectItem>
                      <SelectItem value="Australia/Perth">Perth</SelectItem>
                      <SelectItem value="Australia/Adelaide">Adelaide</SelectItem>
                      <SelectItem value="Australia/Darwin">Darwin</SelectItem>
                      <SelectItem value="Australia/Hobart">Hobart</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleCreateLocation}
                    disabled={createLocationMutation.isPending || !newLocName.trim() || !newLocCode.trim()}
                  >
                    {createLocationMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowNewLocation(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <HolidayManager locationId={locationId} locations={locations} compact />
          </div>

          <PayHours
            embedWorkforce
            locationId={locationId}
            setLocationId={setLocationId}
            payHoursJobId={payHoursJobId}
            setPayHoursJobId={setPayHoursJobId}
          />

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setStep('calculator')}>
              Next: Calculator
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
      </TabsContent>

      <TabsContent value="calculator" className="space-y-3 mt-3">
          <CardTitleHint
            hint={
              canViewWorkforceCost
                ? 'Upload per-staff rates; billing & cost reuses them. Same location as Setup.'
                : 'Upload per-staff rates workbook. Same location as Setup.'
            }
            titleClassName="text-2sm"
          >
            Award calculator &amp; rates
          </CardTitleHint>
          <SchadsCalculator locationId={locationId || undefined} onStaffRatesMapChange={setHubStaffRatesMap} />
          <div className={`flex gap-2 ${canViewWorkforceCost ? 'justify-between' : 'justify-start'}`}>
            <Button type="button" variant="outline" size="sm" onClick={() => setStep('setup')}>
              Back
            </Button>
            {canViewWorkforceCost && (
              <Button type="button" size="sm" onClick={() => setStep('cost')}>
                Next: Cost <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
      </TabsContent>

      {canViewWorkforceCost && (
        <TabsContent value="cost" className="space-y-3 mt-3">
          <CostAnalysis embedded locationId={locationId || undefined} hubStaffRatesMap={hubStaffRatesMap} />
          <div className="flex justify-start">
            <Button type="button" variant="outline" size="sm" onClick={() => setStep('calculator')}>
              Back
            </Button>
          </div>
        </TabsContent>
      )}
      </Tabs>
    </div>
  );
}
