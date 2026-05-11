import { useState, useEffect } from 'react';
import {
  useShiftDashboard,
  useCreateVacantShift,
  usePatchVacantShift,
  useAddVacantShiftUpdate,
  useRosterParticipants,
} from '../../api/rosterCoverage';

const C = {
  bg: '#F9F8F6',
  surface: '#FFFFFF',
  border: '#EBEBEB',
  borderHover: '#D4D4D4',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  faint: '#F2F1EF',
  accent: '#2563EB',
  accentBg: '#EFF4FF',
};

const REASON_CFG = {
  sick_call:  { dot: '#F43F5E', bg: '#FFF1F3', label: 'Sick Call' },
  vacancy:    { dot: '#EAB308', bg: '#FEFCE8', label: 'Vacant Shift' },
  other:      { dot: '#8B5CF6', bg: '#F5F3FF', label: 'Other' },
};

const STATUS_CFG = {
  open:        { color: '#F43F5E', bg: '#FFF1F3', label: 'Open' },
  in_progress: { color: '#F97316', bg: '#FFF7ED', label: 'In Progress' },
  filled:      { color: '#22C55E', bg: '#F0FDF4', label: 'Filled' },
  cancelled:   { color: '#94A3B8', bg: '#F8FAFC', label: 'Cancelled' },
};

