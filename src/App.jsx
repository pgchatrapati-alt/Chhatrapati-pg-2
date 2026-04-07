import { useState, useCallback, useEffect, useRef } from 'react';
import { MONTHS, PG_COLORS, INITIAL_DATA } from './data.js';
import { useLocalStorage } from './useStorage.js';
import { pushToSheets, pullFromSheets, pingSheet } from './sync.js';

const COLLECTORS = ['Vishnu', 'Mahendra', 'Cash/other'];
const ADMIN_PASSWORD = 'admin123';
const COLLECTOR_COLORS = { Vishnu: '#10b981', Mahendra: '#6366f1', 'Cash/other': '#f59e0b' };

// Ye sheets PG tabs mein nahi dikhni chahiye (Sheet ke non-PG tabs)
const EXCLUDED_SHEETS = ['Dashboard', 'Monthly_Calculation', '_meta'];

// UPI ID for payment
const UPI_ID = '845972276@ptsbi';

// WhatsApp message builders
function waRentMsg(name, month, dueAmt) {
  return encodeURIComponent(
    'Hi ' + name + ',\n\n' +
    'Aapka ' + month + ' ka rent pending hai.\n\n' +
    'Please is UPI ID par payment kar dein:\n' +
    UPI_ID + '\n\n' +
    (dueAmt ? 'Due amount: ₹' + dueAmt + '\n\n' : '') +
    'Payment ho jaaye to confirm kar dena.\n\nThank you 🙂'
  );
}

function waDepositMsg(name, daysOverdue) {
  return encodeURIComponent(
    'Hi ' + name + ',\n\n' +
    'Aapka security deposit abhi bhi pending hai' +
    (daysOverdue > 0 ? ' (' + daysOverdue + ' din ho gaye joining ke).' : '.') + '\n\n' +
    'Please is UPI ID par deposit bhej dein:\n' +
    UPI_ID + '\n\n' +
    'Confirm kar dena payment ke baad.\n\nThank you 🙂'
  );
}

function waLink(contact, msgEncoded) {
  var num = contact.replace(/\s/g, '').replace(/^0/, '');
  // Add 91 prefix if not already there
  if (!num.startsWith('91') && num.length === 10) num = '91' + num;
  return 'https://wa.me/' + num + '?text=' + msgEncoded;
}

// Helper: kya ye sheet ek valid PG hai?
function isValidPG(name) {
  return !EXCLUDED_SHEETS.includes(name) && !name.startsWith('_');
}

// FIX 1: Tenant kisi month ke liye active hai?
// Agar tenant ka joining date uss month ke baad hai → wo pending nahi hai
// Example: joined 01 Apr 2026 → Jan 2026 mein pending nahi dikhna chahiye
function tenantActiveInMonth(tenant, monthName) {
  if (!tenant.dateJoining) return true;
  const joinDate = new Date(tenant.dateJoining);
  const joinYear  = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth(); // 0-indexed

  const MONTHS_IDX = {
    January:0,February:1,March:2,April:3,May:4,June:5,
    July:6,August:7,September:8,October:9,November:10,December:11
  };
  const selIdx = MONTHS_IDX[monthName];
  if (selIdx === undefined) return true;

  const now     = new Date();
  const selYear = now.getFullYear();

  // Only block if tenant joins IN THE FUTURE relative to selected month+year
  // Past years: always active
  if (joinYear < selYear) return true;
  // Same year: block if joined after selected month
  if (joinYear === selYear && joinMonth > selIdx) return false;
  // Future year joiners: never show as pending
  if (joinYear > selYear) return false;
  return true;
}
const FS = 15; // base font size +1

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
function fmtNum(n) { return parseFloat(n || 0).toLocaleString('en-IN'); }

