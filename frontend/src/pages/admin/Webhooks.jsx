import { useWebhookSubscriptions, useWebhookEventTypes } from '../../api/shiftcare';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

export function WebhooksPage() {
  const { data: subs, isLoading, isError, error, refetch } = useWebhookSubscriptions();
  const { data: eventTypes } = useWebhookEventTypes();

  const subscriptions = subs?.webhook_subscriptions ?? subs ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title="ShiftCare webhooks"
        hint="View webhook subscriptions and available event types. Configure subscriptions in ShiftCare or via API."
      />

      {isLoading ? (
        <LoadingScreen message="Loading webhooks…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load webhooks" onRetry={refetch} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {!subscriptions.length ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No webhook subscriptions configured</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((s) => (
                      <TableRow key={s.public_id}>
                        <TableCell className="max-w-xs truncate text-xs">{s.url}</TableCell>
                        <TableCell><Badge>{s.status}</Badge></TableCell>
                        <TableCell className="text-xs">{s.event_types ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available event types</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {!eventTypes?.length ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No event types returned</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Resource</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventTypes.slice(0, 30).map((et) => (
                      <TableRow key={et.name}>
                        <TableCell className="font-mono text-xs">{et.name}</TableCell>
                        <TableCell className="text-xs">{et.resource_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
