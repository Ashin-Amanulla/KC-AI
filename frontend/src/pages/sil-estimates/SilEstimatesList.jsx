import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/PageHeader';
import { QueryErrorState } from '../../components/QueryErrorState';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  useSilEstimates,
  useCreateSilEstimate,
  useDeleteSilEstimate,
  useDuplicateSilEstimate,
} from '../../api/silEstimates';
import { createEmptyWorkspace } from '../../lib/silEstimate/defaults';
import { fmtMoney, fmtDMY } from '../../lib/silEstimate/formatters';
import { getErrorMessage } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';

export function SilEstimatesList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.ESTIMATES_MANAGE);
  const { data, isLoading, error, refetch } = useSilEstimates();
  const createM = useCreateSilEstimate();
  const deleteM = useDeleteSilEstimate();
  const duplicateM = useDuplicateSilEstimate();

  const estimates = data?.estimates ?? [];

  const handleCreate = async () => {
    try {
      const body = createEmptyWorkspace();
      const res = await createM.mutateAsync(body);
      navigate(`/sil-estimates/${res.estimate._id}`);
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Failed to create estimate');
    }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteM.mutateAsync(id);
      toast.success('Estimate deleted');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete');
    }
  };

  const handleDuplicate = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await duplicateM.mutateAsync(id);
      toast.success('Estimate duplicated');
      navigate(`/sil-estimates/${res.estimate._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to duplicate');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <QueryErrorState error={error} onRetry={refetch} />;

  return (
    <div className="page-stack-tight">
      <PageHeader
        title="SIL Estimates"
        description="NDIS Supported Independent Living cost estimates with weekly rosters and plan-period pricing."
        hint="Build roster templates, set plan dates and budgets, and calculate exact SIL costs day-by-day including public holidays."
      >
        {canManage && (
          <Button onClick={handleCreate} disabled={createM.isPending}>
            <Plus className="size-4" />
            New estimate
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {estimates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">No SIL estimates yet.</p>
              {canManage && (
                <Button onClick={handleCreate} disabled={createM.isPending}>
                  <Plus className="size-4" />
                  Create your first estimate
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Plan period</TableHead>
                  <TableHead className="text-right">Period total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  {canManage && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((row) => {
                  const overBudget = row.variance < 0;
                  const periodLabel =
                    row.planStart && row.planEnd
                      ? `${fmtDMY(row.planStart)} – ${fmtDMY(row.planEnd)}`
                      : '—';
                  return (
                    <TableRow
                      key={row._id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/sil-estimates/${row._id}`)}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.participantCount}</TableCell>
                      <TableCell className="text-2sm text-muted-foreground">{periodLabel}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtMoney(row.periodTotal)}</TableCell>
                      <TableCell>
                        {row.variance !== 0 && row.periodTotal > 0 ? (
                          <Badge variant={overBudget ? 'destructive' : 'secondary'}>
                            {overBudget ? 'Over budget' : 'Under budget'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-2sm text-muted-foreground">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-AU') : '—'}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(e) => handleDuplicate(e, row._id)}
                              title="Duplicate"
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={(e) => handleDelete(e, row._id, row.name)}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
