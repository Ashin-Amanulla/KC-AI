import api from '../utils/api';

export async function getEngineStatus() {
  const response = await api.get('/api/engine/status');
  return response.data.data;
}

export async function suggestEngineUpdate(prompt, context = {}) {
  const response = await api.post('/api/engine/suggest', { prompt, ...context });
  return response.data.data;
}

export async function applyEngineUpdate(diff, metadata = {}) {
  const response = await api.post('/api/engine/update', { diff, metadata });
  return response.data.data;
}
