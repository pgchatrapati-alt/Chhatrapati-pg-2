import { useState, useEffect, useRef } from 'react'

/* ── Unsplash fallback images ── */
const DEFAULT_IMGS = {
  room1: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80',
  room2: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80',
  room3: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=900&q=80',
  food1: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900&q=80',
  food2: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80',
  food3: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=900&q=80',
  kitchen:'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80',
  hero:   'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1600&q=80',
  outside:'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&q=80',
  common: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&q=80',
}

const ADMIN_PASS = 'pg2025'

const AMENITIES = [
  {icon:'🛏️',label:'Fully Furnished',desc:'Bed, mattress, pillow, wardrobe & personal locker'},
  {icon:'❄️',label:'Air Conditioning',desc:'All rooms fully air-conditioned'},
  {icon:'📶',label:'High-Speed WiFi',desc:'Seamless internet connectivity'},
  {icon:'🚿',label:'Geyser Attached',desc:'Hot water geyser in every washroom'},
  {icon:'🧊',label:'Refrigerator',desc:'Shared refrigerator access'},
  {icon:'💧',label:'24/7 Water & RO',desc:'RO filtered drinking water always'},
  {icon:'🫧',label:'Washing Machine',desc:'Washing machine connection provided'},
  {icon:'🔒',label:'CCTV Security',desc:'24-hour surveillance for your safety'},
  {icon:'🛡️',label:'Bed Linen',desc:'Fresh bed sheets & pillow covers provided'},
]

/* ── localStorage helpers ── */
function getLS(k,def){ try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch{return def;} }
function setLS(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch{} }

/* ── Intersection observer ── */
function useVisible(t=.15){ const ref=useRef(null);const[v,setV]=useState(false);useEffect(()=>{const o=new IntersectionObserver(([e])=>{if(e.isIntersecting)setV(true)},{threshold:t});if(ref.current)o.observe(ref.current);return()=>o.disconnect();},[]);return[ref,v]; }
function FadeIn({children,delay=0}){const[ref,v]=useVisible();return<div ref={ref} style={{opacity:v?1:0,transform:v?'translateY(0)':'translateY(28px)',transition:`opacity .6s ${delay}ms ease,transform .6s ${delay}ms cubic-bezier(.22,1,.36,1)`}}>{children}</div>}

/* ── Lightbox ── */
function Lightbox({imgs,idx,onClose}){
  const[cur,setCur]=useState(idx);
  useEffect(()=>{const fn=e=>{if(e.key==='Escape')onClose();if(e.key==='ArrowRight')setCur(c=>Math.min(c+1,imgs.length-1));if(e.key==='ArrowLeft')setCur(c=>Math.max(c-1,0));};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[]);
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.95)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}} onClick={onClose}>
      <div style={{position:'relative',maxWidth:'90vw',maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        <img src={imgs[cur].url||imgs[cur]} alt="" style={{maxWidth:'88vw',maxHeight:'82vh',borderRadius:16,objectFit:'contain',display:'block'}}/>
        {imgs[cur].label&&<div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'6px 16px',borderRadius:20,fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>{imgs[cur].label}</div>}
        <button onClick={onClose} style={{position:'absolute',top:-14,right:-14,width:36,height:36,borderRadius:'50%',background:'#fff',border:'none',cursor:'pointer',fontSize:18,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,.4)'}}>✕</button>
        {cur>0&&<button onClick={()=>setCur(c=>c-1)} style={{position:'absolute',left:-20,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>}
        {cur<imgs.length-1&&<button onClick={()=>setCur(c=>c+1)} style={{position:'absolute',right:-20,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>}
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:12}}>
          {imgs.map((_,i)=><div key={i} onClick={()=>setCur(i)} style={{width:i===cur?24:8,height:8,borderRadius:4,background:i===cur?'#f5c842':'rgba(255,255,255,.3)',cursor:'pointer',transition:'all .2s'}}/>)}
        </div>
      </div>
    </div>
  );
}

/* ── Admin Panel ── */
function AdminPanel({siteData,setSiteData,onClose}){
  const[tab,setTab]=useState('rooms');
  const[pw,setPw]=useState('');
  const[auth,setAuth]=useState(false);
  const[err,setErr]=useState('');

  if(!auth) return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}>
      <div style={{background:'#1a1008',border:'1px solid #8b5e2a',borderRadius:20,padding:32,width:320,textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>🔐</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:'#fff',marginBottom:20}}>Admin Access</div>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){if(pw===ADMIN_PASS)setAuth(true);else{setErr('Wrong password');setTimeout(()=>setErr(''),1500);}}}} placeholder="Password daalo…" autoFocus
          style={{width:'100%',background:'#0d0703',border:`1px solid ${err?'#ef4444':'#5a3010'}`,color:'#fff',padding:'11px 14px',borderRadius:10,fontSize:14,textAlign:'center',outline:'none',boxSizing:'border-box',marginBottom:8}}/>
        {err&&<div style={{color:'#ef4444',fontSize:12,marginBottom:8}}>{err}</div>}
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={()=>{if(pw===ADMIN_PASS)setAuth(true);else{setErr('Wrong password');setTimeout(()=>setErr(''),1500);}}}
            style={{flex:1,background:'linear-gradient(135deg,#c8763a,#f5c842)',border:'none',color:'#2d1a0a',padding:'10px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:14}}>Login</button>
          <button onClick={onClose} style={{background:'#2d1a0a',border:'1px solid #5a3010',color:'#9a7a5a',padding:'10px 14px',borderRadius:10,cursor:'pointer',fontSize:14}}>✕</button>
        </div>
      </div>
    </div>
  );

  function addPhoto(section,url,label){
    if(!url.trim())return;
    const next={...siteData,[section]:[...(siteData[section]||[]),{url:url.trim(),label:label||''}]};
    setSiteData(next);setLS('siteData',next);
  }
  function removePhoto(section,idx){
    const next={...siteData,[section]:(siteData[section]||[]).filter((_,i)=>i!==idx)};
    setSiteData(next);setLS('siteData',next);
  }
  function updateHero(url){
    const next={...siteData,hero:url};setSiteData(next);setLS('siteData',next);
  }

  const sections=[['roomPhotos','🛏️ Room Photos'],['foodPhotos','🍽️ Food Photos'],['galleryPhotos','📸 Gallery']];
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.92)',zIndex:500,display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(6px)'}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#0d0703',border:'1px solid #3a1f05',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:700,maxHeight:'90vh',overflowY:'auto',padding:24}}>
        <div style={{width:36,height:4,background:'#3a1f05',borderRadius:4,margin:'0 auto 20px'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:'#fff'}}>⚙️ Admin Panel</div>
          <button onClick={onClose} style={{background:'#2d1a0a',border:'1px solid #5a3010',color:'#9a7a5a',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:13}}>Close</button>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'#1a0e05',borderRadius:12,padding:4,marginBottom:20,overflowX:'auto'}}>
          {[['hero','🖼️ Hero'],['roomPhotos','🛏️ Rooms'],['foodPhotos','🍽️ Food'],['galleryPhotos','📸 Gallery']].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'8px 12px',borderRadius:9,border:'none',background:tab===t?'linear-gradient(135deg,#c8763a,#f5c842)':'transparent',color:tab===t?'#2d1a0a':'#9a7a5a',fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',transition:'all .2s'}}>{l}</button>
          ))}
        </div>

        {tab==='hero'&&(
          <div>
            <div style={{fontSize:12,color:'#9a7a5a',marginBottom:8}}>Hero background image URL (direct image link)</div>
            <div style={{display:'flex',gap:8}}>
              <input defaultValue={siteData.hero||''} id="heroUrl" placeholder="https://…image.jpg"
                style={{flex:1,background:'#1a0e05',border:'1px solid #3a1f05',color:'#fff',padding:'9px 12px',borderRadius:8,fontSize:13,outline:'none'}}/>
              <button onClick={()=>{const v=document.getElementById('heroUrl').value;updateHero(v);}} style={{background:'linear-gradient(135deg,#c8763a,#f5c842)',border:'none',color:'#2d1a0a',padding:'9px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>Save</button>
            </div>
            {siteData.hero&&<img src={siteData.hero} alt="" style={{width:'100%',height:160,objectFit:'cover',borderRadius:12,marginTop:12}}/>}
          </div>
        )}

        {tab!=='hero'&&(<PhotoManager section={tab} photos={siteData[tab]||[]} onAdd={addPhoto} onRemove={removePhoto}/>)}
      </div>
    </div>
  );
}

