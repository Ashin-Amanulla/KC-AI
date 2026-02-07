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
} from "lucide-react";
import {
  useStartAnalysis,
  useAnalysisJobStatus,
  useAnalysisJob,
} from "../api/analysisJobs";
import { useAnalysisJobStore } from "../store/analysisJob";
import { useDropzone } from "react-dropzone";
import { validateCsvFile, MAX_CSV_FILE_SIZE_BYTES, CSV_ACCEPT } from "../config/upload";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/api";

const CATEGORIES = [
  { id: "all", label: "All", color: "bg-gray-100 text-gray-800" },
  {
    id: "early_leave",
    label: "Early Leave",
    color: "bg-red-100 text-red-800",
    icon: Clock,
  },
  {
    id: "overtime",
    label: "Overtime",
    color: "bg-indigo-100 text-indigo-800",
    icon: Clock,
  },
  {
    id: "staff_change",
    label: "Staff Change",
    color: "bg-blue-100 text-blue-800",
    icon: UserX,
  },
  {
    id: "has_expense",
    label: "Expense",
    color: "bg-yellow-100 text-yellow-800",
    icon: DollarSign,
  },
  {
    id: "reimbursement",
    label: "Reimbursement",
    color: "bg-purple-100 text-purple-800",
    icon: DollarSign,
  },
  {
    id: "night_stay",
    label: "Night Stay",
    color: "bg-slate-100 text-slate-800",
    icon: Moon,
  },
  {
    id: "special_request",
    label: "Special Request",
    color: "bg-green-100 text-green-800",
    icon: MessageSquare,
  },
  {
    id: "incident",
    label: "Incident",
    color: "bg-orange-100 text-orange-800",
    icon: AlertTriangle,
  },
  {
    id: "behaviour_alert",
    label: "Behaviour Alert",
    color: "bg-pink-100 text-pink-800",
    icon: Activity,
  },
  {
    id: "medication_concern",
    label: "Medication Issue",
    color: "bg-cyan-100 text-cyan-800",
    icon: Pill,
  },
  {
    id: "lazy_note",
    label: "Lazy Note",
    color: "bg-gray-200 text-gray-600",
    icon: FileWarning,
  },
];

