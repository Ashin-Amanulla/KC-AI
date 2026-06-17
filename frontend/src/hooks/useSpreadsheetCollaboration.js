import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSpreadsheetWsUrl } from '../lib/spreadsheetCollaboration';

function cellKey(rowId, colKey) {
  return `${rowId}:${colKey}`;
}

export function useSpreadsheetCollaboration({ room, queryKeyPrefix, rowsKey, editingRef }) {
  const queryClient = useQueryClient();
  const wsRef = useRef(null);
  const clientIdRef = useRef(null);
  const reconnectTimer = useRef(null);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [cellFocus, setCellFocus] = useState({});
  const [livePreviews, setLivePreviews] = useState({});

  const patchRowInCache = useCallback(
    (row) => {
      if (!row?._id) return;
      queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old) => {
        if (!old?.[rowsKey]) return old;
        const id = String(row._id);
        const exists = old[rowsKey].some((r) => String(r._id) === id);
        const nextRows = exists
          ? old[rowsKey].map((r) => (String(r._id) === id ? { ...r, ...row } : r))
          : [...old[rowsKey], row];
        return { ...old, [rowsKey]: nextRows };
      });
    },
    [queryClient, queryKeyPrefix, rowsKey]
  );

  const removeRowFromCache = useCallback(
    (rowId) => {
      queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old) => {
        if (!old?.[rowsKey]) return old;
        return {
          ...old,
          [rowsKey]: old[rowsKey].filter((r) => String(r._id) !== String(rowId)),
        };
      });
    },
    [queryClient, queryKeyPrefix, rowsKey]
  );

  const handleMessage = useCallback(
    (msg) => {
      if (msg.type === 'joined') {
        clientIdRef.current = msg.clientId;
        return;
      }

      if (msg.room && room && msg.room !== room) return;

      switch (msg.type) {
        case 'presence':
          setPeers(msg.users || []);
          break;
        case 'cell:focus':
          if (msg.clientId === clientIdRef.current) return;
          setCellFocus((prev) => ({
            ...prev,
            [cellKey(msg.rowId, msg.colKey)]: {
              userName: msg.userName,
              color: msg.color,
              clientId: msg.clientId,
            },
          }));
          break;
        case 'cell:blur':
          if (msg.clientId === clientIdRef.current) return;
          setCellFocus((prev) => {
            const next = { ...prev };
            delete next[cellKey(msg.rowId, msg.colKey)];
            return next;
          });
          setLivePreviews((prev) => {
            const next = { ...prev };
            delete next[cellKey(msg.rowId, msg.colKey)];
            return next;
          });
          break;
        case 'cell:preview':
          if (msg.clientId === clientIdRef.current) return;
          {
            const edit = editingRef.current;
            if (edit?.rowId === msg.rowId && edit?.colKey === msg.colKey) return;
          }
          setLivePreviews((prev) => ({
            ...prev,
            [cellKey(msg.rowId, msg.colKey)]: {
              value: msg.value,
              userName: msg.userName,
              color: msg.color,
            },
          }));
          break;
        case 'row:created':
        case 'row:updated':
          {
            const edit = editingRef.current;
            if (edit?.rowId === String(msg.row?._id)) return;
            patchRowInCache(msg.row);
          }
          break;
        case 'row:deleted':
          removeRowFromCache(msg.rowId);
          break;
        case 'bulk:reload':
          queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
          break;
        default:
          break;
      }
    },
    [room, patchRowInCache, removeRowFromCache, queryClient, queryKeyPrefix, editingRef]
  );

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!room) return undefined;

    let cancelled = false;

    const connect = () => {
      const url = getSpreadsheetWsUrl();
      if (!url || cancelled) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'join', room }));
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          reconnectTimer.current = setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setPeers([]);
      setCellFocus({});
      setLivePreviews({});
    };
  }, [room, handleMessage]);

  const notifyFocus = useCallback(
    (rowId, colKey) => send({ type: 'cell:focus', rowId, colKey }),
    [send]
  );

  const notifyBlur = useCallback(
    (rowId, colKey) => send({ type: 'cell:blur', rowId, colKey }),
    [send]
  );

  const notifyPreview = useCallback(
    (rowId, colKey, value) => send({ type: 'cell:preview', rowId, colKey, value }),
    [send]
  );

  return {
    connected,
    peers,
    cellFocus,
    livePreviews,
    notifyFocus,
    notifyBlur,
    notifyPreview,
  };
}
