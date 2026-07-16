import { useCrmDashboard } from '../../api/crm';
import { useCrmBdm } from './CrmBdmContext';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { StatCard } from '../../ui/stat-card';
import { LoadingScreen } from '../../ui/LoadingSpinner';

export function CrmDashboard() {
  const { bdmParams } = useCrmBdm();
  const { data, isLoading } = useCrmDashboard(bdmParams);

  if (isLoading) {
    return (
      <div className="py-6">
        <LoadingScreen message="Loading dashboard…" />
      </div>
    );
  }

  const km = data?.keyMetrics ?? {};
  const fu = data?.followUps ?? {};
  const act = data?.activitySummary ?? {};
  const rel = data?.relationshipStatus ?? {};

  return (
    <div className="page-stack-dense">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Support coordinators" value={km.totalSupportCoordinators ?? 0} className="px-3 py-2" />
        <StatCard label="Total leads" value={km.totalLeads ?? 0} className="px-3 py-2" />
        <StatCard label="Leads — new" value={km.leadsNew ?? 0} tone="primary" className="px-3 py-2" />
        <StatCard label="Leads — active" value={km.leadsActive ?? 0} tone="primary" className="px-3 py-2" />
        <StatCard label="Leads — converted" value={km.leadsConverted ?? 0} tone="success" className="px-3 py-2" />
        <StatCard label="Leads — lost" value={km.leadsLost ?? 0} tone="destructive" className="px-3 py-2" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0 border-b py-2.5">
            <span className="section-label">Follow-ups</span>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 py-2.5 text-2sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">SC overdue</span>
              <span className="font-medium tabular-nums">{fu.scFollowUpsOverdue ?? 0}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">SC due (7 days)</span>
              <span className="font-medium tabular-nums">{fu.scFollowUpsDue7Days ?? 0}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Activities overdue</span>
              <span className="font-medium tabular-nums">{fu.activitiesNextActionOverdue ?? 0}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Activities due (7 days)</span>
              <span className="font-medium tabular-nums">{fu.activitiesDue7Days ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 border-b py-2.5">
            <span className="section-label">Activity summary</span>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 py-2.5 text-2sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Last 7 days</span>
              <span className="font-medium tabular-nums">{act.activitiesLast7Days ?? 0}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Last 30 days</span>
              <span className="font-medium tabular-nums">{act.activitiesLast30Days ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-0 border-b py-2.5">
          <span className="section-label">SC relationship status</span>
        </CardHeader>
        <CardContent className="px-3 py-2.5">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(rel).map(([status, count]) => (
              <div key={status} className="flex justify-between rounded-md border border-border/60 px-2.5 py-1.5 text-2sm">
                <span className="text-muted-foreground">{status || 'Unset'}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