// FIX 2: blur amounts for viewer
function Amt({ n, isViewer, due = false }) {
  const formatted = `₹${fmtNum(n)}`;
  if (isViewer && !due) {
    return <span style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>{formatted}</span>;
  }
  return <span>{formatted}</span>;
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {label && <div style={S.label}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.input} />
    </div>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {label && <div style={S.label}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={S.input}>
        <option value="">—</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Pill({ children, c = '#94a3b8', bg = '#33415533' }) {
  return <span style={{ fontSize: 10, background: bg, color: c, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>{children}</span>;
}
function Toast({ toast }) {
  if (!toast) return null;
  const bg = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', success: '#22c55e' }[toast.type] || '#22c55e';
  return <div style={{ position: 'fixed', bottom: 76, left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', padding: '10px 22px', borderRadius: 24, fontWeight: 600, fontSize: 14, zIndex: 600, boxShadow: '0 4px 24px rgba(0,0,0,.5)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{toast.msg}</div>;
}
function MonthBar({ sel, setSel, clr }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = el.querySelector(`[data-m="${sel}"]`);
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [sel]);
  return (
    <div ref={ref} style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '8px 14px', background: '#0a0f1e', borderBottom: '1px solid #1e293b', scrollbarWidth: 'none' }}>
      {MONTHS.map(m => (
        <button key={m} data-m={m} onClick={() => setSel(m)}
          style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', background: sel === m ? clr : '#111827', color: sel === m ? '#fff' : '#64748b', boxShadow: sel === m ? `0 0 8px ${clr}66` : 'none', transition: 'all .15s' }}>
          {m.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  function tryLogin() {
    if (pw === ADMIN_PASSWORD) onLogin('admin');
    else { setErr('Galat password!'); setTimeout(() => setErr(''), 2000); }
  }
  if (!mode) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0f1e,#111827)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <div style={{ fontSize: 56 }}>🏠</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>PG Manager</div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Login karein</div>
      <button onClick={() => setMode('admin')} style={S.bigBtn('#6366f1')}>🔐 Admin Login</button>
      <button onClick={() => onLogin('viewer')} style={S.bigBtn('#1e293b', '#94a3b8')}>👁 Sirf Dekhna Hai</button>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0f1e,#111827)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 40 }}>🔐</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: '#f8fafc' }}>Admin Password</div>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryLogin()}
        placeholder="Password daalo…" autoFocus style={{ ...S.input, width: '100%', maxWidth: 280, fontSize: 16, padding: '11px 14px', textAlign: 'center', borderRadius: 12 }} />
      {err && <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={tryLogin} style={S.bigBtn('#6366f1', '#fff', '10px 28px')}>Login</button>
        <button onClick={() => { setMode(null); setPw(''); }} style={S.bigBtn('#1e293b', '#94a3b8', '10px 20px')}>Back</button>
      </div>
    </div>
  );
}

// ── Info Modal (Tenant tab click) ─────────────────────────────
function TenantInfoModal({ tenant, selectedPG, pgColor, isAdmin, onClose, onSave }) {
  const [form, setForm] = useState({ ...tenant });
  const totalPaid = MONTHS.reduce((s, m) => s + (parseFloat(tenant.monthly?.[m]?.amount) || 0), 0);
  const isActive = !tenant.dateLeaving || new Date(tenant.dateLeaving) >= new Date();
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ width: 36, height: 4, background: '#334155', borderRadius: 4, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{tenant.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selectedPG} • {isActive ? '🟢 Active' : '🔴 Left'} • Joined {fmtDate(tenant.dateJoining)}</div>
            {tenant.contact && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📞 {tenant.contact}</div>}
          </div>
          <button onClick={onClose} style={{ ...S.ghostBtn, fontSize: 15, padding: '4px 10px' }}>✕</button>
        </div>
        {tenant.contact && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href={`tel:${tenant.contact.replace(/\s/g, '')}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#22c55e', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>📞 Call</a>
            <a href={waLink(tenant.contact, waRentMsg(tenant.name, 'is month', ''))}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#25d366', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>💬 WhatsApp</a>
          </div>
        )}
        <div style={{ display: 'flex', gap: 1, marginBottom: 14, background: '#0a0f1e', borderRadius: 12, overflow: 'hidden' }}>
          {[{ label: 'Total Paid', val: `₹${fmtNum(totalPaid)}`, c: '#22c55e' }, { label: 'Monthly Rent', val: `₹${fmtNum(form.rent)}`, c: pgColor }, { label: 'Deposit', val: form.deposit ? `₹${fmtNum(form.deposit)}` : '⚠ Pending', c: form.deposit ? '#f8fafc' : '#ef4444' }].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRight: i < 2 ? '1px solid #1e293b' : 'none' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{x.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#f59e0b', borderRadius: 10, padding: '8px', marginBottom: 14, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1a1000' }}>📋 Info</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input label="Contact" value={form.contact || ''} onChange={v => setForm(p => ({ ...p, contact: v }))} />
            <Input label="Deposit ₹" value={form.deposit || ''} onChange={v => setForm(p => ({ ...p, deposit: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input label="Rent ₹/mo" value={form.rent || ''} onChange={v => setForm(p => ({ ...p, rent: v }))} />
            <Input label="Note" value={form.note || ''} onChange={v => setForm(p => ({ ...p, note: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input label="Date Joining" type="date" value={form.dateJoining || ''} onChange={v => setForm(p => ({ ...p, dateJoining: v }))} />
            <Input label="Date Leaving" type="date" value={form.dateLeaving || ''} onChange={v => setForm(p => ({ ...p, dateLeaving: v }))} />
          </div>
        </div>
        {/* FIX 5: Both admin & viewer can edit & save Info */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
          <button onClick={() => onSave({ ...form, monthly: tenant.monthly || emptyMonthly() })}
            style={{ flex: 1, background: '#f59e0b', border: 'none', color: '#1a1000', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>💾 Save + Auto Sync</button>
          <button onClick={onClose} style={S.ghostBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal (Monthly tab click, admin only) ─────────────
function TenantPaymentModal({ tenant, selectedPG, pgColor, onClose, onSave }) {
  const [form, setForm] = useState({ ...tenant });
  const [monthly, setMonthly] = useState(JSON.parse(JSON.stringify(tenant.monthly || emptyMonthly())));
  const setM = (m, f, v) => setMonthly(p => ({ ...p, [m]: { ...p[m], [f]: v } }));
  const totalPaid = MONTHS.reduce((s, m) => s + (parseFloat(monthly[m]?.amount) || 0), 0);
  const isActive = !tenant.dateLeaving || new Date(tenant.dateLeaving) >= new Date();
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ width: 36, height: 4, background: '#334155', borderRadius: 4, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{tenant.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selectedPG} • {isActive ? '🟢 Active' : '🔴 Left'} • Joined {fmtDate(tenant.dateJoining)}</div>
          </div>
          <button onClick={onClose} style={{ ...S.ghostBtn, fontSize: 15, padding: '4px 10px' }}>✕</button>
        </div>
        {tenant.contact && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href={`tel:${tenant.contact.replace(/\s/g, '')}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#22c55e', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>📞 Call</a>
            <a href={waLink(tenant.contact, waRentMsg(tenant.name, 'is month', ''))}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#25d366', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>💬 WhatsApp</a>
          </div>
        )}
        <div style={{ display: 'flex', gap: 1, marginBottom: 14, background: '#0a0f1e', borderRadius: 12, overflow: 'hidden' }}>
          {[{ label: 'Total Paid', val: `₹${fmtNum(totalPaid)}`, c: '#22c55e' }, { label: 'Monthly Rent', val: `₹${fmtNum(form.rent)}`, c: pgColor }, { label: 'Deposit', val: form.deposit ? `₹${fmtNum(form.deposit)}` : '⚠ Pending', c: form.deposit ? '#f8fafc' : '#ef4444' }].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRight: i < 2 ? '1px solid #1e293b' : 'none' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{x.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#0a0f1e', borderRadius: 10, padding: 4 }}>
          <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'default', fontSize: 13, fontWeight: 700, background: pgColor, color: '#fff' }}>📅 Payments</button>
          <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'default', fontSize: 13, fontWeight: 700, background: 'transparent', color: '#64748b' }}>📋 Info</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MONTHS.map(m => {
            const md = monthly[m] || { amount: '', halfFull: '', collector: '', note: '' };
            const paid = parseFloat(md.amount) || 0;
            const rent = parseFloat(form.rent) || 0;
            const tc = paid === 0 ? '#475569' : paid < rent ? '#f59e0b' : pgColor;
            const bc = paid === 0 ? '#1e293b' : paid < rent ? '#f59e0b44' : `${pgColor}44`;
            return (
              <div key={m} style={{ background: '#0a0f1e', borderRadius: 10, padding: '10px 12px', border: `1px solid ${bc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: tc }}>{m}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tc }}>{paid > 0 ? `₹${fmtNum(paid)}${paid < rent ? ' (Half)' : ' ✓'}` : 'Not Paid'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Input label="₹ Amount" value={md.amount} onChange={v => setM(m, 'amount', v)} />
                  <Sel label="Half/Full" value={md.halfFull} onChange={v => setM(m, 'halfFull', v)} options={['Full', 'Half']} />
                  <Sel label="Collector" value={md.collector} onChange={v => setM(m, 'collector', v)} options={COLLECTORS} />
                  <Input label="Note" value={md.note} onChange={v => setM(m, 'note', v)} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
          <button onClick={() => onSave({ ...form, monthly })}
            style={{ flex: 1, background: pgColor, border: 'none', color: '#fff', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>💾 Save + Auto Sync</button>
          <button onClick={onClose} style={S.ghostBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Collection Tab ────────────────────────────────────────────
function CollectionTab({ pgData, selectedMonth, setSelectedMonth, pgColor }) {
  const pgStats = Object.entries(pgData).map(([pgName, tenants]) => {
    const amt = (tenants || []).filter(t => t && t.name).reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
    return { pgName, amt, color: PG_COLORS[pgName] || '#6366f1', active: tenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date()), tenants };
  }).sort((a, b) => b.amt - a.amt);
  const totalThisMonth = pgStats.reduce((s, x) => s + x.amt, 0);
  const collectorMonth = {};
  COLLECTORS.forEach(c => { collectorMonth[c] = 0; });
  Object.values(pgData).flat().forEach(t => {
    const md = t.monthly?.[selectedMonth];
    if (md?.collector && md?.amount) {
      if (!collectorMonth[md.collector]) collectorMonth[md.collector] = 0;
      collectorMonth[md.collector] += parseFloat(md.amount) || 0;
    }
  });
  const monthlyTotals = MONTHS.map(m => ({ m, total: Object.values(pgData).flat().filter(t => t && t.name).reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0) }));
  const maxBar = Math.max(...monthlyTotals.map(x => x.total), 1);
  return (
    <div style={{ padding: '0 14px 88px', maxWidth: 700, margin: '0 auto' }}>
      <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
      <div style={{ background: `linear-gradient(135deg,${pgColor}28,#111827)`, borderRadius: 14, padding: '14px 16px', border: `1px solid ${pgColor}44`, margin: '12px 0' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>TOTAL COLLECTION — {selectedMonth.toUpperCase()}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: pgColor }}>₹{fmtNum(totalThisMonth)}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(collectorMonth).map(([c, amt]) => amt > 0 && (
            <div key={c} style={{ background: '#0a0f1e', borderRadius: 8, padding: '5px 12px', border: `1px solid ${COLLECTOR_COLORS[c] || '#334155'}44` }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{c}: </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLLECTOR_COLORS[c] || '#94a3b8' }}>₹{fmtNum(amt)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>PG-wise — {selectedMonth}</div>
      {pgStats.map(({ pgName, amt, color, active, tenants: ts }) => {
        const expected = active.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
        const pct = expected > 0 ? Math.min(100, Math.round((amt / expected) * 100)) : 0;
        const breakdown = {};
        ts.forEach(t => { const md = t.monthly?.[selectedMonth]; if (md?.collector && md?.amount) { if (!breakdown[md.collector]) breakdown[md.collector] = 0; breakdown[md.collector] += parseFloat(md.amount) || 0; } });
        return (
          <div key={pgName} style={{ background: '#111827', borderRadius: 12, padding: '12px 14px', border: `1px solid ${color}33`, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                <span style={{ fontWeight: 700, fontSize: 15, color }}>{pgName}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{active.length} active</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>₹{fmtNum(amt)}</div>
                <div style={{ fontSize: 11, color: pct >= 100 ? '#22c55e' : '#f59e0b' }}>{pct}% of ₹{fmtNum(expected)}</div>
              </div>
            </div>
            <div style={{ background: '#0a0f1e', borderRadius: 4, height: 5, marginBottom: 6 }}>
              <div style={{ height: '100%', background: pct >= 100 ? '#22c55e' : color, borderRadius: 4, width: `${pct}%` }} />
            </div>
            {Object.entries(breakdown).filter(([, v]) => v > 0).length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {Object.entries(breakdown).filter(([, v]) => v > 0).map(([c, v]) => (
                  <div key={c} style={{ fontSize: 11, background: '#0a0f1e', borderRadius: 6, padding: '3px 8px', color: COLLECTOR_COLORS[c] || '#94a3b8', border: `1px solid ${COLLECTOR_COLORS[c] || '#334155'}33` }}>
                    {c.split('/')[0]}: <b>₹{fmtNum(v)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ background: '#111827', borderRadius: 12, padding: 14, border: '1px solid #1e293b', marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>📈 All PGs — Monthly Trend</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 72, marginBottom: 6 }}>
          {monthlyTotals.map(({ m, total }) => (
            <div key={m} onClick={() => setSelectedMonth(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <div style={{ width: '100%', height: Math.max(3, (total / maxBar) * 60), background: m === selectedMonth ? pgColor : total > 0 ? '#334155' : '#1e293b', borderRadius: 3 }} />
              <div style={{ fontSize: 8, color: m === selectedMonth ? pgColor : '#475569', fontWeight: m === selectedMonth ? 700 : 400 }}>{m.slice(0, 1)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #1e293b' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Year total (all PGs)</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: pgColor }}>₹{fmtNum(monthlyTotals.reduce((s, x) => s + x.total, 0))}</span>
        </div>
      </div>
    </div>
  );
}

// ── FIX 5: Analytics Tab ──────────────────────────────────────
function AnalyticsTab({ pgData, selectedMonth, setSelectedMonth, pgColor }) {
  const allTenants = Object.values(pgData).flat().filter(t => t && t.name);
  const active = allTenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());

  // Payment status counts
  // FIX 1: Filter out future tenants from selectedMonth stats
  const activeThisMonth = active.filter(t => tenantActiveInMonth(t, selectedMonth));
  const fullyPaid = activeThisMonth.filter(t => {
    const p = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
    const r = parseFloat(t.rent) || 0;
    return r > 0 && p >= r;
  }).length;
  const halfPaidCount = activeThisMonth.filter(t => {
    const p = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
    const r = parseFloat(t.rent) || 0;
    return p > 0 && p < r;
  }).length;
  const unpaidCount = activeThisMonth.filter(t => !(parseFloat(t.monthly?.[selectedMonth]?.amount) || 0)).length;
  const noDepositCount = active.filter(t => !t.deposit || t.deposit === '' || t.deposit === '0').length;

  const totalCollected = allTenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const totalExpected = activeThisMonth.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
  const totalDue = Math.max(0, totalExpected - totalCollected);

  // Deposit stats
  const totalDepositCollected = active.filter(t => t.deposit && t.deposit !== '' && t.deposit !== '0').reduce((s, t) => s + (parseFloat(t.deposit) || 0), 0);
  const depositPendingCount = noDepositCount;
  const depositTotal = active.reduce((s, t) => s + (parseFloat(t.deposit) || 0), 0);
  const depositPct = depositTotal > 0 ? Math.round((totalDepositCollected / (totalDepositCollected + depositPendingCount * 5000)) * 100) : 0;

  // Monthly trend for bar chart
  const monthlyData = MONTHS.map(m => {
    const col = allTenants.reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0);
    const act = allTenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
    const exp = act.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
    return { m, col, exp };
  });
  const maxVal = Math.max(...monthlyData.map(x => Math.max(x.col, x.exp)), 1);

  // Per-PG profit overview
  const pgAnalytics = Object.entries(pgData).map(([pgName, tenants]) => {
    const act = tenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
    const expected = act.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
    const collected = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
    const paidCount = act.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) >= (parseFloat(t.rent) || 1)).length;
    return { pgName, expected, collected, paidCount, total: act.length, color: PG_COLORS[pgName] || '#6366f1' };
  });

  return (
    <div style={{ padding: '0 14px 88px', maxWidth: 700, margin: '0 auto' }}>
      <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
      <div style={{ marginTop: 12 }}>

        {/* Payment status */}
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>{selectedMonth} — Payment Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { lbl: 'Fully Paid', val: fullyPaid, c: '#22c55e', b: '#22c55e33' },
            { lbl: 'Half Paid', val: halfPaidCount, c: '#f59e0b', b: '#f59e0b33' },
            { lbl: 'Unpaid', val: unpaidCount, c: '#ef4444', b: '#ef444433' },
            { lbl: 'No Deposit', val: noDepositCount, c: '#f59e0b', b: '#f59e0b33' },
          ].map(s => (
            <div key={s.lbl} style={{ background: '#111827', borderRadius: 10, padding: '10px 8px', border: `1px solid ${s.b}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Collected vs Due */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#22c55e14,#111827)', borderRadius: 12, padding: '12px 14px', border: '1px solid #22c55e33' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Collected</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>₹{fmtNum(totalCollected)}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}% of expected</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#ef444414,#111827)', borderRadius: 12, padding: '12px 14px', border: '1px solid #ef444433' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Total Due</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>₹{fmtNum(totalDue)}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{unpaidCount + halfPaidCount} tenants</div>
          </div>
        </div>

        {/* Monthly collection vs expected bar chart */}
        <div style={{ background: '#111827', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>📊 Collected vs Expected</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: pgColor }} /><span style={{ fontSize: 11, color: '#64748b' }}>Collected</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#334155' }} /><span style={{ fontSize: 11, color: '#64748b' }}>Expected</span></div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
            {monthlyData.map(({ m, col, exp }) => (
              <div key={m} onClick={() => setSelectedMonth(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                <div style={{ width: '100%', position: 'relative', height: Math.max(3, (Math.max(col, exp) / maxVal) * 68) }}>
                  {/* expected bar (background) */}
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: Math.max(2, (exp / maxVal) * 68), background: m === selectedMonth ? '#475569' : '#1e293b', borderRadius: '3px 3px 0 0' }} />
                  {/* collected bar (foreground) */}
                  <div style={{ position: 'absolute', bottom: 0, width: '60%', left: '20%', height: Math.max(2, (col / maxVal) * 68), background: m === selectedMonth ? pgColor : col > 0 ? pgColor + '88' : '#334155', borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
                </div>
                <div style={{ fontSize: 7, color: m === selectedMonth ? pgColor : '#475569', fontWeight: m === selectedMonth ? 700 : 400 }}>{m.slice(0, 1)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Deposit status */}
        <div style={{ background: '#111827', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>🔒 Deposit Status</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{active.length - noDepositCount}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Deposit Given</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{noDepositCount}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>No Deposit</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: pgColor }}>₹{fmtNum(totalDepositCollected)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Held</div>
            </div>
          </div>
          <div style={{ background: '#0a0f1e', borderRadius: 4, height: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 4, width: `${active.length > 0 ? Math.round(((active.length - noDepositCount) / active.length) * 100) : 0}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{active.length > 0 ? Math.round(((active.length - noDepositCount) / active.length) * 100) : 0}% tenants gave deposit</span>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{noDepositCount} pending</span>
          </div>
        </div>

        {/* FIX 4: Collector totals — all time and this month */}
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Collector Totals</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
          {COLLECTORS.map(col => {
            const c = COLLECTOR_COLORS[col] || '#94a3b8';
            const thisMonth = allTenants.reduce((s, t) => {
              const md = t.monthly?.[selectedMonth];
              return md?.collector === col ? s + (parseFloat(md.amount) || 0) : s;
            }, 0);
            const allTime = allTenants.reduce((s, t) =>
              s + MONTHS.reduce((ss, m) => {
                const md = t.monthly?.[m];
                return md?.collector === col ? ss + (parseFloat(md.amount) || 0) : ss;
              }, 0), 0);
            if (allTime === 0) return null;
            return (
              <div key={col} style={{ background: `linear-gradient(135deg,${c}14,#111827)`, borderRadius: 12, padding: '12px 14px', border: `1px solid ${c}44` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: c, marginBottom: 6 }}>{col}</div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{selectedMonth}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>₹{fmtNum(thisMonth)}</div>
                </div>
                <div style={{ borderTop: `1px solid ${c}22`, paddingTop: 6 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>All Time Total</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c }}>₹{fmtNum(allTime)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-PG analytics */}
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>PG-wise Breakdown — {selectedMonth}</div>
        {pgAnalytics.filter(p => p.total > 0).map(({ pgName, expected, collected, paidCount, total, color }) => {
          const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
          return (
            <div key={pgName} style={{ background: '#111827', borderRadius: 10, padding: '10px 14px', border: `1px solid ${color}33`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{pgName}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{paidCount}/{total} paid</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>₹{fmtNum(collected)}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}> / ₹{fmtNum(expected)}</span>
                </div>
              </div>
              <div style={{ background: '#0a0f1e', borderRadius: 3, height: 5 }}>
                <div style={{ height: '100%', background: pct >= 100 ? '#22c55e' : color, borderRadius: 3, width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const [pgData, setPgData] = useLocalStorage('pgData', INITIAL_DATA);
  const [webAppUrl, setWebAppUrl] = useLocalStorage('webAppUrl', '');
  const [lastSync, setLastSync] = useLocalStorage('lastSync', '');
  const [userRole, setUserRole] = useLocalStorage('userRole', null);
  const [selectedPG, setSelectedPG] = useState(Object.keys(pgData)[0]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [view, setView] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [urlDraft, setUrlDraft] = useState(webAppUrl);
  const [newTenant, setNewTenant] = useState({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
  const [pendingTab, setPendingTab] = useState('rent');

  const isAdmin = userRole === 'admin';
  const isViewer = userRole === 'viewer';

  const showToast = useCallback((msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }, []);
  const markSync = () => setLastSync(new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }));

  // FIX 2+3: Auto-pull on app load — viewer & admin dono ko fresh data milega
  // Jab bhi app open ho ya page refresh ho → sheet se latest data lo
  useEffect(() => {
    if (!webAppUrl || !userRole) return; // URL ya login na ho to skip
    // Silent auto-pull: no toast, no loading indicator
    (async () => {
      try {
        const res = await pullFromSheets(webAppUrl);
        if (res.success && res.data) {
          const merged = {};
          Object.keys(pgData).forEach(pg => { if (isValidPG(pg)) merged[pg] = pgData[pg]; });
          Object.keys(res.data).forEach(pg => {
            if (isValidPG(pg) && res.data[pg]?.length > 0) {
              // Ensure every tenant has an ID (migration for old data)
              // Filter null/empty rows and ensure every tenant has an ID
          merged[pg] = res.data[pg]
            .filter(t => t && t.name && String(t.name).trim() !== '')
            ;
            }
          });
          setPgData(merged);
          markSync();
          // If selectedPG got removed, reset to first
          if (!merged[selectedPG]) {
            const first = Object.keys(merged)[0];
            if (first) setSelectedPG(first);
          }
        }
      } catch (e) {
        // Silent fail — just use cached data
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, webAppUrl]); // runs when user logs in or URL changes

  const doPush = useCallback(async (data, silent = false) => {
    if (!webAppUrl) { if (!silent) showToast('Settings mein Web App URL daalo', 'warn'); return false; }
    setSyncStatus('syncing');
    if (!silent) showToast('⏳ Syncing…', 'info');
    const res = await pushToSheets(webAppUrl, data);
    if (res.success) { markSync(); setSyncStatus('ok'); if (!silent) showToast('✅ Sheet updated!'); setTimeout(() => setSyncStatus('idle'), 4000); return true; }
    else { setSyncStatus('error'); showToast('❌ ' + res.error, 'error'); setTimeout(() => setSyncStatus('idle'), 5000); return false; }
  }, [webAppUrl, showToast]);

  const doPull = async () => {
    if (!webAppUrl) { showToast('Settings mein URL daalo', 'warn'); return; }
    setSyncStatus('syncing'); showToast('⬇ Pulling…', 'info');
    const res = await pullFromSheets(webAppUrl);
    if (res.success && res.data) {
      // Filter out non-PG sheets (Dashboard, Monthly_Calculation etc.)
      const merged = {};
      // First keep existing valid PGs
      Object.keys(pgData).forEach(pg => { if (isValidPG(pg)) merged[pg] = pgData[pg]; });
      // Merge new data from sheet (only valid PG sheets)
      Object.keys(res.data).forEach(pg => {
        if (isValidPG(pg) && res.data[pg]?.length > 0) merged[pg] = res.data[pg];
      });
      setPgData(merged); markSync(); setSyncStatus('ok'); showToast('✅ Data updated!');
      setTimeout(() => setSyncStatus('idle'), 4000);
    } else { setSyncStatus('error'); showToast('❌ ' + (res.error || 'Pull failed'), 'error'); setTimeout(() => setSyncStatus('idle'), 5000); }
  };
  // FIX: Clear localStorage pgData and re-pull fresh from sheet
  const doClearAndPull = async () => {
    if (!webAppUrl) { showToast('Settings mein URL daalo pehle', 'warn'); return; }
    setSyncStatus('syncing');
    showToast('⏳ Cache clear karke fresh pull…', 'info');
    const res = await pullFromSheets(webAppUrl);
    if (res.success && res.data) {
      // Start completely fresh — only valid PG sheets
      const fresh = {};
      Object.keys(res.data).forEach(pg => {
        if (isValidPG(pg)) fresh[pg] = res.data[pg];
      });
      setPgData(fresh);
      // Reset selectedPG to first valid one
      const firstPG = Object.keys(fresh)[0];
      if (firstPG) setSelectedPG(firstPG);
      markSync(); setSyncStatus('ok');
      showToast('✅ Fresh data loaded! Cache clear ho gaya.');
      setTimeout(() => setSyncStatus('idle'), 4000);
    } else {
      setSyncStatus('error');
      showToast('❌ ' + (res.error || 'Pull failed'), 'error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const doTest = async () => {
    if (!webAppUrl) { showToast('URL daalo pehle', 'warn'); return; }
    setSyncStatus('syncing');
    const res = await pingSheet(webAppUrl);
    if (res.success) { setSyncStatus('ok'); showToast('✅ Connected!'); setTimeout(() => setSyncStatus('idle'), 4000); }
    else { setSyncStatus('error'); showToast('❌ ' + res.error, 'error'); setTimeout(() => setSyncStatus('idle'), 5000); }
  };

  const tenants = (pgData[selectedPG] || []).filter(t => t && t.name);
  const allTenants = Object.values(pgData).flat().filter(t => t && t.name);

  // FIX 1+6: Sort by joining date (pure date, day-level) — ascending (oldest first for active, left tenants at bottom)
  // FIX 1: Sort by DAY NUMBER only (1→31), month/year ignored
  // e.g. 01-Jan, 03-Mar, 15-Aug, 28-Dec — only the day matters
  // Guard: filter out any null/undefined/empty tenant objects
  const validTenants = tenants.filter(t => t && t.name);
  const sortedTenants = [...validTenants].sort((a, b) => {
    const aLeft = a.dateLeaving && new Date(a.dateLeaving) < new Date();
    const bLeft = b.dateLeaving && new Date(b.dateLeaving) < new Date();
    if (aLeft && !bLeft) return 1;   // left always goes to bottom
    if (!aLeft && bLeft) return -1;
    // Extract only the day-of-month (1–31), ignore month & year
    const dayA = a.dateJoining ? new Date(a.dateJoining).getDate() : 32;
    const dayB = b.dateJoining ? new Date(b.dateJoining).getDate() : 32;
    return dayA - dayB;
  });

  const filteredTenants = sortedTenants.filter(t =>
    t && t.name &&
    (t.name.toLowerCase().includes(search.toLowerCase()) || (t.contact || '').includes(search))
  );

  // FIX: proper left tenant check - tenant is active if NO leaving date OR leaving date is in future
  const isActiveTenant = t => {
    if (!t.dateLeaving || String(t.dateLeaving).trim() === '') return true;
    try { return new Date(t.dateLeaving) >= new Date(new Date().toDateString()); }
    catch(e) { return true; }
  };
  const active = tenants.filter(isActiveTenant);
  const totalRent = active.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
  const collected = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const grandTotal = allTenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  // FIX 1: Only show pending for tenants who joined ON or BEFORE the selectedMonth
  const rentPending = active.filter(t =>
    tenantActiveInMonth(t, selectedMonth) &&
    (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) < (parseFloat(t.rent) || 0)
  );
  const depositPending = active.filter(t => !t.deposit || t.deposit === '' || t.deposit === '0');
  
  // FIX 5: Deposit pending 15+ days after joining
  const depositOverdue = active.filter(t => {
    const noDeposit = !t.deposit || t.deposit === '' || t.deposit === '0';
    if (!noDeposit) return false;
    if (!t.dateJoining) return false;
    const joined = new Date(t.dateJoining);
    const today = new Date();
    const daysSince = Math.floor((today - joined) / (1000 * 60 * 60 * 24));
    return daysSince >= 15; // 15+ days beet gaye, deposit nahi diya
  });
  const halfPaid = active.filter(t => { const p = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0; const r = parseFloat(t.rent) || 0; return p > 0 && p < r; });

  const monthlyBar = MONTHS.map(m => ({ m, total: tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0) }));
  const barMax = Math.max(...monthlyBar.map(x => x.total), 1);
  // Filter: sirf valid PG sheets dikhao (no Dashboard, Monthly_Calculation etc.)
  const allPGs = Object.keys(pgData).filter(isValidPG);
  const pgColor = PG_COLORS[selectedPG] || '#6366f1';
  const syncDot = { idle: '#475569', syncing: '#f59e0b', ok: '#22c55e', error: '#ef4444' }[syncStatus];

  async function saveInfo(updatedTenant) {
    const key = infoModal.name + infoModal.dateJoining;
    const updated = pgData[selectedPG].map(t => (t.name + t.dateJoining) === key ? updatedTenant : t);
    const newData = { ...pgData, [selectedPG]: updated };
    setPgData(newData); setInfoModal(null);
    await doPush(newData);
  }
  async function savePay(updatedTenant) {
    const key = payModal.name + payModal.dateJoining;
    const updated = pgData[selectedPG].map(t => (t.name + t.dateJoining) === key ? updatedTenant : t);
    const newData = { ...pgData, [selectedPG]: updated };
    setPgData(newData); setPayModal(null);
    await doPush(newData);
  }

  // FIX 3+6: Both admin & viewer can add tenant (prepend = newest on top after sort)
  async function addTenant() {
    if (!newTenant.name.trim()) return showToast('Naam zaroor daalo', 'error');
    const tenant = { ...newTenant, monthly: emptyMonthly() };
    const newData = { ...pgData, [selectedPG]: [tenant, ...(pgData[selectedPG] || [])] };
    setPgData(newData);
    setNewTenant({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
    setShowAddTenant(false);
    showToast('✅ Tenant added!', 'success');
    await doPush(newData);
  }

  if (!userRole) return <LoginScreen onLogin={r => setUserRole(r)} />;

  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <span style={S.logo}>🏠 PG</span>
        {isViewer && <Pill c="#3b82f6" bg="#3b82f622">👁 View</Pill>}
        <div style={{ flex: 1 }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot, boxShadow: syncStatus !== 'idle' ? `0 0 8px ${syncDot}` : 'none' }} />
        {lastSync && <span style={{ fontSize: 10, color: '#475569' }}>{lastSync}</span>}
        {isAdmin && <>
          <button onClick={doPull} style={S.hBtn}>⬇</button>
          <button onClick={() => doPush(pgData)} style={S.hBtn}>⬆</button>
          <button onClick={() => setShowSettings(s => !s)} style={S.hBtn}>⚙</button>
        </>}
        <button onClick={() => setUserRole(null)} style={{ ...S.hBtn, color: '#ef4444', borderColor: '#ef444433' }}>⏻</button>
      </header>

      {/* SETTINGS */}
      {showSettings && isAdmin && (
        <div style={{ background: '#111827', borderBottom: '1px solid #1e293b', padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>🔗 Google Sheets Auto-Sync</div>
          <input value={urlDraft} onChange={e => setUrlDraft(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec"
            style={{ ...S.input, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setWebAppUrl(urlDraft); showToast('URL saved ✓'); setShowSettings(false); }} style={S.greenBtn}>💾 Save</button>
            <button onClick={doTest} style={S.blueBtn}>🔌 Test</button>
            <button onClick={doPull} style={S.ghostBtn}>⬇ Pull</button>
          </div>
          <button onClick={doClearAndPull}
            style={{ width: '100%', background: '#ef444422', border: '1px solid #ef444466', color: '#ef4444', padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            🗑 Cache Clear + Fresh Pull (Dashboard/Monthly_Calculation hatane ke liye)
          </button>
          <div style={{ background: '#0a0f1e', borderRadius: 8, padding: 12, fontSize: 12, color: '#64748b', lineHeight: 2 }}>
            <b style={{ color: '#94a3b8' }}>Setup:</b> Google Sheet → Extensions → Apps Script → paste GoogleAppsScript_PG_Sync_v2.js → Deploy → Web App → URL yahan paste
          </div>
        </div>
      )}

      {/* PG TABS */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 14px', background: '#0f1629', borderBottom: '1px solid #1e293b', scrollbarWidth: 'none' }}>
        {Object.keys(pgData).map(pg => {
          const pgC = (pgData[pg] || []).reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
          return (
            <button key={pg} onClick={() => setSelectedPG(pg)}
              style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', fontSize: 14, fontWeight: 700, background: selectedPG === pg ? PG_COLORS[pg] || '#6366f1' : '#111827', color: selectedPG === pg ? '#fff' : '#64748b', boxShadow: selectedPG === pg ? `0 0 10px ${PG_COLORS[pg]}55` : 'none', transition: 'all .15s' }}>
              {pg}{pgC > 0 && <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.8 }}>₹{(pgC / 1000).toFixed(0)}k</span>}
            </button>
          );
        })}
      </div>

      {/* VIEW TABS */}
      <div style={{ display: 'flex', background: '#0a0f1e', borderBottom: '1px solid #1e293b', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[['dashboard', '📊', 'Overview'], ['tenants', '👥', 'Tenants'], ['monthly', '📅', 'Monthly'], ['collection', '💰', 'Collection'], ['analytics', '📈', 'Analytics']].map(([v, ic, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: view === v ? pgColor : '#475569', borderBottom: `2px solid ${view === v ? pgColor : 'transparent'}`, whiteSpace: 'nowrap', transition: 'color .15s' }}>
            {ic} {lbl}
          </button>
        ))}
      </div>

      {/* COLLECTION TAB */}
      {view === 'collection' && <CollectionTab pgData={pgData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} pgColor={pgColor} />}

      {/* FIX 2: ANALYTICS only in analytics tab */}
      {view === 'analytics' && <AnalyticsTab pgData={pgData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} pgColor={pgColor} />}

      {/* MAIN */}
      {view !== 'collection' && view !== 'analytics' && (
        <main style={{ padding: '14px 14px 88px', maxWidth: 700, margin: '0 auto' }}>

          {/* ══ DASHBOARD ══ */}
          {view === 'dashboard' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
            <div style={{ background: `linear-gradient(135deg,${pgColor}28,#111827)`, borderRadius: 14, padding: '14px 16px', border: `1px solid ${pgColor}44`, margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>ALL PGs — {selectedMonth}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: pgColor }}><Amt n={grandTotal} isViewer={isViewer} /></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedPG}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><Amt n={collected} isViewer={isViewer} /></div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>of <Amt n={totalRent} isViewer={isViewer} /></div>
                </div>
              </div>
              <div style={{ marginTop: 10, background: '#0a0f1e', borderRadius: 6, height: 5 }}>
                <div style={{ height: '100%', background: pgColor, borderRadius: 6, width: `${Math.min(100, totalRent > 0 ? (collected / totalRent) * 100 : 0)}%` }} />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{totalRent > 0 ? `${Math.round((collected / totalRent) * 100)}% collected` : '—'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
              {[
                { ic: '👥', lbl: 'Active', val: active.length, c: pgColor },
                { ic: '📋', lbl: 'Expected', val: <Amt n={totalRent} isViewer={isViewer} />, c: pgColor },
                { ic: '⏳', lbl: 'Rent Pending', val: rentPending.length, warn: rentPending.length > 0, sub: rentPending.length > 0 ? `${halfPaid.length} half paid` : '✅ All paid', click: 'rent' },
                { ic: '🔒', lbl: 'No Deposit', val: depositPending.length, warn: depositPending.length > 0, sub: depositPending[0]?.name || '✅ All ok', click: 'deposit' },
              ].map((s, i) => (
                <div key={i} onClick={() => s.click && setPendingTab(s.click)}
                  style={{ background: '#111827', borderRadius: 12, padding: '12px 10px', border: `1px solid ${s.warn ? '#ef444466' : '#1e293b'}`, boxShadow: s.warn ? '0 0 10px #ef444422' : 'none', cursor: s.click ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{s.ic}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.warn ? '#ef4444' : (s.c || '#f1f5f9') }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.lbl}</div>
                  {s.sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ background: '#111827', borderRadius: 12, padding: 12, border: '1px solid #1e293b', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>📈 {selectedPG} — Monthly Trend</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64 }}>
                {monthlyBar.map(({ m, total }) => (
                  <div key={m} onClick={() => setSelectedMonth(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: Math.max(3, (total / barMax) * 52), background: m === selectedMonth ? pgColor : total > 0 ? '#334155' : '#1e293b', borderRadius: 3 }} />
                    <div style={{ fontSize: 8, color: m === selectedMonth ? pgColor : '#475569', fontWeight: m === selectedMonth ? 700 : 400 }}>{m.slice(0, 1)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#111827', borderRadius: 12, padding: 12, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {[['rent', '⏳ Rent'], ['deposit', '🔒 Deposit']].map(([t, lbl]) => (
                  <button key={t} onClick={() => setPendingTab(t)}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: pendingTab === t ? pgColor : '#0a0f1e', color: pendingTab === t ? '#fff' : '#64748b' }}>
                    {lbl} Pending
                  </button>
                ))}
              </div>
              {pendingTab === 'rent' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{selectedMonth} — {rentPending.length} pending</span>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                    ₹{fmtNum(rentPending.reduce((s, t) => s + ((parseFloat(t.rent) || 0) - (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0)), 0))} due
                  </span>
                </div>
                {/* FIX 5: Send All Rent Reminders button */}
                {rentPending.filter(t => t.contact).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                      💡 Ek ek karke WhatsApp open hoga — har ek ke liye Send dabao
                    </div>
                    <button
                      onClick={() => {
                        rentPending.filter(t => t.contact).forEach((t, i) => {
                          const due = fmtNum((parseFloat(t.rent)||0)-(parseFloat(t.monthly?.[selectedMonth]?.amount)||0));
                          setTimeout(() => {
                            window.open(waLink(t.contact, waRentMsg(t.name, selectedMonth, due)), '_blank');
                          }, i * 800); // 800ms gap between each
                        });
                      }}
                      style={{ width: '100%', background: '#25d36622', border: '1px solid #25d36655', color: '#25d366', padding: '9px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      💬 Send All Rent Reminders ({rentPending.filter(t => t.contact).length})
                    </button>
                  </div>
                )}
                {rentPending.length === 0
                  ? <div style={{ color: '#22c55e', fontSize: 14, padding: '8px 0' }}>✅ Sab ne rent de diya!</div>
                  : rentPending.map(t => {
                    const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
                    const rent = parseFloat(t.rent) || 0;
                    return (
                      <div key={t.name} onClick={() => isAdmin && setPayModal(t)}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e293b', cursor: isAdmin ? 'pointer' : 'default' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(t.dateJoining)} • ₹{fmtNum(t.rent)}/mo</div>
                          {t.contact && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 5 }} onClick={e => e.stopPropagation()}>
                              <a href={`tel:${t.contact.replace(/\s/g, '')}`}
                                style={{ background: '#22c55e18', border: '1px solid #22c55e33', color: '#22c55e', padding: '3px 9px', borderRadius: 16, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>📞 Call</a>
                              <a href={waLink(t.contact, waRentMsg(t.name, selectedMonth, fmtNum((parseFloat(t.rent)||0)-(parseFloat(t.monthly?.[selectedMonth]?.amount)||0))))}
                                target="_blank" rel="noreferrer"
                                style={{ background: '#25d36618', border: '1px solid #25d36633', color: '#25d366', padding: '3px 9px', borderRadius: 16, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>💬 WA</a>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: paid > 0 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 13 }}>{paid > 0 ? `Half (₹${fmtNum(paid)})` : 'Not Paid'}</div>
                          {/* FIX 2: due amount visible even for viewer */}
                          <div style={{ fontSize: 12, color: '#ef4444' }}>₹{fmtNum(rent - paid)} due</div>
                        </div>
                      </div>
                    );
                  })
                }
              </>)}
              {pendingTab === 'deposit' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{depositPending.length} bina deposit • {depositOverdue.length} overdue (15+ days)</span>
                </div>
                
                {/* FIX 5: Send deposit reminders for 15+ day overdue */}
                {depositOverdue.filter(t => t.contact).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ background: '#ef444418', border: '1px solid #ef444433', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>🔴 {depositOverdue.length} tenants — 15+ days se deposit pending!</div>
                    </div>
                    <button
                      onClick={() => {
                        depositOverdue.filter(t => t.contact).forEach((t, i) => {
                          const joined = new Date(t.dateJoining);
                          const days = Math.floor((new Date() - joined) / (1000*60*60*24));
                          setTimeout(() => {
                            window.open(waLink(t.contact, waDepositMsg(t.name, days)), '_blank');
                          }, i * 800);
                        });
                      }}
                      style={{ width: '100%', background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444', padding: '9px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                      💬 Send Deposit Reminders ({depositOverdue.filter(t => t.contact).length} overdue)
                    </button>
                  </div>
                )}

                {depositPending.length === 0
                  ? <div style={{ color: '#22c55e', fontSize: 14, padding: '8px 0' }}>✅ Sab ne deposit de diya!</div>
                  : depositPending.map(t => {
                    const joined = new Date(t.dateJoining);
                    const days = t.dateJoining ? Math.floor((new Date() - joined) / (1000*60*60*24)) : 0;
                    const isOverdue = days >= 15;
                    return (
                      <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e293b', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(t.dateJoining)} • {days} din {isOverdue ? '🔴' : '🟡'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: isOverdue ? '#ef4444' : '#f59e0b', fontWeight: 700, fontSize: 12 }}>{isOverdue ? 'Overdue!' : 'Pending'}</div>
                          {t.contact && (
                            <a href={waLink(t.contact, waDepositMsg(t.name, days))} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: 11, color: '#25d366', textDecoration: 'none', fontWeight: 700, marginTop: 3, display: 'block' }}>💬 Remind</a>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </>)}
            </div>
          </>)}

          {/* ══ TENANTS ══ */}
          {view === 'tenants' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...S.input, flex: 1, padding: '9px 12px', fontSize: FS }} />
              {/* FIX 3: Both admin & viewer can add tenant */}
              <button onClick={() => setShowAddTenant(true)}
                style={{ background: pgColor, border: 'none', color: '#fff', padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { lbl: 'Active', val: active.length, c: '#22c55e' },
                { lbl: 'Paid', val: active.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) >= (parseFloat(t.rent) || 1)).length, c: '#22c55e' },
                { lbl: 'Half', val: halfPaid.length, c: '#f59e0b' },
                { lbl: 'Unpaid', val: active.filter(t => !(parseFloat(t.monthly?.[selectedMonth]?.amount) || 0)).length, c: '#ef4444' },
                { lbl: 'No Dep', val: depositPending.length, c: '#f59e0b' },
              ].map(s => (
                <div key={s.lbl} style={{ background: '#111827', borderRadius: 10, padding: '7px 14px', border: `1px solid ${s.c}33`, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            {showAddTenant && (
              <div style={{ background: '#111827', borderRadius: 12, padding: 14, marginBottom: 14, border: `1px solid ${pgColor}66` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>NEW TENANT — {selectedPG}</span>
                  <button onClick={() => setShowAddTenant(false)} style={{ ...S.ghostBtn, fontSize: 12 }}>Cancel</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input label="Naam *" value={newTenant.name} onChange={v => setNewTenant(p => ({ ...p, name: v }))} />
                    <Input label="Contact" value={newTenant.contact} onChange={v => setNewTenant(p => ({ ...p, contact: v }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input label="Deposit ₹" value={newTenant.deposit} onChange={v => setNewTenant(p => ({ ...p, deposit: v }))} />
                    <Input label="Rent ₹/mo" value={newTenant.rent} onChange={v => setNewTenant(p => ({ ...p, rent: v }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input label="Date Joining" type="date" value={newTenant.dateJoining} onChange={v => setNewTenant(p => ({ ...p, dateJoining: v }))} />
                    <Input label="Date Leaving" type="date" value={newTenant.dateLeaving} onChange={v => setNewTenant(p => ({ ...p, dateLeaving: v }))} />
                  </div>
                  <Input label="Note" value={newTenant.note} onChange={v => setNewTenant(p => ({ ...p, note: v }))} />

                  <button onClick={addTenant}
                    style={{ background: pgColor, border: 'none', color: '#fff', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                    ✅ Add Tenant + Auto Sync
                  </button>
                </div>
              </div>
            )}
            {/* FIX 1: Sorted by joining date ascending, left tenants at bottom */}
            {filteredTenants.map(t => {
              const isLeft = t.dateLeaving && new Date(t.dateLeaving) < new Date();
              const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
              const rent = parseFloat(t.rent) || 0;
              const hasDeposit = t.deposit && t.deposit !== '' && t.deposit !== '0';
              const rs = paid === 0 ? 'unpaid' : paid < rent ? 'half' : 'full';
              const rc = { unpaid: '#ef4444', half: '#f59e0b', full: '#22c55e' }[rs];
              const rl = { unpaid: 'Not Paid', half: `Half ₹${fmtNum(paid)}`, full: `✅ ₹${fmtNum(paid)}` }[rs];
              return (
                <div key={t.name + t.dateJoining}
                  onClick={() => !isLeft && setInfoModal(t)}
                  style={{ background: '#111827', borderRadius: 12, padding: '12px 14px', border: `1px solid ${rs !== 'full' && !isLeft ? rc + '55' : '#1e293b'}`, cursor: !isLeft ? 'pointer' : 'default', marginBottom: 8, opacity: isLeft ? 0.45 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: FS, color: isLeft ? '#64748b' : '#f1f5f9' }}>{t.name}</span>
                        {isLeft && <Pill c="#64748b" bg="#33415522">Left</Pill>}
                        {!hasDeposit && !isLeft && <Pill c="#f59e0b" bg="#f59e0b22">No Dep</Pill>}
                        {rs === 'half' && !isLeft && <Pill c="#f59e0b" bg="#f59e0b22">Half</Pill>}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        📅 {fmtDate(t.dateJoining)} {t.contact && `• 📞 ${t.contact}`}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Rent <b style={{ color: '#f1f5f9' }}>₹{fmtNum(t.rent)}</b></span>
                        {hasDeposit && <span style={{ fontSize: 12, color: '#94a3b8' }}>Dep <b style={{ color: '#f1f5f9' }}>₹{fmtNum(t.deposit)}</b></span>}
                      </div>
                      {t.contact && !isLeft && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                          <a href={`tel:${t.contact.replace(/\s/g, '')}`}
                            style={{ background: '#22c55e18', border: '1px solid #22c55e33', color: '#22c55e', padding: '4px 10px', borderRadius: 20, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>📞 Call</a>
                          <a href={waLink(t.contact, waRentMsg(t.name, selectedMonth, ''))}
                            target="_blank" rel="noreferrer"
                            style={{ background: '#25d36618', border: '1px solid #25d36633', color: '#25d366', padding: '4px 10px', borderRadius: 20, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>💬 WA</a>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 10, flexShrink: 0 }}>
                      {!isLeft && <div style={{ color: rc, fontWeight: 700, fontSize: 14 }}>{rl}</div>}
                      {t.monthly?.[selectedMonth]?.collector && !isLeft && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.monthly[selectedMonth].collector}</div>}
                      {isLeft && <div style={{ fontSize: 11, color: '#64748b' }}>Left {fmtDate(t.dateLeaving)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTenants.length === 0 && <div style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: FS }}>No tenants found</div>}
          </>)}

          {/* ══ MONTHLY ══ */}
          {view === 'monthly' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { lbl: 'Collected', val: <Amt n={collected} isViewer={isViewer} />, c: pgColor },
                  { lbl: 'Remaining', val: <Amt n={Math.max(0, totalRent - collected)} isViewer={isViewer} due />, c: '#ef4444' },
                  { lbl: 'Half Paid', val: halfPaid.length, c: '#f59e0b' },
                ].map(s => (
                  <div key={s.lbl} style={{ flex: 1, background: '#111827', borderRadius: 12, padding: 12, border: `1px solid ${s.c}44`, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.lbl}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#111827', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e293b' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: FS }}>{selectedPG} — {selectedMonth}</span>
                  <span style={{ color: pgColor, fontWeight: 700, fontSize: FS }}>{active.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) >= (parseFloat(t.rent) || 1)).length}/{active.length} paid</span>
                </div>
                {active.map(t => {
                  const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
                  const rent = parseFloat(t.rent) || 0;
                  const sc = paid === 0 ? '#ef4444' : paid < rent ? '#f59e0b' : '#22c55e';
                  const sl = paid === 0 ? 'Not Paid' : paid < rent ? `₹${fmtNum(paid)} (Half)` : `✅ ₹${fmtNum(paid)}`;
                  return (
                    <div key={t.name} onClick={() => isAdmin && setPayModal(t)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid #0a0f1e', cursor: isAdmin ? 'pointer' : 'default' }}>
                      <div>
                        <div style={{ fontSize: FS, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>₹{fmtNum(t.rent)}/mo{t.monthly?.[selectedMonth]?.collector ? ` • ${t.monthly[selectedMonth].collector}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: sc, fontWeight: 700, fontSize: 14 }}>{sl}</div>
                        {paid > 0 && paid < rent && <div style={{ fontSize: 12, color: '#ef4444' }}>₹{fmtNum(rent - paid)} due</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>)}
        </main>
      )}

      {/* Modals */}
      {infoModal && <TenantInfoModal tenant={infoModal} selectedPG={selectedPG} pgColor={pgColor} isAdmin={isAdmin} onClose={() => setInfoModal(null)} onSave={saveInfo} />}
      {payModal && <TenantPaymentModal tenant={payModal} selectedPG={selectedPG} pgColor={pgColor} onClose={() => setPayModal(null)} onSave={savePay} />}

      <Toast toast={toast} />

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f1629', borderTop: '1px solid #1e293b', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[['dashboard', '📊', 'Overview'], ['tenants', '👥', 'Tenants'], ['monthly', '📅', 'Monthly'], ['collection', '💰', 'Collection'], ['analytics', '📈', 'Analytics']].map(([v, ic, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '8px 2px 6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 18 }}>{ic}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: view === v ? pgColor : '#475569' }}>{lbl}</span>
            {view === v && <div style={{ width: 18, height: 2, background: pgColor, borderRadius: 2 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" },
  header: { background: '#0f1629', borderBottom: '1px solid #1e293b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 },
  logo: { fontSize: 17, fontWeight: 800, color: '#f8fafc' },
  hBtn: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  input: { width: '100%', background: '#0a0f1e', border: '1px solid #1e293b', color: '#e2e8f0', padding: '7px 10px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  label: { fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#111827', width: '100%', maxWidth: 640, borderRadius: '20px 20px 0 0', maxHeight: '94vh', overflowY: 'auto', padding: '16px 18px', boxShadow: '0 -8px 40px rgba(0,0,0,.6)' },
  ghostBtn: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  greenBtn: { background: '#22c55e', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  blueBtn: { background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  bigBtn: (bg, color = '#fff', pad = '13px 40px') => ({ background: bg, border: 'none', color, padding: pad, borderRadius: 14, cursor: 'pointer', fontWeight: 700, fontSize: 16, width: '100%', maxWidth: 280 }),
};
