import { useState, useCallback, useEffect } from 'react';
import { MONTHS, PG_COLORS, INITIAL_DATA } from './data.js';
import { useLocalStorage } from './useStorage.js';
import { pushToSheets, pullFromSheets, pingSheet } from './sync.js';

const COLLECTORS = ['Vishnu', 'Mahendra', 'Cash/other'];
const ADMIN_PASSWORD = 'admin123';
const COLLECTOR_COLORS = { Vishnu:'#06b6d4', Mahendra:'#a78bfa', 'Cash/other':'#fb923c' };

function emptyMonthly() {
  const obj = {};
  MONTHS.forEach(m => { obj[m] = { amount:'', halfFull:'', collector:'', note:'' }; });
  return obj;
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}); }
  catch { return d; }
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#050810;color:#e2e8f0;font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
select option{background:#0f172a;color:#e2e8f0;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0;}to{transform:translateY(0);opacity:1;}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
.fu{animation:fadeUp .35s cubic-bezier(.22,1,.36,1) both;}
.fi{animation:fadeIn .25s ease both;}
.su{animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;}
.ch{transition:transform .18s ease,box-shadow .18s ease;}
.ch:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.45);}
.bp:active{transform:scale(.95);opacity:.8;}
.bp{transition:transform .1s,opacity .1s;}
.row{transition:background .12s;}
.row:hover{background:rgba(255,255,255,.025);}
input:focus,select:focus{outline:none;border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,.14);}
.glow{background:linear-gradient(90deg,#fff 0%,#94a3b8 50%,#fff 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite;}
.mb{animation:fadeIn .2s ease;}
.mc{animation:slideUp .35s cubic-bezier(.22,1,.36,1);}
`;

function StyleInjector() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

function Inp({ label, value, onChange, type='text', placeholder='', disabled=false }) {
  return (
    <div>
      {label && <div style={{fontSize:10,color:'#64748b',marginBottom:3,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</div>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{width:'100%',background:'#070d1a',border:'1px solid #1e2d45',color:'#e2e8f0',padding:'7px 10px',borderRadius:8,fontSize:13,boxSizing:'border-box',fontFamily:'Outfit,sans-serif',opacity:disabled?.5:1,cursor:disabled?'not-allowed':'text',transition:'border .2s'}}/>
    </div>
  );
}
function Sel({ label, value, onChange, options, disabled=false }) {
  return (
    <div>
      {label && <div style={{fontSize:10,color:'#64748b',marginBottom:3,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</div>}
      <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}
        style={{width:'100%',background:'#070d1a',border:'1px solid #1e2d45',color:value?'#e2e8f0':'#64748b',padding:'7px 10px',borderRadius:8,fontSize:13,boxSizing:'border-box',fontFamily:'Outfit,sans-serif',opacity:disabled?.5:1,transition:'border .2s'}}>
        <option value="">—</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Toast({ toast }) {
  if (!toast) return null;
  const bg={error:'linear-gradient(135deg,#ef4444,#dc2626)',warn:'linear-gradient(135deg,#f59e0b,#d97706)',info:'linear-gradient(135deg,#3b82f6,#2563eb)',success:'linear-gradient(135deg,#22c55e,#16a34a)'}[toast.type]||'linear-gradient(135deg,#22c55e,#16a34a)';
  return <div className="fu" style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:bg,color:'white',padding:'11px 24px',borderRadius:28,fontWeight:600,fontSize:13,zIndex:600,boxShadow:'0 8px 32px rgba(0,0,0,.5)',whiteSpace:'nowrap',pointerEvents:'none',fontFamily:'Outfit,sans-serif'}}>{toast.msg}</div>;
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  function handleAdmin() {
    if (pw === ADMIN_PASSWORD) { onLogin('admin'); }
    else { setErr('Wrong password!'); setTimeout(()=>setErr(''),1500); }
  }
  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 50% 0%,#0f2040 0%,#050810 60%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'Outfit,sans-serif'}}>
      <div style={{position:'fixed',inset:0,backgroundImage:'radial-gradient(circle at 20% 80%,#1e3a5f22 0%,transparent 50%),radial-gradient(circle at 80% 20%,#0e4d3322 0%,transparent 50%)',pointerEvents:'none'}}/>
      <div className="fu" style={{textAlign:'center',position:'relative',zIndex:1,width:'100%',maxWidth:340}}>
        <div style={{fontSize:52,marginBottom:10,filter:'drop-shadow(0 0 20px rgba(56,189,248,.3))'}}>🏠</div>
        <div className="glow" style={{fontSize:28,fontWeight:900,marginBottom:4}}>PG Manager</div>
        <div style={{fontSize:13,color:'#475569',marginBottom:36}}>Apna role chuniye</div>
        {!mode ? (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <button className="bp ch" onClick={()=>setMode('admin')} style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',color:'#fff',padding:'14px 32px',borderRadius:14,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif',boxShadow:'0 4px 20px rgba(99,102,241,.4)'}}>🔐 Admin Login</button>
            <button className="bp ch" onClick={()=>onLogin('viewer')} style={{background:'#111827',border:'1px solid #1e2d45',color:'#94a3b8',padding:'14px 32px',borderRadius:14,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>👁 Viewer Mode</button>
          </div>
        ) : (
          <div className="fi" style={{display:'flex',flexDirection:'column',gap:12}}>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdmin()} placeholder="Password daalo…" autoFocus
              style={{background:'#0a0f1e',border:`1px solid ${err?'#ef4444':'#1e2d45'}`,color:'#e2e8f0',padding:'13px 18px',borderRadius:12,fontSize:15,textAlign:'center',fontFamily:'Outfit,sans-serif',outline:'none',transition:'border .2s'}}/>
            {err && <div style={{color:'#ef4444',fontSize:13,fontWeight:600}}>{err}</div>}
            <div style={{display:'flex',gap:8}}>
              <button className="bp ch" onClick={handleAdmin} style={{flex:1,background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',color:'#fff',padding:'12px',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Login</button>
              <button className="bp" onClick={()=>{setMode(null);setPw('');}} style={{background:'#111827',border:'1px solid #1e2d45',color:'#64748b',padding:'12px 16px',borderRadius:12,fontSize:14,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>←</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [pgData,setPgData] = useLocalStorage('pgData',INITIAL_DATA);
  const [webAppUrl,setWebAppUrl] = useLocalStorage('webAppUrl','');
  const [lastSync,setLastSync] = useLocalStorage('lastSync','');
  const [userRole,setUserRole] = useLocalStorage('userRole',null);

  const [selectedPG,setSelectedPG] = useState(Object.keys(pgData)[0]);
  const [selectedMonth,setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [view,setView] = useState('overview');
  const [activePGDetail,setActivePGDetail] = useState(null);
  const [search,setSearch] = useState('');
  const [toast,setToast] = useState(null);
  const [syncStatus,setSyncStatus] = useState('idle');
  const [showSettings,setShowSettings] = useState(false);
  const [showAddTenant,setShowAddTenant] = useState(false);
  const [editingTenant,setEditingTenant] = useState(null);
  const [editForm,setEditForm] = useState({});
  const [editMonthly,setEditMonthly] = useState({});
  const [newTenant,setNewTenant] = useState({name:'',contact:'',deposit:'',rent:'',dateJoining:'',dateLeaving:'',note:''});
  const [urlDraft,setUrlDraft] = useState(webAppUrl);
  const isAdmin = userRole==='admin';

  const showToast = useCallback((msg,type='success')=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); },[]);
  const markSync = () => { const n=new Date().toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}); setLastSync(n); };

  const doPush = async (data,silent=false) => {
    if (!webAppUrl){if(!silent)showToast('Web App URL daalo','warn');return false;}
    setSyncStatus('syncing');
    const res = await pushToSheets(webAppUrl,data);
    if (res.success){markSync();setSyncStatus('ok');if(!silent)showToast('✅ Sheet update ho gaya!');setTimeout(()=>setSyncStatus('idle'),3000);return true;}
    else{setSyncStatus('error');if(!silent)showToast('Sync failed: '+res.error,'error');setTimeout(()=>setSyncStatus('idle'),4000);return false;}
  };
  const doPull = async () => {
    if(!webAppUrl){showToast('Web App URL daalo','warn');return;}
    setSyncStatus('syncing');showToast('Sheet se data la raha hoon…','info');
    const res = await pullFromSheets(webAppUrl);
    if(res.success&&res.data){const m={...pgData};Object.keys(res.data).forEach(pg=>{if(res.data[pg]?.length>0)m[pg]=res.data[pg];});setPgData(m);markSync();setSyncStatus('ok');showToast('✅ Latest data aa gaya!');setTimeout(()=>setSyncStatus('idle'),3000);}
    else{setSyncStatus('error');showToast('Pull failed: '+(res.error||'?'),'error');setTimeout(()=>setSyncStatus('idle'),4000);}
  };
  const doTest = async () => {
    if(!webAppUrl){showToast('Pehle URL daalo','warn');return;}
    setSyncStatus('syncing');
    const res=await pingSheet(webAppUrl);
    if(res.success){setSyncStatus('ok');showToast('✅ Connected!');setTimeout(()=>setSyncStatus('idle'),3000);}
    else{setSyncStatus('error');showToast('❌ '+res.error,'error');setTimeout(()=>setSyncStatus('idle'),4000);}
  };

  const allPGs = Object.keys(pgData);
  const tenants = pgData[selectedPG]||[];
  const filtered = tenants.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())||t.contact?.includes(search));
  const active = tenants.filter(t=>!t.dateLeaving||new Date(t.dateLeaving)>=new Date());
  const collected = tenants.reduce((s,t)=>s+(parseFloat(t.monthly?.[selectedMonth]?.amount)||0),0);
  const allTenants = Object.values(pgData).flat();
  const grandTotal = allTenants.reduce((s,t)=>s+(parseFloat(t.monthly?.[selectedMonth]?.amount)||0),0);
  const grandActive = allTenants.filter(t=>!t.dateLeaving||new Date(t.dateLeaving)>=new Date());
  const grandPending = grandActive.filter(t=>(parseFloat(t.monthly?.[selectedMonth]?.amount)||0)<(parseFloat(t.rent)||0)).length;

  const pgStats = allPGs.map(pg=>{
    const ts=pgData[pg]||[];
    const act=ts.filter(t=>!t.dateLeaving||new Date(t.dateLeaving)>=new Date());
    const col=ts.reduce((s,t)=>s+(parseFloat(t.monthly?.[selectedMonth]?.amount)||0),0);
    const pend=act.filter(t=>(parseFloat(t.monthly?.[selectedMonth]?.amount)||0)<(parseFloat(t.rent)||0)).length;
    return {pg,col,pend,active:act.length,color:PG_COLORS[pg]||'#6366f1'};
  });

  // Collectors: rent received per month per collector (all PGs)
  const collectorStats = (() => {
    const s={};
    COLLECTORS.forEach(c=>{s[c]={months:{}};MONTHS.forEach(m=>{s[c].months[m]=0;});});
    allTenants.forEach(t=>{
      MONTHS.forEach(m=>{
        const md=t.monthly?.[m];
        if(!md?.collector||!md?.amount)return;
        const amt=parseFloat(md.amount)||0;
        const k=md.collector;
        if(!s[k]){s[k]={months:{}};MONTHS.forEach(mm=>{s[k].months[mm]=0;});}
        s[k].months[m]=(s[k].months[m]||0)+amt;
      });
    });
    return s;
  })();

  const pgColor = PG_COLORS[selectedPG]||'#6366f1';
  const syncDot = {idle:'#334155',syncing:'#f59e0b',ok:'#22c55e',error:'#ef4444'}[syncStatus];

  function getRentStatus(t,month){
    const paid=parseFloat(t.monthly?.[month]?.amount)||0;
    const rent=parseFloat(t.rent)||0;
    const hf=t.monthly?.[month]?.halfFull||'';
    if(paid===0)return{label:'Not Paid',color:'#ef4444',bg:'#ef444418',isPending:true};
    if(paid<rent||hf==='Half')return{label:`Half Paid ₹${paid.toLocaleString()}`,color:'#f59e0b',bg:'#f59e0b18',isPending:true};
    return{label:`₹${paid.toLocaleString()}`,color:'#22c55e',bg:'#22c55e18',isPending:false};
  }

  function openEdit(tenant){ if(!isAdmin&&view!=='tenants'&&view!=='pg_detail')return; setEditingTenant(tenant);setEditForm({...tenant});setEditMonthly(JSON.parse(JSON.stringify(tenant.monthly||emptyMonthly()))); }

  async function saveEdit(){
    const pg=activePGDetail||selectedPG;
    const key=editingTenant.name+editingTenant.dateJoining;
    const updated=pgData[pg].map(t=>(t.name+t.dateJoining)===key?{...editForm,monthly:editMonthly}:t);
    const nd={...pgData,[pg]:updated};
    setPgData(nd);setEditingTenant(null);showToast('Saving…','info');await doPush(nd);
  }
  async function addTenant(){
    if(!newTenant.name.trim())return showToast('Naam zaroor daalo','error');
    const tenant={...newTenant,monthly:emptyMonthly()};
    const nd={...pgData,[selectedPG]:[...(pgData[selectedPG]||[]),tenant]};
    setPgData(nd);setNewTenant({name:'',contact:'',deposit:'',rent:'',dateJoining:'',dateLeaving:'',note:''});
    setShowAddTenant(false);showToast('Tenant add ho gaya!','success');await doPush(nd);
  }
  function doCall(contact,e){ e.stopPropagation();if(!contact)return showToast('Contact nahi hai','warn');window.open(`tel:${contact.replace(/\s/g,'')}`);}
  function doWhatsApp(contact,name,e){
    e.stopPropagation();if(!contact)return showToast('Contact nahi hai','warn');
    const num=contact.replace(/\s/g,'');
    const msg=encodeURIComponent(`Namaste ${name}! 🏠 PG rent reminder — is month ka rent jama karein. Dhanyawad!`);
    window.open(`https://wa.me/91${num}?text=${msg}`,'_blank');
  }

  if(!userRole)return(<><StyleInjector/><LoginScreen onLogin={r=>setUserRole(r)}/></>);

  // ── Edit Modal ─────────────────────────────────────────────
  function EditModal(){
    if(!editingTenant)return null;
    const pg=activePGDetail||selectedPG;
    const pgC=PG_COLORS[pg]||'#6366f1';
    return(
      <div className="mb" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setEditingTenant(null);}}>
        <div className="mc" style={{background:'linear-gradient(180deg,#0d1626,#070d1a)',width:'100%',maxWidth:620,borderRadius:'20px 20px 0 0',maxHeight:'92vh',overflowY:'auto',padding:'20px 18px 32px',border:'1px solid #1e2d45',borderBottom:'none'}}>
          <div style={{width:36,height:4,background:'#1e2d45',borderRadius:4,margin:'0 auto 18px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
            <div>
              <div style={{fontWeight:800,fontSize:20}}>{editingTenant.name}</div>
              <div style={{fontSize:11,color:'#475569',marginTop:2}}>Joined: {fmtDate(editingTenant.dateJoining)} • {pg}</div>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {!isAdmin&&<span style={{fontSize:9,background:'#3b82f622',color:'#3b82f6',padding:'3px 8px',borderRadius:20,border:'1px solid #3b82f633',fontWeight:700}}>👁 VIEW</span>}
              {editForm.contact&&<><button className="bp" onClick={e=>doCall(editForm.contact,e)} style={{background:'#22c55e18',border:'1px solid #22c55e33',color:'#22c55e',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:13}}>📞</button><button className="bp" onClick={e=>doWhatsApp(editForm.contact,editingTenant.name,e)} style={{background:'#25d36618',border:'1px solid #25d36633',color:'#25d366',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:13}}>💬</button></>}
              <button className="bp" onClick={()=>setEditingTenant(null)} style={{background:'#1e2d45',border:'1px solid #334155',color:'#94a3b8',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:13}}>✕</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            <Inp label="Contact" value={editForm.contact||''} onChange={v=>setEditForm(p=>({...p,contact:v}))} disabled={!isAdmin}/>
            <Inp label="Deposit ₹" value={editForm.deposit||''} onChange={v=>setEditForm(p=>({...p,deposit:v}))} disabled={!isAdmin}/>
            <Inp label="Rent ₹/mo" value={editForm.rent||''} onChange={v=>setEditForm(p=>({...p,rent:v}))} disabled={!isAdmin}/>
            <Inp label="Note" value={editForm.note||''} onChange={v=>setEditForm(p=>({...p,note:v}))} disabled={!isAdmin}/>
            <Inp label="Joining" type="date" value={editForm.dateJoining||''} onChange={v=>setEditForm(p=>({...p,dateJoining:v}))} disabled={!isAdmin}/>
            <Inp label="Leaving" type="date" value={editForm.dateLeaving||''} onChange={v=>setEditForm(p=>({...p,dateLeaving:v}))} disabled={!isAdmin}/>
          </div>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.08em',margin:'16px 0 8px'}}>MONTHLY PAYMENTS</div>
          {MONTHS.map(m=>{
            const md=editMonthly[m]||{amount:'',halfFull:'',collector:'',note:''};
            const set=(f,v)=>setEditMonthly(p=>({...p,[m]:{...md,[f]:v}}));
            const paid=parseFloat(md.amount)||0;const rent=parseFloat(editForm.rent)||0;
            const ac=paid===0?'#1e2d45':paid<rent?'#f59e0b':pgC;
            return(
              <div key={m} style={{marginBottom:8,background:'#070d1a',borderRadius:10,padding:'10px 12px',border:`1px solid ${paid>0?ac+'55':'#1e2d45'}`,transition:'border .2s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:13,color:paid>0?ac:'#475569'}}>{m}</div>
                  {paid>0&&<div style={{fontSize:10,color:paid<rent?'#f59e0b':'#22c55e',fontWeight:700,background:(paid<rent?'#f59e0b':'#22c55e')+'18',padding:'2px 8px',borderRadius:20}}>{paid<rent?'Half':'Full'} • ₹{paid.toLocaleString()}</div>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                  <Inp label="₹ Amount" value={md.amount} onChange={v=>set('amount',v)} disabled={!isAdmin}/>
                  <Sel label="Half/Full" value={md.halfFull} onChange={v=>set('halfFull',v)} options={['Full','Half']} disabled={!isAdmin}/>
                  <Sel label="Collector" value={md.collector} onChange={v=>set('collector',v)} options={COLLECTORS} disabled={!isAdmin}/>
                  <Inp label="Note" value={md.note} onChange={v=>set('note',v)} disabled={!isAdmin}/>
                </div>
              </div>
            );
          })}
          <div style={{display:'flex',gap:8,marginTop:18}}>
            {isAdmin
              ?<button className="bp ch" onClick={saveEdit} style={{flex:1,background:`linear-gradient(135deg,${pgC},${pgC}cc)`,border:'none',color:'#fff',padding:'13px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:15,fontFamily:'Outfit,sans-serif',boxShadow:`0 4px 20px ${pgC}44`}}>💾 Save + Sync</button>
              :<div style={{flex:1,textAlign:'center',fontSize:13,color:'#475569',padding:'13px',background:'#070d1a',borderRadius:12}}>👁 Viewer — edit allowed nahi</div>}
            <button className="bp" onClick={()=>setEditingTenant(null)} style={{background:'#111827',border:'1px solid #1e2d45',color:'#64748b',padding:'13px 16px',borderRadius:12,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── PG Detail ───────────────────────────────────────────────
  if(view==='pg_detail'&&activePGDetail){
    const pgTs=pgData[activePGDetail]||[];
    const dc=PG_COLORS[activePGDetail]||'#6366f1';
    const pgAct=pgTs.filter(t=>!t.dateLeaving||new Date(t.dateLeaving)>=new Date());
    const pgCol=pgTs.reduce((s,t)=>s+(parseFloat(t.monthly?.[selectedMonth]?.amount)||0),0);
    return(<>
      <StyleInjector/>
      <div style={{minHeight:'100vh',background:'#050810',fontFamily:'Outfit,sans-serif'}}>
        <div style={{background:`linear-gradient(135deg,${dc}22,#0d1626)`,borderBottom:'1px solid #1e2d45',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,position:'sticky',top:0,zIndex:100,backdropFilter:'blur(12px)'}}>
          <button className="bp" onClick={()=>{setView('overview');setActivePGDetail(null);}} style={{background:'#111827',border:'1px solid #1e2d45',color:'#94a3b8',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'Outfit,sans-serif'}}>← Back</button>
          <div style={{width:9,height:9,borderRadius:'50%',background:dc,boxShadow:`0 0 10px ${dc}`}}/>
          <span style={{fontSize:18,fontWeight:800,color:dc}}>{activePGDetail}</span>
          <div style={{flex:1}}/>
          {isAdmin&&<button className="bp ch" onClick={()=>{setSelectedPG(activePGDetail);setShowAddTenant(true);setView('tenants');}} style={{background:`linear-gradient(135deg,${dc},${dc}aa)`,border:'none',color:'#fff',padding:'7px 14px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'Outfit,sans-serif'}}>+ Add Tenant</button>}
        </div>
        <div style={{padding:'8px 14px',display:'flex',gap:5,overflowX:'auto',background:'#0a0f1e',borderBottom:'1px solid #1e2d45'}}>
          {MONTHS.map(m=>(
            <button key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${selectedMonth===m?'transparent':'#1e2d45'}`,background:selectedMonth===m?dc:'#111827',color:selectedMonth===m?'#fff':'#64748b',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',transition:'all .18s'}}>
              {m.slice(0,3)}
            </button>
          ))}
        </div>
        <div style={{padding:'14px 16px',maxWidth:900,margin:'0 auto'}}>
          <div className="fu" style={{background:`linear-gradient(135deg,${dc}18,#0d1626)`,border:`1px solid ${dc}33`,borderRadius:16,padding:'16px 20px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.06em'}}>{selectedMonth.toUpperCase()} COLLECTION</div><div style={{fontSize:30,fontWeight:900,color:dc,fontFamily:'JetBrains Mono,monospace'}}>₹{pgCol.toLocaleString()}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:10,color:'#475569',fontWeight:600}}>ACTIVE</div><div style={{fontSize:24,fontWeight:800}}>{pgAct.length}</div></div>
          </div>
          {pgTs.map((t,i)=>{
            const isActive=!t.dateLeaving||new Date(t.dateLeaving)>=new Date();
            const status=getRentStatus(t,selectedMonth);
            return(
              <div key={t.name+t.dateJoining} className="ch fu row" onClick={()=>{setSelectedPG(activePGDetail);openEdit(t);}} style={{background:'linear-gradient(135deg,#0d1626,#0a0f1e)',borderRadius:14,padding:'14px 16px',border:`1px solid ${status.isPending&&isActive?'#ef444422':'#1e2d45'}`,cursor:isAdmin?'pointer':'default',marginBottom:8,animationDelay:`${i*40}ms`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16,color:isActive?'#f1f5f9':'#475569'}}>{t.name}{!isActive&&<span style={{fontSize:9,background:'#334155',color:'#64748b',padding:'2px 6px',borderRadius:20,marginLeft:6}}>Left</span>}</div>
                    <div style={{fontSize:11,color:'#475569',marginTop:3}}>Joined: {fmtDate(t.dateJoining)} • ₹{t.rent||'—'}/mo {t.deposit&&`• Dep: ₹${t.deposit}`}</div>
                    {t.contact&&<div style={{display:'flex',gap:6,marginTop:8}}>
                      <button className="bp" onClick={e=>doCall(t.contact,e)} style={{background:'#22c55e18',border:'1px solid #22c55e33',color:'#22c55e',padding:'4px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif'}}>📞 Call</button>
                      <button className="bp" onClick={e=>doWhatsApp(t.contact,t.name,e)} style={{background:'#25d36618',border:'1px solid #25d36633',color:'#25d366',padding:'4px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif'}}>💬 WhatsApp</button>
                    </div>}
                  </div>
                  <div style={{textAlign:'right',marginLeft:12}}>
                    <div style={{fontWeight:700,fontSize:12,color:status.color,background:status.bg,padding:'4px 10px',borderRadius:20}}>{status.label}</div>
                    {t.monthly?.[selectedMonth]?.collector&&<div style={{fontSize:10,color:'#475569',marginTop:4}}>{t.monthly[selectedMonth].collector}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <EditModal/><Toast toast={toast}/>
    </>);
  }

  // ── Main Layout ────────────────────────────────────────────
  return(<>
    <StyleInjector/>
    <div style={{minHeight:'100vh',background:'#050810',fontFamily:'Outfit,sans-serif'}}>

      {/* Header */}
      <header style={{background:'linear-gradient(135deg,#0d1626dd,#050810dd)',borderBottom:'1px solid #1e2d45',padding:'11px 16px',display:'flex',alignItems:'center',gap:8,position:'sticky',top:0,zIndex:100,backdropFilter:'blur(16px)'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:'#38bdf8',boxShadow:'0 0 10px #38bdf8',marginRight:2}}/>
        <span style={{fontSize:16,fontWeight:800,color:'#f8fafc'}}>PG Manager</span>
        {!isAdmin&&<span style={{fontSize:9,background:'#3b82f618',color:'#3b82f6',padding:'2px 8px',borderRadius:20,border:'1px solid #3b82f633',fontWeight:700}}>VIEWER</span>}
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:syncDot,boxShadow:`0 0 6px ${syncDot}`,animation:syncStatus==='syncing'?'pulse 1s infinite':'none'}}/>
          {lastSync&&<span style={{fontSize:9,color:'#334155'}}>{lastSync}</span>}
        </div>
        {isAdmin&&<button className="bp" onClick={doPull} style={Sbtn}>⬇</button>}
        {isAdmin&&<button className="bp" onClick={()=>doPush(pgData)} style={Sbtn}>⬆</button>}
        {isAdmin&&<button className="bp" onClick={()=>setShowSettings(s=>!s)} style={Sbtn}>⚙</button>}
        <button className="bp" onClick={()=>setUserRole(null)} style={{...Sbtn,color:'#ef444499',borderColor:'#ef444422'}}>Exit</button>
      </header>

      {/* Settings */}
      {showSettings&&isAdmin&&(
        <div className="fi" style={{background:'#0a0f1e',borderBottom:'1px solid #1e2d45',padding:16}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:10,color:'#64748b',letterSpacing:'.06em'}}>🔗 GOOGLE SHEETS SYNC</div>
          <input value={urlDraft} onChange={e=>setUrlDraft(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec"
            style={{width:'100%',background:'#070d1a',border:'1px solid #1e2d45',color:'#e2e8f0',padding:'8px 12px',borderRadius:10,fontSize:12,marginBottom:10,fontFamily:'JetBrains Mono,monospace',outline:'none',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:8}}>
            <button className="bp" onClick={()=>{setWebAppUrl(urlDraft);showToast('Saved ✓');setShowSettings(false);}} style={{background:'linear-gradient(135deg,#22c55e,#16a34a)',border:'none',color:'#fff',padding:'7px 16px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'Outfit,sans-serif'}}>Save</button>
            <button className="bp" onClick={doTest} style={{background:'linear-gradient(135deg,#3b82f6,#2563eb)',border:'none',color:'#fff',padding:'7px 16px',borderRadius:8,cursor:'pointer',fontSize:12,fontFamily:'Outfit,sans-serif'}}>Test Connection</button>
          </div>
        </div>
      )}

      {/* PG Pills */}
      <div style={{padding:'10px 14px',display:'flex',gap:6,overflowX:'auto',background:'#0a0f1e',borderBottom:'1px solid #1e2d45'}}>
        {allPGs.map(pg=>{
          const c=PG_COLORS[pg]||'#6366f1';const isSel=selectedPG===pg;
          return(<button key={pg} className="bp" onClick={()=>{setSelectedPG(pg);setActivePGDetail(pg);setView('pg_detail');}} style={{padding:'6px 16px',borderRadius:22,cursor:'pointer',whiteSpace:'nowrap',fontSize:14,fontWeight:700,fontFamily:'Outfit,sans-serif',background:isSel?c:'#111827',color:isSel?'#fff':'#64748b',border:`1px solid ${isSel?'transparent':'#1e2d45'}`,boxShadow:isSel?`0 4px 16px ${c}44`:'none',transition:'all .2s'}}>
            {pg}
          </button>);
        })}
      </div>

      {/* View Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid #1e2d45',background:'#070d1a',overflowX:'auto'}}>
        {[['overview','🏠 Overview'],['tenants','👥 Tenants'],['monthly','📅 Monthly'],['collectors','💼 Collectors']].map(([v,label])=>(
          <button key={v} className="bp" onClick={()=>setView(v)} style={{padding:'10px 16px',border:'none',background:'transparent',color:view===v?pgColor:'#475569',borderBottom:`2px solid ${view===v?pgColor:'transparent'}`,cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap',fontFamily:'Outfit,sans-serif',transition:'color .2s,border-color .2s'}}>{label}</button>
        ))}
      </div>

      <main style={{padding:'16px',maxWidth:900,margin:'0 auto'}}>

        {/* ══ OVERVIEW ══ */}
        {view==='overview'&&(<>
          <div style={{display:'flex',gap:5,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
            {MONTHS.map(m=>(
              <button key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${selectedMonth===m?'transparent':'#1e2d45'}`,background:selectedMonth===m?pgColor:'#111827',color:selectedMonth===m?'#fff':'#64748b',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',transition:'all .18s'}}>
                {m.slice(0,3)}
              </button>
            ))}
          </div>
          {/* Grand banner */}
          <div className="fu" style={{background:'linear-gradient(135deg,#0d2040,#0a0f1e)',border:'1px solid #1e3a5f',borderRadius:20,padding:'20px 24px',marginBottom:16,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:130,height:130,borderRadius:'50%',background:'radial-gradient(circle,#38bdf822,transparent)',pointerEvents:'none'}}/>
            <div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.1em',marginBottom:4}}>TOTAL COLLECTION — {selectedMonth.toUpperCase()}</div>
            <div style={{fontSize:36,fontWeight:900,color:'#38bdf8',fontFamily:'JetBrains Mono,monospace',letterSpacing:'-.03em'}}>₹{grandTotal.toLocaleString()}</div>
            <div style={{display:'flex',gap:24,marginTop:12}}>
              <div><div style={{fontSize:10,color:'#475569',fontWeight:600}}>ACTIVE</div><div style={{fontSize:20,fontWeight:800}}>{grandActive.length}</div></div>
              <div><div style={{fontSize:10,color:'#475569',fontWeight:600}}>PENDING</div><div style={{fontSize:20,fontWeight:800,color:grandPending?'#ef4444':'#22c55e'}}>{grandPending}</div></div>
              <div><div style={{fontSize:10,color:'#475569',fontWeight:600}}>PGs</div><div style={{fontSize:20,fontWeight:800}}>{allPGs.length}</div></div>
            </div>
          </div>
          {/* PG breakdown */}
          <div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.08em',marginBottom:10}}>PG-WISE BREAKDOWN</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:10,marginBottom:16}}>
            {pgStats.map(({pg,col,pend,active:act,color},i)=>(
              <div key={pg} className="ch fu bp" style={{animationDelay:`${i*50}ms`,borderRadius:14,border:`1px solid ${pend?'#ef444422':'#1e2d45'}`,cursor:'pointer',padding:'14px',background:'linear-gradient(135deg,#0d1626,#0a0f1e)',position:'relative',overflow:'hidden'}} onClick={()=>{setSelectedPG(pg);setActivePGDetail(pg);setView('pg_detail');}}>
                <div style={{position:'absolute',top:0,right:0,width:50,height:50,background:`radial-gradient(circle at top right,${color}22,transparent)`,borderRadius:'0 14px 0 0'}}/>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:color,boxShadow:`0 0 8px ${color}`}}/>
                  {pend>0&&<div style={{fontSize:9,background:'#ef444418',color:'#ef4444',padding:'2px 6px',borderRadius:20,fontWeight:700}}>{pend} pending</div>}
                </div>
                <div style={{fontSize:14,fontWeight:800,color,marginBottom:2}}>{pg}</div>
                <div style={{fontSize:20,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:'#f1f5f9'}}>₹{col.toLocaleString()}</div>
                <div style={{fontSize:10,color:'#475569',marginTop:3}}>{act} tenants</div>
              </div>
            ))}
          </div>
          {/* All-PG bar chart */}
          <div className="fu" style={{background:'linear-gradient(135deg,#0d1626,#0a0f1e)',borderRadius:16,padding:'16px',border:'1px solid #1e2d45'}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:12,color:'#94a3b8'}}>📊 Monthly Collection — All PGs</div>
            <div style={{display:'flex',gap:4,alignItems:'flex-end',height:80}}>
              {MONTHS.map(m=>{
                const tot=allTenants.reduce((s,t)=>s+(parseFloat(t.monthly?.[m]?.amount)||0),0);
                const mx=Math.max(...MONTHS.map(mm=>allTenants.reduce((s,t)=>s+(parseFloat(t.monthly?.[mm]?.amount)||0),0)),1);
                const h=Math.max(4,(tot/mx)*68);
                return(<div key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer'}}>
                  <div style={{width:'100%',height:h,background:m===selectedMonth?`linear-gradient(180deg,${pgColor},${pgColor}66)`:'#1e2d45',borderRadius:'4px 4px 2px 2px',transition:'height .4s ease,background .2s'}}/>
                  <div style={{fontSize:8,color:m===selectedMonth?pgColor:'#334155',fontWeight:600}}>{m.slice(0,1)}</div>
                </div>);
              })}
            </div>
          </div>
        </>)}

        {/* ══ TENANTS ══ */}
        {view==='tenants'&&(<>
          <div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
            {MONTHS.map(m=>(
              <button key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${selectedMonth===m?'transparent':'#1e2d45'}`,background:selectedMonth===m?pgColor:'#111827',color:selectedMonth===m?'#fff':'#64748b',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',transition:'all .18s'}}>
                {m.slice(0,3)}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tenant…" style={{flex:1,background:'#070d1a',border:'1px solid #1e2d45',color:'#e2e8f0',padding:'8px 12px',borderRadius:10,fontSize:13,fontFamily:'Outfit,sans-serif',outline:'none'}}/>
            <select value={selectedPG} onChange={e=>setSelectedPG(e.target.value)} style={{background:'#070d1a',border:'1px solid #1e2d45',color:'#94a3b8',padding:'8px 10px',borderRadius:10,fontSize:12,fontFamily:'Outfit,sans-serif',cursor:'pointer',outline:'none'}}>
              {allPGs.map(pg=><option key={pg} value={pg}>{pg}</option>)}
            </select>
            {isAdmin&&<button className="bp ch" onClick={()=>setShowAddTenant(s=>!s)} style={{background:`linear-gradient(135deg,${pgColor},${pgColor}aa)`,border:'none',color:'#fff',padding:'8px 14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',boxShadow:`0 4px 16px ${pgColor}33`}}>+ Add</button>}
          </div>
          {/* Add tenant form */}
          {showAddTenant&&isAdmin&&(
            <div className="fu" style={{background:'linear-gradient(135deg,#0d1626,#070d1a)',borderRadius:16,padding:16,marginBottom:14,border:`1px solid ${pgColor}44`}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'.06em',marginBottom:12}}>NEW TENANT — {selectedPG}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <Inp label="Naam*" value={newTenant.name} onChange={v=>setNewTenant(p=>({...p,name:v}))}/>
                <Inp label="Contact" value={newTenant.contact} onChange={v=>setNewTenant(p=>({...p,contact:v}))}/>
                <Inp label="Deposit ₹" value={newTenant.deposit} onChange={v=>setNewTenant(p=>({...p,deposit:v}))}/>
                <Inp label="Rent ₹/mo" value={newTenant.rent} onChange={v=>setNewTenant(p=>({...p,rent:v}))}/>
                <Inp label="Joining Date" type="date" value={newTenant.dateJoining} onChange={v=>setNewTenant(p=>({...p,dateJoining:v}))}/>
                <Inp label="Leaving Date" type="date" value={newTenant.dateLeaving} onChange={v=>setNewTenant(p=>({...p,dateLeaving:v}))}/>
              </div>
              <Inp label="Note" value={newTenant.note} onChange={v=>setNewTenant(p=>({...p,note:v}))}/>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button className="bp ch" onClick={addTenant} style={{background:'linear-gradient(135deg,#22c55e,#16a34a)',border:'none',color:'#fff',padding:'9px 20px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'Outfit,sans-serif'}}>Add + Sync</button>
                <button className="bp" onClick={()=>setShowAddTenant(false)} style={{background:'#111827',border:'1px solid #1e2d45',color:'#64748b',padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map((t,i)=>{
              const isActive=!t.dateLeaving||new Date(t.dateLeaving)>=new Date();
              const status=getRentStatus(t,selectedMonth);
              const depMissing=!t.deposit||t.deposit===''||t.deposit==='0';
              return(
                <div key={t.name+t.dateJoining} className="ch fu row" onClick={()=>openEdit(t)} style={{background:'linear-gradient(135deg,#0d1626,#0a0f1e)',borderRadius:14,padding:'14px 16px',border:`1px solid ${status.isPending&&isActive?'#ef444422':'#1e2d45'}`,cursor:isAdmin?'pointer':'default',animationDelay:`${i*30}ms`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:isActive?'#f1f5f9':'#475569',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        {t.name}
                        {!isActive&&<span style={{fontSize:9,background:'#334155',color:'#64748b',padding:'2px 6px',borderRadius:20}}>Left</span>}
                        {depMissing&&isActive&&<span style={{fontSize:9,background:'#f59e0b18',color:'#f59e0b',padding:'2px 6px',borderRadius:20,border:'1px solid #f59e0b33'}}>No Deposit</span>}
                      </div>
                      <div style={{fontSize:11,color:'#475569',marginTop:3}}>Joined: {fmtDate(t.dateJoining)} • ₹{t.rent||'—'}/mo{t.deposit?` • Dep: ₹${t.deposit}`:''}</div>
                      {t.note&&<div style={{fontSize:11,color:'#64748b',fontStyle:'italic',marginTop:2}}>{t.note}</div>}
                      {t.contact&&<div style={{display:'flex',gap:6,marginTop:8}}>
                        <button className="bp" onClick={e=>doCall(t.contact,e)} style={{background:'#22c55e18',border:'1px solid #22c55e33',color:'#22c55e',padding:'4px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif'}}>📞 Call</button>
                        <button className="bp" onClick={e=>doWhatsApp(t.contact,t.name,e)} style={{background:'#25d36618',border:'1px solid #25d36633',color:'#25d366',padding:'4px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif'}}>💬 WhatsApp</button>
                      </div>}
                    </div>
                    <div style={{textAlign:'right',marginLeft:12}}>
                      <div style={{fontWeight:700,fontSize:12,color:status.color,background:status.bg,padding:'4px 10px',borderRadius:20}}>{status.label}</div>
                      {t.monthly?.[selectedMonth]?.collector&&<div style={{fontSize:10,color:'#475569',marginTop:4}}>{t.monthly[selectedMonth].collector}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ══ MONTHLY ══ */}
        {view==='monthly'&&(<>
          <div style={{display:'flex',gap:5,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
            {MONTHS.map(m=>(
              <button key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${selectedMonth===m?'transparent':'#1e2d45'}`,background:selectedMonth===m?pgColor:'#111827',color:selectedMonth===m?'#fff':'#64748b',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',transition:'all .18s'}}>
                {m}
              </button>
            ))}
          </div>
          <div style={{background:'linear-gradient(135deg,#0d1626,#0a0f1e)',borderRadius:16,border:'1px solid #1e2d45',overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid #1e2d45',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontWeight:800,fontSize:15}}>{selectedPG}</div><div style={{fontSize:11,color:'#475569',marginTop:1}}>{selectedMonth}</div></div>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:18,fontWeight:800,color:pgColor}}>₹{collected.toLocaleString()}</div>
            </div>
            {filtered.filter(t=>!t.dateLeaving||new Date(t.dateLeaving)>=new Date()).map(t=>{
              const status=getRentStatus(t,selectedMonth);
              return(<div key={t.name} className="row" onClick={()=>openEdit(t)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:'1px solid #0d1626',cursor:isAdmin?'pointer':'default'}}>
                <div><div style={{fontWeight:600,fontSize:14}}>{t.name}</div><div style={{fontSize:11,color:'#475569'}}>Rent: ₹{t.rent||'—'}</div></div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,fontSize:12,color:status.color,background:status.bg,padding:'3px 10px',borderRadius:20}}>{status.label}</div>
                  {t.monthly?.[selectedMonth]?.collector&&<div style={{fontSize:10,color:'#475569',marginTop:3}}>{t.monthly[selectedMonth].collector}</div>}
                </div>
              </div>);
            })}
          </div>
        </>)}

        {/* ══ COLLECTORS ══ */}
        {view==='collectors'&&(<>
          <div style={{display:'flex',gap:5,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
            {MONTHS.map(m=>(
              <button key={m} className="bp" onClick={()=>setSelectedMonth(m)} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${selectedMonth===m?'transparent':'#1e2d45'}`,background:selectedMonth===m?pgColor:'#111827',color:selectedMonth===m?'#fff':'#64748b',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Outfit,sans-serif',whiteSpace:'nowrap',transition:'all .18s'}}>
                {m.slice(0,3)}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.08em',marginBottom:10}}>RENT RECEIVED — {selectedMonth.toUpperCase()}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:20}}>
            {Object.entries(collectorStats).map(([collector,stats],i)=>{
              const c=COLLECTOR_COLORS[collector]||'#94a3b8';
              const monthAmt=stats.months[selectedMonth]||0;
              return(<div key={collector} className="fu ch" style={{borderRadius:16,border:`1px solid ${c}33`,background:`linear-gradient(135deg,${c}0e,#0d1626)`,padding:'16px',animationDelay:`${i*60}ms`,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:-20,right:-20,width:70,height:70,borderRadius:'50%',background:`radial-gradient(circle,${c}22,transparent)`}}/>
                <div style={{fontSize:10,color:c,fontWeight:700,letterSpacing:'.06em',marginBottom:6}}>{collector.toUpperCase()}</div>
                <div style={{fontSize:26,fontWeight:900,color:'#f1f5f9',fontFamily:'JetBrains Mono,monospace',letterSpacing:'-.02em'}}>₹{monthAmt.toLocaleString()}</div>
                <div style={{fontSize:10,color:'#475569',marginTop:4}}>Rent received</div>
              </div>);
            })}
          </div>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,letterSpacing:'.08em',marginBottom:10}}>MONTH-WISE BREAKDOWN</div>
          <div style={{background:'linear-gradient(135deg,#0d1626,#0a0f1e)',borderRadius:16,border:'1px solid #1e2d45',overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'Outfit,sans-serif'}}>
                <thead>
                  <tr style={{background:'#070d1a'}}>
                    <th style={{padding:'10px 16px',textAlign:'left',color:'#475569',fontWeight:700,fontSize:11,letterSpacing:'.05em'}}>MONTH</th>
                    {Object.keys(collectorStats).map(c=>(
                      <th key={c} style={{padding:'10px 16px',textAlign:'right',color:COLLECTOR_COLORS[c]||'#94a3b8',fontWeight:700,fontSize:11,letterSpacing:'.05em'}}>{c.toUpperCase()}</th>
                    ))}
                    <th style={{padding:'10px 16px',textAlign:'right',color:'#64748b',fontWeight:700,fontSize:11,letterSpacing:'.05em'}}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map(m=>{
                    const rowTotal=Object.values(collectorStats).reduce((s,st)=>s+(st.months[m]||0),0);
                    const isSel=m===selectedMonth;
                    return(<tr key={m} style={{borderTop:'1px solid #1e2d45',background:isSel?'#ffffff05':'transparent',cursor:'pointer',transition:'background .15s'}} onClick={()=>setSelectedMonth(m)}>
                      <td style={{padding:'10px 16px',color:isSel?pgColor:'#94a3b8',fontWeight:isSel?700:500}}>{m}</td>
                      {Object.entries(collectorStats).map(([c,st])=>(
                        <td key={c} style={{padding:'10px 16px',textAlign:'right',color:st.months[m]?'#f1f5f9':'#1e2d45',fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>
                          {st.months[m]?`₹${st.months[m].toLocaleString()}`:'—'}
                        </td>
                      ))}
                      <td style={{padding:'10px 16px',textAlign:'right',color:rowTotal?pgColor:'#1e2d45',fontWeight:800,fontFamily:'JetBrains Mono,monospace'}}>
                        {rowTotal?`₹${rowTotal.toLocaleString()}`:'—'}
                      </td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </main>
      <EditModal/>
      <Toast toast={toast}/>
    </div>
  </>);
}
const Sbtn={background:'#111827',border:'1px solid #1e2d45',color:'#64748b',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:12,fontFamily:'Outfit,sans-serif',transition:'all .2s'};
