import { useState, useCallback } from 'react';
import { MONTHS, PG_COLORS, INITIAL_DATA } from './data.js';
import { useLocalStorage } from './useStorage.js';
import { pushToSheets, pullFromSheets, pingSheet } from './sync.js';

// ─── Constants ────────────────────────────────────────────────
const COLLECTORS = ['Vishnu', 'Mahendra', 'Cash/other'];
const ADMIN_PASSWORD = 'admin123'; // Change this!

function emptyMonthly() {
  const obj = {};
  MONTHS.forEach(m => { obj[m] = { amount: '', halfFull: '', collector: '', note: '' }; });
  return obj;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return d; }
}

// ─── UI Components ────────────────────────────────────────────
function Input({ label, value, onChange, type = 'text', placeholder = '', disabled = false }) {
  return (
    <div>
      {label && <div style={styles.fieldLabel}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{ ...styles.input, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'text' }} />
    </div>
  );
}

function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      {label && <div style={styles.fieldLabel}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...styles.input, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', success: '#22c55e' }[toast.type] || '#22c55e';
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: bg, color: 'white', padding: '10px 22px', borderRadius: 24, fontWeight: 600, fontSize: 13, zIndex: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {toast.msg}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null); // null | 'admin' | 'viewer'
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  function handleAdmin() {
    if (pw === ADMIN_PASSWORD) { onLogin('admin'); }
    else { setErr('Wrong password!'); setTimeout(() => setErr(''), 2000); }
  }

  if (!mode) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>PG Manager</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Kaun hai aap?</div>
      <button onClick={() => setMode('admin')} style={{ ...styles.btnPrimary, background: '#6366f1', fontSize: 15, padding: '12px 32px', borderRadius: 12 }}>🔐 Admin Login</button>
      <button onClick={() => onLogin('viewer')} style={{ ...styles.btnGhost, fontSize: 15, padding: '12px 32px', borderRadius: 12 }}>👁 Viewer (Sirf dekhna hai)</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 36 }}>🔐</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Admin Password</div>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdmin()}
        placeholder="Password daalo…" autoFocus
        style={{ ...styles.input, width: 260, fontSize: 15, padding: '10px 14px', textAlign: 'center' }} />
      {err && <div style={{ color: '#ef4444', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleAdmin} style={{ ...styles.btnPrimary, background: '#6366f1', padding: '8px 24px' }}>Login</button>
        <button onClick={() => { setMode(null); setPw(''); }} style={styles.btnGhost}>Back</button>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [pgData, setPgData] = useLocalStorage('pgData', INITIAL_DATA);
  const [webAppUrl, setWebAppUrl] = useLocalStorage('webAppUrl', '');
  const [lastSync, setLastSync] = useLocalStorage('lastSync', '');
  const [userRole, setUserRole] = useLocalStorage('userRole', null); // null | 'admin' | 'viewer'

  const [selectedPG, setSelectedPG] = useState(Object.keys(pgData)[0]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [view, setView] = useState('dashboard'); // dashboard | tenants | monthly | collectors | pg_detail
  const [activePGDetail, setActivePGDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editMonthly, setEditMonthly] = useState({});
  const [newTenant, setNewTenant] = useState({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
  const [urlDraft, setUrlDraft] = useState(webAppUrl);

  const isAdmin = userRole === 'admin';

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const markSync = () => {
    const now = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    setLastSync(now);
  };

  // ── Sync ────────────────────────────────────────────────────
  const doPush = async (data, silent = false) => {
    if (!webAppUrl) { if (!silent) showToast('Settings mein Web App URL daalo', 'warn'); return false; }
    setSyncStatus('syncing');
    const res = await pushToSheets(webAppUrl, data);
    if (res.success) {
      markSync(); setSyncStatus('ok');
      if (!silent) showToast('✅ Google Sheet update ho gaya!');
      setTimeout(() => setSyncStatus('idle'), 3000);
      return true;
    } else {
      setSyncStatus('error');
      if (!silent) showToast('Sheet sync failed: ' + res.error, 'error');
      setTimeout(() => setSyncStatus('idle'), 4000);
      return false;
    }
  };

  const doPull = async () => {
    if (!webAppUrl) { showToast('Settings mein Web App URL daalo', 'warn'); return; }
    setSyncStatus('syncing');
    showToast('Sheet se data la raha hoon…', 'info');
    const res = await pullFromSheets(webAppUrl);
    if (res.success && res.data) {
      const merged = { ...pgData };
      Object.keys(res.data).forEach(pg => { if (res.data[pg]?.length > 0) merged[pg] = res.data[pg]; });
      setPgData(merged);
      markSync(); setSyncStatus('ok');
      showToast('✅ Sheet se latest data aa gaya!');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } else {
      setSyncStatus('error');
      showToast('Pull failed: ' + (res.error || 'Unknown'), 'error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  };

  const doTest = async () => {
    if (!webAppUrl) { showToast('Pehle URL daalo', 'warn'); return; }
    setSyncStatus('syncing');
    const res = await pingSheet(webAppUrl);
    if (res.success) { setSyncStatus('ok'); showToast('✅ Connected!'); setTimeout(() => setSyncStatus('idle'), 3000); }
    else { setSyncStatus('error'); showToast('❌ ' + res.error, 'error'); setTimeout(() => setSyncStatus('idle'), 4000); }
  };

  // ── Computed ────────────────────────────────────────────────
  const tenants = pgData[selectedPG] || [];
  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.contact?.includes(search)
  );
  const active = tenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());

  const totalRent = active.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
  const collected = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);

  // FIX 5: pending = full rent not received (0 paid OR half paid)
  const pendingFull = active.filter(t => {
    const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
    const rent = parseFloat(t.rent) || 0;
    return paid < rent;
  });

  // FIX 4: deposit pending
  const depositPending = active.filter(t => !t.deposit || t.deposit === '' || t.deposit === '0');

  const grandTotal = Object.values(pgData).flat().reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const monthlyBar = MONTHS.map(m => ({ month: m, total: tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0) }));
  const barMax = Math.max(...monthlyBar.map(x => x.total), 1);

  // FIX 6: Collector totals per month across all PGs
  const collectorTotals = (() => {
    const totals = {};
    COLLECTORS.forEach(c => { totals[c] = {}; MONTHS.forEach(m => { totals[c][m] = 0; }); });
    Object.values(pgData).flat().forEach(t => {
      MONTHS.forEach(m => {
        const md = t.monthly?.[m];
        if (md?.collector && md?.amount) {
          const key = md.collector;
          if (totals[key]) totals[key][m] = (totals[key][m] || 0) + (parseFloat(md.amount) || 0);
          else { totals[key] = {}; MONTHS.forEach(mm => { totals[key][mm] = 0; }); totals[key][m] += parseFloat(md.amount) || 0; }
        }
      });
    });
    return totals;
  })();

  const pgColor = PG_COLORS[selectedPG] || '#6366f1';
  const allPGs = Object.keys(pgData);
  const syncDot = { idle: '#475569', syncing: '#f59e0b', ok: '#22c55e', error: '#ef4444' }[syncStatus];

  function openEdit(tenant) {
    if (!isAdmin) return;
    setEditingTenant(tenant);
    setEditForm({ ...tenant });
    setEditMonthly(JSON.parse(JSON.stringify(tenant.monthly || emptyMonthly())));
  }

  async function saveEdit() {
    const key = editingTenant.name + editingTenant.dateJoining;
    const updated = pgData[selectedPG].map(t =>
      (t.name + t.dateJoining) === key ? { ...editForm, monthly: editMonthly } : t
    );
    const newData = { ...pgData, [selectedPG]: updated };
    setPgData(newData);
    setEditingTenant(null);
    showToast('Saving…', 'info');
    await doPush(newData);
  }

  async function addTenant() {
    if (!newTenant.name.trim()) return showToast('Naam zaroor daalo', 'error');
    const tenant = { ...newTenant, monthly: emptyMonthly() };
    const newData = { ...pgData, [selectedPG]: [...(pgData[selectedPG] || []), tenant] };
    setPgData(newData);
    setNewTenant({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
    setShowAddTenant(false);
    showToast('Tenant add ho gaya, sync ho raha hai…', 'info');
    await doPush(newData);
  }

  // ── Rent status helper ───────────────────────────────────────
  function getRentStatus(t, month) {
    const paid = parseFloat(t.monthly?.[month]?.amount) || 0;
    const rent = parseFloat(t.rent) || 0;
    const hf = t.monthly?.[month]?.halfFull || '';
    if (paid === 0) return { label: 'Not Paid', color: '#ef4444', isPending: true };
    if (paid < rent || hf === 'Half') return { label: `Half Paid ₹${paid.toLocaleString()}`, color: '#f59e0b', isPending: true };
    return { label: `₹${paid.toLocaleString()}`, color: '#22c55e', isPending: false };
  }

  // ── Login gate ───────────────────────────────────────────────
  if (!userRole) return <LoginScreen onLogin={role => setUserRole(role)} />;

  // ─────────────────────────────────────────────────────────────
  // PG DETAIL VIEW (click on PG name → all tenants of that PG)
  if (view === 'pg_detail' && activePGDetail) {
    const pgTenants = pgData[activePGDetail] || [];
    const pgActive = pgTenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
    const pgCollected = pgTenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
    const detailColor = PG_COLORS[activePGDetail] || '#6366f1';
    return (
      <div style={styles.root}>
        <header style={styles.header}>
          <button onClick={() => setView('dashboard')} style={styles.btnGhost}>← Back</button>
          <span style={{ ...styles.logo, color: detailColor, fontSize: 20 }}>{activePGDetail}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>{pgActive.length} tenants</span>
        </header>
        {/* Month selector */}
        <div style={{ padding: '8px 14px', display: 'flex', gap: 5, overflowX: 'auto', background: '#111827', borderBottom: '1px solid #1e293b' }}>
          {MONTHS.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} style={{
              ...styles.monthPill, background: selectedMonth === m ? detailColor : '#0a0f1e',
              color: selectedMonth === m ? '#fff' : '#64748b', border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`
            }}>{m.slice(0,3)}</button>
          ))}
        </div>
        <main style={styles.main}>
          <div style={{ ...styles.card, background: `linear-gradient(135deg,${detailColor}18,#111827)`, border: `1px solid ${detailColor}33`, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 10, color: '#64748b' }}>{selectedMonth} collected</div><div style={{ fontSize: 22, fontWeight: 800, color: detailColor }}>₹{pgCollected.toLocaleString()}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: '#64748b' }}>Active</div><div style={{ fontSize: 18, fontWeight: 700 }}>{pgActive.length}</div></div>
          </div>
          {pgTenants.map(t => {
            const isActive = !t.dateLeaving || new Date(t.dateLeaving) >= new Date();
            const status = getRentStatus(t, selectedMonth);
            return (
              <div key={t.name + t.dateJoining} onClick={() => { setSelectedPG(activePGDetail); openEdit(t); }}
                style={{ ...styles.card, marginBottom: 8, border: `1px solid ${status.isPending && isActive ? '#ef444433' : '#1e293b'}`, cursor: isAdmin ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isActive ? '#f1f5f9' : '#64748b' }}>
                      {t.name}{!isActive && <span style={styles.badge}>Left</span>}
                    </div>
                    <div style={styles.tenantSub}>
                      Joined: {fmtDate(t.dateJoining)} • ₹{t.rent || '—'}/mo
                    </div>
                    {t.deposit && <div style={{ fontSize: 11, color: '#64748b' }}>Deposit: ₹{t.deposit}</div>}
                    {t.note && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{t.note}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: status.color, fontWeight: 700, fontSize: 13 }}>{status.label}</div>
                    {t.monthly?.[selectedMonth]?.collector && <div style={{ fontSize: 10, color: '#64748b' }}>{t.monthly[selectedMonth].collector}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </main>
        <Toast toast={toast} />
        {editingTenant && renderEditModal()}
      </div>
    );
  }

  function renderEditModal() {
    return (
      <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setEditingTenant(null); }}>
        <div style={styles.modal}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editingTenant.name}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!isAdmin && <span style={{ ...styles.badge, background: '#3b82f622', color: '#3b82f6', fontSize: 10, padding: '3px 8px' }}>👁 View Only</span>}
              <button onClick={() => setEditingTenant(null)} style={styles.btnGhost}>✕</button>
            </div>
          </div>
          <div style={styles.grid2}>
            <Input label="Contact" value={editForm.contact || ''} onChange={v => setEditForm(p => ({ ...p, contact: v }))} disabled={!isAdmin} />
            <Input label="Deposit" value={editForm.deposit || ''} onChange={v => setEditForm(p => ({ ...p, deposit: v }))} disabled={!isAdmin} />
            <Input label="Rent" value={editForm.rent || ''} onChange={v => setEditForm(p => ({ ...p, rent: v }))} disabled={!isAdmin} />
            <Input label="Note" value={editForm.note || ''} onChange={v => setEditForm(p => ({ ...p, note: v }))} disabled={!isAdmin} />
            <Input label="Joining" type="date" value={editForm.dateJoining || ''} onChange={v => setEditForm(p => ({ ...p, dateJoining: v }))} disabled={!isAdmin} />
            <Input label="Leaving" type="date" value={editForm.dateLeaving || ''} onChange={v => setEditForm(p => ({ ...p, dateLeaving: v }))} disabled={!isAdmin} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#64748b', margin: '14px 0 8px' }}>MONTHLY PAYMENTS</div>
          {MONTHS.map(m => {
            const md = editMonthly[m] || { amount: '', halfFull: '', collector: '', note: '' };
            const set = (field, val) => setEditMonthly(p => ({ ...p, [m]: { ...md, [field]: val } }));
            const paid = parseFloat(md.amount) || 0;
            const rent = parseFloat(editForm.rent) || 0;
            const statusColor = paid === 0 ? '#1e293b' : paid < rent ? '#f59e0b33' : `${pgColor}44`;
            return (
              <div key={m} style={{ marginBottom: 8, background: '#0a0f1e', borderRadius: 8, padding: 10, border: `1px solid ${statusColor}` }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: paid > 0 ? (paid < rent ? '#f59e0b' : pgColor) : '#64748b', marginBottom: 6 }}>
                  {m} {paid > 0 && paid < rent && <span style={{ fontSize: 10, color: '#f59e0b' }}>— Half Paid</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  <Input label="₹ Amount" value={md.amount} onChange={v => set('amount', v)} disabled={!isAdmin} />
                  <Select label="Half/Full" value={md.halfFull} onChange={v => set('halfFull', v)} options={['Full', 'Half']} disabled={!isAdmin} />
                  <Select label="Collector" value={md.collector} onChange={v => set('collector', v)} options={COLLECTORS} disabled={!isAdmin} />
                  <Input label="Note" value={md.note} onChange={v => set('note', v)} disabled={!isAdmin} />
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
            {isAdmin
              ? <button onClick={saveEdit} style={{ ...styles.btnPrimary, flex: 1, background: pgColor, fontSize: 14 }}>💾 Save + Sync</button>
              : <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#64748b', padding: '10px' }}>👁 Viewer — edit nahi kar sakte</div>
            }
            <button onClick={() => setEditingTenant(null)} style={styles.btnGhost}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <span style={styles.logo}>🏠 PG Manager</span>
        {!isAdmin && <span style={{ fontSize: 10, background: '#3b82f622', color: '#3b82f6', padding: '2px 8px', borderRadius: 10, border: '1px solid #3b82f644' }}>👁 Viewer</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: syncDot, boxShadow: `0 0 5px ${syncDot}` }} />
          {lastSync && <span style={{ fontSize: 9, color: '#475569' }}>Sync: {lastSync}</span>}
        </div>
        {isAdmin && <button onClick={doPull} style={styles.btnGhost}>⬇ Pull</button>}
        {isAdmin && <button onClick={() => doPush(pgData)} style={styles.btnGhost}>⬆ Push</button>}
        {isAdmin && <button onClick={() => setShowSettings(s => !s)} style={styles.btnGhost}>⚙</button>}
        <button onClick={() => setUserRole(null)} style={{ ...styles.btnGhost, color: '#ef4444' }}>Logout</button>
      </header>

      {/* ── Settings ── */}
      {showSettings && isAdmin && (
        <div style={styles.settingsPanel}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#94a3b8' }}>🔗 Google Sheets Sync</div>
          <input value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            style={{ ...styles.input, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => { setWebAppUrl(urlDraft); showToast('URL save ho gaya ✓'); setShowSettings(false); }} style={styles.btnGreen}>Save</button>
            <button onClick={doTest} style={styles.btnBlue}>Test Connection</button>
          </div>
          <div style={styles.infoBox}>
            <b style={{ color: '#94a3b8' }}>Setup:</b><br />
            1. Google Sheet → <b>Extensions → Apps Script</b><br />
            2. GoogleAppsScript_PG_Sync.js paste karo<br />
            3. <b>Deploy → New Deployment → Web App</b><br />
            4. Execute as: <b>Me</b> | Access: <b>Anyone</b>
          </div>
        </div>
      )}

      {/* ── PG Bar (FIX 3: bigger font, clickable for detail) ── */}
      <div style={styles.pgBar}>
        {allPGs.map(pg => (
          <button key={pg}
            onClick={() => { setSelectedPG(pg); setActivePGDetail(pg); setView('pg_detail'); }}
            style={{
              ...styles.pgTab,
              background: selectedPG === pg ? PG_COLORS[pg] || '#6366f1' : '#0a0f1e',
              color: selectedPG === pg ? '#fff' : '#94a3b8',
              border: `1px solid ${selectedPG === pg ? 'transparent' : '#1e293b'}`,
              fontSize: 14, // FIX 3: bigger font
              fontWeight: 700,
            }}>{pg}</button>
        ))}
      </div>

      {/* ── View Tabs ── */}
      <div style={styles.viewBar}>
        {[
          ['dashboard', '📊 Overview'],
          ['tenants', '👥 Tenants'],
          ['monthly', '📅 Monthly'],
          ['collectors', '💼 Collectors'],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            ...styles.viewTab,
            color: view === v ? pgColor : '#475569',
            borderBottom: `2px solid ${view === v ? pgColor : 'transparent'}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Content ── */}
      <main style={styles.main}>

        {/* ══ DASHBOARD ══ */}
        {view === 'dashboard' && (
          <>
            <div style={styles.monthRow}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} style={{
                  ...styles.monthPill,
                  background: selectedMonth === m ? pgColor : '#111827',
                  color: selectedMonth === m ? '#fff' : '#64748b',
                  border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`,
                }}>{m.slice(0, 3)}</button>
              ))}
            </div>

            {/* Grand total */}
            <div style={{ ...styles.card, background: `linear-gradient(135deg,${pgColor}18,#111827)`, border: `1px solid ${pgColor}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>ALL PGs — {selectedMonth}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: pgColor }}>₹{grandTotal.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#64748b' }}>{selectedPG}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>₹{collected.toLocaleString()}</div>
              </div>
            </div>

            {/* Stat cards */}
            <div style={styles.statsGrid}>
              {[
                { label: 'Active Tenants', val: active.length, icon: '👥' },
                { label: 'Expected Rent', val: `₹${totalRent.toLocaleString()}`, icon: '📋' },
                { label: 'Rent Pending', val: pendingFull.length, icon: '⏳', warn: pendingFull.length > 0 },
                { label: 'Deposit Pending', val: depositPending.length, icon: '🔒', warn: depositPending.length > 0 }, // FIX 4
              ].map(s => (
                <div key={s.label} style={{ ...styles.card, border: `1px solid ${s.warn ? '#ef444466' : '#1e293b'}` }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.warn ? '#ef4444' : pgColor }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div style={{ ...styles.card, marginBottom: 12 }}>
              <div style={styles.cardTitle}>📈 Collection — {selectedPG}</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64 }}>
                {monthlyBar.map(({ month, total }) => (
                  <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: Math.max(3, (total / barMax) * 54), background: month === selectedMonth ? pgColor : '#1e293b', borderRadius: 3 }} />
                    <div style={{ fontSize: 8, color: '#64748b' }}>{month.slice(0, 1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* FIX 4+5: Pending section — rent pending + deposit pending */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>⏳ Rent Pending — {selectedMonth}</div>
              {pendingFull.length === 0
                ? <div style={{ color: '#22c55e', fontSize: 13 }}>✅ Sabne full rent diya!</div>
                : pendingFull.map(t => {
                  const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
                  const rent = parseFloat(t.rent) || 0;
                  const isHalf = paid > 0 && paid < rent;
                  return (
                    <div key={t.name} onClick={() => { openEdit(t); }} style={{ ...styles.listRow, cursor: isAdmin ? 'pointer' : 'default' }}>
                      <div>
                        <div style={styles.tenantName}>{t.name}</div>
                        <div style={styles.tenantSub}>Joined: {fmtDate(t.dateJoining)} • Rent: ₹{t.rent || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {isHalf
                          ? <><div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>Half Paid</div><div style={{ fontSize: 10, color: '#64748b' }}>₹{paid} / ₹{rent}</div></>
                          : <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 12 }}>Not Paid</div>
                        }
                      </div>
                    </div>
                  );
                })
              }
            </div>

            {/* FIX 4: Deposit Pending card */}
            {depositPending.length > 0 && (
              <div style={{ ...styles.card, marginTop: 12, border: '1px solid #f59e0b44' }}>
                <div style={{ ...styles.cardTitle, color: '#f59e0b' }}>🔒 Deposit Pending</div>
                {depositPending.map(t => (
                  <div key={t.name} onClick={() => openEdit(t)} style={{ ...styles.listRow, cursor: isAdmin ? 'pointer' : 'default' }}>
                    <div>
                      <div style={styles.tenantName}>{t.name}</div>
                      <div style={styles.tenantSub}>Joined: {fmtDate(t.dateJoining)} • Rent: ₹{t.rent || '—'}</div>
                    </div>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>No Deposit</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ TENANTS ══ */}
        {view === 'tenants' && (
          <>
            {/* Month selector for payment status */}
            <div style={{ ...styles.monthRow, marginBottom: 10 }}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} style={{
                  ...styles.monthPill, background: selectedMonth === m ? pgColor : '#111827',
                  color: selectedMonth === m ? '#fff' : '#64748b', border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`
                }}>{m.slice(0, 3)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...styles.input, flex: 1 }} />
              {isAdmin && <button onClick={() => setShowAddTenant(true)} style={{ ...styles.btnPrimary, background: pgColor }}>+ Add</button>}
            </div>

            {showAddTenant && isAdmin && (
              <div style={{ ...styles.card, border: `1px solid ${pgColor}`, marginBottom: 12 }}>
                <div style={styles.cardTitle}>New Tenant — {selectedPG}</div>
                <div style={styles.grid2}>
                  <Input label="Naam*" value={newTenant.name} onChange={v => setNewTenant(p => ({ ...p, name: v }))} />
                  <Input label="Contact" value={newTenant.contact} onChange={v => setNewTenant(p => ({ ...p, contact: v }))} />
                  <Input label="Deposit" value={newTenant.deposit} onChange={v => setNewTenant(p => ({ ...p, deposit: v }))} />
                  <Input label="Rent" value={newTenant.rent} onChange={v => setNewTenant(p => ({ ...p, rent: v }))} />
                  <Input label="Joining Date" type="date" value={newTenant.dateJoining} onChange={v => setNewTenant(p => ({ ...p, dateJoining: v }))} />
                  <Input label="Leaving Date" type="date" value={newTenant.dateLeaving} onChange={v => setNewTenant(p => ({ ...p, dateLeaving: v }))} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Input label="Note" value={newTenant.note} onChange={v => setNewTenant(p => ({ ...p, note: v }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={addTenant} style={styles.btnGreen}>Add + Sync</button>
                  <button onClick={() => setShowAddTenant(false)} style={styles.btnGhost}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(t => {
                const isActive = !t.dateLeaving || new Date(t.dateLeaving) >= new Date();
                const status = getRentStatus(t, selectedMonth);
                const depositMissing = !t.deposit || t.deposit === '' || t.deposit === '0';
                return (
                  <div key={t.name + t.dateJoining} onClick={() => openEdit(t)} style={{
                    ...styles.card,
                    border: `1px solid ${status.isPending && isActive ? '#ef444433' : '#1e293b'}`,
                    cursor: isAdmin ? 'pointer' : 'default',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: isActive ? '#f1f5f9' : '#64748b' }}>
                          {t.name}
                          {!isActive && <span style={styles.badge}>Left</span>}
                          {depositMissing && isActive && <span style={{ ...styles.badge, background: '#f59e0b22', color: '#f59e0b' }}>No Deposit</span>}
                        </div>
                        {/* FIX 1: Show dateJoining instead of contact */}
                        <div style={styles.tenantSub}>
                          Joined: {fmtDate(t.dateJoining)} • ₹{t.rent || '—'}/mo
                        </div>
                        {t.deposit && <div style={{ fontSize: 11, color: '#64748b' }}>Deposit: ₹{t.deposit}</div>}
                        {t.note && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{t.note}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: status.color, fontWeight: 700, fontSize: 13 }}>{status.label}</div>
                        {t.monthly?.[selectedMonth]?.collector && <div style={{ fontSize: 10, color: '#64748b' }}>{t.monthly[selectedMonth].collector}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ MONTHLY ══ */}
        {view === 'monthly' && (
          <>
            <div style={styles.monthRow}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} style={{
                  ...styles.monthPill, background: selectedMonth === m ? pgColor : '#111827',
                  color: selectedMonth === m ? '#fff' : '#64748b', border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`
                }}>{m}</button>
              ))}
            </div>
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>{selectedPG} — {selectedMonth}</span>
                <span style={{ color: pgColor, fontWeight: 700 }}>₹{collected.toLocaleString()}</span>
              </div>
              {filtered.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date()).map(t => {
                const status = getRentStatus(t, selectedMonth);
                return (
                  <div key={t.name} onClick={() => openEdit(t)} style={{ ...styles.listRow, padding: '10px 16px', cursor: isAdmin ? 'pointer' : 'default' }}>
                    <div>
                      <div style={styles.tenantName}>{t.name}</div>
                      <div style={styles.tenantSub}>Rent: ₹{t.rent || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: status.color, fontWeight: 700, fontSize: 13 }}>{status.label}</div>
                      {t.monthly?.[selectedMonth]?.collector && <div style={{ fontSize: 10, color: '#64748b' }}>{t.monthly[selectedMonth].collector}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ FIX 6: COLLECTORS VIEW ══ */}
        {view === 'collectors' && (
          <>
            <div style={styles.monthRow}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} style={{
                  ...styles.monthPill, background: selectedMonth === m ? pgColor : '#111827',
                  color: selectedMonth === m ? '#fff' : '#64748b', border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`
                }}>{m.slice(0, 3)}</button>
              ))}
            </div>

            {/* Summary cards for selected month */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
              {Object.entries(collectorTotals).map(([collector, months]) => {
                const monthAmt = months[selectedMonth] || 0;
                const colors = { Vishnu: '#10b981', Mahendra: '#6366f1', 'Cash/other': '#f59e0b' };
                const c = colors[collector] || '#94a3b8';
                return (
                  <div key={collector} style={{ ...styles.card, border: `1px solid ${c}44`, background: `linear-gradient(135deg,${c}11,#111827)` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c, marginBottom: 4 }}>{collector}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>₹{monthAmt.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{selectedMonth}</div>
                  </div>
                );
              })}
            </div>

            {/* Monthly breakdown table */}
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: 13 }}>
                📅 All Months Breakdown
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0a0f1e' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Month</th>
                      {Object.keys(collectorTotals).map(c => (
                        <th key={c} style={{ padding: '8px 14px', textAlign: 'right', color: { Vishnu: '#10b981', Mahendra: '#6366f1', 'Cash/other': '#f59e0b' }[c] || '#94a3b8', fontWeight: 600 }}>{c}</th>
                      ))}
                      <th style={{ padding: '8px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map(m => {
                      const rowTotal = Object.values(collectorTotals).reduce((s, months) => s + (months[m] || 0), 0);
                      return (
                        <tr key={m} style={{ borderTop: '1px solid #1e293b', background: m === selectedMonth ? '#ffffff08' : 'transparent' }}>
                          <td style={{ padding: '8px 14px', color: m === selectedMonth ? pgColor : '#94a3b8', fontWeight: m === selectedMonth ? 700 : 400 }}>{m}</td>
                          {Object.entries(collectorTotals).map(([c, months]) => (
                            <td key={c} style={{ padding: '8px 14px', textAlign: 'right', color: months[m] ? '#f1f5f9' : '#334155' }}>
                              {months[m] ? `₹${months[m].toLocaleString()}` : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '8px 14px', textAlign: 'right', color: rowTotal ? pgColor : '#334155', fontWeight: 700 }}>
                            {rowTotal ? `₹${rowTotal.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Edit Modal ── */}
      {editingTenant && renderEditModal()}

      <Toast toast={toast} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = {
  root: { minHeight: '100vh', background: '#0a0f1e', color: '#e2e8f0' },
  header: { background: 'linear-gradient(135deg,#111827,#0a0f1e)', borderBottom: '1px solid #1e293b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 },
  logo: { fontSize: 17, fontWeight: 800, color: '#f8fafc' },
  settingsPanel: { background: '#111827', borderBottom: '1px solid #1e293b', padding: 16 },
  infoBox: { background: '#0a0f1e', borderRadius: 8, padding: 12, fontSize: 11, color: '#64748b', lineHeight: 1.8 },
  pgBar: { padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto', background: '#111827', borderBottom: '1px solid #1e293b' },
  pgTab: { padding: '5px 14px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap' },
  viewBar: { display: 'flex', borderBottom: '1px solid #1e293b', background: '#0a0f1e', overflowX: 'auto' },
  viewTab: { padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  main: { padding: '14px 16px', maxWidth: 900, margin: '0 auto' },
  monthRow: { display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 },
  monthPill: { padding: '3px 9px', borderRadius: 12, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' },
  card: { background: '#111827', borderRadius: 12, padding: 14, border: '1px solid #1e293b' },
  cardTitle: { fontWeight: 700, fontSize: 13, marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 12 },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b' },
  tenantName: { fontWeight: 700, fontSize: 14 },
  tenantSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badge: { fontSize: 9, background: '#334155', color: '#94a3b8', padding: '2px 6px', borderRadius: 8, marginLeft: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  fieldLabel: { fontSize: 10, color: '#64748b', marginBottom: 3 },
  input: { width: '100%', background: '#0a0f1e', border: '1px solid #1e293b', color: '#e2e8f0', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#111827', width: '100%', maxWidth: 600, borderRadius: '16px 16px 0 0', maxHeight: '92vh', overflowY: 'auto', padding: 20 },
  btnGhost: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontSize: 12 },
  btnGreen: { background: '#22c55e', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnBlue: { background: '#3b82f6', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnPrimary: { border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
};
