import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { User } from '../user/user.model.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { loadRolePermissions } from '../../middlewares/auth.middleware.js';

const WS_PATH = '/ws/spreadsheet';

/** @type {Map<string, Set<SpreadsheetClient>>} */
const rooms = new Map();

const PEER_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d', '#4f46e5',
];

function colorForUser(userId) {
  let hash = 0;
  const s = String(userId);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

function serializePresence(roomClients) {
  const seen = new Map();
  for (const c of roomClients) {
    if (!seen.has(c.userId)) {
      seen.set(c.userId, {
        userId: c.userId,
        name: c.userName,
        color: c.color,
      });
    }
  }
  return [...seen.values()];
}

function broadcastRoom(roomId, message, excludeClient = null) {
  const clients = rooms.get(roomId);
  if (!clients?.size) return;
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client === excludeClient) continue;
    if (client.ws.readyState === 1) {
      client.ws.send(payload);
    }
  }
}

function sendPresence(roomId) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const users = serializePresence(clients);
  broadcastRoom(roomId, { type: 'presence', room: roomId, users });
}

function leaveRoom(client) {
  if (!client.room) return;
  const set = rooms.get(client.room);
  if (set) {
    set.delete(client);
    if (set.size === 0) rooms.delete(client.room);
    else sendPresence(client.room);
  }
  client.room = null;
}

function joinRoom(client, roomId) {
  leaveRoom(client);
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  client.room = roomId;
  rooms.get(roomId).add(client);
  sendPresence(roomId);
}

async function authenticateToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('name email role').lean();
    if (!user) return null;
    const permissions = await loadRolePermissions(user.role || decoded.role || 'viewer');
    if (!permissions.includes(PERMISSIONS.CRM_VIEW) && !permissions.includes(PERMISSIONS.CIR_VIEW)) return null;
    return {
      userId: String(decoded.userId),
      email: user.email || decoded.email,
      userName: user.name || user.email || decoded.email,
      color: colorForUser(decoded.userId),
    };
  } catch {
    return null;
  }
}

/**
 * @param {import('http').Server} server
 */
export function attachSpreadsheetCollaborationWs(server) {
  const wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const auth = await authenticateToken(token);
    if (!auth) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    /** @type {SpreadsheetClient} */
    const client = {
      ws,
      ...auth,
      room: null,
      clientId: randomUUID(),
    };

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === 'join' && typeof msg.room === 'string') {
        joinRoom(client, msg.room);
        ws.send(JSON.stringify({ type: 'joined', room: msg.room, clientId: client.clientId }));
        return;
      }

      if (!client.room) return;

      if (msg.type === 'cell:focus' && msg.rowId && msg.colKey) {
        broadcastRoom(
          client.room,
          {
            type: 'cell:focus',
            room: client.room,
            rowId: String(msg.rowId),
            colKey: String(msg.colKey),
            userId: client.userId,
            userName: client.userName,
            color: client.color,
            clientId: client.clientId,
          },
          client
        );
        return;
      }

      if (msg.type === 'cell:blur' && msg.rowId && msg.colKey) {
        broadcastRoom(
          client.room,
          {
            type: 'cell:blur',
            room: client.room,
            rowId: String(msg.rowId),
            colKey: String(msg.colKey),
            clientId: client.clientId,
          },
          client
        );
        return;
      }

      if (msg.type === 'cell:preview' && msg.rowId && msg.colKey) {
        broadcastRoom(
          client.room,
          {
            type: 'cell:preview',
            room: client.room,
            rowId: String(msg.rowId),
            colKey: String(msg.colKey),
            value: msg.value ?? '',
            userId: client.userId,
            userName: client.userName,
            color: client.color,
            clientId: client.clientId,
          },
          client
        );
      }
    });

    ws.on('close', () => leaveRoom(client));
  });

  console.log(`Spreadsheet collaboration WebSocket on ${WS_PATH}`);
}

/**
 * Broadcast data change after REST mutation (all clients including actor refresh from payload).
 */
export function broadcastSpreadsheetChange(room, message) {
  broadcastRoom(room, { ...message, room });
}

export function broadcastSpreadsheetBulkReload(rooms) {
  for (const room of rooms) {
    broadcastRoom(room, { type: 'bulk:reload', room });
  }
}

export const SPREADSHEET_ROOMS = {
  supportCoordinators: 'crm:support-coordinators',
  leads: 'crm:leads',
  marketing: 'crm:marketing',
  hrRequirements: 'hr:requirements',
  cirRegister: 'cir:register',
};

/**
 * @typedef {object} SpreadsheetClient
 * @property {import('ws').WebSocket} ws
 * @property {string} userId
 * @property {string} userName
 * @property {string} email
 * @property {string} color
 * @property {string|null} room
 * @property {string} clientId
 */
