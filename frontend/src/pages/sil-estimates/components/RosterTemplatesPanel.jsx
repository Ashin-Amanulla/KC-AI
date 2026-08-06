import { Plus, Upload, Copy, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { cn } from '../../../lib/utils';

export function RosterTemplatesPanel({
  templates,
  activeTemplateId,
  onSetActive,
  onRename,
  onAdd,
  onDuplicate,
  onDelete,
  onFileUpload,
  canManage,
}) {
  const templateList = Object.values(templates || {});

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold">Roster templates</CardTitle>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" asChild>
              <label className="cursor-pointer">
                <Upload className="size-3.5" />
                Upload schedule
                <input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={onFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
            <Button size="sm" variant="outline" onClick={onAdd}>
              <Plus className="size-3.5" />
              New template
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {templateList.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border py-1 pl-2 pr-1',
                t.id === activeTemplateId ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <input
                value={t.name}
                onFocus={() => onSetActive(t.id)}
                onChange={(e) => onRename(t.id, e.target.value)}
                className={cn(
                  'w-28 bg-transparent text-xs font-semibold outline-none',
                  t.id === activeTemplateId ? 'text-primary' : 'text-muted-foreground'
                )}
                disabled={!canManage}
              />
              {canManage && (
                <>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => onDuplicate(t.id)}>
                    <Copy className="size-3.5" />
                  </Button>
                  {templateList.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
