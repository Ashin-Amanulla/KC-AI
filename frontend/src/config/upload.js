/** Max CSV file size in bytes (50MB) - must match backend MAX_CSV_FILE_SIZE_MB */
export const MAX_CSV_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Accept object for react-dropzone */
export const CSV_ACCEPT = {
  'text/csv': ['.csv'],
  'application/csv': ['.csv'],
  'text/plain': ['.csv'],
};

export const ALLOWED_CSV_EXTENSIONS = ['.csv'];
export const ALLOWED_CSV_MIMETYPES = ['text/csv', 'application/csv', 'text/plain'];

export const validateCsvFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const hasValidExt = ALLOWED_CSV_EXTENSIONS.includes(ext);
  const hasValidMime = ALLOWED_CSV_MIMETYPES.includes(file.type);
  if (!hasValidExt && !hasValidMime) {
    return { valid: false, error: 'Only CSV files are allowed' };
  }

  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    const maxMB = Math.round(MAX_CSV_FILE_SIZE_BYTES / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB` };
  }

  return { valid: true };
};
