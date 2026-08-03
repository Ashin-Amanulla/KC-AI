import api, { getErrorMessage } from '../utils/api';

export async function getEngineStatus() {
  const response = await api.get('/api/engine/status');
  return response.data.data;
}

export async function sendEngineChat(messages) {
  const response = await api.post('/api/engine/chat', { messages });
  return response.data.data;
}

export async function applyEngineProposal(code, metadata = {}) {
  const response = await api.post('/api/engine/apply-proposal', { code, metadata });
  return response.data.data;
}

export { getErrorMessage };
