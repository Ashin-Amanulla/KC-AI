import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';
import { PERMISSIONS, hasPermission } from '../../config/permissions';
import { useAwardRateSets, useUpdateAwardRateSet } from '../../api/ruleEngine';

const CONSTANT_LABELS = [
  ['brokenShiftAllowance1', 'Broken shift — 1 break', '$'],
  ['brokenShiftAllowance2', 'Broken shift — 2 breaks', '$'],
  ['mealAllowance', 'Meal allowance', '$'],
  ['vehicleKmRate', 'Vehicle rate / km', '$'],
  ['sleepoverDefault', 'Sleepover (default)', '$'],
  ['standardRateWeekly', 'Standard rate (weekly)', '$'],
  ['casualLoading', 'Casual loading', '×'],
  ['eveningMult', 'Evening (after 8pm)', '×'],
  ['nightMult', 'Night', '×'],
  ['satMult', 'Saturday', '×'],
  ['sunMult', 'Sunday', '×'],
  ['phMult', 'Public holiday', '×'],
  ['otTier1Mult', 'OT tier 1 (first 2h)', '×'],
  ['otTier2Mult', 'OT tier 2', '×'],
];

const STATUS_CLS = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  draft: 'bg-muted text-muted-foreground',
  'needs-verification': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

function RateSetCard({ set, canManage, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const startEdit = () => {
    setDraft({ ...set.constants });
    setEditing(true);
  };

  const save = () => {
    const constants = {};
    for (const [key, value] of Object.entries(draft)) {
      const num = Number(value);
      if (Number.isFinite(num)) constants[key] = num;
    }
    onSave(set._id, { constants, status: 'active' });
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{set.label}</CardTitle>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CLS[set.status])}>
            {set.status}
          </span>
          <span className="text-xs text-muted-foreground">
            effective {new Date(set.effectiveFrom).toLocaleDateString()}
            {set.effectiveTo ? ` → ${new Date(set.effectiveTo).toLocaleDateString()}` : ' → ongoing'}
          </span>
        </div>
        {canManage && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            Edit & verify
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              Save as active
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {set.status === 'needs-verification' && (
          <p className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Placeholder values copied from the previous financial year. Confirm each amount against
            the FWC determination / current SCHADS pay guide, then save as active.
            {set.source ? ` Source: ${set.source}` : ''}
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {CONSTANT_LABELS.map(([key, label, unit]) => (
            <div key={key} className="flex items-center justify-between gap-2 border-b border-border/40 py-1">
              <span className="truncate text-muted-foreground" title={label}>{label}</span>
              {editing ? (
                <input
                  type="number"
                  step="0.01"
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="w-20 rounded border border-input bg-background px-1.5 py-0.5 text-right font-mono text-xs"
                />
              ) : (
                <span className="font-mono tabular-nums">
                  {unit === '$' ? `$${Number(set.constants?.[key] ?? 0).toFixed(2)}` : `${set.constants?.[key] ?? '—'}×`}
                </span>
              )}
            </div>
          ))}
        </div>
        {set.notes && <p className="mt-3 text-xs text-muted-foreground">{set.notes}</p>}
      </CardContent>
    </Card>
  );
}

export function AwardRatesPage() {
  const { data, isLoading, error } = useAwardRateSets();
  const updateSet = useUpdateAwardRateSet();
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user?.permissions ?? [], PERMISSIONS.RULE_ENGINE_MANAGE);

  const handleSave = (id, update) => {
    updateSet.mutate(
      { id, update },
      {
        onSuccess: () => toast.success('Award rate set updated.'),
        onError: (err) => toast.error(err?.response?.data?.error || 'Failed to update rate set.'),
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-sm text-destructive">Failed to load award rate sets.</p>;

  const sets = data?.sets ?? [];

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        SCHADS allowances and multipliers are effective-dated per financial year (FWC indexes the
        dollar amounts every 1 July). Pay runs are stamped with the set that applied at their period
        start, so recomputing an old fortnight reproduces the old dollars.
        {sets.length === 0 && ' No sets exist yet — run `npm run seed:award-rates` in backend/.'}
      </p>
      {sets.map((set) => (
        <RateSetCard
          key={set._id}
          set={set}
          canManage={canManage}
          onSave={handleSave}
          saving={updateSet.isPending}
        />
      ))}
    </div>
  );
}
