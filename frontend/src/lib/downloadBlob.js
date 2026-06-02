import api from '../utils/api';

export function parseFilenameFromDisposition(cd) {
  if (!cd) return 'download';
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return m ? m[1].trim() : 'download';
}

/** Authenticated GET → browser file download (uses API base URL + Bearer token). */
export async function downloadBlobGet(path, params, fallbackName = 'download') {
  const res = await api.get(path, { params, responseType: 'blob' });
  const name = parseFilenameFromDisposition(res.headers['content-disposition']) || fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
