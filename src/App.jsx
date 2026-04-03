import { useState, useCallback, useEffect, useRef } from 'react';
import { MONTHS, PG_COLORS, INITIAL_DATA } from './data.js';
import { useLocalStorage } from './useStorage.js';
import { pushToSheets, pullFromSheets, pingSheet } from './sync.js';

const COLLECTORS = ['Vishnu', 'Mahendra', 'Cash/other'];
const ADMIN_PASSWORD = 'admin123';
const COLLECTOR_COLORS = { Vishnu: '#10b981', Mahendra: '#6366f1', 'Cash/other': '#f59e0b' };

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

// ── UI atoms ──────────────────────────────────────────────────
function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {label && <div style={S.label}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={S.input} />
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
  return <span style={{ fontSize: 9, background: bg, color: c, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>{children}</span>;
}
function Toast({ toast }) {
  if (!toast) return null;
  const bg = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', success: '#22c55e' }[toast.type] || '#22c55e';
  return <div style={{ position: 'fixed', bottom: 76, left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', padding: '10px 22px', borderRadius: 24, fontWeight: 600, fontSize: 13, zIndex: 600, boxShadow: '0 4px 24px rgba(0,0,0,.5)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{toast.msg}</div>;
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
          style={{ padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: sel === m ? clr : '#111827', color: sel === m ? '#fff' : '#64748b', boxShadow: sel === m ? `0 0 8px ${clr}66` : 'none', transition: 'all .15s' }}>
          {m.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────
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
      <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>PG Manager</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Login karein</div>
      <button onClick={() => setMode('admin')} style={S.bigBtn('#6366f1')}>🔐 Admin Login</button>
      <button onClick={() => onLogin('viewer')} style={S.bigBtn('#1e293b', '#94a3b8')}>👁 Sirf Dekhna Hai</button>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0f1e,#111827)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 40 }}>🔐</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Admin Password</div>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryLogin()}
        placeholder="Password daalo…" autoFocus style={{ ...S.input, width: '100%', maxWidth: 280, fontSize: 15, padding: '11px 14px', textAlign: 'center', borderRadius: 12 }} />
      {err && <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={tryLogin} style={S.bigBtn('#6366f1', '#fff', '10px 28px')}>Login</button>
        <button onClick={() => { setMode(null); setPw(''); }} style={S.bigBtn('#1e293b', '#94a3b8', '10px 20px')}>Back</button>
      </div>
    </div>
  );
}

// ── FIX 2+3: Overview click = NO modal at all (removed)
// ── FIX 3: Tenant tab click = Info only modal ────────────────
function TenantInfoModal({ tenant, selectedPG, pgColor, onClose, onSave }) {
  const [form, setForm] = useState({ ...tenant });
  const totalPaid = MONTHS.reduce((s, m) => s + (parseFloat(tenant.monthly?.[m]?.amount) || 0), 0);
  const isActive = !tenant.dateLeaving || new Date(tenant.dateLeaving) >= new Date();

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ width: 36, height: 4, background: '#334155', borderRadius: 4, margin: '0 auto 14px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{tenant.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{selectedPG} • {isActive ? '🟢 Active' : '🔴 Left'} • Joined {fmtDate(tenant.dateJoining)}</div>
            {tenant.contact && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📞 {tenant.contact}</div>}
          </div>
          <button onClick={onClose} style={{ ...S.ghostBtn, fontSize: 15, padding: '4px 10px' }}>✕</button>
        </div>

        {/* FIX 2: Call & WA in modal (image 2 reference) */}
        {tenant.contact && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href={`tel:${tenant.contact.replace(/\s/g, '')}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#22c55e', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 800 }}>
              📞 Call
            </a>
            <a href={`https://wa.me/91${tenant.contact.replace(/\s/g, '')}?text=Namaste%20${encodeURIComponent(tenant.name)}!%20PG%20rent%20reminder%20-%20please%20clear%20dues.%20Thank%20you!`}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#25d366', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 800 }}>
              💬 WhatsApp
            </a>
          </div>
        )}

        {/* Summary Strip */}
        <div style={{ display: 'flex', gap: 1, marginBottom: 14, background: '#0a0f1e', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Total Paid', val: `₹${fmtNum(totalPaid)}`, c: '#22c55e' },
            { label: 'Monthly Rent', val: `₹${fmtNum(form.rent)}`, c: pgColor },
            { label: 'Deposit', val: form.deposit ? `₹${fmtNum(form.deposit)}` : '⚠ Pending', c: form.deposit ? '#f8fafc' : '#ef4444' },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRight: i < 2 ? '1px solid #1e293b' : 'none' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>{x.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.val}</div>
            </div>
          ))}
        </div>

        {/* FIX 3: Only INFO tab — no payments here */}
        <div style={{ background: '#f59e0b', borderRadius: 10, padding: '8px', marginBottom: 14, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1a1000' }}>
          📋 Info
        </div>

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

        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
          <button onClick={() => onSave({ ...form, monthly: tenant.monthly || emptyMonthly() })}
            style={{ flex: 1, background: '#f59e0b', border: 'none', color: '#1a1000', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
            💾 Save + Auto Sync
          </button>
          <button onClick={onClose} style={S.ghostBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Payment Modal (Monthly tab click) ──────────────────
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
            <div style={{ fontWeight: 800, fontSize: 19 }}>{tenant.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{selectedPG} • {isActive ? '🟢 Active' : '🔴 Left'} • Joined {fmtDate(tenant.dateJoining)}</div>
            {tenant.contact && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📞 {tenant.contact}</div>}
          </div>
          <button onClick={onClose} style={{ ...S.ghostBtn, fontSize: 15, padding: '4px 10px' }}>✕</button>
        </div>

        {tenant.contact && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href={`tel:${tenant.contact.replace(/\s/g, '')}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#22c55e', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 800 }}>
              📞 Call
            </a>
            <a href={`https://wa.me/91${tenant.contact.replace(/\s/g, '')}?text=Namaste%20${encodeURIComponent(tenant.name)}!%20PG%20rent%20reminder%20-%20please%20clear%20dues.%20Thank%20you!`}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#25d366', color: '#fff', padding: '11px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 800 }}>
              💬 WhatsApp
            </a>
          </div>
        )}

        <div style={{ display: 'flex', gap: 1, marginBottom: 14, background: '#0a0f1e', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Total Paid', val: `₹${fmtNum(totalPaid)}`, c: '#22c55e' },
            { label: 'Monthly Rent', val: `₹${fmtNum(form.rent)}`, c: pgColor },
            { label: 'Deposit', val: form.deposit ? `₹${fmtNum(form.deposit)}` : '⚠ Pending', c: form.deposit ? '#f8fafc' : '#ef4444' },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRight: i < 2 ? '1px solid #1e293b' : 'none' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>{x.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.val}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#0a0f1e', borderRadius: 10, padding: 4 }}>
          {[['monthly', '📅 Payments'], ['info', '📋 Info']].map(([t, lbl]) => (
            <button key={t} onClick={() => {}} disabled
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'default', fontSize: 12, fontWeight: 700, background: t === 'monthly' ? pgColor : 'transparent', color: t === 'monthly' ? '#fff' : '#64748b' }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MONTHS.map(m => {
            const md = monthly[m] || { amount: '', halfFull: '', collector: '', note: '' };
            const paid = parseFloat(md.amount) || 0;
            const rent = parseFloat(form.rent) || 0;
            const tc = paid === 0 ? '#475569' : paid < rent ? '#f59e0b' : pgColor;
            const borderClr = paid === 0 ? '#1e293b' : paid < rent ? '#f59e0b44' : `${pgColor}44`;
            return (
              <div key={m} style={{ background: '#0a0f1e', borderRadius: 10, padding: '10px 12px', border: `1px solid ${borderClr}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: tc }}>{m}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>
                    {paid > 0 ? `₹${fmtNum(paid)}${paid < rent ? ' (Half)' : ' ✓'}` : 'Not Paid'}
                  </span>
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
            style={{ flex: 1, background: pgColor, border: 'none', color: '#fff', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            💾 Save + Auto Sync
          </button>
          <button onClick={onClose} style={S.ghostBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── FIX 1: New Collection Tab — per PG per month ─────────────
function CollectionTab({ pgData, selectedMonth, setSelectedMonth, pgColor }) {
  // All PGs collection this month
  const pgStats = Object.entries(pgData).map(([pgName, tenants]) => {
    const amt = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
    return { pgName, amt, color: PG_COLORS[pgName] || '#6366f1' };
  }).sort((a, b) => b.amt - a.amt);

  const totalThisMonth = pgStats.reduce((s, x) => s + x.amt, 0);

  // Collector breakdown this month
  const collectorMonth = {};
  COLLECTORS.forEach(c => { collectorMonth[c] = 0; });
  Object.values(pgData).flat().forEach(t => {
    const md = t.monthly?.[selectedMonth];
    if (md?.collector && md?.amount) {
      if (!collectorMonth[md.collector]) collectorMonth[md.collector] = 0;
      collectorMonth[md.collector] += parseFloat(md.amount) || 0;
    }
  });

  // Monthly totals across all PGs
  const monthlyTotals = MONTHS.map(m => ({
    m,
    total: Object.values(pgData).flat().reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0)
  }));
  const maxBar = Math.max(...monthlyTotals.map(x => x.total), 1);

  return (
    <div style={{ padding: '0 14px 88px', maxWidth: 700, margin: '0 auto' }}>
      <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />

      {/* Grand total banner */}
      <div style={{ background: `linear-gradient(135deg,${pgColor}28,#111827)`, borderRadius: 16, padding: '16px 18px', border: `1px solid ${pgColor}44`, margin: '12px 0' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>TOTAL COLLECTION — {selectedMonth.toUpperCase()}</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: pgColor }}>₹{fmtNum(totalThisMonth)}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(collectorMonth).map(([c, amt]) => amt > 0 && (
            <div key={c} style={{ background: '#0a0f1e', borderRadius: 8, padding: '5px 12px', border: `1px solid ${COLLECTOR_COLORS[c] || '#334155'}44` }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>{c}: </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLLECTOR_COLORS[c] || '#94a3b8' }}>₹{fmtNum(amt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-PG collection this month */}
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
        PG-wise — {selectedMonth}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {pgStats.map(({ pgName, amt, color }) => {
          const pgActive = (pgData[pgName] || []).filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
          const pgExpected = pgActive.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
          const pct = pgExpected > 0 ? Math.min(100, Math.round((amt / pgExpected) * 100)) : 0;
          return (
            <div key={pgName} style={{ background: '#111827', borderRadius: 14, padding: '12px 14px', border: `1px solid ${color}33` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{pgName}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{pgActive.length} tenants</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>₹{fmtNum(amt)}</div>
                  <div style={{ fontSize: 10, color: pct >= 100 ? '#22c55e' : '#f59e0b' }}>{pct}% of ₹{fmtNum(pgExpected)}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ background: '#0a0f1e', borderRadius: 4, height: 5 }}>
                <div style={{ height: '100%', background: pct >= 100 ? '#22c55e' : color, borderRadius: 4, width: `${pct}%`, transition: 'width .4s' }} />
              </div>
              {/* Collector breakdown for this PG this month */}
              {(() => {
                const breakdown = {};
                (pgData[pgName] || []).forEach(t => {
                  const md = t.monthly?.[selectedMonth];
                  if (md?.collector && md?.amount) {
                    if (!breakdown[md.collector]) breakdown[md.collector] = 0;
                    breakdown[md.collector] += parseFloat(md.amount) || 0;
                  }
                });
                const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
                if (!entries.length) return null;
                return (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {entries.map(([c, v]) => (
                      <div key={c} style={{ fontSize: 10, background: '#0a0f1e', borderRadius: 6, padding: '3px 8px', color: COLLECTOR_COLORS[c] || '#94a3b8', border: `1px solid ${COLLECTOR_COLORS[c] || '#334155'}33` }}>
                        {c.split('/')[0]}: <b>₹{fmtNum(v)}</b>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Month trend bar chart */}
      <div style={{ background: '#111827', borderRadius: 14, padding: 14, border: '1px solid #1e293b' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          📈 All PGs — Monthly Trend
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
          {monthlyTotals.map(({ m, total }) => (
            <div key={m} onClick={() => setSelectedMonth(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <div style={{ fontSize: 9, color: total > 0 ? pgColor : 'transparent', fontWeight: 700, marginBottom: 1 }}>
                {total > 0 ? `${(total / 1000).toFixed(0)}k` : ''}
              </div>
              <div style={{ width: '100%', height: Math.max(3, (total / maxBar) * 62), background: m === selectedMonth ? pgColor : total > 0 ? '#334155' : '#1e293b', borderRadius: 3, transition: 'height .3s' }} />
              <div style={{ fontSize: 8, color: m === selectedMonth ? pgColor : '#475569', fontWeight: m === selectedMonth ? 700 : 400 }}>{m.slice(0, 1)}</div>
            </div>
          ))}
        </div>
        {/* Summary row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #1e293b', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Year total (all PGs)</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: pgColor }}>
            ₹{fmtNum(monthlyTotals.reduce((s, x) => s + x.total, 0))}
          </span>
        </div>
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
  const [infoModal, setInfoModal] = useState(null);   // tenant for Info modal (tenant tab)
  const [payModal, setPayModal] = useState(null);     // tenant for Payment modal (monthly tab)
  const [urlDraft, setUrlDraft] = useState(webAppUrl);
  const [newTenant, setNewTenant] = useState({ name: '', contact: '', deposit: '', rent: '', dateJoining: '', dateLeaving: '', note: '' });
  const [pendingTab, setPendingTab] = useState('rent');

  const isAdmin = userRole === 'admin';
  const showToast = useCallback((msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }, []);
  const markSync = () => setLastSync(new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }));

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
      const merged = { ...pgData };
      Object.keys(res.data).forEach(pg => { if (res.data[pg]?.length > 0) merged[pg] = res.data[pg]; });
      setPgData(merged); markSync(); setSyncStatus('ok'); showToast('✅ Data updated!');
      setTimeout(() => setSyncStatus('idle'), 4000);
    } else { setSyncStatus('error'); showToast('❌ ' + (res.error || 'Pull failed'), 'error'); setTimeout(() => setSyncStatus('idle'), 5000); }
  };
  const doTest = async () => {
    if (!webAppUrl) { showToast('URL daalo pehle', 'warn'); return; }
    setSyncStatus('syncing');
    const res = await pingSheet(webAppUrl);
    if (res.success) { setSyncStatus('ok'); showToast('✅ Connected!'); setTimeout(() => setSyncStatus('idle'), 4000); }
    else { setSyncStatus('error'); showToast('❌ ' + res.error, 'error'); setTimeout(() => setSyncStatus('idle'), 5000); }
  };

  const tenants = pgData[selectedPG] || [];
  const allTenants = Object.values(pgData).flat();

  // FIX 5: Sort — new active on top, left on bottom
  const sortedTenants = [...tenants].sort((a, b) => {
    const aLeft = a.dateLeaving && new Date(a.dateLeaving) < new Date();
    const bLeft = b.dateLeaving && new Date(b.dateLeaving) < new Date();
    if (aLeft && !bLeft) return 1;
    if (!aLeft && bLeft) return -1;
    return new Date(b.dateJoining || 0) - new Date(a.dateJoining || 0);
  });
  const filteredTenants = sortedTenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || (t.contact || '').includes(search)
  );

  const active = tenants.filter(t => !t.dateLeaving || new Date(t.dateLeaving) >= new Date());
  const totalRent = active.reduce((s, t) => s + (parseFloat(t.rent) || 0), 0);
  const collected = tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const grandTotal = allTenants.reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
  const rentPending = active.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) < (parseFloat(t.rent) || 0));
  const depositPending = active.filter(t => !t.deposit || t.deposit === '' || t.deposit === '0');
  const halfPaid = active.filter(t => { const p = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0; const r = parseFloat(t.rent) || 0; return p > 0 && p < r; });

  const monthlyBar = MONTHS.map(m => ({ m, total: tenants.reduce((s, t) => s + (parseFloat(t.monthly?.[m]?.amount) || 0), 0) }));
  const barMax = Math.max(...monthlyBar.map(x => x.total), 1);
  const pgColor = PG_COLORS[selectedPG] || '#6366f1';
  const syncDot = { idle: '#475569', syncing: '#f59e0b', ok: '#22c55e', error: '#ef4444' }[syncStatus];

  async function saveInfo(updatedTenant) {
    const key = editKey(infoModal);
    const updated = pgData[selectedPG].map(t => editKey(t) === key ? updatedTenant : t);
    const newData = { ...pgData, [selectedPG]: updated };
    setPgData(newData); setInfoModal(null);
    await doPush(newData);
  }
  async function savePay(updatedTenant) {
    const key = editKey(payModal);
    const updated = pgData[selectedPG].map(t => editKey(t) === key ? updatedTenant : t);
    const newData = { ...pgData, [selectedPG]: updated };
    setPgData(newData); setPayModal(null);
    await doPush(newData);
  }
  function editKey(t) { return t.name + t.dateJoining; }

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
        {!isAdmin && <Pill c="#3b82f6" bg="#3b82f622">👁 View</Pill>}
        <div style={{ flex: 1 }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot, boxShadow: syncStatus !== 'idle' ? `0 0 8px ${syncDot}` : 'none' }} />
        {lastSync && <span style={{ fontSize: 9, color: '#475569' }}>{lastSync}</span>}
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
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 8, fontSize: 13 }}>🔗 Google Sheets Auto-Sync</div>
          <input value={urlDraft} onChange={e => setUrlDraft(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec"
            style={{ ...S.input, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => { setWebAppUrl(urlDraft); showToast('URL saved ✓'); setShowSettings(false); }} style={S.greenBtn}>💾 Save</button>
            <button onClick={doTest} style={S.blueBtn}>🔌 Test</button>
            <button onClick={doPull} style={S.ghostBtn}>⬇ Pull</button>
          </div>
        </div>
      )}

      {/* PG TABS */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 14px', background: '#0f1629', borderBottom: '1px solid #1e293b', scrollbarWidth: 'none' }}>
        {Object.keys(pgData).map(pg => {
          const pgC = (pgData[pg] || []).reduce((s, t) => s + (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0), 0);
          return (
            <button key={pg} onClick={() => setSelectedPG(pg)}
              style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', fontSize: 13, fontWeight: 700, background: selectedPG === pg ? PG_COLORS[pg] || '#6366f1' : '#111827', color: selectedPG === pg ? '#fff' : '#64748b', boxShadow: selectedPG === pg ? `0 0 10px ${PG_COLORS[pg]}55` : 'none', transition: 'all .15s' }}>
              {pg}{pgC > 0 && <span style={{ fontSize: 9, marginLeft: 5, opacity: 0.8 }}>₹{(pgC / 1000).toFixed(0)}k</span>}
            </button>
          );
        })}
      </div>

      {/* VIEW TABS */}
      <div style={{ display: 'flex', background: '#0a0f1e', borderBottom: '1px solid #1e293b', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          ['dashboard', '📊', 'Overview'],
          ['tenants', '👥', 'Tenants'],
          ['monthly', '📅', 'Monthly'],
          ['collection', '💰', 'Collection'], // FIX 1: New tab
        ].map(([v, ic, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: view === v ? pgColor : '#475569', borderBottom: `2px solid ${view === v ? pgColor : 'transparent'}`, whiteSpace: 'nowrap', transition: 'color .15s' }}>
            {ic} {lbl}
          </button>
        ))}
      </div>

      {/* FIX 1: Collection view rendered outside main */}
      {view === 'collection' && (
        <CollectionTab pgData={pgData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} pgColor={pgColor} />
      )}

      {/* MAIN */}
      {view !== 'collection' && (
        <main style={{ padding: '14px 14px 88px', maxWidth: 700, margin: '0 auto' }}>

          {/* ══ DASHBOARD ══ */}
          {view === 'dashboard' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />

            <div style={{ background: `linear-gradient(135deg,${pgColor}28,#111827)`, borderRadius: 16, padding: '16px 18px', border: `1px solid ${pgColor}44`, margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ALL PGs — {selectedMonth}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: pgColor }}>₹{fmtNum(grandTotal)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{selectedPG}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>₹{fmtNum(collected)}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>of ₹{fmtNum(totalRent)}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, background: '#0a0f1e', borderRadius: 6, height: 6 }}>
                <div style={{ height: '100%', background: pgColor, borderRadius: 6, width: `${Math.min(100, totalRent > 0 ? (collected / totalRent) * 100 : 0)}%`, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{totalRent > 0 ? `${Math.round((collected / totalRent) * 100)}% collected` : '—'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { ic: '👥', lbl: 'Active', val: active.length, c: pgColor },
                { ic: '📋', lbl: 'Expected', val: `₹${fmtNum(totalRent)}`, c: pgColor },
                { ic: '⏳', lbl: 'Rent Pending', val: rentPending.length, warn: rentPending.length > 0, sub: rentPending.length > 0 ? `${halfPaid.length} half paid` : '✅ All paid', click: 'rent' },
                { ic: '🔒', lbl: 'No Deposit', val: depositPending.length, warn: depositPending.length > 0, sub: depositPending.length > 0 ? depositPending[0]?.name : '✅ All ok', click: 'deposit' },
              ].map((s, i) => (
                <div key={i} onClick={() => s.click && setPendingTab(s.click)}
                  style={{ background: '#111827', borderRadius: 14, padding: '14px 12px', border: `1px solid ${s.warn ? '#ef444466' : '#1e293b'}`, boxShadow: s.warn ? '0 0 12px #ef444422' : 'none', cursor: s.click ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{s.ic}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.warn ? '#ef4444' : (s.c || '#f1f5f9') }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.lbl}</div>
                  {s.sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ background: '#111827', borderRadius: 14, padding: 14, border: '1px solid #1e293b', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>📈 {selectedPG} — Monthly Trend</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 72 }}>
                {monthlyBar.map(({ m, total }) => (
                  <div key={m} onClick={() => setSelectedMonth(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: Math.max(3, (total / barMax) * 60), background: m === selectedMonth ? pgColor : total > 0 ? '#334155' : '#1e293b', borderRadius: 3, transition: 'height .3s' }} />
                    <div style={{ fontSize: 8, color: m === selectedMonth ? pgColor : '#475569', fontWeight: m === selectedMonth ? 700 : 400 }}>{m.slice(0, 1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending section */}
            <div style={{ background: '#111827', borderRadius: 14, padding: 14, border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[['rent', '⏳ Rent'], ['deposit', '🔒 Deposit']].map(([t, lbl]) => (
                  <button key={t} onClick={() => setPendingTab(t)}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: pendingTab === t ? pgColor : '#0a0f1e', color: pendingTab === t ? '#fff' : '#64748b', transition: 'all .15s' }}>
                    {lbl} Pending
                  </button>
                ))}
              </div>

              {pendingTab === 'rent' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{selectedMonth} — {rentPending.length} pending</span>
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>₹{fmtNum(rentPending.reduce((s, t) => s + ((parseFloat(t.rent) || 0) - (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0)), 0))} due</span>
                </div>
                {rentPending.length === 0
                  ? <div style={{ color: '#22c55e', fontSize: 13, padding: '8px 0' }}>✅ Sab ne rent de diya!</div>
                  : rentPending.map(t => {
                    const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
                    const rent = parseFloat(t.rent) || 0;
                    return (
                      <div key={t.name}
                        // FIX 2: overview pending click = payment modal (admin only)
                        onClick={() => isAdmin && setPayModal(t)}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e293b', cursor: isAdmin ? 'pointer' : 'default' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(t.dateJoining)} • ₹{fmtNum(t.rent)}/mo</div>
                          {/* FIX 2: Call/WA on pending rows — from image 2 */}
                          {t.contact && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 5 }} onClick={e => e.stopPropagation()}>
                              <a href={`tel:${t.contact.replace(/\s/g, '')}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#22c55e18', border: '1px solid #22c55e33', color: '#22c55e', padding: '3px 9px', borderRadius: 16, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>📞 Call</a>
                              <a href={`https://wa.me/91${t.contact.replace(/\s/g, '')}?text=Namaste%20${encodeURIComponent(t.name)}!%20${encodeURIComponent(selectedMonth)}%20ka%20rent%20pending%20hai.%20Please%20jama%20karein.`}
                                target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#25d36618', border: '1px solid #25d36633', color: '#25d366', padding: '3px 9px', borderRadius: 16, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>💬 WA</a>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: paid > 0 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 12 }}>{paid > 0 ? `Half (₹${fmtNum(paid)})` : 'Not Paid'}</div>
                          <div style={{ fontSize: 11, color: '#ef4444' }}>₹{fmtNum(rent - paid)} due</div>
                        </div>
                      </div>
                    );
                  })
                }
              </>)}

              {pendingTab === 'deposit' && (<>
                <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: '#64748b' }}>{depositPending.length} tenants bina deposit ke</span></div>
                {depositPending.length === 0
                  ? <div style={{ color: '#22c55e', fontSize: 13, padding: '8px 0' }}>✅ Sab ne deposit de diya!</div>
                  : depositPending.map(t => (
                    <div key={t.name}
                      onClick={() => isAdmin && setInfoModal(t)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e293b', cursor: isAdmin ? 'pointer' : 'default' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(t.dateJoining)} • Rent ₹{fmtNum(t.rent)}</div>
                      </div>
                      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>No Deposit ⚠</div>
                    </div>
                  ))
                }
              </>)}
            </div>
          </>)}

          {/* ══ TENANTS ══ */}
          {view === 'tenants' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...S.input, flex: 1, padding: '9px 12px' }} />
              {/* FIX 6: Only admin can add tenant — viewer cannot */}
              {isAdmin && (
                <button onClick={() => setShowAddTenant(true)}
                  style={{ background: pgColor, border: 'none', color: '#fff', padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  + Add
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { lbl: 'Active', val: active.length, c: '#22c55e' },
                { lbl: 'Paid', val: active.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) >= (parseFloat(t.rent) || 1)).length, c: '#22c55e' },
                { lbl: 'Half', val: halfPaid.length, c: '#f59e0b' },
                { lbl: 'Unpaid', val: active.filter(t => !(parseFloat(t.monthly?.[selectedMonth]?.amount) || 0)).length, c: '#ef4444' },
                { lbl: 'No Dep', val: depositPending.length, c: '#f59e0b' },
              ].map(s => (
                <div key={s.lbl} style={{ background: '#111827', borderRadius: 10, padding: '7px 14px', border: `1px solid ${s.c}33`, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Add Tenant — admin only */}
            {showAddTenant && isAdmin && (
              <div style={{ background: '#111827', borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${pgColor}66` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>NEW TENANT — {selectedPG}</span>
                  <button onClick={() => setShowAddTenant(false)} style={{ ...S.ghostBtn, fontSize: 11 }}>Cancel</button>
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
                    style={{ background: pgColor, border: 'none', color: '#fff', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                    ✅ Add Tenant + Auto Sync
                  </button>
                </div>
              </div>
            )}

            {/* FIX 3+5: Tenant click = Info modal (admin only), viewer = no click */}
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
                  // FIX 3: tenant click = Info modal, admin only
                  onClick={() => isAdmin && !isLeft && setInfoModal(t)}
                  style={{ background: '#111827', borderRadius: 14, padding: '13px 14px', border: `1px solid ${rs !== 'full' && !isLeft ? rc + '55' : '#1e293b'}`, cursor: isAdmin && !isLeft ? 'pointer' : 'default', marginBottom: 8, opacity: isLeft ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: isLeft ? '#64748b' : '#f1f5f9' }}>{t.name}</span>
                        {isLeft && <Pill c="#64748b" bg="#33415522">Left</Pill>}
                        {!hasDeposit && !isLeft && <Pill c="#f59e0b" bg="#f59e0b22">No Dep</Pill>}
                        {rs === 'half' && !isLeft && <Pill c="#f59e0b" bg="#f59e0b22">Half</Pill>}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                        📅 {fmtDate(t.dateJoining)} {t.contact && `• 📞 ${t.contact}`}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Rent <b style={{ color: '#f1f5f9' }}>₹{fmtNum(t.rent)}</b></span>
                        {hasDeposit && <span style={{ fontSize: 11, color: '#94a3b8' }}>Dep <b style={{ color: '#f1f5f9' }}>₹{fmtNum(t.deposit)}</b></span>}
                      </div>
                      {/* FIX 6: Viewer sees call/wa but cannot edit */}
                      {t.contact && !isLeft && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                          <a href={`tel:${t.contact.replace(/\s/g, '')}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#22c55e18', border: '1px solid #22c55e33', color: '#22c55e', padding: '4px 10px', borderRadius: 20, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>📞 Call</a>
                          <a href={`https://wa.me/91${t.contact.replace(/\s/g, '')}?text=Namaste%20${encodeURIComponent(t.name)}!%20PG%20rent%20reminder%20-%20please%20clear%20dues.`}
                            target="_blank" rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#25d36618', border: '1px solid #25d36633', color: '#25d366', padding: '4px 10px', borderRadius: 20, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>💬 WA</a>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 10, flexShrink: 0 }}>
                      {!isLeft && <div style={{ color: rc, fontWeight: 700, fontSize: 13 }}>{rl}</div>}
                      {t.monthly?.[selectedMonth]?.collector && !isLeft && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{t.monthly[selectedMonth].collector}</div>}
                      {isLeft && <div style={{ fontSize: 10, color: '#64748b' }}>Left {fmtDate(t.dateLeaving)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTenants.length === 0 && <div style={{ textAlign: 'center', color: '#475569', padding: 32 }}>No tenants found</div>}
          </>)}

          {/* ══ MONTHLY ══ */}
          {view === 'monthly' && (<>
            <MonthBar sel={selectedMonth} setSel={setSelectedMonth} clr={pgColor} />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { lbl: 'Collected', val: `₹${fmtNum(collected)}`, c: pgColor },
                  { lbl: 'Remaining', val: `₹${fmtNum(Math.max(0, totalRent - collected))}`, c: '#ef4444' },
                  { lbl: 'Half Paid', val: halfPaid.length, c: '#f59e0b' },
                ].map(s => (
                  <div key={s.lbl} style={{ flex: 1, background: '#111827', borderRadius: 12, padding: 12, border: `1px solid ${s.c}44`, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{s.lbl}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#111827', borderRadius: 14, overflow: 'hidden', border: '1px solid #1e293b' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>{selectedPG} — {selectedMonth}</span>
                  <span style={{ color: pgColor, fontWeight: 700 }}>{active.filter(t => (parseFloat(t.monthly?.[selectedMonth]?.amount) || 0) >= (parseFloat(t.rent) || 1)).length}/{active.length} paid</span>
                </div>
                {active.map(t => {
                  const paid = parseFloat(t.monthly?.[selectedMonth]?.amount) || 0;
                  const rent = parseFloat(t.rent) || 0;
                  const sc = paid === 0 ? '#ef4444' : paid < rent ? '#f59e0b' : '#22c55e';
                  const sl = paid === 0 ? 'Not Paid' : paid < rent ? `₹${fmtNum(paid)} (Half)` : `✅ ₹${fmtNum(paid)}`;
                  return (
                    <div key={t.name}
                      // Monthly tab click = payment modal (admin only)
                      onClick={() => isAdmin && setPayModal(t)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid #0a0f1e', cursor: isAdmin ? 'pointer' : 'default' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>₹{fmtNum(t.rent)}/mo{t.monthly?.[selectedMonth]?.collector ? ` • ${t.monthly[selectedMonth].collector}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: sc, fontWeight: 700, fontSize: 13 }}>{sl}</div>
                        {paid > 0 && paid < rent && <div style={{ fontSize: 10, color: '#ef4444' }}>₹{fmtNum(rent - paid)} due</div>}
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
      {infoModal && (
        <TenantInfoModal
          tenant={infoModal}
          selectedPG={selectedPG}
          pgColor={pgColor}
          onClose={() => setInfoModal(null)}
          onSave={saveInfo}
        />
      )}
      {payModal && (
        <TenantPaymentModal
          tenant={payModal}
          selectedPG={selectedPG}
          pgColor={pgColor}
          onClose={() => setPayModal(null)}
          onSave={savePay}
        />
      )}

      <Toast toast={toast} />

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f1629', borderTop: '1px solid #1e293b', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[['dashboard', '📊', 'Overview'], ['tenants', '👥', 'Tenants'], ['monthly', '📅', 'Monthly'], ['collection', '💰', 'Collection']].map(([v, ic, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '10px 4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 20 }}>{ic}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: view === v ? pgColor : '#475569' }}>{lbl}</span>
            {view === v && <div style={{ width: 20, height: 2, background: pgColor, borderRadius: 2 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" },
  header: { background: '#0f1629', borderBottom: '1px solid #1e293b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 },
  logo: { fontSize: 16, fontWeight: 800, color: '#f8fafc' },
  hBtn: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  input: { width: '100%', background: '#0a0f1e', border: '1px solid #1e293b', color: '#e2e8f0', padding: '7px 10px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  label: { fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#111827', width: '100%', maxWidth: 640, borderRadius: '20px 20px 0 0', maxHeight: '94vh', overflowY: 'auto', padding: '16px 18px', boxShadow: '0 -8px 40px rgba(0,0,0,.6)' },
  ghostBtn: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  greenBtn: { background: '#22c55e', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  blueBtn: { background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  bigBtn: (bg, color = '#fff', pad = '13px 40px') => ({ background: bg, border: 'none', color, padding: pad, borderRadius: 14, cursor: 'pointer', fontWeight: 700, fontSize: 15, width: '100%', maxWidth: 280 }),
};
