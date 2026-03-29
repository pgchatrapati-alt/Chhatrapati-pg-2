import { useState, useCallback } from 'react';
import { MONTHS, PG_COLORS, INITIAL_DATA } from './data.js';
import { useLocalStorage } from './useStorage.js';
import { pushToSheets, pullFromSheets, pingSheet } from './sync.js';

const COLLECTORS = ['Vishnu', 'Mahendra', 'Cash/other'];

function emptyMonthly() {
  const obj = {};
  MONTHS.forEach(m => { obj[m] = { amount: '', halfFull: '', collector: '', note: '' }; });
  return obj;
}

// ─── Small UI pieces ──────────────────────────────────────────

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      {label && <div style={styles.fieldLabel}>{label}</div>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      {label && <div style={styles.fieldLabel}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={styles.input}>
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
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: bg, color: 'white', padding: '10px 22px', borderRadius: 24, fontWeight: 600, fontSize: 13, zIndex: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
      {toast.msg}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────

export default function App() {
  const [pgData, setPgData] = useLocalStorage('pgData', INITIAL_DATA);
  const [webAppUrl, setWebAppUrl] = useLocalStorage('webAppUrl', '');
  const [lastSync, setLastSync] = useLocalStorage('lastSync', '');

  const [selectedPG, setSelectedPG] = useState(Object.keys(pgData)[0]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [view, setView] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editMonthly, setEditMonthly] = useState({});
  const [newTenant, setNewTenant] = useState({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
  const [urlDraft, setUrlDraft] = useState(webAppUrl);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const markSync = () => {
    const now = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    setLastSync(now);
  };

  // ── Sync actions ────────────────────────────────────────────
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

  // ── Data helpers ────────────────────────────────────────────
  const tenants = pgData[selectedPG] || [];
  const filtered = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.contact?.includes(search));
  const active = tenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
  const totalRent = active.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
  const collected = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const pending = active.filter(t => !t.monthly?.[selectedMonth]?.amount).length;
  const grandTotal = Object.values(pgData).flat().reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const monthlyBar = MONTHS.map(m => ({ month: m, total: tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0) }));
  const barMax = Math.max(...monthlyBar.map(x => x.total), 1);

  const pgColor = PG_COLORS[selectedPG] || '#6366f1';
  const allPGs = Object.keys(pgData);

  const syncDot = { idle: '#475569', syncing: '#f59e0b', ok: '#22c55e', error: '#ef4444' }[syncStatus];

  function openEdit(tenant) {
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

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <span style={styles.logo}>🏠 PG Manager</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot, boxShadow: `0 0 6px ${syncDot}`, transition: 'background .3s' }} />
          {lastSync && <span style={{ fontSize: 10, color: '#475569' }}>Sync: {lastSync}</span>}
        </div>
        <button onClick={doPull} style={styles.btnGhost}>⬇ Pull</button>
        <button onClick={() => doPush(pgData)} style={styles.btnGhost}>⬆ Push</button>
        <button onClick={() => setShowSettings(s => !s)} style={styles.btnGhost}>⚙</button>
      </header>

      {/* ── Settings ── */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#94a3b8' }}>🔗 Google Sheets Sync</div>
          <input
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            style={{ ...styles.input, width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => { setWebAppUrl(urlDraft); showToast('URL save ho gaya ✓'); setShowSettings(false); }} style={styles.btnGreen}>Save</button>
            <button onClick={doTest} style={styles.btnBlue}>Test Connection</button>
          </div>
          <div style={styles.infoBox}>
            <b style={{ color: '#94a3b8' }}>Setup kaise karein:</b><br />
            1. Google Sheet → <b>Extensions → Apps Script</b><br />
            2. <b>GoogleAppsScript_PG_Sync.js</b> code paste karo<br />
            3. <b>Deploy → New Deployment → Web App</b><br />
            4. Execute as: <b>Me</b> | Access: <b>Anyone</b><br />
            5. URL copy karke upar paste karo ✓
          </div>
        </div>
      )}

      {/* ── PG Selector ── */}
      <div style={styles.pgBar}>
        {allPGs.map(pg => (
          <button key={pg} onClick={() => setSelectedPG(pg)} style={{
            ...styles.pgTab,
            background: selectedPG === pg ? PG_COLORS[pg] || '#6366f1' : '#0a0f1e',
            color: selectedPG === pg ? '#fff' : '#64748b',
            border: `1px solid ${selectedPG === pg ? 'transparent' : '#1e293b'}`,
          }}>{pg}</button>
        ))}
      </div>

      {/* ── View Tabs ── */}
      <div style={styles.viewBar}>
        {[['dashboard', '📊 Overview'], ['tenants', '👥 Tenants'], ['monthly', '📅 Monthly']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            ...styles.viewTab,
            color: view === v ? pgColor : '#475569',
            borderBottom: `2px solid ${view === v ? pgColor : 'transparent'}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Content ── */}
      <main style={styles.main}>

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <>
            {/* Month pills */}
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

            {/* Grand total banner */}
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
                { label: 'Pending', val: pending, icon: '⏳', warn: pending > 0 },
                { label: 'Collected', val: `₹${collected.toLocaleString()}`, icon: '💰' },
              ].map(s => (
                <div key={s.label} style={{ ...styles.card, border: `1px solid ${s.warn ? '#ef4444' : '#1e293b'}` }}>
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
                    <div style={{ width: '100%', height: Math.max(3, (total / barMax) * 54), background: month === selectedMonth ? pgColor : '#1e293b', borderRadius: 3, transition: 'height .3s' }} />
                    <div style={{ fontSize: 8, color: '#64748b' }}>{month.slice(0, 1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending list */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>⏳ Pending — {selectedMonth}</div>
              {active.filter(t => !t.monthly?.[selectedMonth]?.amount).length === 0
                ? <div style={{ color: '#22c55e', fontSize: 13 }}>✅ Sabne pay kar diya!</div>
                : active.filter(t => !t.monthly?.[selectedMonth]?.amount).map(t => (
                  <div key={t.name} onClick={() => { openEdit(t); setView('tenants'); }} style={styles.listRow}>
                    <div>
                      <div style={styles.tenantName}>{t.name}</div>
                      <div style={styles.tenantSub}>{t.contact} • ₹{t.rent || '—'}</div>
                    </div>
                    <div style={{ color: '#ef4444', fontSize: 12 }}>Baaki hai</div>
                  </div>
                ))
              }
            </div>
          </>
        )}

        {/* TENANTS */}
        {view === 'tenants' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...styles.input, flex: 1 }} />
              <button onClick={() => setShowAddTenant(true)} style={{ ...styles.btnPrimary, background: pgColor }}>+ Add</button>
            </div>

            {showAddTenant && (
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
                const paid = t.monthly?.[selectedMonth]?.amount;
                return (
                  <div key={t.name + t.dateJoining} onClick={() => openEdit(t)} style={{
                    ...styles.card,
                    border: `1px solid ${paid ? '#22c55e33' : isActive ? '#ef444433' : '#1e293b'}`,
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ ...styles.tenantName, color: isActive ? '#f1f5f9' : '#64748b' }}>
                          {t.name}
                          {!isActive && <span style={styles.badge}>Left</span>}
                        </div>
                        <div style={styles.tenantSub}>{t.contact} {t.rent && `• ₹${t.rent}/mo`} {t.deposit && `• Dep: ₹${t.deposit}`}</div>
                        {t.note && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{t.note}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {paid ? <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>₹{parseFloat(paid).toLocaleString()}</div>
                               : isActive ? <div style={{ color: '#ef4444', fontSize: 12 }}>Baaki</div> : null}
                        {t.monthly?.[selectedMonth]?.collector && <div style={{ fontSize: 10, color: '#64748b' }}>{t.monthly[selectedMonth].collector}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* MONTHLY */}
        {view === 'monthly' && (
          <>
            <div style={styles.monthRow}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} style={{
                  ...styles.monthPill,
                  background: selectedMonth === m ? pgColor : '#111827',
                  color: selectedMonth === m ? '#fff' : '#64748b',
                  border: `1px solid ${selectedMonth === m ? 'transparent' : '#1e293b'}`,
                }}>{m}</button>
              ))}
            </div>
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>{selectedPG} — {selectedMonth}</span>
                <span style={{ color: pgColor, fontWeight: 700 }}>₹{collected.toLocaleString()}</span>
              </div>
              {filtered.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date()).map(t => {
                const m = t.monthly?.[selectedMonth] || {};
                return (
                  <div key={t.name} onClick={() => openEdit(t)} style={{ ...styles.listRow, padding: '10px 16px', cursor: 'pointer' }}>
                    <div>
                      <div style={styles.tenantName}>{t.name}</div>
                      <div style={styles.tenantSub}>Rent: ₹{t.rent || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {m.amount
                        ? <><div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>₹{parseFloat(m.amount).toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{m.halfFull} • {m.collector}</div></>
                        : <div style={{ color: '#ef4444', fontSize: 12 }}>Nahi diya</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── Edit Modal ── */}
      {editingTenant && (
        <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setEditingTenant(null); }}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{editingTenant.name}</div>
              <button onClick={() => setEditingTenant(null)} style={styles.btnGhost}>✕</button>
            </div>

            {/* Basic fields */}
            <div style={styles.grid2}>
              <Input label="Contact" value={editForm.contact || ''} onChange={v => setEditForm(p => ({ ...p, contact: v }))} />
              <Input label="Deposit" value={editForm.deposit || ''} onChange={v => setEditForm(p => ({ ...p, deposit: v }))} />
              <Input label="Rent" value={editForm.rent || ''} onChange={v => setEditForm(p => ({ ...p, rent: v }))} />
              <Input label="Note" value={editForm.note || ''} onChange={v => setEditForm(p => ({ ...p, note: v }))} />
              <Input label="Joining" type="date" value={editForm.dateJoining || ''} onChange={v => setEditForm(p => ({ ...p, dateJoining: v }))} />
              <Input label="Leaving" type="date" value={editForm.dateLeaving || ''} onChange={v => setEditForm(p => ({ ...p, dateLeaving: v }))} />
            </div>

            {/* Monthly */}
            <div style={{ fontWeight: 700, fontSize: 11, color: '#64748b', margin: '14px 0 8px' }}>MONTHLY PAYMENTS</div>
            {MONTHS.map(m => {
              const md = editMonthly[m] || { amount: '', halfFull: '', collector: '', note: '' };
              const set = (field, val) => setEditMonthly(p => ({ ...p, [m]: { ...md, [field]: val } }));
              return (
                <div key={m} style={{ marginBottom: 8, background: '#0a0f1e', borderRadius: 8, padding: 10, border: md.amount ? `1px solid ${pgColor}44` : '1px solid #1e293b' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: md.amount ? pgColor : '#64748b', marginBottom: 6 }}>{m}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                    <Input label="₹ Amount" value={md.amount} onChange={v => set('amount', v)} />
                    <Select label="Half/Full" value={md.halfFull} onChange={v => set('halfFull', v)} options={['Full', 'Half']} />
                    <Select label="Collector" value={md.collector} onChange={v => set('collector', v)} options={COLLECTORS} />
                    <Input label="Note" value={md.note} onChange={v => set('note', v)} />
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
              <button onClick={saveEdit} style={{ ...styles.btnPrimary, flex: 1, background: pgColor, fontSize: 14 }}>💾 Save + Sync</button>
              <button onClick={() => setEditingTenant(null)} style={styles.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ─── Styles object ────────────────────────────────────────────
const styles = {
  root: { minHeight: '100vh', background: '#0a0f1e', color: '#e2e8f0' },
  header: { background: 'linear-gradient(135deg,#111827,#0a0f1e)', borderBottom: '1px solid #1e293b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 100 },
  logo: { fontSize: 18, fontWeight: 800, color: '#f8fafc' },
  settingsPanel: { background: '#111827', borderBottom: '1px solid #1e293b', padding: 16 },
  infoBox: { background: '#0a0f1e', borderRadius: 8, padding: 12, fontSize: 11, color: '#64748b', lineHeight: 1.8 },
  pgBar: { padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto', background: '#111827', borderBottom: '1px solid #1e293b' },
  pgTab: { padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  viewBar: { display: 'flex', borderBottom: '1px solid #1e293b', background: '#0a0f1e' },
  viewTab: { padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  main: { padding: '14px 16px', maxWidth: 900, margin: '0 auto' },
  monthRow: { display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto' },
  monthPill: { padding: '3px 9px', borderRadius: 12, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' },
  card: { background: '#111827', borderRadius: 12, padding: 14, border: '1px solid #1e293b', marginBottom: 0 },
  cardTitle: { fontWeight: 700, fontSize: 13, marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 12 },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b' },
  tenantName: { fontWeight: 700, fontSize: 14 },
  tenantSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badge: { fontSize: 9, background: '#334155', padding: '1px 6px', borderRadius: 8, marginLeft: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  fieldLabel: { fontSize: 10, color: '#64748b', marginBottom: 3 },
  input: { width: '100%', background: '#0a0f1e', border: '1px solid #1e293b', color: '#e2e8f0', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#111827', width: '100%', maxWidth: 600, borderRadius: '16px 16px 0 0', maxHeight: '92vh', overflowY: 'auto', padding: 20 },
  btnGhost: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12 },
  btnGreen: { background: '#22c55e', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnBlue: { background: '#3b82f6', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnPrimary: { border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
};