const PRI_CFG = {
  critical: { color: '#F43F5E', label: 'Critical' },
  high:     { color: '#F97316', label: 'High' },
  medium:   { color: '#EAB308', label: 'Medium' },
  low:      { color: '#94A3B8', label: 'Low' },
};

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>
      {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function NoteThread({ notes = [], shiftId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState('');

  function post() {
    if (!draft.trim()) return;
    onAdd({ id: shiftId, authorName: author || 'Staff', text: draft.trim() });
    setDraft('');
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 12 }}
      >
        <span style={{ fontSize: 10, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>
        <span style={{ fontWeight: 500 }}>{notes.length} update{notes.length !== 1 ? 's' : ''}</span>
        {!open && notes.length > 0 && (
          <span style={{ color: '#C4C4C4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, fontSize: 11 }}>
            — {notes[notes.length - 1].text.slice(0, 50)}{notes[notes.length - 1].text.length > 50 ? '…' : ''}
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n) => (
            <div key={n._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.faint, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.muted, flexShrink: 0, fontFamily: "'DM Mono',monospace" }}>
                {(n.authorName || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: '#555' }}>{n.authorName || 'Staff'}</span>
                  <span style={{ margin: '0 5px', color: C.border }}>·</span>
                  <span>{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div style={{ fontSize: 13, color: '#3A3A3A', lineHeight: 1.55, background: C.faint, borderRadius: 8, padding: '8px 11px' }}>
                  {n.text}
                </div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 38 }}>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name…"
              style={{ background: C.surface, border: `1.5px solid ${C.border}`, color: C.text, borderRadius: 7, padding: '5px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 160 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Post a shift update…"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }}
                style={{ flex: 1, background: C.surface, border: `1.5px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 12, resize: 'none', fontFamily: 'inherit', outline: 'none' }}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
              <button
                onClick={post}
                style={{ alignSelf: 'flex-end', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftCard({ shift, idx, onStatus, onNote }) {
  const rc = REASON_CFG[shift.reason] ?? { dot: '#94A3B8', bg: C.faint, label: shift.reason };
  const sc = STATUS_CFG[shift.status] ?? STATUS_CFG.open;
  const pc = PRI_CFG[shift.priority] ?? PRI_CFG.medium;
  const [hover, setHover] = useState(false);

  const participantName = shift.rosterParticipantId?.name ?? 'Unknown Participant';
  const location = shift.rosterParticipantId?.locationLabel ?? '';
  const startStr = new Date(shift.startDatetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  const endStr = new Date(shift.endDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const filledBy = shift.filledByStaffId?.fullName;

  const nextStatus = shift.status === 'open' ? 'in_progress' : shift.status === 'in_progress' ? 'filled' : null;
  const nextLabel = shift.status === 'open' ? 'Start →' : shift.status === 'in_progress' ? '✓ Filled' : null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface,
        border: `1.5px solid ${hover ? C.borderHover : C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hover ? '0 4px 24px rgba(0,0,0,.06)' : '0 1px 4px rgba(0,0,0,.03)',
        animation: 'rise .35s ease both',
        animationDelay: `${Math.min(idx * 0.04, 0.6)}s`,
      }}
    >
      {/* top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: rc.dot, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rc.label}</span>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>#{shift._id?.slice(-6)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: pc.color, display: 'inline-block' }} title={pc.label} />
          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg, padding: '2px 9px', borderRadius: 20 }}>
            {sc.label}
          </span>
        </div>
      </div>

      {/* participant + shift times */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{participantName}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {[location, `${startStr} – ${endStr}`].filter(Boolean).map((v, i, arr) => (
            <span key={i} style={{ fontSize: 11, color: C.muted }}>
              {v}{i < arr.length - 1 && <span style={{ margin: '0 6px', color: C.border }}>·</span>}
            </span>
          ))}
        </div>
      </div>

      {/* filled by / actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {filledBy ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.accentBg, border: `1.5px solid ${C.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.accent }}>
              {filledBy.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{filledBy}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>Unassigned</span>
        )}

        {nextStatus && (
          <button
            onClick={() => onStatus({ id: shift._id, status: nextStatus })}
            style={{ marginLeft: 'auto', background: C.faint, color: '#555', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '5px 13px', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = nextStatus === 'in_progress' ? '#FFF7ED' : '#F0FDF4'; e.currentTarget.style.borderColor = nextStatus === 'in_progress' ? '#F97316' : '#22C55E'; e.currentTarget.style.color = nextStatus === 'in_progress' ? '#F97316' : '#22C55E'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.faint; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = '#555'; }}
          >
            {nextLabel}
          </button>
        )}
      </div>

      <NoteThread notes={shift.updateLogs ?? []} shiftId={shift._id} onAdd={onNote} />
    </div>
  );
}

function LogShiftModal({ onClose, onSubmit, participants = [] }) {
  const now = new Date();
  const toLocal = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    rosterParticipantId: participants[0]?._id ?? '',
    startDatetime: toLocal(now),
    endDatetime: toLocal(new Date(now.getTime() + 8 * 3600000)),
    reason: 'vacancy',
    priority: 'high',
    notes: '',
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!form.rosterParticipantId) return;
    onSubmit({
      ...form,
      startDatetime: new Date(form.startDatetime).toISOString(),
      endDatetime: new Date(form.endDatetime).toISOString(),
    });
  }

  const fieldStyle = {
    width: '100%',
    background: C.faint,
    border: `1.5px solid ${C.border}`,
    color: C.text,
    padding: '10px 12px',
    borderRadius: 9,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    marginBottom: 5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, borderRadius: 18, padding: 28, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>Log Vacant Shift</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Participant</label>
          <select value={form.rosterParticipantId} onChange={(e) => set('rosterParticipantId', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {participants.map((p) => <option key={p._id} value={p._id}>{p.name}{p.locationLabel ? ` — ${p.locationLabel}` : ''}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Start</label>
            <input type="datetime-local" value={form.startDatetime} onChange={(e) => set('startDatetime', e.target.value)} style={fieldStyle} onFocus={(e) => (e.target.style.borderColor = C.accent)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
          </div>
          <div>
            <label style={labelStyle}>End</label>
            <input type="datetime-local" value={form.endDatetime} onChange={(e) => set('endDatetime', e.target.value)} style={fieldStyle} onFocus={(e) => (e.target.style.borderColor = C.accent)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Reason</label>
            <select value={form.reason} onChange={(e) => set('reason', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="vacancy">Vacant Shift</option>
              <option value="sick_call">Sick Call</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Initial Note</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Context, actions taken, coverage status…"
            style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }}
            onFocus={(e) => (e.target.style.borderColor = C.accent)}
            onBlur={(e) => (e.target.style.borderColor = C.border)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: C.faint, color: C.muted, border: 'none', borderRadius: 9, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={submit} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Log Shift</button>
        </div>
      </div>
    </div>
  );
}

export function RosterShiftLog() {
  const { data, isLoading, dataUpdatedAt } = useShiftDashboard(15000);
  const { data: participantData } = useRosterParticipants();
  const createShift = useCreateVacantShift();
  const patchShift = usePatchVacantShift();
  const addUpdate = useAddVacantShiftUpdate();

  const [showModal, setShowModal] = useState(false);
  const [statusF, setStatusF] = useState('all');
  const [priF, setPriF] = useState('all');
  const [search, setSearch] = useState('');

  const shifts = data?.shifts ?? [];
  const counts = data?.counts ?? { open: 0, in_progress: 0, filled: 0, critical: 0 };
  const participants = participantData?.participants ?? [];

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  const visible = shifts.filter((s) => {
    if (statusF === 'all' && s.status === 'filled') return false;
    if (statusF !== 'all' && s.status !== statusF) return false;
    if (priF !== 'all' && s.priority !== priF) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        s.rosterParticipantId?.name,
        s.rosterParticipantId?.locationLabel,
        s.reason,
        s.status,
        s.priority,
        s.notes,
        ...(s.updateLogs ?? []).map((u) => `${u.authorName} ${u.text}`),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cols = [[], [], []];
  visible.forEach((s, i) => cols[i % 3].push(s));

  function handleCreate(form) {
    createShift.mutate(form, { onSuccess: () => setShowModal(false) });
  }

  function handleStatus({ id, status }) {
    patchShift.mutate({ id, status });
  }

  function handleNote({ id, authorName, text }) {
    addUpdate.mutate({ id, authorName, text });
  }

  const filterBtn = (active, onClick, label, color) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        background: active ? (color ?? C.text) : 'transparent',
        color: active ? '#fff' : C.muted,
        border: `1.5px solid ${active ? (color ?? C.text) : C.border}`,
        borderRadius: 7,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Outfit',sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 0, height: 60 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 36 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📋</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.5, color: C.text, lineHeight: 1.1 }}>Shift Log</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace" }}>live · updated {lastRefresh}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {[
              { label: 'Open', val: counts.open, color: '#F43F5E', bg: '#FFF1F3' },
              { label: 'In Progress', val: counts.in_progress, color: '#F97316', bg: '#FFF7ED' },
              { label: 'Filled', val: counts.filled, color: '#22C55E', bg: '#F0FDF4' },
              { label: 'Critical', val: counts.critical, color: '#F43F5E', bg: '#FFF1F3' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</span>
                <span style={{ fontSize: 11, color: s.color, fontWeight: 500, opacity: 0.8 }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LiveClock />
            <button
              onClick={() => setShowModal(true)}
              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Log Vacant Shift
            </button>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 60, zIndex: 190 }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', padding: '10px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participant, notes…"
              style={{ background: C.faint, border: `1.5px solid ${C.border}`, color: C.text, padding: '7px 12px 7px 30px', borderRadius: 9, fontSize: 12, width: 220, outline: 'none', fontFamily: 'inherit' }}
              onFocus={(e) => (e.target.style.borderColor = C.accent)}
              onBlur={(e) => (e.target.style.borderColor = C.border)}
            />
          </div>

          <div style={{ width: 1, height: 20, background: C.border, margin: '0 2px' }} />

          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open', color: '#F43F5E' },
            { key: 'in_progress', label: 'In Progress', color: '#F97316' },
            { key: 'filled', label: 'Filled', color: '#22C55E' },
            { key: 'cancelled', label: 'Cancelled', color: '#94A3B8' },
          ].map(({ key, label, color }) =>
            filterBtn(statusF === key, () => setStatusF(key), label, color)
          )}

          <div style={{ width: 1, height: 20, background: C.border, margin: '0 2px' }} />

          {[
            { key: 'all', label: 'All Priority' },
            { key: 'critical', label: 'Critical', color: '#F43F5E' },
            { key: 'high', label: 'High', color: '#F97316' },
            { key: 'medium', label: 'Medium', color: '#EAB308' },
            { key: 'low', label: 'Low', color: '#94A3B8' },
          ].map(({ key, label, color }) =>
            filterBtn(priF === key, () => setPriF(key), label, color)
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{visible.length} shift{visible.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* GRID */}
      <main style={{ maxWidth: 1520, margin: '0 auto', padding: '24px 28px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Loading shift log…</div>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>No vacant shifts match your filters.</div>
            <button
              onClick={() => setShowModal(true)}
              style={{ marginTop: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Log first shift
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {col.map((shift, idx) => (
                  <ShiftCard
                    key={shift._id}
                    shift={shift}
                    idx={idx + ci * 9}
                    onStatus={handleStatus}
                    onNote={handleNote}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <LogShiftModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          participants={participants}
        />
      )}

      <style>{`
        @keyframes rise { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        *{box-sizing:border-box;}
        select,input,textarea{outline:none;}
        button{font-family:inherit;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#E0E0E0;border-radius:3px;}
      `}</style>
    </div>
  );
}
