import { useCrmDashboard } from '../../api/crm';
import { useCrmBdm } from './CrmBdmContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

function MetricCard({ label, value }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value ?? 0}</p>
      </CardContent>
    </Card>
  );
}

export function CrmDashboard() {
  const { bdmParams } = useCrmBdm();
  const { data, isLoading } = useCrmDashboard(bdmParams);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  const km = data?.keyMetrics ?? {};
  const fu = data?.followUps ?? {};
  const act = data?.activitySummary ?? {};
  const rel = data?.relationshipStatus ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-lg font-semibold">Key Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Support Coordinators" value={km.totalSupportCoordinators} />
          <MetricCard label="Total Leads" value={km.totalLeads} />
          <MetricCard label="Leads — New" value={km.leadsNew} />
          <MetricCard label="Leads — Active" value={km.leadsActive} />
          <MetricCard label="Leads — Converted" value={km.leadsConverted} />
          <MetricCard label="Leads — Lost" value={km.leadsLost} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>SC follow-ups overdue</span>
              <span className="font-medium">{fu.scFollowUpsOverdue ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>SC follow-ups due (7 days)</span>
              <span className="font-medium">{fu.scFollowUpsDue7Days ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Activities next action overdue</span>
              <span className="font-medium">{fu.activitiesNextActionOverdue ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Activities due (7 days)</span>
              <span className="font-medium">{fu.activitiesDue7Days ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Activities (last 7 days)</span>
              <span className="font-medium">{act.activitiesLast7Days ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Activities (last 30 days)</span>
              <span className="font-medium">{act.activitiesLast30Days ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support Coordinator Relationship Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(rel).map(([status, count]) => (
              <div key={status} className="flex justify-between rounded-md border px-3 py-2 text-sm">
                <span>{status || 'Unset'}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
