import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  UserX,
  AlertTriangle,
  FileWarning,
  Moon,
  MessageSquare,
  Pill,
  Activity,
  Ban,
} from "lucide-react";
import {
  useStartAnalysis,
  useAnalysisJobStatus,
  useAnalysisJob,
  useCancelAnalysisJob,
} from "../api/analysisJobs";
import { useAnalysisJobStore } from "../store/analysisJob";
import { useDropzone } from "react-dropzone";
import { validateCsvFile, MAX_CSV_FILE_SIZE_BYTES, CSV_ACCEPT } from "../config/upload";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/api";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { cn } from "../lib/utils";

const CHART_2_BADGE = "bg-chart-2/15 text-chart-2";
const CHART_1_BADGE = "bg-chart-1/15 text-chart-1";
const CHART_5_BADGE = "bg-chart-5/15 text-chart-5";

const CATEGORIES = [
  { id: "all", label: "All", variant: "default" },
  {
    id: "early_leave",
    label: "Early Leave",
    variant: "destructive",
    icon: Clock,
  },
  {
    id: "overtime",
    label: "Overtime",
    variant: "primary",
    icon: Clock,
  },
  {
    id: "staff_change",
    label: "Staff Change",
    variant: "primary",
    icon: UserX,
  },
  {
    id: "has_expense",
    label: "Expense",
    variant: "warning",
    icon: DollarSign,
  },
  {
    id: "reimbursement",
    label: "Reimbursement",
    variant: "chart-2",
    icon: DollarSign,
  },
  {
    id: "night_stay",
    label: "Night Stay",
    variant: "default",
    icon: Moon,
  },
  {
    id: "special_request",
    label: "Special Request",
    variant: "success",
    icon: MessageSquare,
  },
  {
    id: "incident",
    label: "Incident",
    variant: "warning",
    icon: AlertTriangle,
  },
  {
    id: "behaviour_alert",
    label: "Behaviour Alert",
    variant: "chart-5",
    icon: Activity,
  },
  {
    id: "medication_concern",
    label: "Medication Issue",
    variant: "chart-1",
    icon: Pill,
  },
  {
    id: "lazy_note",
    label: "Lazy Note",
    variant: "default",
    icon: FileWarning,
  },
];

const BADGE_VARIANT_CLASS = {
  "chart-2": CHART_2_BADGE,
  "chart-1": CHART_1_BADGE,
  "chart-5": CHART_5_BADGE,
};

const getBadgeProps = (variant) => {
  const className = BADGE_VARIANT_CLASS[variant];
  if (className) {
    return { variant: "default", className };
  }
  return { variant };
};

