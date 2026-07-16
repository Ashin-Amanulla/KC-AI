import {
  ArrowRight,
  Briefcase,
  Calculator,
  CircleDollarSign,
  Equal,
  Layers,
  MapPin,
  Moon,
  Sun,
  Tags,
  User,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogTitle } from '../../ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../lib/utils';
import { RichDescription } from './rulesReferenceUtils';

const STATUS_META = {
  implemented: { label: 'Implemented', variant: 'success' },
  'needs-verification': { label: 'Needs verification', variant: 'warning' },
  flagged: { label: 'Flag only', variant: 'primary' },
  'not-implemented': { label: 'Not implemented', variant: 'default' },
};

const BAR_COLORS = {
  daytime: 'bg-sky-500',
  evening: 'bg-amber-500',
  night: 'bg-indigo-500',
  saturday: 'bg-orange-500',
  sunday: 'bg-rose-500',
  holiday: 'bg-violet-500',
  ot1: 'bg-warning',
  ot2: 'bg-destructive/80',
  unpaid: 'bg-muted-foreground/25',
  allowance: 'bg-success/70',
};

const FLOW_STEPS = [
  { key: 'classify', icon: Tags, label: 'Classify' },
  { key: 'bucket', icon: Layers, label: 'Bucket' },
  { key: 'multiply', icon: Calculator, label: '× Rate' },
  { key: 'total', icon: CircleDollarSign, label: 'Gross' },
];

const STEP_ICONS = {
  muted: Sun,
  warning: Moon,
  primary: ArrowRight,
  success: CircleDollarSign,
};