function PhotoManager({section,photos,onAdd,onRemove}){
  const[url,setUrl]=useState('');const[label,setLabel]=useState('');
  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image URL paste karo (https://…)"
          style={{flex:2,minWidth:200,background:'#1a0e05',border:'1px solid #3a1f05',color:'#fff',padding:'9px 12px',borderRadius:8,fontSize:12,outline:'none'}}/>
        <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label (optional)"
          style={{flex:1,minWidth:120,background:'#1a0e05',border:'1px solid #3a1f05',color:'#fff',padding:'9px 12px',borderRadius:8,fontSize:12,outline:'none'}}/>
        <button onClick={()=>{onAdd(section,url,label);setUrl('');setLabel('');}} style={{background:'linear-gradient(135deg,#c8763a,#f5c842)',border:'none',color:'#2d1a0a',padding:'9px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>+ Add</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
        {photos.map((p,i)=>(
          <div key={i} style={{position:'relative',borderRadius:10,overflow:'hidden',aspectRatio:'1'}}>
            <img src={p.url||p} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            {p.label&&<div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,padding:'4px 6px'}}>{p.label}</div>}
            <button onClick={()=>onRemove(section,i)} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button>
          </div>
        ))}
        {photos.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',color:'#5a3010',fontSize:13,padding:24}}>Koi photos nahi hai. Upar URL paste karo.</div>}
      </div>
    </div>
  );
}

/* ── Chatbot ── */
const BOT_ANSWERS = [
  {q:['rent','price','kitna','cost','fees','charge','monthly'],a:`Hamare PG mein rent ₹4,500 se shuru hota hai:\n• Triple Sharing: ₹4,500/person\n• Double Sharing: ₹6,500/person\n• Single Room: ₹9,500\n\nFood include nahi hai by default. Food ke saath ₹3,000 extra. Light bill alag hoga.`},
  {q:['food','khana','breakfast','lunch','dinner','meal','eat'],a:`Haan! Hamare yahan ghar jaisa fresh khana milta hai:\n• Breakfast\n• Lunch\n• Dinner\n• Morning/Evening Tea & Milk\n\nFood plan sirf ₹3,000/month extra. 😊`},
  {q:['wifi','internet','net','speed'],a:'High-speed WiFi included hai rent mein! Bilkul free, no extra charge. 📶'},
  {q:['ac','air condition','cooling'],a:'Sab rooms mein AC hai! Fully air-conditioned. ❄️'},
  {q:['security','safe','cctv','camera'],a:'24/7 CCTV surveillance hai. Girls aur boys dono ke liye bilkul safe PG hai. 🔒'},
  {q:['location','address','kaha','where','map','fatehganj'],a:'Prime location: Fatehganj, Bareilly! 📍\n\nMarket, ATM, Hospital, Bank, Auto Stand, Bus Stand — sab walking distance mein.\n\nGoogle Maps: https://maps.app.goo.gl/DZNesjYqhwrV4uEg9'},
  {q:['contact','call','phone','number','whatsapp'],a:'Hume contact karo:\n📞 9405334300\n📞 8857009635\n💬 WhatsApp bhi kar sakte ho!'},
  {q:['girl','female','ladies','women'],a:'Haan! Hamare PG mein girls ke liye alag section hai. 100% safe & secure. 👩\n\nFull CCTV, safe environment, and strict entry policy.'},
  {q:['boy','male','men','gents'],a:'Haan! Boys ke liye bhi rooms available hain. 👦\n\nFully furnished, AC, WiFi — sab included!'},
  {q:['water','geyser','hot'],a:'24/7 fresh water supply + RO filtered drinking water. Har washroom mein geyser attached hai. 💧🚿'},
  {q:['furniture','furnished','bed','mattress','almirah','wardrobe'],a:'Fully furnished rooms! 🛏️\n• Bed + Mattress + Pillow\n• Wardrobe (personal)\n• Personal Locker\n• Bed sheets + pillow covers'},
  {q:['washing','laundry','kapde','machine'],a:'Washing machine connection available hai. 🫧'},
  {q:['booking','book','reserve','available'],a:'Room book karne ke liye call ya WhatsApp karo:\n📞 9405334300\n\nPehle aao, pehle pao! Rooms jaldi bhar jaate hain. 😊'},
  {q:['deposit','advance','security'],a:'Security deposit ki details ke liye please call karein:\n📞 9405334300'},
  {q:['kitchen','cooking','utensil','gas','lpg'],a:'Fully loaded kitchen available hai! 🍳\nSaare basic utensils + LPG supply included.'},
  {q:['light','electricity','bill'],a:'Light bill (electricity) rent mein included nahi hai. Actual usage ke hisaab se alag charge hoga. ⚡'},
  {q:['occupancy','sharing','single','double','triple'],a:'Teen tarah ke rooms available hain:\n• Triple Sharing — ₹4,500\n• Double Sharing — ₹6,500\n• Single Room — ₹9,500'},
  {q:['hi','hello','hey','namaste','helo'],a:'Namaste! 🙏 Main Chhatrapati PG ka assistant hoon.\n\nAap kya jaanna chahte ho? Rent, Food, Rooms, Location — kuch bhi pucho!'},
  {q:['thanks','thank','shukriya','dhanyawad'],a:'Khushi hui aapki help karke! 😊\n\nKoi aur sawaal ho toh zaroor pucho. Room book karne ke liye call karein: 📞 9405334300'},
];

function getAnswer(msg){
  const m=msg.toLowerCase();
  for(const b of BOT_ANSWERS){
    if(b.q.some(k=>m.includes(k)))return b.a;
  }
  return 'Maafi chahta hoon, yeh sawaal samajh nahi aaya. 😅\n\nKripya call karein: 📞 9405334300\nYa WhatsApp: 9405334300\n\nAap puch sakte ho: rent, food, rooms, location, facilities, etc.';
}

function Chatbot(){
  const[open,setOpen]=useState(false);
  const[msgs,setMsgs]=useState([{from:'bot',text:'Namaste! 🙏 Main Chhatrapati PG ka assistant hoon.\n\nRent, food, rooms, location — kuch bhi pucho! Hindi ya English dono chalega. 😊'}]);
  const[input,setInput]=useState('');
  const[typing,setTyping]=useState(false);
  const endRef=useRef(null);
  useEffect(()=>{if(endRef.current)endRef.current.scrollIntoView({behavior:'smooth'});},[msgs,open]);

  function send(){
    const t=input.trim();if(!t)return;
    setMsgs(p=>[...p,{from:'user',text:t}]);setInput('');setTyping(true);
    setTimeout(()=>{setMsgs(p=>[...p,{from:'bot',text:getAnswer(t)}]);setTyping(false);},800+Math.random()*600);
  }
  const QUICK=['Rent kitna hai?','Food included hai?','Location kaha hai?','Rooms available?','Call karna hai'];

  return(<>
    {/* Floating button */}
    <button onClick={()=>setOpen(o=>!o)} style={{position:'fixed',bottom:100,right:24,zIndex:997,width:54,height:54,borderRadius:'50%',background:'linear-gradient(135deg,#c8763a,#f5c842)',border:'none',cursor:'pointer',fontSize:24,boxShadow:'0 6px 24px rgba(200,118,58,.5)',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform .25s'}}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
      {open?'✕':'🤖'}
      {!open&&<div style={{position:'absolute',top:-2,right:-2,width:16,height:16,borderRadius:'50%',background:'#ef4444',border:'2px solid #fff',fontSize:9,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>!</div>}
    </button>

    {open&&(
      <div style={{position:'fixed',bottom:168,right:16,width:340,maxHeight:480,background:'#1a0e05',border:'1px solid #5a3010',borderRadius:20,zIndex:996,display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,.6)',overflow:'hidden',animation:'fadeUp .3s ease'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#c8763a,#f5c842)',padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏠</div>
          <div><div style={{fontWeight:700,fontSize:14,color:'#2d1a0a'}}>Chhatrapati PG</div><div style={{fontSize:10,color:'rgba(45,26,10,.7)'}}>Usually replies instantly</div></div>
        </div>
        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:10}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.from==='user'?'flex-end':'flex-start'}}>
              <div style={{maxWidth:'82%',background:m.from==='user'?'linear-gradient(135deg,#c8763a,#f5c842)':'#2d1a0a',color:m.from==='user'?'#2d1a0a':'#f5e6d0',padding:'9px 13px',borderRadius:m.from==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',fontSize:13,lineHeight:1.6,border:m.from==='bot'?'1px solid #3a1f05':'none',whiteSpace:'pre-line'}}>
                {m.text}
              </div>
            </div>
          ))}
          {typing&&<div style={{display:'flex',gap:4,padding:'10px 14px',background:'#2d1a0a',borderRadius:'16px 16px 16px 4px',width:56,border:'1px solid #3a1f05'}}>
            {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#c8763a',animation:`pulse 1.2s ${i*.2}s infinite`}}/>)}
          </div>}
          <div ref={endRef}/>
        </div>
        {/* Quick replies */}
        <div style={{padding:'0 10px 8px',display:'flex',gap:6,overflowX:'auto'}}>
          {QUICK.map(q=>(
            <button key={q} onClick={()=>{setMsgs(p=>[...p,{from:'user',text:q}]);setTyping(true);setTimeout(()=>{setMsgs(p=>[...p,{from:'bot',text:getAnswer(q)}]);setTyping(false);},700+Math.random()*500);}}
              style={{background:'#2d1a0a',border:'1px solid #5a3010',color:'#e8c090',padding:'5px 11px',borderRadius:20,cursor:'pointer',fontSize:11,whiteSpace:'nowrap',transition:'background .2s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#3d2a1a'}
              onMouseLeave={e=>e.currentTarget.style.background='#2d1a0a'}>
              {q}
            </button>
          ))}
        </div>
        {/* Input */}
        <div style={{padding:'8px 12px 12px',borderTop:'1px solid #3a1f05',display:'flex',gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Kuch bhi pucho…"
            style={{flex:1,background:'#2d1a0a',border:'1px solid #5a3010',color:'#f5e6d0',padding:'9px 12px',borderRadius:10,fontSize:13,outline:'none'}}/>
          <button onClick={send} style={{background:'linear-gradient(135deg,#c8763a,#f5c842)',border:'none',color:'#2d1a0a',width:38,borderRadius:10,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>↑</button>
        </div>
      </div>
    )}
  </>);
}

/* ── Navbar ── */
function Navbar({onAdminClick}){
  const[scrolled,setScrolled]=useState(false);
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>40);window.addEventListener('scroll',fn);return()=>window.removeEventListener('scroll',fn);},[]);
  const links=[['home','Home'],['rooms','Rooms'],['food','Food'],['gallery','Gallery'],['amenities','Amenities'],['contact','Contact']];
  return(
    <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:scrolled?'rgba(255,248,240,0.97)':'transparent',backdropFilter:scrolled?'blur(14px)':'none',boxShadow:scrolled?'0 2px 24px rgba(180,100,20,.12)':'none',transition:'all .4s ease',padding:'0 5vw'}}>
      <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',height:68,justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#c8763a,#e8a44a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:'0 4px 12px rgba(200,118,58,.35)'}}>🏠</div>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:scrolled?'#2d1a0a':'#fff',lineHeight:1.1}}>Chhatrapati PG</div>
            <div style={{fontSize:9,color:scrolled?'#c8763a':'#ffd9a0',fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase'}}>Premium Coliving</div>
          </div>
        </div>
        <div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
          {links.map(([id,l])=>(
            <a key={id} href={`#${id}`} style={{fontSize:13,fontWeight:600,color:scrolled?'#4a2c10':'#fff',textDecoration:'none',letterSpacing:'.04em',transition:'color .2s'}}
              onMouseEnter={e=>e.target.style.color='#c8763a'}
              onMouseLeave={e=>e.target.style.color=scrolled?'#4a2c10':'#fff'}>{l}</a>
          ))}
          <button onClick={onAdminClick} style={{background:'rgba(200,118,58,.15)',border:'1px solid rgba(200,118,58,.3)',color:scrolled?'#c8763a':'#ffd9a0',padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .2s'}}>⚙ Admin</button>
          <a href="tel:9405334300" style={{background:'linear-gradient(135deg,#c8763a,#e8a44a)',color:'#fff',padding:'9px 20px',borderRadius:30,fontSize:13,fontWeight:700,textDecoration:'none',boxShadow:'0 4px 16px rgba(200,118,58,.4)',transition:'transform .2s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>📞 Call Now</a>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ── */
function Hero({heroImg}){
  return(
    <section id="home" style={{position:'relative',minHeight:'100vh',display:'flex',alignItems:'center',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:`url(${heroImg||DEFAULT_IMGS.hero})`,backgroundSize:'cover',backgroundPosition:'center',filter:'brightness(.42)'}}/>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(60,20,5,.78) 0%,rgba(180,90,20,.35) 50%,rgba(0,0,0,.2) 100%)'}}/>
      <div style={{position:'absolute',top:'10%',right:'8%',width:320,height:320,borderRadius:'50%',border:'1px solid rgba(255,200,100,.2)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1,padding:'120px 6vw 80px',maxWidth:1200,margin:'0 auto',width:'100%'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(200,118,58,.25)',border:'1px solid rgba(232,164,74,.4)',borderRadius:30,padding:'6px 16px',marginBottom:24,backdropFilter:'blur(8px)'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#f5c842',boxShadow:'0 0 8px #f5c842'}}/>
          <span style={{fontSize:11,color:'#ffd9a0',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase'}}>Fatehganj, Bareilly</span>
        </div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(36px,6vw,76px)',fontWeight:900,color:'#fff',lineHeight:1.08,marginBottom:20,maxWidth:700}}>
          Your Home<br/><span style={{background:'linear-gradient(90deg,#f5c842,#e8a44a)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Away from Home</span>
        </h1>
        <p style={{fontSize:'clamp(14px,1.8vw,18px)',color:'rgba(255,255,255,.82)',maxWidth:520,lineHeight:1.7,marginBottom:40}}>
          Premium coliving in Fatehganj. Fully furnished rooms with AC & WiFi. Food available at ₹3,000/month extra.
        </p>
        <div style={{display:'flex',gap:32,marginBottom:44,flexWrap:'wrap'}}>
          {[['₹4,500','Starting rent/mo'],['Optional','Food +₹3,000'],['24/7','Security & Water'],['100%','Furnished']].map(([val,lab])=>(
            <div key={lab}><div style={{fontSize:26,fontWeight:900,color:'#f5c842',fontFamily:"'Playfair Display',serif"}}>{val}</div><div style={{fontSize:11,color:'rgba(255,255,255,.6)',letterSpacing:'.05em',marginTop:2}}>{lab}</div></div>
          ))}
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          <a href="tel:9405334300" style={{background:'linear-gradient(135deg,#c8763a,#f5c842)',color:'#2d1a0a',padding:'14px 32px',borderRadius:50,fontSize:15,fontWeight:800,textDecoration:'none',boxShadow:'0 8px 30px rgba(200,118,58,.5)',display:'flex',alignItems:'center',gap:8,transition:'transform .2s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>📞 Call: 9405334300</a>
          <a href="https://wa.me/919405334300?text=Hi%20Chhatrapati%20PG!%20I%20want%20to%20enquire%20about%20rooms." target="_blank" rel="noreferrer"
            style={{background:'rgba(255,255,255,.1)',border:'1.5px solid rgba(255,255,255,.35)',color:'#fff',padding:'14px 32px',borderRadius:50,fontSize:15,fontWeight:700,textDecoration:'none',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',gap:8,transition:'background .2s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.18)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}>💬 WhatsApp Us</a>
        </div>
      </div>
      <div style={{position:'absolute',bottom:32,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,.5)',letterSpacing:'.1em',textTransform:'uppercase'}}>Scroll</div>
        <div style={{width:1,height:40,background:'linear-gradient(180deg,rgba(255,255,255,.5),transparent)'}}/>
      </div>
    </section>
  );
}

/* ── Rooms ── */
function Rooms({siteData}){
  const[active,setActive]=useState(null);
  const[lightbox,setLightbox]=useState(null);
  const[withFood,setWithFood]=useState(false);

  const ROOMS=[
    {type:'Triple Sharing',basePrice:4500,tag:'Most Popular',defaultImg:DEFAULT_IMGS.room1,features:['3 residents','Wardrobe each','AC + WiFi','Attached geyser']},
    {type:'Double Sharing',basePrice:6500,tag:'Best Value',defaultImg:DEFAULT_IMGS.room2,features:['2 residents','Personal locker','AC + WiFi','Attached geyser']},
    {type:'Single Room',basePrice:9500,tag:'Premium',defaultImg:DEFAULT_IMGS.room3,features:['Private space','Full wardrobe','AC + WiFi','Attached geyser']},
  ];
  const roomPhotos=siteData.roomPhotos||[];

  return(
    <section id="rooms" style={{padding:'100px 6vw',background:'#fdf8f2'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <FadeIn>
          <div style={{textAlign:'center',marginBottom:48}}>
            <div style={{fontSize:11,color:'#c8763a',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>Choose Your Space</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,4vw,48px)',fontWeight:800,color:'#2d1a0a',marginBottom:16}}>Our Rooms</h2>
            <div style={{width:60,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,margin:'0 auto 28px'}}/>
            {/* FIX 3: Food toggle */}
            <div style={{display:'inline-flex',alignItems:'center',gap:14,background:'#fff3e0',border:'1px solid #f0d0a0',borderRadius:50,padding:'10px 20px',boxShadow:'0 4px 16px rgba(200,118,58,.12)'}}>
              <span style={{fontSize:13,color:'#7a5020',fontWeight:600}}>Without Food</span>
              <div onClick={()=>setWithFood(w=>!w)} style={{width:52,height:28,borderRadius:14,background:withFood?'linear-gradient(135deg,#c8763a,#f5c842)':'#e0d0c0',cursor:'pointer',position:'relative',transition:'background .3s',flexShrink:0}}>
                <div style={{position:'absolute',top:3,left:withFood?26:3,width:22,height:22,borderRadius:'50%',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.2)',transition:'left .3s'}}/>
              </div>
              <span style={{fontSize:13,color:withFood?'#c8763a':'#9a7a5a',fontWeight:withFood?700:600}}>With Food +₹3,000</span>
            </div>
          </div>
        </FadeIn>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:28}}>
          {ROOMS.map((r,i)=>{
            const price=r.basePrice+(withFood?3000:0);
            // Get matching room photo from admin uploads
            const adminPhoto=roomPhotos[i];
            const imgUrl=adminPhoto?adminPhoto.url:r.defaultImg;
            // Build gallery for this room — use all uploaded room photos
            const gallery=roomPhotos.length>0?roomPhotos:[{url:r.defaultImg,label:r.type},{url:DEFAULT_IMGS.room2,label:'Room view'},{url:DEFAULT_IMGS.room3,label:'Interior'}];
            return(
              <FadeIn key={r.type} delay={i*120}>
                <div onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)}
                  style={{borderRadius:24,overflow:'hidden',background:'#fff',boxShadow:active===i?'0 24px 60px rgba(200,118,58,.22)':'0 4px 24px rgba(0,0,0,.07)',transition:'box-shadow .35s,transform .35s',transform:active===i?'translateY(-6px)':'translateY(0)'}}>
                  {/* Room photo — clickable to open lightbox */}
                  <div style={{position:'relative',height:220,overflow:'hidden',cursor:'pointer'}} onClick={()=>setLightbox({imgs:gallery,idx:0})}>
                    <img src={imgUrl} alt={r.type} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .5s',transform:active===i?'scale(1.06)':'scale(1)'}} loading="lazy"/>
                    <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.5))'}}/>
                    <div style={{position:'absolute',top:16,left:16,background:'linear-gradient(135deg,#c8763a,#f5c842)',color:'#fff',padding:'4px 14px',borderRadius:20,fontSize:11,fontWeight:700}}>{r.tag}</div>
                    {/* Photo count badge */}
                    {gallery.length>1&&<div style={{position:'absolute',bottom:12,right:12,background:'rgba(0,0,0,.6)',color:'#fff',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,backdropFilter:'blur(4px)'}}>📸 {gallery.length} photos</div>}
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:active===i?1:0,transition:'opacity .3s',background:'rgba(0,0,0,.2)'}}>
                      <div style={{background:'rgba(255,255,255,.9)',color:'#2d1a0a',padding:'8px 18px',borderRadius:20,fontSize:13,fontWeight:700}}>🔍 View Photos</div>
                    </div>
                  </div>
                  <div style={{padding:'24px 24px 28px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                      <div>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:'#2d1a0a'}}>{r.type}</div>
                        <div style={{fontSize:11,color:'#9a7a5a',marginTop:2}}>Per person / month</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:26,fontWeight:900,color:'#c8763a',fontFamily:"'Playfair Display',serif"}}>₹{price.toLocaleString()}</div>
                        <div style={{fontSize:10,color:'#c8763a',fontWeight:600}}>{withFood?'food included':'+ food ₹3,000 extra'}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:22}}>
                      {r.features.map(f=>(
                        <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:18,height:18,borderRadius:'50%',background:'#fef0e0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <div style={{width:6,height:6,borderRadius:'50%',background:'#c8763a'}}/>
                          </div>
                          <span style={{fontSize:13,color:'#5a3c20'}}>{f}</span>
                        </div>
                      ))}
                      {withFood&&<div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:18,height:18,borderRadius:'50%',background:'#fef0e0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><div style={{width:6,height:6,borderRadius:'50%',background:'#c8763a'}}/></div>
                        <span style={{fontSize:13,color:'#c8763a',fontWeight:600}}>🍽️ Breakfast + Lunch + Dinner</span>
                      </div>}
                    </div>
                    <a href="tel:9405334300" style={{display:'block',textAlign:'center',background:active===i?'linear-gradient(135deg,#c8763a,#f5c842)':'#fdf0e0',color:active===i?'#fff':'#c8763a',padding:'12px',borderRadius:14,fontSize:13,fontWeight:700,textDecoration:'none',transition:'all .3s',border:'1.5px solid #e8c090'}}>
                      Book This Room →
                    </a>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
        <FadeIn delay={200}>
          <div style={{textAlign:'center',marginTop:32,padding:'16px 24px',background:'#fef5e4',borderRadius:16,border:'1px solid #f0d8a0'}}>
            <div style={{fontSize:13,color:'#7a5020',lineHeight:1.7}}>⚡ <strong>Light bill excluded</strong> — All other utilities & amenities included. Food +₹3,000/month optional.</div>
          </div>
        </FadeIn>
      </div>
      {lightbox&&<Lightbox imgs={lightbox.imgs} idx={lightbox.idx} onClose={()=>setLightbox(null)}/>}
    </section>
  );
}

/* ── Food ── */
function Food({siteData}){
  const[lightbox,setLightbox]=useState(null);
  const foodPhotos=(siteData.foodPhotos||[]).length>0?siteData.foodPhotos:[
    {url:DEFAULT_IMGS.food1,label:'Home-style Lunch'},
    {url:DEFAULT_IMGS.food2,label:'Fresh Breakfast'},
    {url:DEFAULT_IMGS.food3,label:'Evening Snacks'},
    {url:DEFAULT_IMGS.kitchen,label:'Fully Loaded Kitchen'},
  ];
  return(
    <section id="food" style={{padding:'100px 6vw',background:'#2d1a0a',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-100,right:-100,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(200,118,58,.15),transparent)',pointerEvents:'none'}}/>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:80,alignItems:'center'}}>
          <FadeIn>
            <div>
              <div style={{fontSize:11,color:'#f5c842',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>Ghar Jaisa Khana</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,3.5vw,44px)',fontWeight:800,color:'#fff',marginBottom:20,lineHeight:1.2}}>3 Fresh Meals<br/>Every Single Day</h2>
              <div style={{width:50,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,marginBottom:28}}/>
              <p style={{color:'rgba(255,255,255,.7)',fontSize:15,lineHeight:1.85,marginBottom:28}}>Food plan sirf ₹3,000/month extra. Fresh, home-style Indian meals — breakfast, lunch & dinner daily.</p>
              <div style={{background:'rgba(245,200,66,.12)',border:'1px solid rgba(245,200,66,.25)',borderRadius:14,padding:'14px 18px',marginBottom:28,display:'inline-flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:22}}>🍽️</span>
                <div><div style={{color:'#f5c842',fontWeight:700,fontSize:15}}>Food Add-on: ₹3,000/month</div><div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginTop:2}}>Optional — add at any time</div></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[['🌅','Breakfast','Fresh & energising'],['☀️','Lunch','Hot home-style'],['☕','Tea/Milk','Morning & evening'],['🌙','Dinner','Wholesome end']].map(([ic,title,sub])=>(
                  <div key={title} style={{background:'rgba(255,255,255,.06)',borderRadius:14,padding:'14px',border:'1px solid rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:22,marginBottom:6}}>{ic}</div>
                    <div style={{fontWeight:700,color:'#fff',fontSize:13}}>{title}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginTop:2}}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {foodPhotos.slice(0,4).map((f,i)=>(
                <div key={i} onClick={()=>setLightbox({imgs:foodPhotos,idx:i})} style={{borderRadius:16,overflow:'hidden',position:'relative',aspectRatio:i===3?'2/1':'1/1',gridColumn:i===3?'1/-1':undefined,boxShadow:'0 8px 30px rgba(0,0,0,.4)',cursor:'pointer'}}>
                  <img src={f.url||f} alt={f.label||''} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .4s'}} loading="lazy"
                    onMouseEnter={e=>e.target.style.transform='scale(1.05)'}
                    onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.65))'}}/>
                  {f.label&&<div style={{position:'absolute',bottom:10,left:12,fontSize:11,color:'#fff',fontWeight:600}}>{f.label}</div>}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
      {lightbox&&<Lightbox imgs={lightbox.imgs} idx={lightbox.idx} onClose={()=>setLightbox(null)}/>}
    </section>
  );
}

/* ── Gallery ── */
function Gallery({siteData}){
  const[lightbox,setLightbox]=useState(null);
  const allPhotos=[...(siteData.galleryPhotos||[]),...(siteData.roomPhotos||[]),...(siteData.foodPhotos||[])];
  const fallback=[DEFAULT_IMGS.room1,DEFAULT_IMGS.room2,DEFAULT_IMGS.food1,DEFAULT_IMGS.outside,DEFAULT_IMGS.food2,DEFAULT_IMGS.common].map((url,i)=>({url,label:`Photo ${i+1}`}));
  const photos=allPhotos.length>0?allPhotos:fallback;
  return(
    <section id="gallery" style={{padding:'100px 6vw',background:'#1a0f05'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <FadeIn>
          <div style={{textAlign:'center',marginBottom:56}}>
            <div style={{fontSize:11,color:'#f5c842',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>See For Yourself</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,4vw,48px)',fontWeight:800,color:'#fff',marginBottom:16}}>Life at Chhatrapati PG</h2>
            <div style={{width:60,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,margin:'0 auto'}}/>
          </div>
        </FadeIn>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,gridAutoRows:220}}>
          {photos.slice(0,6).map((p,i)=>(
            <FadeIn key={i} delay={i*60}>
              <div onClick={()=>setLightbox({imgs:photos,idx:i})} style={{borderRadius:16,overflow:'hidden',height:'100%',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,.4)',gridColumn:i===0?'span 2':undefined}}>
                <img src={p.url||p} alt={p.label||''} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .5s',display:'block'}} loading="lazy"
                  onMouseEnter={e=>e.target.style.transform='scale(1.06)'}
                  onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
              </div>
            </FadeIn>
          ))}
        </div>
        {photos.length>6&&<div style={{textAlign:'center',marginTop:24}}>
          <button onClick={()=>setLightbox({imgs:photos,idx:0})} style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',padding:'12px 28px',borderRadius:30,cursor:'pointer',fontSize:13,fontWeight:600}}>View All {photos.length} Photos →</button>
        </div>}
      </div>
      {lightbox&&<Lightbox imgs={lightbox.imgs} idx={lightbox.idx} onClose={()=>setLightbox(null)}/>}
    </section>
  );
}

/* ── Amenities ── */
function Amenities(){
  return(
    <section id="amenities" style={{padding:'100px 6vw',background:'#fdf8f2'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <FadeIn>
          <div style={{textAlign:'center',marginBottom:60}}>
            <div style={{fontSize:11,color:'#c8763a',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>Everything Included</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,4vw,48px)',fontWeight:800,color:'#2d1a0a',marginBottom:16}}>World-Class Amenities</h2>
            <div style={{width:60,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,margin:'0 auto'}}/>
          </div>
        </FadeIn>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:20}}>
          {AMENITIES.map((a,i)=>(
            <FadeIn key={a.label} delay={i*50}>
              <div style={{background:'#fff',borderRadius:18,padding:'24px 20px',border:'1px solid #f0e4d0',boxShadow:'0 2px 16px rgba(0,0,0,.04)',transition:'all .3s',cursor:'default'}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 12px 36px rgba(200,118,58,.15)';e.currentTarget.style.transform='translateY(-4px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 16px rgba(0,0,0,.04)';e.currentTarget.style.transform='translateY(0)';}}>
                <div style={{fontSize:32,marginBottom:12}}>{a.icon}</div>
                <div style={{fontWeight:700,color:'#2d1a0a',fontSize:15,marginBottom:6}}>{a.label}</div>
                <div style={{fontSize:12,color:'#9a7a5a',lineHeight:1.6}}>{a.desc}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function Testimonials(){
  const T=[
    {name:'Priya S.',role:'Working Professional',text:'Best PG in Fatehganj! Food is amazing, rooms are clean and staff very helpful. Feels exactly like home.',stars:5},
    {name:'Rahul M.',role:'College Student',text:'Great value for money. WiFi is fast, AC works perfectly and the food is delicious. Highly recommend!',stars:5},
    {name:'Anjali K.',role:'MBA Student',text:'Very safe for girls, CCTV everywhere and always clean. The wardrobe and locker gives great privacy.',stars:5},
  ];
  return(
    <section style={{padding:'100px 6vw',background:'#fdf8f2'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <FadeIn><div style={{textAlign:'center',marginBottom:56}}>
          <div style={{fontSize:11,color:'#c8763a',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>Happy Residents</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,4vw,44px)',fontWeight:800,color:'#2d1a0a'}}>What Our Residents Say</h2>
          <div style={{width:60,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,margin:'16px auto 0'}}/>
        </div></FadeIn>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24}}>
          {T.map((t,i)=>(
            <FadeIn key={t.name} delay={i*100}>
              <div style={{background:'#fff',borderRadius:22,padding:'32px 28px',border:'1px solid #f0e4d0',boxShadow:'0 4px 24px rgba(0,0,0,.06)'}}>
                <div style={{fontSize:48,color:'#f0d8a0',fontFamily:'Georgia,serif',lineHeight:1,marginBottom:14}}>"</div>
                <p style={{color:'#5a3c20',fontSize:14,lineHeight:1.85,marginBottom:22,fontStyle:'italic'}}>{t.text}</p>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#c8763a,#f5c842)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{t.name[0]}</div>
                  <div><div style={{fontWeight:700,color:'#2d1a0a',fontSize:14}}>{t.name}</div><div style={{fontSize:11,color:'#c8763a'}}>{t.role}</div></div>
                  <div style={{marginLeft:'auto',color:'#f5c842',fontSize:13,letterSpacing:1}}>{'★'.repeat(t.stars)}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Contact ── */
function Contact(){
  return(
    <section id="contact" style={{padding:'100px 6vw',background:'#2d1a0a',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',bottom:-100,left:-100,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,200,66,.08),transparent)',pointerEvents:'none'}}/>
      <div style={{maxWidth:1200,margin:'0 auto',position:'relative',zIndex:1}}>
        <FadeIn><div style={{textAlign:'center',marginBottom:60}}>
          <div style={{fontSize:11,color:'#f5c842',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:12}}>Get In Touch</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(28px,4vw,48px)',fontWeight:800,color:'#fff',marginBottom:16}}>Visit Us Today</h2>
          <div style={{width:60,height:3,background:'linear-gradient(90deg,#c8763a,#f5c842)',borderRadius:4,margin:'0 auto'}}/>
        </div></FadeIn>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'start'}}>
          <FadeIn>
            <div>
              {[
                {icon:'📍',title:'Location',val:'Fatehganj, Bareilly',link:'https://maps.app.goo.gl/DZNesjYqhwrV4uEg9',linkText:'Open in Google Maps →'},
                {icon:'📞',title:'Call Us',val:'9405334300 / 8857009635',link:'tel:9405334300',linkText:'Call Now →'},
                {icon:'💬',title:'WhatsApp',val:'Chat for quick reply',link:'https://wa.me/919405334300?text=Hi%20Chhatrapati%20PG!%20I%20want%20to%20enquire.',linkText:'Open WhatsApp →'},
                {icon:'⏰',title:'Visit Timing',val:'9:00 AM – 8:00 PM, All days',link:null},
              ].map(item=>(
                <div key={item.title} style={{display:'flex',gap:18,marginBottom:28}}>
                  <div style={{width:50,height:50,borderRadius:14,background:'rgba(200,118,58,.2)',border:'1px solid rgba(200,118,58,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{item.icon}</div>
                  <div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.5)',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:4}}>{item.title}</div>
                    <div style={{color:'#fff',fontWeight:600,fontSize:15,marginBottom:4}}>{item.val}</div>
                    {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#f5c842',textDecoration:'none',fontWeight:600}}>{item.linkText}</a>}
                  </div>
                </div>
              ))}
              <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
                {['👨 Males Welcome','👩 Females Welcome'].map(t=>(
                  <div key={t} style={{background:'rgba(245,200,66,.12)',border:'1px solid rgba(245,200,66,.25)',borderRadius:30,padding:'8px 16px',fontSize:12,color:'#f5c842',fontWeight:600}}>{t}</div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <div style={{borderRadius:24,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.5)',border:'1px solid rgba(255,255,255,.08)'}}>
              <iframe src="https://maps.google.com/maps?q=Fatehganj,Bareilly,UP&output=embed" width="100%" height="340" style={{border:0,display:'block'}} allowFullScreen loading="lazy" title="Location"/>
            </div>
            <a href="https://maps.app.goo.gl/DZNesjYqhwrV4uEg9" target="_blank" rel="noreferrer"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:12,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:14,padding:'12px',color:'#fff',textDecoration:'none',fontSize:13,fontWeight:600,transition:'background .2s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}>
              📍 Get Exact Directions
            </a>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ── CTA Banner ── */
function CTABanner(){
  return(
    <section style={{padding:'80px 6vw',background:'linear-gradient(135deg,#c8763a 0%,#e8a44a 40%,#f5c842 100%)',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-60,right:-60,width:250,height:250,borderRadius:'50%',background:'rgba(255,255,255,.1)',pointerEvents:'none'}}/>
      <div style={{maxWidth:700,margin:'0 auto',textAlign:'center',position:'relative',zIndex:1}}>
        <FadeIn>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(24px,4vw,42px)',fontWeight:900,color:'#2d1a0a',marginBottom:14}}>Ready to Move In?</h2>
          <p style={{fontSize:15,color:'rgba(45,26,10,.75)',marginBottom:32,lineHeight:1.7}}>Rooms fill up fast! Call us now or WhatsApp and we'll respond within minutes.</p>
          <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <a href="tel:9405334300" style={{background:'#2d1a0a',color:'#f5c842',padding:'15px 36px',borderRadius:50,fontSize:15,fontWeight:800,textDecoration:'none',display:'flex',alignItems:'center',gap:8}}>📞 9405334300</a>
            <a href="https://wa.me/919405334300?text=Hi%20Chhatrapati%20PG!" target="_blank" rel="noreferrer"
              style={{background:'#25d366',color:'#fff',padding:'15px 36px',borderRadius:50,fontSize:15,fontWeight:800,textDecoration:'none',display:'flex',alignItems:'center',gap:8}}>💬 WhatsApp</a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer(){
  return(
    <footer style={{background:'#160c02',padding:'48px 6vw 32px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:32,marginBottom:36}}>
          <div style={{maxWidth:260}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#c8763a,#e8a44a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏠</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:'#fff'}}>Chhatrapati PG</div>
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,.45)',lineHeight:1.8}}>Premium coliving for males & females in Fatehganj, Bareilly. PG like home. ✌️</p>
          </div>
          <div>
            <div style={{fontSize:11,color:'#f5c842',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>Quick Links</div>
            {['Home','Rooms','Food','Gallery','Amenities','Contact'].map(l=>(
              <a key={l} href={`#${l.toLowerCase()}`} style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:13,textDecoration:'none',marginBottom:8,transition:'color .2s'}}
                onMouseEnter={e=>e.target.style.color='#f5c842'}
                onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.5)'}>{l}</a>
            ))}
          </div>
          <div>
            <div style={{fontSize:11,color:'#f5c842',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>Contact</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.6)',lineHeight:2.1}}>
              <div>📍 Fatehganj, Bareilly</div><div>📞 9405334300</div><div>📞 8857009635</div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <a href="https://wa.me/919405334300" target="_blank" rel="noreferrer" style={{width:36,height:36,background:'#25d366',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,textDecoration:'none',transition:'transform .2s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>💬</a>
              <a href="tel:9405334300" style={{width:36,height:36,background:'#c8763a',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,textDecoration:'none',transition:'transform .2s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>📞</a>
            </div>
          </div>
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:20,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div style={{fontSize:12,color:'rgba(255,255,255,.3)'}}>© 2025 Chhatrapati PG. All rights reserved.</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.3)'}}>Made with ❤️ for Fatehganj residents</div>
        </div>
      </div>
    </footer>
  );
}

/* ── Floating WhatsApp ── */
function FloatingWA(){
  return(
    <a href="https://wa.me/919405334300?text=Hi%20Chhatrapati%20PG!%20I%20want%20to%20enquire%20about%20rooms." target="_blank" rel="noreferrer"
      style={{position:'fixed',bottom:28,right:24,zIndex:998,width:56,height:56,background:'#25d366',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,boxShadow:'0 6px 24px rgba(37,211,102,.5)',textDecoration:'none',animation:'wabounce 2.5s ease-in-out infinite',transition:'transform .25s'}}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>💬</a>
  );
}

/* ── App root ── */
export default function App(){
  const[siteData,setSiteData]=useState(()=>getLS('siteData',{roomPhotos:[],foodPhotos:[],galleryPhotos:[],hero:''}));
  const[showAdmin,setShowAdmin]=useState(false);

  useEffect(()=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
    const style=document.createElement('style');
    style.textContent=`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html{scroll-behavior:smooth;}
      body{font-family:'DM Sans',sans-serif;background:#fdf8f2;overflow-x:hidden;}
      ::-webkit-scrollbar{width:5px;}
      ::-webkit-scrollbar-track{background:#2d1a0a;}
      ::-webkit-scrollbar-thumb{background:#c8763a;border-radius:4px;}
      @keyframes wabounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
      @media(max-width:768px){
        nav>div>div:last-child>a:not(:last-child){display:none!important;}
        section>div{grid-template-columns:1fr!important;}
      }
    `;
    document.head.appendChild(style);
    return()=>{document.head.removeChild(link);document.head.removeChild(style);};
  },[]);

  return(<>
    <Navbar onAdminClick={()=>setShowAdmin(true)}/>
    <Hero heroImg={siteData.hero}/>
    <Rooms siteData={siteData}/>
    <Food siteData={siteData}/>
    <Gallery siteData={siteData}/>
    <Amenities/>
    <Testimonials/>
    <CTABanner/>
    <Contact/>
    <Footer/>
    <FloatingWA/>
    <Chatbot/>
    {showAdmin&&<AdminPanel siteData={siteData} setSiteData={setSiteData} onClose={()=>setShowAdmin(false)}/>}
  </>);
}