const formatEstimatedTime = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `~${seconds} sec remaining`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins} min remaining`;
};

const ExceptionPanel = ({ title, children, tone = "destructive" }) => {
  const tones = {
    destructive: "bg-destructive/10 border-destructive/20 text-destructive",
    primary: "bg-primary/10 border-primary/20 text-primary",
    success: "bg-success/15 border-success/20 text-success",
    warning: "bg-warning/15 border-warning/20 text-warning",
    muted: "bg-muted border text-foreground",
    "chart-1": "bg-chart-1/15 border-chart-1/20 text-chart-1",
    "chart-2": "bg-chart-2/15 border-chart-2/20 text-chart-2",
    "chart-5": "bg-chart-5/15 border-chart-5/20 text-chart-5",
  };

  return (
    <div className={cn("rounded-md border p-3 text-sm", tones[tone])}>
      <div className="font-semibold">{title}</div>
      {children}
    </div>
  );
};

export const ShiftAnalysis = () => {
  const [file, setFile] = useState(null);
  const [fileValidationError, setFileValidationError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState(null);

  const { activeJobId, setActiveJob, clearActiveJob } = useAnalysisJobStore();
  const startAnalysis = useStartAnalysis();
  const cancelJob = useCancelAnalysisJob();
  const { data: statusData, isLoading: statusLoading } =
    useAnalysisJobStatus(activeJobId);
  const { data: jobData } = useAnalysisJob(activeJobId, {
    enabled:
      statusData?.status === "completed" ||
      statusData?.status === "failed" ||
      statusData?.status === "cancelled",
  });

  const data = jobData?.results ?? null;
  const error =
    (startAnalysis.error && getErrorMessage(startAnalysis.error)) ||
    (statusData?.status === "failed"
      ? jobData?.error || "Analysis failed"
      : null);
  const isSubmitting = startAnalysis.isPending;
  const isProcessing =
    activeJobId &&
    statusData?.status !== "completed" &&
    statusData?.status !== "failed" &&
    statusData?.status !== "cancelled";

  const lastStatusRef = useRef(null);
  useEffect(() => {
    if (!statusData?.status || !activeJobId) return;
    if (lastStatusRef.current === statusData.status) return;
    lastStatusRef.current = statusData.status;
    if (statusData.status === "completed") {
      toast.success("Analysis complete", {
        description: `Processed ${statusData.totalRows} rows successfully.`,
      });
    } else if (statusData.status === "failed") {
      toast.error("Analysis failed", {
        description: jobData?.error || "An error occurred during processing.",
      });
    } else if (statusData.status === "cancelled") {
      clearActiveJob();
    }
  }, [statusData?.status, statusData?.totalRows, activeJobId, jobData?.error, clearActiveJob]);

  const onDrop = (acceptedFiles, rejectedFiles) => {
    setFileValidationError(null);
    if (rejectedFiles?.length > 0) {
      const err = rejectedFiles[0].errors?.[0];
      setFileValidationError(err?.message || "Invalid file");
      setFile(null);
      return;
    }
    if (acceptedFiles?.[0]) {
      const validation = validateCsvFile(acceptedFiles[0]);
      if (!validation.valid) {
        setFileValidationError(validation.error);
        setFile(null);
      } else {
        setFile(acceptedFiles[0]);
      }
    }
    startAnalysis.reset();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: CSV_ACCEPT,
    maxSize: MAX_CSV_FILE_SIZE_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled: isSubmitting || isProcessing,
  });

  const handleUpload = async () => {
    if (!file) return;
    const validation = validateCsvFile(file);
    if (!validation.valid) {
      setFileValidationError(validation.error);
      return;
    }
    setFileValidationError(null);
    startAnalysis.reset();
    clearActiveJob();

    try {
      const result = await startAnalysis.mutateAsync(file);
      setActiveJob(result.jobId, {
        estimatedSeconds: result.estimatedSeconds,
        totalRows: result.totalRows,
      });
      setFile(null);
      toast.success("Analysis started", {
        description: `${result.totalRows} rows queued for processing.`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Upload failed", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleUploadNew = () => {
    clearActiveJob();
    startAnalysis.reset();
    setFile(null);
  };

  const checkFilter = (row, filterId) => {
    const res = row.analysis_result || {};
    const exc = res.exceptions || {};

    switch (filterId) {
      case "all":
        return true;
      case "has_expense":
        return res.expenses && res.expenses.length > 0;
      case "reimbursement":
        return (
          res.reimbursement_claim_explicit ||
          (res.expenses && res.expenses.some((e) => e.is_reimbursement))
        );
      case "staff_change":
        return exc.staff_change?.occurred;
      case "overtime":
        return exc.overtime?.occurred;
      case "early_leave":
        return exc.early_leave?.occurred;
      case "night_stay":
        return exc.night_stay?.occurred;
      case "special_request":
        return exc.special_request?.occurred;
      case "incident":
        return exc.incident?.occurred;
      case "behaviour_alert":
        return exc.behaviour_alert?.occurred;
      case "medication_concern":
        return exc.medication_concern?.occurred;
      case "lazy_note":
        return res.lazy_note;
      default:
        return false;
    }
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((row) => checkFilter(row, activeFilter));
  }, [data, activeFilter]);

  const getBadges = (row) => {
    const badges = [];
    const res = row.analysis_result || {};
    const exc = res.exceptions || {};

    if (exc.early_leave?.occurred)
      badges.push({ label: "Early Leave", variant: "destructive" });
    if (exc.overtime?.occurred)
      badges.push({ label: "Overtime", variant: "primary" });
    if (exc.staff_change?.occurred)
      badges.push({ label: "Staff Change", variant: "primary" });
    if (exc.night_stay?.occurred)
      badges.push({ label: "Night Stay", variant: "default" });
    if (exc.special_request?.occurred)
      badges.push({ label: "Special Request", variant: "success" });
    if (exc.incident?.occurred)
      badges.push({ label: "Incident", variant: "warning" });
    if (exc.behaviour_alert?.occurred)
      badges.push({ label: "Behaviour Alert", variant: "chart-5" });
    if (exc.medication_concern?.occurred)
      badges.push({ label: "Medication Issue", variant: "chart-1" });
    if (res.expenses?.length > 0)
      badges.push({ label: "Expense", variant: "warning" });
    if (res.reimbursement_claim_explicit)
      badges.push({ label: "Reimbursement", variant: "chart-2" });
    if (res.lazy_note)
      badges.push({ label: "Lazy Note", variant: "default" });

    return badges;
  };

  const getSeverityVariant = (severity) => {
    if (severity === "high") return "destructive";
    if (severity === "medium") return "warning";
    return "default";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shift Report Analysis"
        hint="Upload a ShiftCare shift report CSV for AI categorization and exception detection."
      />

      {!data && !isProcessing && (
        <Card className="mb-8 max-w-xl mx-auto">
          <CardContent className="p-8 pt-8">
            <div
              {...getRootProps()}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border hover:bg-muted"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium text-foreground">
                Upload CSV
              </h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop your CSV file here..."
                  : "Drag and drop your ShiftCare export, or click to select"}
              </p>
              <Button type="button" size="sm">
                Select File
              </Button>

              {file && (
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </div>
              )}
              {fileValidationError && (
                <p className="mt-4 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {fileValidationError}
                </p>
              )}
              {error && !fileValidationError && (
                <p className="mt-4 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end px-8 pb-8 pt-0">
            <Button
              onClick={handleUpload}
              disabled={!file || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Starting..." : "Analyze"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {!data && isProcessing && (
        <Card className="mb-8 max-w-xl mx-auto">
          <CardContent className="flex flex-col items-center p-8 pt-8">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Analyzing your report
            </h3>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              You can navigate away and return anytime. Results will be ready
              when processing completes.
            </p>
            <div className="mb-4 w-full max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${statusData?.progress ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {statusData?.progress ?? 0}% complete
                {statusData?.processedRows != null &&
                  statusData?.totalRows != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({statusData.processedRows} / {statusData.totalRows} rows)
                    </span>
                  )}
              </p>
            </div>
            {formatEstimatedTime(statusData?.estimatedSeconds) && (
              <p className="text-sm text-muted-foreground">
                {formatEstimatedTime(statusData?.estimatedSeconds)}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (activeJobId) {
                  cancelJob.mutate(activeJobId, {
                    onSuccess: () => {
                      clearActiveJob();
                      toast.info("Analysis cancelled");
                    },
                    onError: () => {
                      toast.error("Failed to cancel");
                    },
                  });
                }
              }}
              disabled={cancelJob.isPending}
            >
              {cancelJob.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {cancelJob.isPending ? "Cancelling..." : "Cancel analysis"}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <div className="flex flex-wrap gap-2 border-b bg-muted/50 p-4">
            <div className="mr-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            {CATEGORIES.map((cat) => {
              const count = data.filter((r) => checkFilter(r, cat.id)).length;
              if (count === 0 && cat.id !== "all") return null;

              const isActive = activeFilter === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveFilter(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {cat.icon && <cat.icon className="h-3 w-3" />}
                  {cat.label}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-1.5 py-0.5 text-2xs",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleUploadNew}
              className="ml-auto"
            >
              Upload New File
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40 px-6">Client / Staff</TableHead>
                <TableHead className="w-32 px-6">Date</TableHead>
                <TableHead className="px-6">Exceptions / Flags</TableHead>
                <TableHead className="px-6">Shift Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row) => (
                <React.Fragment key={row._id}>
                  <TableRow
                    className={cn(
                      "cursor-pointer",
                      expandedRow === row._id && "bg-primary/5"
                    )}
                    onClick={() =>
                      setExpandedRow(expandedRow === row._id ? null : row._id)
                    }
                  >
                    <TableCell className="px-6 py-4 align-top">
                      <div className="font-medium text-foreground">
                        {row["Client"] || row["Customer"]}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row["Staff"] ||
                          row["Full Name"] ||
                          row["Summary"] ||
                          row.analysis_result?.staff_name}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 align-top">
                      <div className="text-muted-foreground">{row["Date"]}</div>
                    </TableCell>
                    <TableCell className="px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {getBadges(row).map((badge, i) => (
                          <Badge key={i} {...getBadgeProps(badge.variant)}>
                            {badge.label}
                          </Badge>
                        ))}
                        {getBadges(row).length === 0 && (
                          <span className="text-xs italic text-muted-foreground">
                            Normal
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 align-top">
                      <div className="line-clamp-2 text-foreground">
                        {row.analysis_result?.shift_summary || "No summary"}
                      </div>
                      {expandedRow === row._id && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                          Hide Details <ChevronUp className="h-3 w-3" />
                        </div>
                      )}
                      {expandedRow !== row._id && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:text-primary group-hover:opacity-100">
                          Show Details <ChevronDown className="h-3 w-3" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedRow === row._id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={4} className="border-b px-6 py-4">
                        <Card className="shadow-sm">
                          <CardContent className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2">
                            <div>
                              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                Exception Analysis
                              </h4>

                              <div className="space-y-4">
                                {row.analysis_result?.exceptions?.early_leave
                                  ?.occurred && (
                                  <ExceptionPanel title="Early Leave Detected" tone="destructive">
                                    {row.analysis_result.exceptions.early_leave
                                      .duration && (
                                      <div className="mt-1 font-mono text-xs">
                                        Duration:{" "}
                                        {
                                          row.analysis_result.exceptions
                                            .early_leave.duration
                                        }
                                      </div>
                                    )}
                                    <div className="mt-1">
                                      Reason: "
                                      {row.analysis_result.exceptions.early_leave
                                        .reason || "Not specified"}
                                      "
                                    </div>
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.overtime
                                  ?.occurred && (
                                  <ExceptionPanel title="Overtime Detected" tone="primary">
                                    <div className="mt-1">
                                      Duration:{" "}
                                      {row.analysis_result.exceptions.overtime
                                        .duration || "Unknown"}
                                    </div>
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.staff_change
                                  ?.occurred && (
                                  <ExceptionPanel
                                    title="Staff Change/Handover"
                                    tone="primary"
                                  >
                                    <div className="mt-1">
                                      Reason: "
                                      {row.analysis_result.exceptions.staff_change
                                        .reason || "Not specified"}
                                      "
                                    </div>
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.night_stay
                                  ?.occurred && (
                                  <ExceptionPanel
                                    title="Night Stay / Sleepover Shift"
                                    tone="muted"
                                  >
                                    {row.analysis_result.exceptions.night_stay
                                      .duration && (
                                      <div className="mt-1">
                                        Duration:{" "}
                                        {
                                          row.analysis_result.exceptions
                                            .night_stay.duration
                                        }
                                      </div>
                                    )}
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.special_request
                                  ?.occurred && (
                                  <ExceptionPanel title="Special Request" tone="success">
                                    <div className="mt-1">
                                      "
                                      {row.analysis_result.exceptions
                                        .special_request.description ||
                                        "Not specified"}
                                      "
                                    </div>
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.incident
                                  ?.occurred && (
                                  <ExceptionPanel
                                    title={
                                      <span className="flex items-center gap-2">
                                        Incident Detected
                                        {row.analysis_result.exceptions.incident
                                          .severity && (
                                          <Badge
                                            variant={getSeverityVariant(
                                              row.analysis_result.exceptions
                                                .incident.severity
                                            )}
                                          >
                                            {row.analysis_result.exceptions.incident.severity.toUpperCase()}
                                          </Badge>
                                        )}
                                      </span>
                                    }
                                    tone="warning"
                                  >
                                    {row.analysis_result.exceptions.incident
                                      .description && (
                                      <div className="mt-1">
                                        "
                                        {
                                          row.analysis_result.exceptions.incident
                                            .description
                                        }
                                        "
                                      </div>
                                    )}
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions?.behaviour_alert
                                  ?.occurred && (
                                  <ExceptionPanel title="Behaviour Alert" tone="chart-5">
                                    {row.analysis_result.exceptions.behaviour_alert
                                      .description && (
                                      <div className="mt-1">
                                        "
                                        {
                                          row.analysis_result.exceptions
                                            .behaviour_alert.description
                                        }
                                        "
                                      </div>
                                    )}
                                  </ExceptionPanel>
                                )}
                                {row.analysis_result?.exceptions
                                  ?.medication_concern?.occurred && (
                                  <ExceptionPanel
                                    title="Medication Concern"
                                    tone="chart-1"
                                  >
                                    {row.analysis_result.exceptions
                                      .medication_concern.description && (
                                      <div className="mt-1">
                                        "
                                        {
                                          row.analysis_result.exceptions
                                            .medication_concern.description
                                        }
                                        "
                                      </div>
                                    )}
                                  </ExceptionPanel>
                                )}

                                {(row.analysis_result?.expenses?.length > 0 ||
                                  row.analysis_result
                                    ?.reimbursement_claim_explicit) && (
                                  <ExceptionPanel
                                    title="Expenses & Claims"
                                    tone="warning"
                                  >
                                    {row.analysis_result.expenses.map(
                                      (exp, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between border-b border-warning/20 py-1 last:border-0"
                                        >
                                          <span>{exp.type}</span>
                                          <span className="font-medium">
                                            {exp.amount} {exp.currency}
                                          </span>
                                        </div>
                                      )
                                    )}
                                    {row.analysis_result
                                      ?.reimbursement_claim_explicit && (
                                      <Badge
                                        className={cn("mt-2", CHART_2_BADGE)}
                                      >
                                        Reimbursement Requested
                                      </Badge>
                                    )}
                                  </ExceptionPanel>
                                )}

                                {!row.analysis_result?.exceptions?.early_leave
                                  ?.occurred &&
                                  !row.analysis_result?.exceptions?.overtime
                                    ?.occurred &&
                                  !row.analysis_result?.exceptions?.staff_change
                                    ?.occurred &&
                                  !row.analysis_result?.exceptions?.night_stay
                                    ?.occurred &&
                                  !row.analysis_result?.exceptions
                                    ?.special_request?.occurred &&
                                  !row.analysis_result?.exceptions?.incident
                                    ?.occurred &&
                                  !row.analysis_result?.exceptions
                                    ?.behaviour_alert?.occurred &&
                                  !row.analysis_result?.exceptions
                                    ?.medication_concern?.occurred &&
                                  !row.analysis_result?.expenses?.length && (
                                    <div className="text-sm italic text-muted-foreground">
                                      No exceptions or expenses detected.
                                    </div>
                                  )}
                              </div>
                            </div>

                            <div>
                              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                Original Shift Notes
                              </h4>
                              <div className="whitespace-pre-wrap rounded border bg-muted p-4 text-sm leading-relaxed text-foreground">
                                {row["Detailed report"] ||
                                  row["Message"] ||
                                  row["Notes"]}
                              </div>
                              {row.analysis_result?.lazy_note && (
                                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-warning">
                                  <AlertCircle className="h-3 w-3" /> Flagged as
                                  lazy/low-effort note
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {filteredData.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              No records found for this category.
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