/** Rich tooltip for truncated compact UI — hover any clipped text to read full content. */
function HoverTip({ content, children, className, side = 'top', asChild = false }) {
  if (!content) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>
        {asChild ? (
          children
        ) : (
          <span className={cn('cursor-help', className)} tabIndex={0}>
            {children}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="z-[250] max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2 text-left text-2xs leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function fmtMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function ShiftBar({ segments }) {
  if (!segments?.length) return null;
  const totalH = segments.reduce((s, seg) => s + (seg.fixed ? 0.5 : seg.hours || 1), 0) || 1;

  return (
    <div className="space-y-1.5">
      <div className="flex h-5 overflow-hidden rounded-md border border-border/50">
        {segments.map((seg, i) => {
          const w = seg.fixed ? 12 : ((seg.hours || 1) / totalH) * 100;
          const tip = seg.fixed
            ? `${seg.label}: ${fmtMoney(seg.amount)} (flat allowance)`
            : `${seg.label}: ${seg.hours}h`;
          return (
            <HoverTip key={i} content={tip} asChild>
              <div
                className={cn(
                  'relative min-w-[8px] cursor-help transition-all',
                  BAR_COLORS[seg.color] ?? BAR_COLORS.daytime
                )}
                style={{ width: `${Math.max(w, 8)}%` }}
                role="img"
                aria-label={tip}
              />
            </HoverTip>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg, i) => {
          const tip = seg.fixed
            ? `${seg.label} — flat ${fmtMoney(seg.amount)}`
            : `${seg.label} — ${seg.hours} active hours`;
          return (
            <HoverTip key={i} content={tip}>
              <span className="inline-flex max-w-[140px] items-center gap-1 text-2xs text-muted-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-sm', BAR_COLORS[seg.color] ?? BAR_COLORS.daytime)} />
                <span className="truncate">{seg.label}</span>
                {seg.fixed ? (
                  <span className="shrink-0 font-mono text-foreground/70">{fmtMoney(seg.amount)}</span>
                ) : (
                  <span className="shrink-0 font-mono text-foreground/70">{seg.hours}h</span>
                )}
              </span>
            </HoverTip>
          );
        })}
      </div>
    </div>
  );
}

function PayFlow() {
  return (
    <div className="flex items-center justify-between gap-0.5 rounded-md border border-border/50 bg-muted/15 px-2 py-2">
      {FLOW_STEPS.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex min-w-0 flex-1 items-center gap-0.5">
            <HoverTip content={`Pay step: ${step.label}`}>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-3 w-3" />
                </span>
                <span className="text-2xs text-muted-foreground">{step.label}</span>
              </div>
            </HoverTip>
            {i < FLOW_STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompactTimeline({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="grid gap-1.5 sm:grid-cols-3">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.accent ?? 'muted'] ?? Sun;
        const fullTip = (
          <span className="block space-y-1">
            <span className="block font-semibold text-foreground">{step.label}</span>
            <span className="block font-mono text-muted-foreground">{step.time}</span>
            <span className="block">{step.detail}</span>
          </span>
        );
        return (
          <HoverTip key={i} content={fullTip} side="bottom" asChild>
            <div
              className={cn(
                'cursor-help rounded-md border px-2 py-1.5 transition-colors hover:ring-1 hover:ring-primary/20',
                step.accent === 'primary' && 'border-primary/25 bg-primary/5',
                step.accent === 'warning' && 'border-warning/25 bg-warning/5',
                step.accent === 'success' && 'border-success/25 bg-success/5',
                (!step.accent || step.accent === 'muted') && 'border-border/50 bg-muted/10'
              )}
            >
              <div className="flex items-center gap-1">
                <Icon className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate text-2xs font-semibold">{step.label}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-muted-foreground">{step.detail}</p>
              <span className="font-mono text-2xs text-muted-foreground/70">{step.time}</span>
            </div>
          </HoverTip>
        );
      })}
    </div>
  );
}

function PayLedger({ payCalc }) {
  if (!payCalc?.lines?.length) {
    return (
      <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-2xs text-muted-foreground">
        No automated pay line — handled manually outside the engine.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/50 text-2xs">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-border/50 bg-muted/30 px-2 py-1 font-medium text-muted-foreground">
        <span>Bucket</span>
        <span className="text-right">Calc</span>
        <span className="w-14 text-right">$</span>
      </div>
      {payCalc.lines.map((line, i) => {
        const calcStr = line.fixed ? 'flat fee' : `${line.hours}h × ${line.mult} × $${line.rate}/hr`;
        const tip = `${line.bucket}\n${calcStr}\n= ${fmtMoney(line.amount)}`;
        return (
          <HoverTip key={i} content={tip} side="left" asChild>
            <div className="grid cursor-help grid-cols-[1fr_auto_auto] gap-x-2 border-b border-border/40 px-2 py-1 last:border-0 hover:bg-muted/20">
              <span className="flex min-w-0 items-center gap-1">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', BAR_COLORS[line.color] ?? BAR_COLORS.daytime)} />
                <span className="truncate">{line.bucket}</span>
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {line.fixed ? 'flat' : `${line.hours}h×${line.mult}×$${line.rate}`}
              </span>
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">{fmtMoney(line.amount)}</span>
            </div>
          </HoverTip>
        );
      })}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 bg-primary/5 px-2 py-1.5 font-semibold">
        <span className="col-span-2 flex items-center gap-1">
          <Equal className="h-3 w-3 text-primary" />
          Gross (example)
        </span>
        <span className="w-14 text-right font-mono tabular-nums text-primary">{fmtMoney(payCalc.total)}</span>
      </div>
    </div>
  );
}

export function RuleScenarioModal({ rule, open, onOpenChange }) {
  if (!rule?.scenario) return null;

  const { scenario } = rule;
  const statusMeta = STATUS_META[rule.status] ?? STATUS_META.implemented;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TooltipProvider delayDuration={200}>
        <DialogContent className="max-h-[88vh] max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:top-3 [&>button]:right-3">
          <div className="border-b border-border/60 px-4 py-3 pr-10">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-2xs font-medium text-muted-foreground">{rule.id}</span>
                <Badge variant={statusMeta.variant} className="px-1.5 py-0 text-2xs">
                  {statusMeta.label}
                </Badge>
              </div>
              <DialogTitle className="text-sm leading-snug">{rule.title}</DialogTitle>
              <HoverTip content={<RichDescription text={rule.description} />}>
                <p className="line-clamp-2 text-2xs leading-snug text-muted-foreground">
                  <RichDescription text={rule.description} />
                </p>
              </HoverTip>
            </div>
          </div>

          <div className="max-h-[calc(88vh-5rem)] space-y-3 overflow-y-auto px-4 py-3">
            <div>
              <p className="mb-1.5 text-2xs font-semibold text-primary">{scenario.title}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <HoverTip content={`${scenario.worker.name} · ${scenario.worker.role}${scenario.worker.employment ? ` · ${scenario.worker.employment}` : ''}`}>
                  <span className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-2xs">
                    <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{scenario.worker.name}</span>
                  </span>
                </HoverTip>
                <HoverTip content={`${scenario.participant.name} — ${scenario.participant.detail}`}>
                  <span className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-2xs">
                    <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{scenario.participant.name}</span>
                  </span>
                </HoverTip>
                <HoverTip content={scenario.setting}>
                  <span className="inline-flex max-w-[200px] items-center gap-1 truncate text-2xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{scenario.setting}</span>
                  </span>
                </HoverTip>
              </div>
            </div>

            {scenario.visual?.shiftBar?.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hour buckets
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">
                    · hover segments
                  </span>
                </p>
                <ShiftBar segments={scenario.visual.shiftBar} />
              </div>
            )}

            <div>
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Scenario steps
                <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">
                  · hover cards for full detail
                </span>
              </p>
              <CompactTimeline steps={scenario.timeline} />
            </div>

            <div>
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Pay pipeline
              </p>
              <PayFlow />
            </div>

            {scenario.payCalc && (
              <div className="space-y-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  How pay is calculated
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">
                    · hover rows
                  </span>
                </p>
                <HoverTip content={scenario.payCalc.formula}>
                  <p className="line-clamp-2 cursor-help rounded-md bg-muted/25 px-2 py-1.5 font-mono text-2xs text-foreground/80">
                    {scenario.payCalc.formula}
                  </p>
                </HoverTip>
                <ol className="space-y-0.5">
                  {scenario.payCalc.steps?.map((step, i) => {
                    const text = step.replace(/^\d+\.\s*/, '');
                    return (
                      <li key={i} className="flex gap-1.5 text-2xs leading-snug text-muted-foreground">
                        <span className="shrink-0 font-mono text-primary/70">{i + 1}.</span>
                        <HoverTip content={text}>
                          <span className="cursor-help">{text}</span>
                        </HoverTip>
                      </li>
                    );
                  })}
                </ol>
                <PayLedger payCalc={scenario.payCalc} />
                <p className="text-2xs text-muted-foreground/70">{scenario.payCalc.note}</p>
              </div>
            )}

            <HoverTip
              content={
                <span className="block space-y-1">
                  <span className="block">{scenario.outcome}</span>
                  {scenario.payNote && <span className="block text-muted-foreground">{scenario.payNote}</span>}
                </span>
              }
            >
              <div className="cursor-help rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="mb-0.5 text-2xs font-semibold text-primary">Engine outcome</p>
                <p className="line-clamp-3 text-2xs leading-snug text-foreground/90">{scenario.outcome}</p>
                {scenario.payNote && (
                  <p className="mt-1 line-clamp-2 text-2xs leading-snug text-muted-foreground">{scenario.payNote}</p>
                )}
              </div>
            </HoverTip>
          </div>
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