const formatEstimatedTime = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `~${seconds} sec remaining`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins} min remaining`;
};

export const ShiftAnalysis = () => {
  const [file, setFile] = useState(null);
  const [fileValidationError, setFileValidationError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState(null);

  const { activeJobId, setActiveJob, clearActiveJob } = useAnalysisJobStore();
  const startAnalysis = useStartAnalysis();
  const { data: statusData, isLoading: statusLoading } =
    useAnalysisJobStatus(activeJobId);
  const { data: jobData } = useAnalysisJob(activeJobId, {
    enabled:
      statusData?.status === "completed" || statusData?.status === "failed",
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
    statusData?.status !== "failed";

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
    }
  }, [statusData?.status, statusData?.totalRows, activeJobId, jobData?.error]);

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
      badges.push({ label: "Early Leave", color: "bg-red-100 text-red-800" });
    if (exc.overtime?.occurred)
      badges.push({
        label: "Overtime",
        color: "bg-indigo-100 text-indigo-800",
      });
    if (exc.staff_change?.occurred)
      badges.push({
        label: "Staff Change",
        color: "bg-blue-100 text-blue-800",
      });
    if (exc.night_stay?.occurred)
      badges.push({
        label: "Night Stay",
        color: "bg-slate-100 text-slate-800",
      });
    if (exc.special_request?.occurred)
      badges.push({
        label: "Special Request",
        color: "bg-green-100 text-green-800",
      });
    if (exc.incident?.occurred)
      badges.push({
        label: "Incident",
        color: "bg-orange-100 text-orange-800",
      });
    if (exc.behaviour_alert?.occurred)
      badges.push({
        label: "Behaviour Alert",
        color: "bg-pink-100 text-pink-800",
      });
    if (exc.medication_concern?.occurred)
      badges.push({
        label: "Medication Issue",
        color: "bg-cyan-100 text-cyan-800",
      });
    if (res.expenses?.length > 0)
      badges.push({ label: "Expense", color: "bg-yellow-100 text-yellow-800" });
    if (res.reimbursement_claim_explicit)
      badges.push({
        label: "Reimbursement",
        color: "bg-purple-100 text-purple-800",
      });
    if (res.lazy_note)
      badges.push({ label: "Lazy Note", color: "bg-gray-200 text-gray-600" });

    return badges;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Shift Report Analysis
        </h1>
        <p className="text-gray-600">
          AI-powered categorization and exception detection.
        </p>
      </div>

      {!data && !isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8 max-w-xl mx-auto">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 transition-colors cursor-pointer ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload CSV
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              {isDragActive
                ? "Drop your CSV file here..."
                : "Drag and drop your ShiftCare export, or click to select"}
            </p>
            <span className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
              Select File
            </span>

            {file && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600 font-medium">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
            {fileValidationError && (
              <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {fileValidationError}
              </p>
            )}
            {error && !fileValidationError && (
              <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || isSubmitting}
              className={`px-6 py-2 rounded-md font-medium text-white transition-colors flex items-center gap-2 ${
                !file || isSubmitting
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Starting..." : "Analyze"}
            </button>
          </div>
        </div>
      )}

      {!data && isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8 max-w-xl mx-auto">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Analyzing your report
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              You can navigate away and return anytime. Results will be ready
              when processing completes.
            </p>
            <div className="w-full max-w-sm mb-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${statusData?.progress ?? 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                {statusData?.progress ?? 0}% complete
                {statusData?.processedRows != null &&
                  statusData?.totalRows != null && (
                    <span className="text-gray-500">
                      {" "}
                      ({statusData.processedRows} / {statusData.totalRows} rows)
                    </span>
                  )}
              </p>
            </div>
            {formatEstimatedTime(statusData?.estimatedSeconds) && (
              <p className="text-sm text-gray-500">
                {formatEstimatedTime(statusData?.estimatedSeconds)}
              </p>
            )}
          </div>
        </div>
      )}

      {data && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          {/* Filter Bar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-2">
            <div className="flex items-center gap-2 mr-4 text-gray-500 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            {CATEGORIES.map((cat) => {
              const count = data.filter((r) => checkFilter(r, cat.id)).length;
              if (count === 0 && cat.id !== "all") return null;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                    activeFilter === cat.id
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {cat.icon && <cat.icon className="h-3 w-3" />}
                  {cat.label}
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      activeFilter === cat.id
                        ? "bg-gray-700 text-gray-200"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <button
              onClick={handleUploadNew}
              className="ml-auto text-sm text-blue-600 hover:underline"
            >
              Upload New File
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-medium text-gray-500 border-b">
                <tr>
                  <th className="px-6 py-3 w-40">Client / Staff</th>
                  <th className="px-6 py-3 w-32">Date</th>
                  <th className="px-6 py-3">Exceptions / Flags</th>
                  <th className="px-6 py-3">Shift Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((row) => (
                  <React.Fragment key={row._id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        expandedRow === row._id ? "bg-blue-50/30" : ""
                      }`}
                      onClick={() =>
                        setExpandedRow(expandedRow === row._id ? null : row._id)
                      }
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900">
                          {row["Client"]}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">
                          {row["Staff"] ||
                            row["Full Name"] ||
                            row.analysis_result?.staff_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <div className="text-gray-600">{row["Date"]}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {getBadges(row).map((badge, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                          {getBadges(row).length === 0 && (
                            <span className="text-gray-400 text-xs italic">
                              Normal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-gray-700 line-clamp-2">
                          {row.analysis_result?.shift_summary || "No summary"}
                        </div>
                        {expandedRow === row._id && (
                          <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                            Hide Details <ChevronUp className="h-3 w-3" />
                          </div>
                        )}
                        {expandedRow !== row._id && (
                          <div className="mt-1 text-xs text-gray-400 group-hover:text-blue-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Show Details <ChevronDown className="h-3 w-3" />
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedRow === row._id && (
                      <tr className="bg-gray-50/50">
                        <td
                          colSpan={4}
                          className="px-6 py-4 border-b border-gray-100"
                        >
                          <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {/* Left Column: Analysis Details */}
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Exception Analysis
                                </h4>

                                <div className="space-y-4">
                                  {row.analysis_result?.exceptions?.early_leave
                                    ?.occurred && (
                                    <div className="bg-red-50 p-3 rounded-md border border-red-100 text-sm">
                                      <div className="font-semibold text-red-800">
                                        Early Leave Detected
                                      </div>
                                      {row.analysis_result.exceptions
                                        .early_leave.duration && (
                                        <div className="text-red-700 mt-1 text-xs font-mono">
                                          Duration:{" "}
                                          {
                                            row.analysis_result.exceptions
                                              .early_leave.duration
                                          }
                                        </div>
                                      )}
                                      <div className="text-red-700 mt-1">
                                        Reason: "
                                        {row.analysis_result.exceptions
                                          .early_leave.reason ||
                                          "Not specified"}
                                        "
                                      </div>
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions?.overtime
                                    ?.occurred && (
                                    <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100 text-sm">
                                      <div className="font-semibold text-indigo-800">
                                        Overtime Detected
                                      </div>
                                      <div className="text-indigo-700 mt-1">
                                        Duration:{" "}
                                        {row.analysis_result.exceptions.overtime
                                          .duration || "Unknown"}
                                      </div>
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions?.staff_change
                                    ?.occurred && (
                                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm">
                                      <div className="font-semibold text-blue-800">
                                        Staff Change/Handover
                                      </div>
                                      <div className="text-blue-700 mt-1">
                                        Reason: "
                                        {row.analysis_result.exceptions
                                          .staff_change.reason ||
                                          "Not specified"}
                                        "
                                      </div>
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions?.night_stay
                                    ?.occurred && (
                                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100 text-sm">
                                      <div className="font-semibold text-slate-800">
                                        Night Stay / Sleepover Shift
                                      </div>
                                      {row.analysis_result.exceptions.night_stay
                                        .duration && (
                                        <div className="text-slate-700 mt-1">
                                          Duration:{" "}
                                          {
                                            row.analysis_result.exceptions
                                              .night_stay.duration
                                          }
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions
                                    ?.special_request?.occurred && (
                                    <div className="bg-green-50 p-3 rounded-md border border-green-100 text-sm">
                                      <div className="font-semibold text-green-800">
                                        Special Request
                                      </div>
                                      <div className="text-green-700 mt-1">
                                        "
                                        {row.analysis_result.exceptions
                                          .special_request.description ||
                                          "Not specified"}
                                        "
                                      </div>
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions?.incident
                                    ?.occurred && (
                                    <div className="bg-orange-50 p-3 rounded-md border border-orange-100 text-sm">
                                      <div className="font-semibold text-orange-800 flex items-center gap-2">
                                        Incident Detected
                                        {row.analysis_result.exceptions.incident
                                          .severity && (
                                          <span
                                            className={`text-xs px-2 py-0.5 rounded ${
                                              row.analysis_result.exceptions
                                                .incident.severity === "high"
                                                ? "bg-red-200 text-red-900"
                                                : row.analysis_result.exceptions
                                                    .incident.severity ===
                                                  "medium"
                                                ? "bg-yellow-200 text-yellow-900"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {row.analysis_result.exceptions.incident.severity.toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                      {row.analysis_result.exceptions.incident
                                        .description && (
                                        <div className="text-orange-700 mt-1">
                                          "
                                          {
                                            row.analysis_result.exceptions
                                              .incident.description
                                          }
                                          "
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions
                                    ?.behaviour_alert?.occurred && (
                                    <div className="bg-pink-50 p-3 rounded-md border border-pink-100 text-sm">
                                      <div className="font-semibold text-pink-800">
                                        Behaviour Alert
                                      </div>
                                      {row.analysis_result.exceptions
                                        .behaviour_alert.description && (
                                        <div className="text-pink-700 mt-1">
                                          "
                                          {
                                            row.analysis_result.exceptions
                                              .behaviour_alert.description
                                          }
                                          "
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {row.analysis_result?.exceptions
                                    ?.medication_concern?.occurred && (
                                    <div className="bg-cyan-50 p-3 rounded-md border border-cyan-100 text-sm">
                                      <div className="font-semibold text-cyan-800">
                                        Medication Concern
                                      </div>
                                      {row.analysis_result.exceptions
                                        .medication_concern.description && (
                                        <div className="text-cyan-700 mt-1">
                                          "
                                          {
                                            row.analysis_result.exceptions
                                              .medication_concern.description
                                          }
                                          "
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(row.analysis_result?.expenses?.length > 0 ||
                                    row.analysis_result
                                      ?.reimbursement_claim_explicit) && (
                                    <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 text-sm">
                                      <div className="font-semibold text-yellow-800 mb-2">
                                        Expenses & Claims
                                      </div>
                                      {row.analysis_result.expenses.map(
                                        (exp, idx) => (
                                          <div
                                            key={idx}
                                            className="flex justify-between items-center text-yellow-900 border-b border-yellow-200/50 last:border-0 py-1"
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
                                        <div className="mt-2 text-purple-700 text-xs bg-purple-100 px-2 py-1 rounded inline-block font-medium">
                                          Reimbursement Requested
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {!row.analysis_result?.exceptions?.early_leave
                                    ?.occurred &&
                                    !row.analysis_result?.exceptions?.overtime
                                      ?.occurred &&
                                    !row.analysis_result?.exceptions
                                      ?.staff_change?.occurred &&
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
                                      <div className="text-sm text-gray-500 italic">
                                        No exceptions or expenses detected.
                                      </div>
                                    )}
                                </div>
                              </div>

                              {/* Right Column: Content */}
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  Original Shift Notes
                                </h4>
                                <div className="bg-gray-50 p-4 rounded text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-100">
                                  {row["Message"] || row["Notes"]}
                                </div>
                                {row.analysis_result?.lazy_note && (
                                  <div className="mt-2 text-xs text-orange-600 flex items-center gap-1 font-medium">
                                    <AlertCircle className="h-3 w-3" /> Flagged
                                    as lazy/low-effort note
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No records found for this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
