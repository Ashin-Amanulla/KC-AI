/** Max upload file size in bytes (50MB) - must match backend config.upload.maxFileSizeBytes */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** @deprecated use MAX_UPLOAD_FILE_SIZE_BYTES */
export const MAX_CSV_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_BYTES;

/** Accept object for react-dropzone (CSV + Excel) */
export const TABULAR_ACCEPT = {
  'text/csv': ['.csv'],
  'application/csv': ['.csv'],
  'text/plain': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls', '.xlsx'],
};

/** @deprecated use TABULAR_ACCEPT */
export const CSV_ACCEPT = TABULAR_ACCEPT;

export const ALLOWED_TABULAR_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
export const ALLOWED_TABULAR_MIMETYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

/** @deprecated use ALLOWED_TABULAR_EXTENSIONS */
export const ALLOWED_CSV_EXTENSIONS = ['.csv'];
/** @deprecated use ALLOWED_TABULAR_MIMETYPES */
export const ALLOWED_CSV_MIMETYPES = ['text/csv', 'application/csv', 'text/plain'];

export const validateTabularFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const hasValidExt = ALLOWED_TABULAR_EXTENSIONS.includes(ext);
  const hasValidMime = ALLOWED_TABULAR_MIMETYPES.includes(file.type);
  if (!hasValidExt && !hasValidMime) {
    return { valid: false, error: 'Only CSV or Excel (.xlsx, .xls) files are allowed' };
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    const maxMB = Math.round(MAX_UPLOAD_FILE_SIZE_BYTES / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB` };
  }

  return { valid: true };
};

/** @deprecated use validateTabularFile */
export const validateCsvFile = validateTabularFile;
