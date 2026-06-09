import { useState, createContext, useContext, useEffect, useRef } from "react";

// ─── Thème ────────────────────────────────────────────────────────────────────
const ThemeCtx = createContext();
const useTheme = () => useContext(ThemeCtx);
const DARK = {
  bg:"#000",bgCard:"#1C1C1E",bgHeader:"rgba(0,0,0,0.92)",
  border:"rgba(255,255,255,0.08)",borderLight:"rgba(255,255,255,0.05)",
  text:"#F2F2F7",textSub:"#AEAEB2",textMuted:"#636366",textFaint:"#3A3A3C",
  input:"rgba(255,255,255,0.07)",inputBorder:"rgba(255,255,255,0.12)",
  tableHead:"rgba(255,255,255,0.03)",sel:"#1C1C1E",toggleBg:"#2C2C2E",
  shadow:"0 4px 24px rgba(0,0,0,0.5)",
};
const LIGHT = {
  bg:"#F2F2F7",bgCard:"#FFFFFF",bgHeader:"rgba(255,255,255,0.92)",
  border:"rgba(0,0,0,0.08)",borderLight:"rgba(0,0,0,0.06)",
  text:"#1C1C1E",textSub:"#3A3A3C",textMuted:"#636366",textFaint:"#AEAEB2",
  input:"#FFFFFF",inputBorder:"rgba(0,0,0,0.12)",
  tableHead:"rgba(0,0,0,0.02)",sel:"#FFFFFF",toggleBg:"#E5E5EA",
  shadow:"0 4px 24px rgba(0,0,0,0.08)",
};

// ─── Session locale ───────────────────────────────────────────────────────────
const SESSION_KEY = "ecole_session";
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch { return null; } };
const saveSession = (u) => localStorage.setItem(SESSION_KEY, JSON.stringify(u));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ─── Config Supabase ──────────────────────────────────────────────────────────
const SUPA_URL = "https://faeltgluscxmijqotlip.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZWx0Z2x1c2N4bWlqcW90bGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjM2OTMsImV4cCI6MjA5NjQ5OTY5M30.FaBj5kAEKf4Vlhkt5U9bEOxkRAHbEP_YXuQXuBxB4_o";

const dbHeaders = {
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

// ─── File d'attente offline ───────────────────────────────────────────────────
const QUEUE_KEY = "ecole_queue";
const loadQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); } catch { return []; } };
const saveQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

const addToQueue = (action) => {
  const q = loadQueue();
  q.push({...action, id: Date.now(), timestamp: new Date().toISOString()});
  saveQueue(q);
};

// Vérifier si en ligne
const isOnline = () => navigator.onLine;

// Synchroniser la file d'attente avec Supabase
const syncQueue = async () => {
  const q = loadQueue();
  if(q.length === 0) return;
  const remaining = [];
  for(const action of q){
    try{
      if(action.type === "ADD"){
        await fetch(`${SUPA_URL}/rest/v1/${action.table}`,{method:"POST",headers:dbHeaders,body:JSON.stringify(action.data)});
      } else if(action.type === "DEL"){
        await fetch(`${SUPA_URL}/rest/v1/${action.table}?id=eq.${action.id}`,{method:"DELETE",headers:dbHeaders});
      } else if(action.type === "PATCH"){
        await fetch(`${SUPA_URL}/rest/v1/${action.table}?id=eq.${action.id}`,{method:"PATCH",headers:dbHeaders,body:JSON.stringify(action.data)});
      }
    } catch(e){
      remaining.push(action); // Réessayer plus tard
    }
  }
  saveQueue(remaining);
};

// Fonctions DB avec fallback offline
const dbGet = (t) => fetch(`${SUPA_URL}/rest/v1/${t}?order=id.desc`,{headers:dbHeaders}).then(r=>r.json());

const dbAdd = async (t, d) => {
  if(isOnline()){
    try{
      const r = await fetch(`${SUPA_URL}/rest/v1/${t}`,{method:"POST",headers:dbHeaders,body:JSON.stringify(d)});
      return r.json();
    }catch(e){
      addToQueue({type:"ADD",table:t,data:d});
      return [{...d, id: Date.now()}]; // ID temporaire
    }
  } else {
    addToQueue({type:"ADD",table:t,data:d});
    return [{...d, id: Date.now()}]; // ID temporaire
  }
};

const dbDel = async (t, id) => {
  if(isOnline()){
    try{
      return fetch(`${SUPA_URL}/rest/v1/${t}?id=eq.${id}`,{method:"DELETE",headers:dbHeaders});
    }catch(e){
      addToQueue({type:"DEL",table:t,id});
    }
  } else {
    addToQueue({type:"DEL",table:t,id});
  }
};

const dbPatch = async (t, id, d) => {
  if(isOnline()){
    try{
      return fetch(`${SUPA_URL}/rest/v1/${t}?id=eq.${id}`,{method:"PATCH",headers:dbHeaders,body:JSON.stringify(d)});
    }catch(e){
      addToQueue({type:"PATCH",table:t,id,data:d});
    }
  } else {
    addToQueue({type:"PATCH",table:t,id,data:d});
  }
};

// ─── Config locale + Cache offline ───────────────────────────────────────────
const STORAGE     = "ecole_config_backup";
const CACHE_KEY   = "ecole_cache";
const loadCfg     = () => { try { return JSON.parse(localStorage.getItem(STORAGE)||"null"); } catch { return null; } };
const loadCache   = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); } catch { return null; } };
const saveCache   = (d) => localStorage.setItem(CACHE_KEY, JSON.stringify(d));

const saveCfg = async (c) => {
  localStorage.setItem(STORAGE, JSON.stringify(c));
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/config?select=id`,{headers:dbHeaders});
    const rows = await res.json();
    if(rows&&rows.length>0){
      await dbPatch("config",rows[0].id,{data:c});
    } else {
      await dbAdd("config",{data:c});
    }
  } catch(e){ console.error("Config sync error",e); }
};

const today = () => new Date().toISOString().split("T")[0];
const xof = (n, devise="FCFA") => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" "+devise;
const MATIERES_DEF = ["Mathématiques","Français","Sciences","Histoire-Géo","Anglais","EPS","Informatique"];
const CLASSES_DEF  = ["6ème","5ème","4ème","3ème","2nde","1ère","Terminale"];
const NIVEAUX      = ["Primaire","Collège","Lycée","Université"];
const DEVISES      = ["FCFA","€","$","MAD","DZD"];

// ─── UI ───────────────────────────────────────────────────────────────────────
const Inp = ({label,value,onChange,type="text",placeholder=""}) => {
  const {theme}=useTheme();
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:12,fontWeight:600,color:theme.textMuted}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"9px 13px",color:theme.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
    </div>
  );
};
const Sel = ({label,value,onChange,options}) => {
  const {theme}=useTheme();
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:12,fontWeight:600,color:theme.textMuted}}>{label}</label>}
      <select value={value} onChange={onChange} style={{background:theme.sel,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"9px 13px",color:theme.text,fontSize:14,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
        {options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
      </select>
    </div>
  );
};
const Card = ({children,style={}}) => {
  const {theme}=useTheme();
  return <div style={{background:theme.bgCard,borderRadius:16,padding:"20px 22px",border:`1px solid ${theme.border}`,boxShadow:theme.shadow,...style}}>{children}</div>;
};
const CardTitle = ({children,color}) => {
  const {theme}=useTheme();
  return <div style={{fontSize:12,fontWeight:700,color:color||theme.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>{children}</div>;
};
const TableWrap = ({children}) => {
  const {theme}=useTheme();
  return <div style={{background:theme.bgCard,borderRadius:16,border:`1px solid ${theme.border}`,overflow:"auto",boxShadow:theme.shadow}}>{children}</div>;
};
const Th = ({children}) => {
  const {theme}=useTheme();
  return <th style={{padding:"11px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:theme.textMuted,background:theme.tableHead,borderBottom:`1px solid ${theme.border}`,whiteSpace:"nowrap"}}>{children}</th>;
};
const Td = ({children,style={}}) => {
  const {theme}=useTheme();
  return <td style={{padding:"11px 14px",fontSize:13,verticalAlign:"middle",color:theme.text,borderBottom:`1px solid ${theme.borderLight}`,...style}}>{children}</td>;
};
const Btn = ({children,onClick,color="#0A84FF",style={}}) => (
  <button onClick={onClick} style={{background:color,color:"#fff",border:"none",padding:"9px 20px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit",...style}}>{children}</button>
);
const BtnSec = ({children,onClick,style={}}) => {
  const {theme}=useTheme();
  return <button onClick={onClick} style={{background:theme.toggleBg,color:theme.text,border:`1px solid ${theme.border}`,padding:"9px 16px",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:14,fontFamily:"inherit",...style}}>{children}</button>;
};
const KPI = ({label,value,sub,accent,icon}) => {
  const {theme}=useTheme();
  return (
    <div style={{background:theme.bgCard,borderRadius:16,padding:"18px 20px",border:`1px solid ${theme.border}`,position:"relative",overflow:"hidden",boxShadow:theme.shadow}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"16px 16px 0 0"}}/>
      <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:11,color:theme.textMuted,fontWeight:500,marginBottom:5}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:accent,letterSpacing:"-0.5px"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:theme.textFaint,marginTop:3}}>{sub}</div>}
    </div>
  );
};
const Badge = ({label,color,bg}) => (
  <span style={{display:"inline-block",fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:99,background:bg,color}}>{label}</span>
);
const Toast = ({msg,err}) => (
  <div style={{position:"fixed",bottom:24,right:24,zIndex:999,padding:"12px 20px",borderRadius:12,
    background:err?"#3A1C1C":"#1C3A27",border:`1px solid ${err?"#FF453A":"#30D158"}`,
    color:err?"#FF453A":"#30D158",fontWeight:600,fontSize:14,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
    {err?"❌":"✅"} {msg}
  </div>
);

// ─── Setup ────────────────────────────────────────────────────────────────────
function Setup({onDone}) {
  const [step,setStep]=useState(1);
  const [cfg,setCfg]=useState({
    nom:"Mon École",slogan:"",adresse:"",telephone:"",email:"",
    devise:"FCFA",couleur:"#0A84FF",niveau:"Collège",
    classes:["6ème","5ème","4ème","3ème"],
    matieres:["Mathématiques","Français","Sciences","Anglais","EPS"],
    fraisParClasse:{},
    fraisInscriptionParClasse:{},
    fraisInscription:50000,
    fraisMensuel:15000,
    fraisSpeciaux:{"01":0,"02":0},
    coursDuSoir:false,
    fraisCoursSOir:10000,
    typesPaiements:["Mensualité","Inscription","Cantine","Fournitures","Transport","Cours du soir","Autre"],
  });
  const [newClasse,setNewClasse]=useState("");
  const [newMatiere,setNewMatiere]=useState("");
  const COLORS=["#0A84FF","#30D158","#FF9F0A","#FF453A","#BF5AF2","#FF6B35","#5E5CE6","#00C7BE"];

  const finish=()=>{saveCfg(cfg);onDone(cfg);};

  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'SF Pro Display','Segoe UI',sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:620}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10}}>🏫</div>
          <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>Configuration de votre école</div>
          <div style={{fontSize:13,color:"#636366",marginTop:6}}>Personnalisez votre logiciel en quelques étapes</div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:28}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:30,height:30,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,
                background:step>=s?cfg.couleur:"rgba(255,255,255,0.1)",color:step>=s?"#fff":"#636366"}}>{s}</div>
              {s<3&&<div style={{width:36,height:2,background:step>s?cfg.couleur:"rgba(255,255,255,0.1)",borderRadius:99}}/>}
            </div>
          ))}
        </div>
        <div style={{background:"#1C1C1E",borderRadius:20,padding:28,border:"1px solid rgba(255,255,255,0.08)"}}>
          {step===1&&(
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:18}}>📋 Informations de l'école</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Inp label="Nom de l'école *" value={cfg.nom} onChange={e=>setCfg({...cfg,nom:e.target.value})} placeholder="Ex: École Excellence Dakar"/>
                <Inp label="Slogan" value={cfg.slogan} onChange={e=>setCfg({...cfg,slogan:e.target.value})} placeholder="Ex: L'excellence au service de l'avenir"/>
                <Inp label="Adresse" value={cfg.adresse} onChange={e=>setCfg({...cfg,adresse:e.target.value})} placeholder="Ex: Dakar, Sénégal"/>
                <Inp label="Téléphone" value={cfg.telephone} onChange={e=>setCfg({...cfg,telephone:e.target.value})} placeholder="+221 77 000 00 00"/>
                <Inp label="Email" value={cfg.email} onChange={e=>setCfg({...cfg,email:e.target.value})} placeholder="contact@monecole.com"/>
                <Sel label="Devise" value={cfg.devise} onChange={e=>setCfg({...cfg,devise:e.target.value})} options={DEVISES}/>
                <Sel label="Niveau scolaire" value={cfg.niveau} onChange={e=>setCfg({...cfg,niveau:e.target.value})} options={NIVEAUX}/>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <label style={{fontSize:12,fontWeight:600,color:"#636366"}}>Couleur principale</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {COLORS.map(c=>(
                      <button key={c} onClick={()=>setCfg({...cfg,couleur:c})}
                        style={{width:30,height:30,borderRadius:99,background:c,border:`3px solid ${cfg.couleur===c?"#fff":c}`,cursor:"pointer",
                          boxShadow:cfg.couleur===c?"0 0 0 2px "+c:"none"}}/>
                    ))}
                  </div>
                </div>
              </div>
              <Btn onClick={()=>setStep(2)} style={{marginTop:22,width:"100%"}} color={cfg.couleur}>Continuer →</Btn>
            </div>
          )}
          {step===2&&(
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:6}}>🎓 Classes</div>
              <div style={{fontSize:13,color:"#636366",marginBottom:16}}>Définissez les classes de votre école</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {cfg.classes.map(c=>(
                  <div key={c} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(255,255,255,0.06)",borderRadius:99,border:"1px solid rgba(255,255,255,0.1)"}}>
                    <span style={{color:"#f2f2f7",fontSize:13,fontWeight:600}}>{c}</span>
                    <button onClick={()=>setCfg({...cfg,classes:cfg.classes.filter(x=>x!==c)})}
                      style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:14,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                <input value={newClasse} onChange={e=>setNewClasse(e.target.value)} placeholder="Nouvelle classe..."
                  style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"9px 13px",color:"#f2f2f7",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                <button onClick={()=>{if(newClasse.trim()){setCfg({...cfg,classes:[...cfg.classes,newClasse.trim()]});setNewClasse("");}}}
                  style={{background:cfg.couleur,color:"#fff",border:"none",padding:"9px 18px",borderRadius:9,cursor:"pointer",fontWeight:700}}>+ Ajouter</button>
              </div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:6}}>📚 Matières</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {cfg.matieres.map(m=>(
                  <div key={m} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(255,255,255,0.06)",borderRadius:99,border:"1px solid rgba(255,255,255,0.1)"}}>
                    <span style={{color:"#f2f2f7",fontSize:13,fontWeight:600}}>{m}</span>
                    <button onClick={()=>setCfg({...cfg,matieres:cfg.matieres.filter(x=>x!==m)})}
                      style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:14,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                <input value={newMatiere} onChange={e=>setNewMatiere(e.target.value)} placeholder="Nouvelle matière..."
                  style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"9px 13px",color:"#f2f2f7",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                <button onClick={()=>{if(newMatiere.trim()){setCfg({...cfg,matieres:[...cfg.matieres,newMatiere.trim()]});setNewMatiere("");}}}
                  style={{background:cfg.couleur,color:"#fff",border:"none",padding:"9px 18px",borderRadius:9,cursor:"pointer",fontWeight:700}}>+ Ajouter</button>
              </div>
              <div style={{display:"flex",gap:10}}>
                <BtnSec onClick={()=>setStep(1)}>← Retour</BtnSec>
                <Btn onClick={()=>setStep(3)} style={{flex:1}} color={cfg.couleur}>Continuer →</Btn>
              </div>
            </div>
          )}
          {step===3&&(
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:6}}>💰 Frais scolaires</div>
              <div style={{fontSize:13,color:"#636366",marginBottom:16}}>Définissez vos tarifs par défaut</div>
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:22}}>
                <Inp label={`Frais d'inscription (${cfg.devise})`} type="number" value={cfg.fraisInscription} onChange={e=>setCfg({...cfg,fraisInscription:parseInt(e.target.value)||0})} placeholder="50000"/>
                <Inp label={`Frais mensuel (${cfg.devise})`} type="number" value={cfg.fraisMensuel} onChange={e=>setCfg({...cfg,fraisMensuel:parseInt(e.target.value)||0})} placeholder="15000"/>
              </div>
              <div style={{display:"flex",gap:10}}>
                <BtnSec onClick={()=>setStep(2)}>← Retour</BtnSec>
                <Btn onClick={finish} style={{flex:1}} color={cfg.couleur}>🚀 Lancer le logiciel</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({eleves,paiements,depenses,recettes,absences,cfg}) {
  const {theme}=useTheme();
  const {couleur,devise}=cfg;
  const totalEleves=eleves.length;
  const elevesActifs=eleves.filter(e=>e.statut==="Actif").length;
  const totalPaye=paiements.reduce((s,p)=>s+p.montant,0);
  const totalDepenses=depenses.filter(d=>d.statut==="Approuvée").reduce((s,d)=>s+d.montant,0);
  const totalRecettes=recettes.reduce((s,r)=>s+r.montant,0)+totalPaye;
  const benefice=totalRecettes-totalDepenses;
  const absAuj=absences.filter(a=>a.date===today()).length;
  const impaye=eleves.filter(e=>{
    const paid=paiements.filter(p=>p.eleveId===e.id&&p.mois===new Date().toISOString().slice(0,7)).reduce((s,p)=>s+p.montant,0);
    return paid<cfg.fraisMensuel && e.statut==="Actif";
  }).length;

  return (
    <div>
      <h1 style={{fontWeight:800,fontSize:24,margin:"0 0 20px",color:theme.text}}>Tableau de bord</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <KPI label="Total élèves" value={totalEleves} accent={couleur} icon="👨‍🎓" sub={`${elevesActifs} actifs`}/>
        <KPI label="Recettes totales" value={xof(totalRecettes,devise)} accent="#30D158" icon="💰" sub="Paiements + recettes"/>
        <KPI label="Dépenses" value={xof(totalDepenses,devise)} accent="#FF453A" icon="📤" sub={`${depenses.length} entrées`}/>
        <KPI label="Bénéfice net" value={xof(benefice,devise)} accent={benefice>=0?"#30D158":"#FF453A"} icon="📈" sub="Recettes − dépenses"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <KPI label="Absents aujourd'hui" value={absAuj} accent="#FF9F0A" icon="📅" sub={today()}/>
        <KPI label="Impayés ce mois" value={impaye} accent="#FF453A" icon="⚠️" sub="élèves en retard"/>
        <KPI label="Frais mensuel" value={xof(cfg.fraisMensuel,devise)} accent={couleur} icon="💳" sub={`Inscription: ${xof(cfg.fraisInscription,devise)}`}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card>
          <CardTitle color={couleur}>Derniers élèves inscrits</CardTitle>
          {eleves.length===0?<div style={{color:theme.textMuted,fontSize:13}}>Aucun élève</div>:eleves.slice(0,5).map(e=>(
            <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:theme.text}}>{e.prenom} {e.nom}</div>
                <div style={{fontSize:11,color:theme.textMuted}}>{e.classe} · {e.dateInscription}</div>
              </div>
              <Badge label={e.statut} color={e.statut==="Actif"?"#30D158":"#FF453A"} bg={e.statut==="Actif"?"#1C3A27":"#3A1C1C"}/>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle color={couleur}>Derniers paiements</CardTitle>
          {paiements.length===0?<div style={{color:theme.textMuted,fontSize:13}}>Aucun paiement</div>:paiements.slice(0,5).map(p=>{
            const eleve=eleves.find(e=>e.id===p.eleveId);
            return (
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</div>
                  <div style={{fontSize:11,color:theme.textMuted}}>{p.type} · {p.date}</div>
                </div>
                <div style={{fontWeight:700,color:"#30D158",fontSize:13}}>{xof(p.montant,devise)}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─── Élèves ───────────────────────────────────────────────────────────────────
function Eleves({eleves,setEleves,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,classes,devise}=cfg;
  const [show,setShow]=useState(false);
  const [search,setSearch]=useState("");
  const [fClasse,setFClasse]=useState("all");
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({nom:"",prenom:"",classe:classes[0]||"",dateNaissance:"",telephone:"",parent:"",telephoneParent:"",adresse:"",dateInscription:today(),statut:"Actif",note:""});

  const filtered=eleves.filter(e=>{
    const q=search.toLowerCase();
    const match=!q||(e.nom+e.prenom+e.classe).toLowerCase().includes(q);
    return match&&(fClasse==="all"||e.classe===fClasse);
  });

  const add=async()=>{
    if(!form.nom||!form.prenom)return showToast("Nom et prénom requis",true);
    if(editId){
      await dbPatch("eleves",editId,{nom:form.nom,prenom:form.prenom,classe:form.classe,date_naissance:form.dateNaissance,telephone:form.telephone,parent:form.parent,telephone_parent:form.telephoneParent,adresse:form.adresse,date_inscription:form.dateInscription,statut:form.statut,note:form.note});
      setEleves(eleves.map(e=>e.id===editId?{...e,...form}:e));
      setEditId(null);showToast("Élève modifié ✓");
    } else {
      const rows=await dbAdd("eleves",{nom:form.nom,prenom:form.prenom,classe:form.classe,date_naissance:form.dateNaissance,telephone:form.telephone,parent:form.parent,telephone_parent:form.telephoneParent,adresse:form.adresse,date_inscription:form.dateInscription,statut:form.statut,note:form.note});
      setEleves([{...rows[0],dateNaissance:rows[0].date_naissance,telephoneParent:rows[0].telephone_parent,dateInscription:rows[0].date_inscription},...eleves]);
      showToast("Élève inscrit ✓");
    }
    setForm({nom:"",prenom:"",classe:classes[0]||"",dateNaissance:"",telephone:"",parent:"",telephoneParent:"",adresse:"",dateInscription:today(),statut:"Actif",note:""});
    setShow(false);
  };
  const startEdit=(e)=>{setForm({...e,dateNaissance:e.date_naissance||e.dateNaissance||"",telephoneParent:e.telephone_parent||e.telephoneParent||"",dateInscription:e.date_inscription||e.dateInscription||""});setEditId(e.id);setShow(true);};
  const del=async(id)=>{await dbDel("eleves",id);setEleves(eleves.filter(e=>e.id!==id));showToast("Supprimé");};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>👨‍🎓 Élèves ({eleves.length})</h1>
        <Btn onClick={()=>{setShow(!show);setEditId(null);setForm({nom:"",prenom:"",classe:classes[0]||"",dateNaissance:"",telephone:"",parent:"",telephoneParent:"",adresse:"",dateInscription:today(),statut:"Actif",note:""});}} color={couleur}>{show?"✕ Annuler":"+ Inscrire un élève"}</Btn>
      </div>
      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:14}}>{editId?"✏️ Modifier l'élève":"Nouvelle inscription"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Inp label="Nom *" value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} placeholder="Nom de famille"/>
            <Inp label="Prénom *" value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} placeholder="Prénom"/>
            <Sel label="Classe" value={form.classe} onChange={e=>setForm({...form,classe:e.target.value})} options={classes}/>
            <Inp label="Date de naissance" type="date" value={form.dateNaissance} onChange={e=>setForm({...form,dateNaissance:e.target.value})}/>
            <Inp label="Téléphone élève" value={form.telephone} onChange={e=>setForm({...form,telephone:e.target.value})} placeholder="+221 77 000 00 00"/>
            <Inp label="Nom du parent" value={form.parent} onChange={e=>setForm({...form,parent:e.target.value})} placeholder="Nom complet"/>
            <Inp label="Téléphone parent" value={form.telephoneParent} onChange={e=>setForm({...form,telephoneParent:e.target.value})} placeholder="+221 77 000 00 00"/>
            <Inp label="Adresse" value={form.adresse} onChange={e=>setForm({...form,adresse:e.target.value})} placeholder="Quartier, ville"/>
            <Inp label="Date d'inscription" type="date" value={form.dateInscription} onChange={e=>setForm({...form,dateInscription:e.target.value})}/>
            <Sel label="Statut" value={form.statut} onChange={e=>setForm({...form,statut:e.target.value})} options={["Actif","Inactif","Exclu","Diplômé"]}/>
            <div style={{gridColumn:"1/-1"}}><Inp label="Note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Informations supplémentaires"/></div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={add} color={couleur}>{editId?"💾 Sauvegarder":"Inscrire"}</Btn>
            {editId&&<BtnSec onClick={()=>{setEditId(null);setShow(false);}}>Annuler</BtnSec>}
          </div>
        </Card>
      )}
      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un élève..."
          style={{flex:1,background:theme.input,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 13px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <select value={fClasse} onChange={e=>setFClasse(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          <option value="all">Toutes classes</option>
          {classes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{color:theme.textMuted,fontSize:13}}>{filtered.length} élève{filtered.length!==1?"s":""}</div>
      </div>
      <TableWrap>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Élève","Classe","Parent","Téléphone","Inscription","Statut","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><Td colSpan={7} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucun élève trouvé</Td></tr>}
            {filtered.map(e=>(
              <tr key={e.id}>
                <Td><strong style={{color:theme.text}}>{e.prenom} {e.nom}</strong>{e.note&&<div style={{fontSize:11,color:theme.textMuted}}>{e.note}</div>}</Td>
                <Td><span style={{background:couleur+"22",color:couleur,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:700}}>{e.classe}</span></Td>
                <Td style={{color:theme.textSub}}>{e.parent||"—"}</Td>
                <Td style={{color:theme.textMuted,fontSize:12}}>{e.telephoneParent||e.telephone||"—"}</Td>
                <Td style={{color:theme.textMuted,fontSize:12}}>{e.dateInscription}</Td>
                <Td><Badge label={e.statut} color={e.statut==="Actif"?"#30D158":e.statut==="Exclu"?"#FF453A":"#FF9F0A"} bg={e.statut==="Actif"?"#1C3A27":e.statut==="Exclu"?"#3A1C1C":"#3A2F1C"}/></Td>
                <Td>
                  <div style={{display:"flex",gap:6}}>
                    <button style={{background:"rgba(255,159,10,0.12)",border:"1px solid #FF9F0A",color:"#FF9F0A",padding:"4px 8px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}} onClick={()=>startEdit(e)}>✏️</button>
                    <button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"4px 8px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={()=>del(e.id)}>🗑</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

// ─── Paiements ────────────────────────────────────────────────────────────────
function Paiements({paiements,setPaiements,eleves,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,devise,fraisParClasse,fraisInscriptionParClasse,fraisMensuel,fraisInscription,fraisSpeciaux,typesPaiements,coursDuSoir,fraisCoursSOir}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [show,setShow]=useState(false);
  const [fMois,setFMois]=useState("");
  const [fType,setFType]=useState("all");
  const moisCourant=new Date().toISOString().slice(0,7);
  const moisNum=new Date().toISOString().slice(5,7);

  // Frais mensuel selon la classe et le mois
  const getFraisMensuel=(classe,mois)=>{
    const mm=mois?mois.slice(5,7):moisNum;
    if(fraisSpeciaux&&fraisSpeciaux[mm]>0) return fraisSpeciaux[mm];
    return fraisParClasse?.[classe]||fraisMensuel||0;
  };
  const getFraisInscription=(classe)=>fraisInscriptionParClasse?.[classe]||fraisInscription||0;

  const [form,setForm]=useState({
    eleveId:"",type:(typesPaiements&&typesPaiements[0])||"Mensualité",
    montant:fraisMensuel||0,date:today(),
    mois:moisCourant,note:"",coursSoir:false
  });

  // Auto-calculer le montant selon type + classe + mois
  const handleType=(type)=>{
    const eleve=eleves.find(e=>e.id===form.eleveId);
    let montant=form.montant;
    if(type==="Mensualité") montant=getFraisMensuel(eleve?.classe,form.mois);
    else if(type==="Inscription") montant=getFraisInscription(eleve?.classe);
    else if(type==="Cours du soir") montant=fraisCoursSOir||0;
    setForm({...form,type,montant});
  };

  const handleEleve=(eleveId)=>{
    const eleve=eleves.find(e=>e.id===Number(eleveId));
    let montant=form.montant;
    if(form.type==="Mensualité") montant=getFraisMensuel(eleve?.classe,form.mois);
    else if(form.type==="Inscription") montant=getFraisInscription(eleve?.classe);
    setForm({...form,eleveId:Number(eleveId),montant});
  };

  const handleMois=(mois)=>{
    const eleve=eleves.find(e=>e.id===form.eleveId);
    let montant=form.montant;
    if(form.type==="Mensualité") montant=getFraisMensuel(eleve?.classe,mois);
    setForm({...form,mois,montant});
  };

  const filtered=paiements.filter(p=>{
    const typeOk=fType==="all"||p.type===fType;
    const moisOk=!fMois||p.mois===fMois;
    return typeOk&&moisOk;
  });
  const total=filtered.reduce((s,p)=>s+p.montant,0);

  const add=async()=>{
    if(!form.eleveId)return showToast("Sélectionnez un élève",true);
    if(!form.montant)return showToast("Montant requis",true);
    const rows=await dbAdd("paiements",{eleve_id:form.eleveId,type:form.type,montant:parseInt(form.montant),date:form.date,mois:form.mois,note:form.note});
    setPaiements([{...rows[0],eleveId:rows[0].eleve_id},...paiements]);
    const eleve=eleves.find(e=>e.id===form.eleveId);
    setForm({...form,eleveId:"",note:"",montant:getFraisMensuel(eleve?.classe,form.mois)});
    setShow(false);showToast("Paiement enregistré ✓");
  };
  const del=async(id)=>{await dbDel("paiements",id);setPaiements(paiements.filter(p=>p.id!==id));showToast("Supprimé");};

  // Impayés ce mois (mensualité seulement)
  const impayes=eleves.filter(e=>{
    if(e.statut!=="Actif")return false;
    const paye=paiements.filter(p=>p.eleveId===e.id&&p.mois===moisCourant&&p.type==="Mensualité").reduce((s,p)=>s+p.montant,0);
    return paye<getFraisMensuel(e.classe,moisCourant);
  });

  const TYPES=typesPaiements||["Mensualité","Inscription","Cantine","Fournitures","Transport","Cours du soir","Autre"];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>💰 Paiements</h1>
        <Btn onClick={()=>setShow(!show)} color={couleur}>{show?"✕ Annuler":"+ Nouveau paiement"}</Btn>
      </div>

      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:14}}>Nouveau paiement</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Sel label="Élève *" value={form.eleveId} onChange={e=>handleEleve(e.target.value)}
              options={[{v:"",l:"-- Choisir un élève --"},...eleves.filter(e=>e.statut==="Actif").map(e=>({v:e.id,l:`${e.prenom} ${e.nom} (${e.classe})`}))]}/>
            <Sel label="Type de paiement" value={form.type} onChange={e=>handleType(e.target.value)}
              options={TYPES}/>
            <Inp label={`Montant (${devise}) *`} type="number" value={form.montant} onChange={e=>setForm({...form,montant:e.target.value})} placeholder="0"/>
            <Inp label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            <Inp label="Mois concerné" type="month" value={form.mois} onChange={e=>handleMois(e.target.value)}/>
            <Inp label="Note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optionnel"/>
          </div>
          {/* Info montant automatique */}
          {form.eleveId&&(
            <div style={{padding:"10px 14px",background:couleur+"11",borderRadius:10,marginBottom:12,fontSize:13,color:theme.textMuted}}>
              💡 Frais mensuel pour ce mois : <strong style={{color:couleur}}>{fmt(getFraisMensuel(eleves.find(e=>e.id===form.eleveId)?.classe,form.mois))}</strong>
              {fraisSpeciaux?.[form.mois?.slice(5,7)]>0&&<span style={{color:"#FF9F0A",marginLeft:8}}>⚠️ Tarif spécial {form.mois?.slice(5,7)==="01"?"Janvier":"Février"}</span>}
            </div>
          )}
          <Btn onClick={add} color={couleur}>Enregistrer le paiement</Btn>
        </Card>
      )}

      {/* Impayés */}
      {impayes.length>0&&(
        <Card style={{marginBottom:16,borderColor:"rgba(255,69,58,0.3)"}}>
          <CardTitle color="#FF453A">⚠️ Mensualités impayées ce mois ({impayes.length})</CardTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {impayes.map(e=>(
              <div key={e.id} style={{padding:"6px 12px",background:"rgba(255,69,58,0.1)",borderRadius:99,border:"1px solid rgba(255,69,58,0.3)"}}>
                <span style={{color:"#FF453A",fontSize:12,fontWeight:600}}>{e.prenom} {e.nom} — {e.classe}</span>
                <span style={{color:"#FF9F0A",fontSize:11,marginLeft:6}}>({fmt(getFraisMensuel(e.classe,moisCourant))})</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <input type="month" value={fMois} onChange={e=>setFMois(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}/>
        <select value={fType} onChange={e=>setFType(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          <option value="all">Tous types</option>
          {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{marginLeft:"auto",color:theme.textMuted,fontSize:13}}>
          Total : <strong style={{color:"#30D158"}}>{fmt(total)}</strong> — {filtered.length} paiement{filtered.length!==1?"s":""}
        </div>
      </div>

      <TableWrap>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Élève","Classe","Type","Mois","Montant","Date","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><Td colSpan={7} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucun paiement</Td></tr>}
            {filtered.map(p=>{
              const eleve=eleves.find(e=>e.id===p.eleveId);
              return (
                <tr key={p.id}>
                  <Td><strong style={{color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</strong></Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{eleve?.classe||"—"}</Td>
                  <Td><span style={{background:couleur+"22",color:couleur,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600}}>{p.type}</span></Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{p.mois}</Td>
                  <Td style={{fontWeight:700,color:"#30D158"}}>{fmt(p.montant)}</Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{p.date}</Td>
                  <Td><button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"4px 8px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={()=>del(p.id)}>🗑</button></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function Notes({notes,setNotes,eleves,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,matieres,classes,matieresParClasse={}}=cfg;
  const [show,setShow]=useState(false);
  const [fClasse,setFClasse]=useState(classes[0]||"");

  // Matières disponibles = communes + spécifiques à la classe sélectionnée
  const getMatieres=(classe)=>{
    const specifiques=matieresParClasse[classe]||[];
    const toutes=[...matieres];
    specifiques.forEach(m=>{if(!toutes.includes(m))toutes.push(m);});
    return toutes;
  };

  const matieresDisponibles=getMatieres(fClasse);
  const [fMatiere,setFMatiere]=useState(matieresDisponibles[0]||"");
  const [form,setForm]=useState({eleveId:"",matiere:matieresDisponibles[0]||"",note:"",coeff:1,type:"Devoir",trimestre:"T1",date:today()});

  const elevesClasse=eleves.filter(e=>e.classe===fClasse&&e.statut==="Actif");
  const notesFiltered=notes.filter(n=>{
    const eleve=eleves.find(e=>e.id===n.eleveId);
    return eleve?.classe===fClasse&&n.matiere===fMatiere;
  });

  // Moyenne par élève pour la matière sélectionnée
  const moyennes=elevesClasse.map(e=>{
    const ns=notes.filter(n=>n.eleveId===e.id&&n.matiere===fMatiere);
    const moy=ns.length>0?ns.reduce((s,n)=>s+n.note*n.coeff,0)/ns.reduce((s,n)=>s+n.coeff,0):null;
    return {...e,moy};
  }).sort((a,b)=>(b.moy||0)-(a.moy||0));

  const add=async()=>{
    if(!form.eleveId||form.note==="")return showToast("Élève et note requis",true);
    const n=parseFloat(form.note);
    if(n<0||n>20)return showToast("Note entre 0 et 20",true);
    const rows=await dbAdd("notes",{eleve_id:form.eleveId,matiere:form.matiere,note:n,coeff:parseInt(form.coeff)||1,type:form.type,trimestre:form.trimestre,date:form.date,classe:form.classe||fClasse});
    setNotes([{...rows[0],eleveId:rows[0].eleve_id},...notes]);
    setForm({...form,eleveId:"",note:""});
    showToast("Note enregistrée ✓");
  };
  const del=async(id)=>{await dbDel("notes",id);setNotes(notes.filter(n=>n.id!==id));showToast("Supprimée");};

  const moyColor=(m)=>m>=14?"#30D158":m>=10?"#FF9F0A":"#FF453A";

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>📝 Notes & Bulletins</h1>
        <Btn onClick={()=>setShow(!show)} color={couleur}>{show?"✕ Annuler":"+ Saisir des notes"}</Btn>
      </div>
      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Sel label="Classe" value={form.classe||fClasse} onChange={e=>{
              const cls=e.target.value;
              const mats=getMatieres(cls);
              setForm({...form,classe:cls,matiere:mats[0]||""});
            }} options={classes}/>
            <Sel label="Élève *" value={form.eleveId} onChange={e=>setForm({...form,eleveId:Number(e.target.value)})}
              options={[{v:"",l:"-- Choisir --"},...eleves.filter(e=>e.classe===(form.classe||fClasse)&&e.statut==="Actif").map(e=>({v:e.id,l:`${e.prenom} ${e.nom}`}))]}/>
            <Sel label="Matière" value={form.matiere} onChange={e=>setForm({...form,matiere:e.target.value})} options={getMatieres(form.classe||fClasse)}/>
            <Inp label="Note (/20) *" type="number" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Ex: 15.5"/>
            <Inp label="Coefficient" type="number" value={form.coeff} onChange={e=>setForm({...form,coeff:e.target.value})} placeholder="1"/>
            <Sel label="Type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} options={["Devoir","Composition","Examen","Contrôle","TP"]}/>
            <Sel label="Trimestre" value={form.trimestre} onChange={e=>setForm({...form,trimestre:e.target.value})} options={["T1","T2","T3"]}/>
            <Inp label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </div>
          <Btn onClick={add} color={couleur}>Enregistrer la note</Btn>
        </Card>
      )}
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <select value={fClasse} onChange={e=>{setFClasse(e.target.value);setFMatiere(getMatieres(e.target.value)[0]||"");}}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {classes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fMatiere} onChange={e=>setFMatiere(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {getMatieres(fClasse).map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{marginLeft:"auto",fontSize:11,color:theme.textMuted,alignSelf:"center"}}>
          {(matieresParClasse[fClasse]||[]).length>0&&
            <span style={{color:couleur}}>+ {(matieresParClasse[fClasse]||[]).join(", ")} (spécifiques)</span>
          }
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <CardTitle color={couleur}>Classement — {fClasse} · {fMatiere}</CardTitle>
          {moyennes.length===0?<div style={{color:theme.textMuted,fontSize:13}}>Aucun élève dans cette classe</div>:moyennes.map((e,i)=>(
            <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
              <div style={{width:24,height:24,borderRadius:6,background:couleur+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:couleur}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:theme.text}}>{e.prenom} {e.nom}</div>
              </div>
              {e.moy!==null
                ?<div style={{fontWeight:800,fontSize:16,color:moyColor(e.moy)}}>{e.moy.toFixed(2)}/20</div>
                :<div style={{color:theme.textMuted,fontSize:12}}>—</div>
              }
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle color={couleur}>Dernières notes saisies</CardTitle>
          {notesFiltered.length===0?<div style={{color:theme.textMuted,fontSize:13}}>Aucune note</div>:notesFiltered.slice(0,8).map(n=>{
            const eleve=eleves.find(e=>e.id===n.eleveId);
            return (
              <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</div>
                  <div style={{fontSize:11,color:theme.textMuted}}>{n.type} · {n.trimestre} · {n.date}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontWeight:800,fontSize:15,color:moyColor(n.note)}}>{n.note}/20</div>
                  <button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"3px 6px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}} onClick={()=>del(n.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─── Absences ─────────────────────────────────────────────────────────────────
function Absences({absences,setAbsences,eleves,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,classes}=cfg;
  const [show,setShow]=useState(false);
  const [fDate,setFDate]=useState(today());
  const [fClasse,setFClasse]=useState("all");
  const [form,setForm]=useState({eleveId:"",date:today(),type:"Absence",motif:"",justifie:false});

  const filtered=absences.filter(a=>{
    const eleve=eleves.find(e=>e.id===a.eleveId);
    const dateOk=!fDate||a.date===fDate;
    const classeOk=fClasse==="all"||eleve?.classe===fClasse;
    return dateOk&&classeOk;
  });

  const add=async()=>{
    if(!form.eleveId)return showToast("Sélectionnez un élève",true);
    const rows=await dbAdd("absences",{eleve_id:form.eleveId,date:form.date,type:form.type,motif:form.motif,justifie:form.justifie});
    setAbsences([{...rows[0],eleveId:rows[0].eleve_id},...absences]);
    setForm({...form,eleveId:"",motif:"",justifie:false});
    showToast("Absence enregistrée ✓");
  };
  const del=async(id)=>{await dbDel("absences",id);setAbsences(absences.filter(a=>a.id!==id));showToast("Supprimée");};
  const toggle=async(id)=>{
    const a=absences.find(x=>x.id===id);
    await dbPatch("absences",id,{justifie:!a.justifie});
    setAbsences(absences.map(x=>x.id===id?{...x,justifie:!x.justifie}:x));
  };

  // Stats
  const totalAbsences=absences.length;
  const njustif=absences.filter(a=>!a.justifie).length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>📅 Présences & Absences</h1>
        <Btn onClick={()=>setShow(!show)} color={couleur}>{show?"✕ Annuler":"+ Enregistrer une absence"}</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Total absences" value={totalAbsences} accent={couleur} icon="📅" sub="toutes périodes"/>
        <KPI label="Non justifiées" value={njustif} accent="#FF453A" icon="⚠️" sub="à traiter"/>
        <KPI label="Justifiées" value={totalAbsences-njustif} accent="#30D158" icon="✓" sub="validées"/>
      </div>
      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Sel label="Élève *" value={form.eleveId} onChange={e=>setForm({...form,eleveId:Number(e.target.value)})}
              options={[{v:"",l:"-- Choisir un élève --"},...eleves.filter(e=>e.statut==="Actif").map(e=>({v:e.id,l:`${e.prenom} ${e.nom} (${e.classe})`}))]}/>
            <Inp label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            <Sel label="Type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} options={["Absence","Retard","Renvoi"]}/>
            <Inp label="Motif" value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} placeholder="Raison de l'absence..."/>
            <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setForm({...form,justifie:!form.justifie})}>
              <div style={{width:20,height:20,borderRadius:6,background:form.justifie?"#30D158":theme.toggleBg,border:`2px solid ${form.justifie?"#30D158":theme.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {form.justifie&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:13,color:theme.text,fontWeight:600}}>Justifiée</span>
            </div>
          </div>
          <Btn onClick={add} color={couleur}>Enregistrer</Btn>
        </Card>
      )}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <Inp label="" value={fDate} onChange={e=>setFDate(e.target.value)} type="date"/>
        <select value={fClasse} onChange={e=>setFClasse(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          <option value="all">Toutes classes</option>
          {classes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{marginLeft:"auto",color:theme.textMuted,fontSize:13,alignSelf:"center"}}>{filtered.length} enregistrement{filtered.length!==1?"s":""}</div>
      </div>
      <TableWrap>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Élève","Classe","Date","Type","Motif","Statut","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><Td colSpan={7} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucune absence</Td></tr>}
            {filtered.map(a=>{
              const eleve=eleves.find(e=>e.id===a.eleveId);
              return (
                <tr key={a.id}>
                  <Td><strong style={{color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</strong></Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{eleve?.classe||"—"}</Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{a.date}</Td>
                  <Td><span style={{background:a.type==="Renvoi"?"#3A1C1C":a.type==="Retard"?"#3A2F1C":"rgba(255,255,255,0.06)",color:a.type==="Renvoi"?"#FF453A":a.type==="Retard"?"#FF9F0A":theme.textSub,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600}}>{a.type}</span></Td>
                  <Td style={{color:theme.textMuted,fontSize:12}}>{a.motif||"—"}</Td>
                  <Td>
                    <button onClick={()=>toggle(a.id)} style={{background:a.justifie?"#1C3A27":"#3A1C1C",color:a.justifie?"#30D158":"#FF453A",border:"none",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      {a.justifie?"✓ Justifiée":"✕ Non justifiée"}
                    </button>
                  </Td>
                  <Td><button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"4px 8px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={()=>del(a.id)}>🗑</button></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

// ─── Finances ─────────────────────────────────────────────────────────────────
function Finances({depenses,setDepenses,recettes,setRecettes,paiements,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,devise}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [tab,setTab]=useState("depenses");
  const [showDep,setShowDep]=useState(false);
  const [showRec,setShowRec]=useState(false);
  const [formDep,setFormDep]=useState({titre:"",categorie:"Salaires",montant:"",date:today(),statut:"En attente",note:""});
  const [formRec,setFormRec]=useState({titre:"",categorie:"Autres",montant:"",date:today(),note:""});

  const CAT_DEP=["Salaires","Loyer","Fournitures","Eau/Électricité","Internet","Entretien","Transport","Autre"];
  const CAT_REC=["Cantine","Transport scolaire","Activités","Dons","Subventions","Autres"];

  const totalDep=depenses.filter(d=>d.statut==="Approuvée").reduce((s,d)=>s+d.montant,0);
  const totalRec=recettes.reduce((s,r)=>s+r.montant,0)+paiements.reduce((s,p)=>s+p.montant,0);
  const ben=totalRec-totalDep;

  const addDep=async()=>{
    if(!formDep.titre||!formDep.montant)return showToast("Titre et montant requis",true);
    const rows=await dbAdd("depenses",{titre:formDep.titre,categorie:formDep.categorie,montant:parseInt(formDep.montant),date:formDep.date,statut:formDep.statut,note:formDep.note});
    setDepenses([rows[0],...depenses]);
    setFormDep({titre:"",categorie:"Salaires",montant:"",date:today(),statut:"En attente",note:""});
    setShowDep(false);showToast("Dépense enregistrée ✓");
  };
  const addRec=async()=>{
    if(!formRec.titre||!formRec.montant)return showToast("Titre et montant requis",true);
    const rows=await dbAdd("recettes",{titre:formRec.titre,categorie:formRec.categorie,montant:parseInt(formRec.montant),date:formRec.date,note:formRec.note});
    setRecettes([rows[0],...recettes]);
    setFormRec({titre:"",categorie:"Autres",montant:"",date:today(),note:""});
    setShowRec(false);showToast("Recette enregistrée ✓");
  };
  const chStat=async(id,statut)=>{await dbPatch("depenses",id,{statut});setDepenses(depenses.map(d=>d.id===id?{...d,statut}:d));};
  const delDep=async(id)=>{await dbDel("depenses",id);setDepenses(depenses.filter(d=>d.id!==id));showToast("Supprimée");};
  const delRec=async(id)=>{await dbDel("recettes",id);setRecettes(recettes.filter(r=>r.id!==id));showToast("Supprimée");};

  return (
    <div>
      <h1 style={{fontWeight:800,fontSize:24,margin:"0 0 16px",color:theme.text}}>💼 Finances</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <KPI label="Total recettes" value={fmt(totalRec)} accent="#30D158" icon="💰" sub="Paiements + autres recettes"/>
        <KPI label="Total dépenses" value={fmt(totalDep)} accent="#FF453A" icon="📤" sub="Approuvées seulement"/>
        <KPI label="Solde" value={fmt(ben)} accent={ben>=0?"#30D158":"#FF453A"} icon={ben>=0?"📈":"📉"} sub="Recettes − dépenses"/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["depenses","📤 Dépenses"],["recettes","💰 Recettes"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{padding:"8px 20px",borderRadius:10,border:"1px solid",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",
              borderColor:tab===v?couleur:theme.border,background:tab===v?couleur+"18":theme.toggleBg,color:tab===v?couleur:theme.textMuted}}>
            {l}
          </button>
        ))}
      </div>
      {tab==="depenses"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <Btn onClick={()=>setShowDep(!showDep)} color={couleur}>{showDep?"✕ Annuler":"+ Nouvelle dépense"}</Btn>
          </div>
          {showDep&&(
            <Card style={{marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <Inp label="Titre *" value={formDep.titre} onChange={e=>setFormDep({...formDep,titre:e.target.value})} placeholder="Description"/>
                <Inp label={`Montant (${devise}) *`} type="number" value={formDep.montant} onChange={e=>setFormDep({...formDep,montant:e.target.value})} placeholder="0"/>
                <Sel label="Catégorie" value={formDep.categorie} onChange={e=>setFormDep({...formDep,categorie:e.target.value})} options={CAT_DEP}/>
                <Inp label="Date" type="date" value={formDep.date} onChange={e=>setFormDep({...formDep,date:e.target.value})}/>
                <Sel label="Statut" value={formDep.statut} onChange={e=>setFormDep({...formDep,statut:e.target.value})} options={["En attente","Approuvée","Rejetée"]}/>
                <Inp label="Note" value={formDep.note} onChange={e=>setFormDep({...formDep,note:e.target.value})} placeholder="Optionnel"/>
              </div>
              <Btn onClick={addDep} color={couleur}>Enregistrer</Btn>
            </Card>
          )}
          <TableWrap>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Dépense","Catégorie","Date","Montant","Statut","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {depenses.length===0&&<tr><Td colSpan={6} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucune dépense</Td></tr>}
                {depenses.map(d=>(
                  <tr key={d.id}>
                    <Td><strong style={{color:theme.text}}>{d.titre}</strong>{d.note&&<div style={{fontSize:11,color:theme.textMuted}}>{d.note}</div>}</Td>
                    <Td style={{color:theme.textMuted,fontSize:12}}>{d.categorie}</Td>
                    <Td style={{color:theme.textMuted,fontSize:12}}>{d.date}</Td>
                    <Td style={{fontWeight:700,color:"#FF453A"}}>{fmt(d.montant)}</Td>
                    <Td><Badge label={d.statut} color={d.statut==="Approuvée"?"#30D158":d.statut==="Rejetée"?"#FF453A":"#FF9F0A"} bg={d.statut==="Approuvée"?"#1C3A27":d.statut==="Rejetée"?"#3A1C1C":"#3A2F1C"}/></Td>
                    <Td>
                      <div style={{display:"flex",gap:6}}>
                        {d.statut!=="Approuvée"&&<button style={{background:"none",border:"1px solid #30D158",color:"#30D158",padding:"3px 7px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}} onClick={()=>chStat(d.id,"Approuvée")}>✓</button>}
                        <button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"3px 7px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}} onClick={()=>delDep(d.id)}>🗑</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
      {tab==="recettes"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <Btn onClick={()=>setShowRec(!showRec)} color={couleur}>{showRec?"✕ Annuler":"+ Nouvelle recette"}</Btn>
          </div>
          {showRec&&(
            <Card style={{marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <Inp label="Titre *" value={formRec.titre} onChange={e=>setFormRec({...formRec,titre:e.target.value})} placeholder="Description"/>
                <Inp label={`Montant (${devise}) *`} type="number" value={formRec.montant} onChange={e=>setFormRec({...formRec,montant:e.target.value})} placeholder="0"/>
                <Sel label="Catégorie" value={formRec.categorie} onChange={e=>setFormRec({...formRec,categorie:e.target.value})} options={CAT_REC}/>
                <Inp label="Date" type="date" value={formRec.date} onChange={e=>setFormRec({...formRec,date:e.target.value})}/>
                <Inp label="Note" value={formRec.note} onChange={e=>setFormRec({...formRec,note:e.target.value})} placeholder="Optionnel"/>
              </div>
              <Btn onClick={addRec} color={couleur}>Enregistrer</Btn>
            </Card>
          )}
          <TableWrap>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Recette","Catégorie","Date","Montant","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {recettes.length===0&&<tr><Td colSpan={5} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucune recette</Td></tr>}
                {recettes.map(r=>(
                  <tr key={r.id}>
                    <Td><strong style={{color:theme.text}}>{r.titre}</strong>{r.note&&<div style={{fontSize:11,color:theme.textMuted}}>{r.note}</div>}</Td>
                    <Td style={{color:theme.textMuted,fontSize:12}}>{r.categorie}</Td>
                    <Td style={{color:theme.textMuted,fontSize:12}}>{r.date}</Td>
                    <Td style={{fontWeight:700,color:"#30D158"}}>{fmt(r.montant)}</Td>
                    <Td><button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"3px 7px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}} onClick={()=>delRec(r.id)}>🗑</button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
    </div>
  );
}

// ─── Paramètres ───────────────────────────────────────────────────────────────
function Parametres({cfg,updateCfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,classes,matieres,devise}=cfg;
  const [newClasse,setNewClasse]=useState("");
  const [newMatiere,setNewMatiere]=useState("");
  const [newType,setNewType]=useState("");
  const [editNom,setEditNom]=useState(cfg.nom);
  const [editAdresse,setEditAdresse]=useState(cfg.adresse||"");
  const [editTel,setEditTel]=useState(cfg.telephone||"");
  const [editEmail,setEditEmail]=useState(cfg.email||"");
  const [editDevise,setEditDevise]=useState(cfg.devise||"FCFA");
  const [fraisParClasse,setFraisParClasse]=useState(cfg.fraisParClasse||{});
  const [fraisInsParClasse,setFraisInsParClasse]=useState(cfg.fraisInscriptionParClasse||{});
  const [fraisJanvier,setFraisJanvier]=useState(cfg.fraisSpeciaux?.["01"]||0);
  const [fraisFevier,setFraisFevier]=useState(cfg.fraisSpeciaux?.["02"]||0);
  const [coursDuSoir,setCoursDuSoir]=useState(cfg.coursDuSoir||false);
  const [fraisCoursSOir,setFraisCoursSOir]=useState(cfg.fraisCoursSOir||0);
  const [typesPaiements,setTypesPaiements]=useState(cfg.typesPaiements||["Mensualité","Inscription","Cantine","Fournitures","Transport","Cours du soir","Autre"]);
  const [matieresParClasse,setMatieresParClasse]=useState(cfg.matieresParClasse||{});
  const [newMatiereClasse,setNewMatiereClasse]=useState("");
  const [classeSelectionnee,setClasseSelectionnee]=useState(classes[0]||"");

  const COLORS=["#0A84FF","#30D158","#FF9F0A","#FF453A","#BF5AF2","#FF6B35","#5E5CE6","#00C7BE"];

  const addClasse=()=>{
    if(!newClasse.trim())return;
    if(cfg.classes.includes(newClasse.trim()))return showToast("Classe déjà existante",true);
    updateCfg({...cfg,classes:[...cfg.classes,newClasse.trim()]});
    setNewClasse("");showToast("Classe ajoutée ✓");
  };
  const delClasse=(c)=>{updateCfg({...cfg,classes:cfg.classes.filter(x=>x!==c)});showToast("Classe supprimée");};
  const addMatiere=()=>{
    if(!newMatiere.trim())return;
    if(cfg.matieres.includes(newMatiere.trim()))return showToast("Matière déjà existante",true);
    updateCfg({...cfg,matieres:[...cfg.matieres,newMatiere.trim()]});
    setNewMatiere("");showToast("Matière ajoutée ✓");
  };
  const delMatiere=(m)=>{updateCfg({...cfg,matieres:cfg.matieres.filter(x=>x!==m)});showToast("Matière supprimée");};

  const addMatiereClasse=()=>{
    if(!newMatiereClasse.trim())return;
    const current=matieresParClasse[classeSelectionnee]||[];
    if(current.includes(newMatiereClasse.trim()))return showToast("Matière déjà ajoutée",true);
    const updated={...matieresParClasse,[classeSelectionnee]:[...current,newMatiereClasse.trim()]};
    setMatieresParClasse(updated);
    setNewMatiereClasse("");showToast(`Matière ajoutée à ${classeSelectionnee} ✓`);
  };
  const delMatiereClasse=(classe,m)=>{
    const updated={...matieresParClasse,[classe]:(matieresParClasse[classe]||[]).filter(x=>x!==m)};
    setMatieresParClasse(updated);
  };

  const addType=()=>{
    if(!newType.trim())return;
    setTypesPaiements([...typesPaiements,newType.trim()]);
    setNewType("");
  };
  const delType=(t)=>setTypesPaiements(typesPaiements.filter(x=>x!==t));

  const saveInfos=()=>{
    updateCfg({...cfg,
      nom:editNom,adresse:editAdresse,telephone:editTel,email:editEmail,devise:editDevise,
      fraisParClasse,fraisInscriptionParClasse:fraisInsParClasse,
      fraisSpeciaux:{"01":parseInt(fraisJanvier)||0,"02":parseInt(fraisFevier)||0},
      coursDuSoir,fraisCoursSOir:parseInt(fraisCoursSOir)||0,
      typesPaiements,matieresParClasse,
    });
    showToast("Paramètres sauvegardés ✓");
  };

  return (
    <div>
      <h1 style={{fontWeight:800,fontSize:24,margin:"0 0 20px",color:theme.text}}>⚙️ Paramètres</h1>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        {/* Infos école */}
        <Card>
          <CardTitle color={couleur}>🏫 Informations de l'école</CardTitle>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Nom de l'école" value={editNom} onChange={e=>setEditNom(e.target.value)}/>
            <Inp label="Adresse" value={editAdresse} onChange={e=>setEditAdresse(e.target.value)}/>
            <Inp label="Téléphone" value={editTel} onChange={e=>setEditTel(e.target.value)}/>
            <Inp label="Email" value={editEmail} onChange={e=>setEditEmail(e.target.value)}/>
            <Sel label="Devise" value={editDevise} onChange={e=>setEditDevise(e.target.value)} options={DEVISES}/>
          </div>
        </Card>

        {/* Couleur */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <CardTitle color={couleur}>🎨 Couleur principale</CardTitle>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>updateCfg({...cfg,couleur:c})}
                  style={{width:34,height:34,borderRadius:99,background:c,border:`3px solid ${cfg.couleur===c?"#fff":c}`,cursor:"pointer",
                    boxShadow:cfg.couleur===c?"0 0 0 2px "+c:"none"}}/>
              ))}
            </div>
          </Card>

          {/* Cours du soir */}
          <Card>
            <CardTitle color={couleur}>🌙 Cours du soir</CardTitle>
            <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:coursDuSoir?12:0}}
              onClick={()=>setCoursDuSoir(!coursDuSoir)}>
              <div style={{width:20,height:20,borderRadius:6,background:coursDuSoir?couleur:theme.toggleBg,border:`2px solid ${coursDuSoir?couleur:theme.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {coursDuSoir&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:theme.text}}>Activer les cours du soir</span>
            </div>
            {coursDuSoir&&(
              <Inp label={`Frais cours du soir (${editDevise})`} type="number" value={fraisCoursSOir} onChange={e=>setFraisCoursSOir(e.target.value)} placeholder="0"/>
            )}
          </Card>
        </div>
      </div>

      {/* Frais par classe */}
      <Card style={{marginBottom:16}}>
        <CardTitle color={couleur}>💰 Frais par classe</CardTitle>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <Th>Classe</Th>
                <Th>Frais mensuel ({editDevise})</Th>
                <Th>Frais inscription ({editDevise})</Th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c=>(
                <tr key={c}>
                  <Td><strong style={{color:couleur}}>{c}</strong></Td>
                  <Td>
                    <input type="number" value={fraisParClasse[c]||""} onChange={e=>setFraisParClasse({...fraisParClasse,[c]:parseInt(e.target.value)||0})}
                      placeholder={`${cfg.fraisMensuel||0}`}
                      style={{width:"100%",background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:8,padding:"7px 10px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                  </Td>
                  <Td>
                    <input type="number" value={fraisInsParClasse[c]||""} onChange={e=>setFraisInsParClasse({...fraisInsParClasse,[c]:parseInt(e.target.value)||0})}
                      placeholder={`${cfg.fraisInscription||0}`}
                      style={{width:"100%",background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:8,padding:"7px 10px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Frais spéciaux Janvier/Février */}
      <Card style={{marginBottom:16}}>
        <CardTitle color="#FF9F0A">📅 Frais spéciaux (Janvier & Février)</CardTitle>
        <div style={{fontSize:12,color:theme.textMuted,marginBottom:12}}>
          Laissez 0 pour utiliser les frais normaux par classe
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Inp label={`Frais Janvier (${editDevise}) — laisser 0 si normal`} type="number" value={fraisJanvier} onChange={e=>setFraisJanvier(e.target.value)} placeholder="0"/>
          <Inp label={`Frais Février (${editDevise}) — laisser 0 si normal`} type="number" value={fraisFevier} onChange={e=>setFraisFevier(e.target.value)} placeholder="0"/>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Classes */}
        <Card>
          <CardTitle color={couleur}>🏫 Classes ({classes.length})</CardTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {classes.map(c=>(
              <div key={c} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:couleur+"18",borderRadius:99,border:`1px solid ${couleur}44`}}>
                <span style={{color:couleur,fontSize:13,fontWeight:600}}>{c}</span>
                <button onClick={()=>delClasse(c)} style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13,padding:0,fontWeight:700}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newClasse} onChange={e=>setNewClasse(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addClasse()} placeholder="Ex: Terminale C"
              style={{flex:1,background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <Btn onClick={addClasse} color={couleur}>+ Ajouter</Btn>
          </div>
        </Card>

        {/* Matières */}
        <Card>
          <CardTitle color={couleur}>📚 Matières ({matieres.length})</CardTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {matieres.map(m=>(
              <div key={m} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"rgba(255,255,255,0.06)",borderRadius:99,border:`1px solid ${theme.border}`}}>
                <span style={{color:theme.text,fontSize:13,fontWeight:600}}>{m}</span>
                <button onClick={()=>delMatiere(m)} style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13,padding:0,fontWeight:700}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newMatiere} onChange={e=>setNewMatiere(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMatiere()} placeholder="Ex: Philosophie"
              style={{flex:1,background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <Btn onClick={addMatiere} color={couleur}>+ Ajouter</Btn>
          </div>
        </Card>

        {/* Matières spécifiques par classe */}
        <Card style={{gridColumn:"1/-1"}}>
          <CardTitle color={couleur}>📚 Matières spécifiques par classe</CardTitle>
          <div style={{fontSize:12,color:theme.textMuted,marginBottom:14}}>
            Les matières communes s'appliquent à toutes les classes. Ajoutez ici des matières supplémentaires pour certaines classes uniquement.
          </div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:5,flex:1}}>
              <label style={{fontSize:12,fontWeight:600,color:theme.textMuted}}>Classe</label>
              <select value={classeSelectionnee} onChange={e=>setClasseSelectionnee(e.target.value)}
                style={{background:theme.sel,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"9px 13px",color:theme.text,fontSize:14,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                {classes.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,flex:2}}>
              <label style={{fontSize:12,fontWeight:600,color:theme.textMuted}}>Matière spécifique</label>
              <input value={newMatiereClasse} onChange={e=>setNewMatiereClasse(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addMatiereClasse()}
                placeholder="Ex: Philosophie, Latin, Arabe..."
                style={{background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"9px 13px",color:theme.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
            </div>
            <Btn onClick={addMatiereClasse} color={couleur}>+ Ajouter</Btn>
          </div>
          {/* Afficher matières spécifiques par classe */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
            {classes.map(c=>{
              const matieresCls=matieresParClasse[c]||[];
              return (
                <div key={c} style={{background:theme.bg,borderRadius:12,padding:"12px 14px",border:`1px solid ${theme.border}`}}>
                  <div style={{fontSize:13,fontWeight:700,color:couleur,marginBottom:8}}>{c}</div>
                  {matieresCls.length===0
                    ?<div style={{fontSize:11,color:theme.textFaint}}>Aucune matière spécifique</div>
                    :matieresCls.map(m=>(
                      <div key={m} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
                        <span style={{fontSize:12,color:theme.text}}>{m}</span>
                        <button onClick={()=>delMatiereClasse(c,m)} style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13,padding:0}}>✕</button>
                      </div>
                    ))
                  }
                </div>
              );
            })}
          </div>
        </Card>

        {/* Types de paiements */}
        <Card>
          <CardTitle color={couleur}>💳 Types de paiements</CardTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {typesPaiements.map(t=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"rgba(255,255,255,0.06)",borderRadius:99,border:`1px solid ${theme.border}`}}>
                <span style={{color:theme.text,fontSize:13,fontWeight:600}}>{t}</span>
                <button onClick={()=>delType(t)} style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13,padding:0,fontWeight:700}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newType} onChange={e=>setNewType(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addType()} placeholder="Ex: Examen"
              style={{flex:1,background:theme.input,border:`1px solid ${theme.inputBorder}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <Btn onClick={addType} color={couleur}>+ Ajouter</Btn>
          </div>
        </Card>
      </div>

      <Btn onClick={saveInfos} color={couleur} style={{width:"100%",padding:"14px"}}>💾 Sauvegarder tous les paramètres</Btn>
    </div>
  );
}

// ─── Reçus ────────────────────────────────────────────────────────────────────
function Recus({paiements,eleves,cfg}) {
  const {theme}=useTheme();
  const {couleur,devise,nom,adresse,telephone,email}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [selected,setSelected]=useState(null);
  const [fEleve,setFEleve]=useState("");
  const [fMois,setFMois]=useState("");
  const printRef=useRef();

  const filtered=paiements.filter(p=>{
    const eleveOk=!fEleve||p.eleveId===Number(fEleve);
    const moisOk=!fMois||p.mois===fMois;
    return eleveOk&&moisOk;
  });

  const imprimer=()=>{
    if(!printRef.current)return;
    const content=printRef.current.innerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>Reçu ${nom}</title><style>
      *{box-sizing:border-box;}
      body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1C1C1E;}
      .recu{max-width:500px;margin:0 auto;border:2px solid #eee;padding:30px;border-radius:12px;}
    </style></head><body>${content}</body></html>`);
    w.document.close();w.print();
  };

  const getEleve=(id)=>eleves.find(e=>e.id===id);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>🧾 Reçus de paiement</h1>
        {selected&&<button onClick={imprimer} style={{background:couleur,color:"#fff",border:"none",padding:"9px 20px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>🖨️ Imprimer</button>}
      </div>

      {/* Aperçu du reçu sélectionné */}
      {selected&&(()=>{
        const p=selected;
        const eleve=getEleve(p.eleveId);
        const num=`REC-${p.id}`;
        return (
          <div style={{...{background:theme.bgCard,borderRadius:16,padding:"20px 22px",border:`1px solid ${couleur}44`,boxShadow:theme.shadow},marginBottom:20}}>
            <div ref={printRef}>
              <div className="recu" style={{maxWidth:500,margin:"0 auto",border:"2px solid #e5e5ea",padding:30,borderRadius:12,background:"#fff",color:"#1C1C1E",fontFamily:"Arial,sans-serif"}}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:20,borderBottom:`3px solid ${couleur}`}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:900,color:couleur}}>{nom}</div>
                    {adresse&&<div style={{fontSize:12,color:"#636366",marginTop:4}}>📍 {adresse}</div>}
                    {telephone&&<div style={{fontSize:12,color:"#636366"}}>📞 {telephone}</div>}
                    {email&&<div style={{fontSize:12,color:"#636366"}}>✉️ {email}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:900,color:couleur}}>REÇU</div>
                    <div style={{fontSize:13,fontWeight:700}}>#{num}</div>
                    <div style={{fontSize:12,color:"#636366",marginTop:4}}>Date : {p.date}</div>
                  </div>
                </div>

                {/* Infos élève */}
                <div style={{marginBottom:20,padding:"14px",background:"#f5f5f7",borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#636366",textTransform:"uppercase",marginBottom:8}}>Reçu de</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E"}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</div>
                  {eleve&&<div style={{fontSize:13,color:"#636366"}}>Classe : {eleve.classe}</div>}
                  {eleve?.parent&&<div style={{fontSize:13,color:"#636366"}}>Parent : {eleve.parent}</div>}
                </div>

                {/* Détail paiement */}
                <div style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e5e5ea"}}>
                    <span style={{fontSize:14,color:"#636366"}}>Type de paiement</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#1C1C1E"}}>{p.type}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e5e5ea"}}>
                    <span style={{fontSize:14,color:"#636366"}}>Période</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#1C1C1E"}}>{p.mois}</span>
                  </div>
                  {p.note&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e5e5ea"}}>
                    <span style={{fontSize:14,color:"#636366"}}>Note</span>
                    <span style={{fontSize:14,color:"#1C1C1E"}}>{p.note}</span>
                  </div>}
                </div>

                {/* Montant */}
                <div style={{background:couleur+"11",borderRadius:12,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>Montant reçu</span>
                  <span style={{fontSize:26,fontWeight:900,color:couleur}}>{fmt(p.montant)}</span>
                </div>

                {/* Footer */}
                <div style={{textAlign:"center",fontSize:11,color:"#8E8E93",borderTop:"1px solid #e5e5ea",paddingTop:16}}>
                  {nom} · Merci pour votre confiance 🙏
                </div>
              </div>
            </div>
            <button onClick={()=>setSelected(null)} style={{marginTop:14,background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"7px 16px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>✕ Fermer</button>
          </div>
        );
      })()}

      {/* Filtres */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <select value={fEleve} onChange={e=>setFEleve(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          <option value="">Tous les élèves</option>
          {eleves.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.classe})</option>)}
        </select>
        <input type="month" value={fMois} onChange={e=>setFMois(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,fontFamily:"inherit"}}/>
        <div style={{marginLeft:"auto",color:theme.textMuted,fontSize:13}}>
          {filtered.length} reçu{filtered.length!==1?"s":""}
        </div>
      </div>

      {/* Liste paiements */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {filtered.length===0&&<div style={{color:theme.textMuted,fontSize:13,gridColumn:"1/-1",textAlign:"center",padding:"2rem"}}>Aucun paiement trouvé</div>}
        {filtered.map(p=>{
          const eleve=getEleve(p.eleveId);
          return (
            <div key={p.id} style={{background:theme.bgCard,borderRadius:14,padding:"16px 18px",border:`1px solid ${selected?.id===p.id?couleur:theme.border}`,boxShadow:theme.shadow,cursor:"pointer",transition:"all 0.15s"}}
              onClick={()=>setSelected(p)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</div>
                  <div style={{fontSize:12,color:theme.textMuted}}>{eleve?.classe||"—"} · {p.mois}</div>
                </div>
                <span style={{background:couleur+"22",color:couleur,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{p.type}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#30D158"}}>{fmt(p.montant)}</div>
                <div style={{fontSize:11,color:theme.textMuted}}>{p.date}</div>
              </div>
              <div style={{marginTop:10,fontSize:11,color:couleur,fontWeight:600}}>👁 Appuyer pour voir le reçu</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Rapports financiers ──────────────────────────────────────────────────────
function Rapports({paiements,depenses,recettes,eleves,cfg}) {
  const {theme}=useTheme();
  const {couleur,devise,classes,fraisMensuel=0}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [periode,setPeriode]=useState("mois");
  const [annee]=useState(new Date().getFullYear());
  const printRef=useRef();

  // Mois de l'année
  const MOIS=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  // Recettes par mois (paiements + recettes)
  const recettesParMois=MOIS.map((_,i)=>{
    const mm=String(i+1).padStart(2,"0");
    const moisStr=`${annee}-${mm}`;
    const p=paiements.filter(x=>x.mois===moisStr).reduce((s,x)=>s+x.montant,0);
    const r=recettes.filter(x=>x.date?.startsWith(moisStr)).reduce((s,x)=>s+x.montant,0);
    return p+r;
  });

  // Dépenses par mois
  const depensesParMois=MOIS.map((_,i)=>{
    const mm=String(i+1).padStart(2,"0");
    const moisStr=`${annee}-${mm}`;
    return depenses.filter(d=>d.date?.startsWith(moisStr)&&d.statut==="Approuvée").reduce((s,d)=>s+d.montant,0);
  });

  const totalRecettes=recettesParMois.reduce((s,v)=>s+v,0);
  const totalDepenses=depensesParMois.reduce((s,v)=>s+v,0);
  const solde=totalRecettes-totalDepenses;
  const maxVal=Math.max(...recettesParMois,...depensesParMois,1);

  // Taux de recouvrement par classe
  const moisCourant=new Date().toISOString().slice(0,7);
  const recouvrement=classes.map(c=>{
    const elevesClasse=eleves.filter(e=>e.classe===c&&e.statut==="Actif");
    const total=elevesClasse.length*fraisMensuel;
    const paye=paiements.filter(p=>{
      const eleve=eleves.find(e=>e.id===p.eleveId);
      return eleve?.classe===c&&p.mois===moisCourant&&p.type==="Mensualité";
    }).reduce((s,p)=>s+p.montant,0);
    const taux=total>0?Math.round((paye/total)*100):0;
    return {classe:c,elevesClasse:elevesClasse.length,total,paye,taux};
  });

  // Paiements par type
  const parType={};
  paiements.forEach(p=>{
    if(!parType[p.type])parType[p.type]=0;
    parType[p.type]+=p.montant;
  });
  const topTypes=Object.entries(parType).sort((a,b)=>b[1]-a[1]);

  // Dépenses par catégorie
  const parCat={};
  depenses.filter(d=>d.statut==="Approuvée").forEach(d=>{
    if(!parCat[d.categorie])parCat[d.categorie]=0;
    parCat[d.categorie]+=d.montant;
  });
  const topCats=Object.entries(parCat).sort((a,b)=>b[1]-a[1]);

  const imprimer=()=>{
    const content=printRef.current.innerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>Rapport financier ${cfg.nom}</title><style>
      *{box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:30px;color:#1C1C1E;}
      h1{font-size:20px;}h2{font-size:15px;color:#636366;}
      table{width:100%;border-collapse:collapse;margin:10px 0;}
      th,td{border:1px solid #e5e5ea;padding:8px 10px;font-size:12px;text-align:left;}
      th{background:#f5f5f7;font-weight:700;}
    </style></head><body>${content}</body></html>`);
    w.document.close();w.print();
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>📈 Rapports financiers</h1>
        <button onClick={imprimer} style={{background:theme.toggleBg,border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"8px 16px",borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>🖨️ Imprimer le rapport</button>
      </div>

      <div ref={printRef}>
        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <KPI label="Total recettes" value={fmt(totalRecettes)} accent="#30D158" icon="💰" sub={`Année ${annee}`}/>
          <KPI label="Total dépenses" value={fmt(totalDepenses)} accent="#FF453A" icon="📤" sub="Approuvées"/>
          <KPI label="Solde net" value={fmt(solde)} accent={solde>=0?"#30D158":"#FF453A"} icon={solde>=0?"📈":"📉"} sub="Recettes − Dépenses"/>
        </div>

        {/* Graphique barres */}
        <Card style={{marginBottom:16}}>
          <CardTitle color={couleur}>📊 Recettes vs Dépenses — {annee}</CardTitle>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:140,paddingTop:10}}>
            {MOIS.map((m,i)=>(
              <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{display:"flex",gap:2,alignItems:"flex-end",height:110}}>
                  <div style={{width:"45%",background:"#30D158",borderRadius:"3px 3px 0 0",height:`${Math.round((recettesParMois[i]/maxVal)*100)}%`,minHeight:recettesParMois[i]>0?4:0}}/>
                  <div style={{width:"45%",background:"#FF453A",borderRadius:"3px 3px 0 0",height:`${Math.round((depensesParMois[i]/maxVal)*100)}%`,minHeight:depensesParMois[i]>0?4:0}}/>
                </div>
                <div style={{fontSize:9,color:theme.textMuted,fontWeight:600}}>{m}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:12,background:"#30D158",borderRadius:3}}/><span style={{fontSize:11,color:theme.textMuted}}>Recettes</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:12,background:"#FF453A",borderRadius:3}}/><span style={{fontSize:11,color:theme.textMuted}}>Dépenses</span></div>
          </div>
        </Card>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          {/* Taux de recouvrement */}
          <Card>
            <CardTitle color={couleur}>🎯 Taux de recouvrement — {moisCourant}</CardTitle>
            {recouvrement.map(r=>(
              <div key={r.classe} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:theme.text}}>{r.classe}</span>
                  <span style={{fontSize:13,fontWeight:800,color:r.taux>=80?"#30D158":r.taux>=50?"#FF9F0A":"#FF453A"}}>{r.taux}%</span>
                </div>
                <div style={{height:8,background:theme.border,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${r.taux}%`,background:r.taux>=80?"#30D158":r.taux>=50?"#FF9F0A":"#FF453A",borderRadius:99,transition:"width 0.5s"}}/>
                </div>
                <div style={{fontSize:11,color:theme.textMuted,marginTop:3}}>{fmt(r.paye)} / {fmt(r.total)} · {r.elevesClasse} élèves</div>
              </div>
            ))}
          </Card>

          {/* Répartition dépenses */}
          <Card>
            <CardTitle color={couleur}>📤 Dépenses par catégorie</CardTitle>
            {topCats.length===0
              ?<div style={{color:theme.textMuted,fontSize:13}}>Aucune dépense</div>
              :topCats.map(([cat,montant])=>(
                <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${theme.borderLight}`}}>
                  <span style={{fontSize:13,color:theme.text}}>{cat}</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#FF453A"}}>{fmt(montant)}</div>
                    <div style={{fontSize:10,color:theme.textMuted}}>{totalDepenses>0?Math.round((montant/totalDepenses)*100):0}%</div>
                  </div>
                </div>
              ))
            }
          </Card>
        </div>

        {/* Recettes par type */}
        <Card style={{marginBottom:16}}>
          <CardTitle color={couleur}>💰 Recettes par type de paiement</CardTitle>
          {topTypes.length===0
            ?<div style={{color:theme.textMuted,fontSize:13}}>Aucun paiement</div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Type","Montant","% du total"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {topTypes.map(([type,montant])=>(
                  <tr key={type}>
                    <Td><span style={{background:couleur+"22",color:couleur,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600}}>{type}</span></Td>
                    <Td style={{fontWeight:700,color:"#30D158"}}>{fmt(montant)}</Td>
                    <Td style={{color:theme.textMuted}}>{totalRecettes>0?Math.round((montant/totalRecettes)*100):0}%</Td>
                  </tr>
                ))}
                <tr style={{borderTop:`2px solid ${theme.border}`}}>
                  <Td><strong style={{color:theme.text}}>TOTAL</strong></Td>
                  <Td style={{fontWeight:800,color:"#30D158",fontSize:15}}>{fmt(totalRecettes)}</Td>
                  <Td style={{fontWeight:700,color:theme.textMuted}}>100%</Td>
                </tr>
              </tbody>
            </table>
          }
        </Card>

        {/* Résumé mensuel */}
        <Card>
          <CardTitle color={couleur}>📅 Résumé mensuel {annee}</CardTitle>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Mois","Recettes","Dépenses","Solde"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {MOIS.map((m,i)=>{
                const rec=recettesParMois[i];
                const dep=depensesParMois[i];
                const sol=rec-dep;
                return (
                  <tr key={m}>
                    <Td style={{fontWeight:600,color:theme.text}}>{m} {annee}</Td>
                    <Td style={{color:"#30D158",fontWeight:600}}>{rec>0?fmt(rec):"—"}</Td>
                    <Td style={{color:"#FF453A",fontWeight:600}}>{dep>0?fmt(dep):"—"}</Td>
                    <Td style={{fontWeight:700,color:sol>=0?"#30D158":"#FF453A"}}>{rec>0||dep>0?fmt(sol):"—"}</Td>
                  </tr>
                );
              })}
              <tr style={{borderTop:`2px solid ${theme.border}`}}>
                <Td><strong style={{color:theme.text}}>TOTAL {annee}</strong></Td>
                <Td style={{fontWeight:800,color:"#30D158",fontSize:14}}>{fmt(totalRecettes)}</Td>
                <Td style={{fontWeight:800,color:"#FF453A",fontSize:14}}>{fmt(totalDepenses)}</Td>
                <Td style={{fontWeight:800,fontSize:14,color:solde>=0?"#30D158":"#FF453A"}}>{fmt(solde)}</Td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Emploi du temps ──────────────────────────────────────────────────────────
const JOURS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const HEURES=["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

function EmploiDuTemps({cfg,professeurs}) {
  const {theme}=useTheme();
  const {couleur,classes,matieres,matieresParClasse={}}=cfg;
  const [fClasse,setFClasse]=useState(classes[0]||"");
  const [emploi,setEmploi]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("ecole_emploi")||"{}");}catch{return {};}
  });
  const [editing,setEditing]=useState(null); // {jour, heure}
  const [form,setForm]=useState({matiere:"",professeur:"",debut:"",fin:""});
  const printRef=useRef();

  const getMatieres=(c)=>{
    const spec=matieresParClasse[c]||[];
    return [...(matieres||[]),...spec.filter(m=>!(matieres||[]).includes(m))];
  };

  const getProfs=()=>professeurs.filter(p=>p.statut==="Actif"||!p.statut);

  const key=(classe,jour,heure)=>`${classe}_${jour}_${heure}`;

  const saveEmploi=(newEmploi)=>{
    setEmploi(newEmploi);
    localStorage.setItem("ecole_emploi",JSON.stringify(newEmploi));
  };

  const setCell=(jour,heure,data)=>{
    const k=key(fClasse,jour,heure);
    const newEmploi=data?{...emploi,[k]:data}:{...emploi};
    if(!data)delete newEmploi[k];
    saveEmploi(newEmploi);
  };

  const getCell=(jour,heure)=>emploi[key(fClasse,jour,heure)]||null;

  const clearCell=(jour,heure)=>{setCell(jour,heure,null);};

  const saveCell=()=>{
    if(!form.matiere)return;
    setCell(editing.jour,editing.heure,{
      matiere:form.matiere,
      professeur:form.professeur,
      debut:form.debut||editing.heure,
      fin:form.fin||HEURES[HEURES.indexOf(editing.heure)+1]||"",
    });
    setEditing(null);
    setForm({matiere:"",professeur:"",debut:"",fin:""});
  };

  const imprimer=()=>{
    const content=printRef.current.innerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>Emploi du temps ${fClasse}</title><style>
      *{box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:20px;color:#1C1C1E;}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #e5e5ea;padding:6px 8px;font-size:12px;text-align:center;}
      th{background:#f5f5f7;font-weight:700;}
      .cours{background:#EAF4FF;border-radius:4px;padding:4px;}
    </style></head><body>${content}</body></html>`);
    w.document.close();w.print();
  };

  const matiereColor=(matiere)=>{
    const colors=["#0A84FF","#30D158","#FF9F0A","#BF5AF2","#FF6B35","#FF453A","#64D2FF","#FFD60A"];
    const idx=getMatieres(fClasse).indexOf(matiere)%colors.length;
    return colors[idx>=0?idx:0];
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>🗓️ Emploi du temps</h1>
        <div style={{display:"flex",gap:8}}>
          <button onClick={imprimer} style={{background:theme.toggleBg,border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"8px 16px",borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>🖨️ Imprimer</button>
        </div>
      </div>

      {/* Filtre classe */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {classes.map(c=>(
          <button key={c} onClick={()=>setFClasse(c)}
            style={{padding:"7px 16px",borderRadius:10,border:"1px solid",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",
              borderColor:fClasse===c?couleur:theme.border,
              background:fClasse===c?couleur+"18":theme.toggleBg,
              color:fClasse===c?couleur:theme.textMuted}}>
            {c}
          </button>
        ))}
      </div>

      {/* Modal édition créneau */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:theme.bgCard,borderRadius:20,padding:28,width:"100%",maxWidth:400,border:`1px solid ${theme.border}`}}>
            <div style={{fontSize:15,fontWeight:800,color:theme.text,marginBottom:16}}>
              ✏️ {editing.jour} à {editing.heure} — {fClasse}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
              <Sel label="Matière *" value={form.matiere} onChange={e=>setForm({...form,matiere:e.target.value})}
                options={[{v:"",l:"-- Choisir une matière --"},...getMatieres(fClasse).map(m=>({v:m,l:m}))]}/>
              <Sel label="Professeur" value={form.professeur} onChange={e=>setForm({...form,professeur:e.target.value})}
                options={[{v:"",l:"-- Choisir un professeur --"},...getProfs().map(p=>({v:`${p.prenom} ${p.nom}`,l:`${p.prenom} ${p.nom}`}))]}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Sel label="Heure début" value={form.debut||editing.heure} onChange={e=>setForm({...form,debut:e.target.value})} options={HEURES.map(h=>({v:h,l:h}))}/>
                <Sel label="Heure fin" value={form.fin} onChange={e=>setForm({...form,fin:e.target.value})} options={HEURES.map(h=>({v:h,l:h}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={saveCell} style={{flex:1,background:couleur,color:"#fff",border:"none",padding:"11px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>💾 Enregistrer</button>
              <button onClick={()=>{setEditing(null);setForm({matiere:"",professeur:"",debut:"",fin:""}); }}
                style={{background:theme.toggleBg,color:theme.text,border:`1px solid ${theme.border}`,padding:"11px 16px",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Grille emploi du temps */}
      <div style={{overflowX:"auto"}}>
        <div ref={printRef}>
          <div style={{fontSize:15,fontWeight:800,color:theme.text,marginBottom:14,textAlign:"center"}}>
            {cfg.nom} — Emploi du temps {fClasse} — {new Date().getFullYear()}
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead>
              <tr>
                <th style={{padding:"10px 12px",background:theme.tableHead,border:`1px solid ${theme.border}`,fontSize:12,fontWeight:700,color:theme.textMuted,minWidth:70}}>Heure</th>
                {JOURS.map(j=>(
                  <th key={j} style={{padding:"10px 12px",background:couleur+"18",border:`1px solid ${theme.border}`,fontSize:13,fontWeight:700,color:couleur,minWidth:110}}>{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HEURES.map(h=>(
                <tr key={h}>
                  <td style={{padding:"8px 12px",border:`1px solid ${theme.border}`,fontSize:12,fontWeight:700,color:theme.textMuted,background:theme.tableHead,textAlign:"center"}}>{h}</td>
                  {JOURS.map(j=>{
                    const cell=getCell(j,h);
                    const color=cell?matiereColor(cell.matiere):null;
                    return (
                      <td key={j} style={{padding:"4px",border:`1px solid ${theme.border}`,verticalAlign:"top",height:60,cursor:"pointer"}}
                        onClick={()=>{setEditing({jour:j,heure:h});setForm(cell?{matiere:cell.matiere,professeur:cell.professeur||"",debut:cell.debut||h,fin:cell.fin||""}:{matiere:"",professeur:"",debut:h,fin:""});}}>
                        {cell?(
                          <div style={{background:color+"22",border:`1px solid ${color}44`,borderRadius:8,padding:"4px 6px",height:"100%",position:"relative"}}>
                            <div style={{fontSize:11,fontWeight:700,color:color}}>{cell.matiere}</div>
                            {cell.professeur&&<div style={{fontSize:10,color:theme.textMuted}}>{cell.professeur}</div>}
                            {cell.debut&&cell.fin&&<div style={{fontSize:10,color:theme.textFaint}}>{cell.debut}–{cell.fin}</div>}
                            <button onClick={e=>{e.stopPropagation();clearCell(j,h);}}
                              style={{position:"absolute",top:2,right:2,background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:11,padding:0,lineHeight:1}}>✕</button>
                          </div>
                        ):(
                          <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:theme.textFaint,fontSize:18}}>+</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Bulletins ────────────────────────────────────────────────────────────────
function Bulletins({notes,eleves,absences,cfg}) {
  const {theme}=useTheme();
  const {couleur,classes,nom:nomEcole,adresse,telephone,matieresParClasse={}}=cfg;
  const [fClasse,setFClasse]=useState(classes[0]||"");
  const [fTrimestre,setFTrimestre]=useState("T1");
  const [selectedEleve,setSelectedEleve]=useState(null);
  const printRef=useRef();

  const elevesClasse=eleves.filter(e=>e.classe===fClasse&&e.statut==="Actif");

  // Matières pour cette classe
  const getMatieres=(classe)=>{
    const spec=matieresParClasse[classe]||[];
    return [...(cfg.matieres||[]),...spec.filter(m=>!(cfg.matieres||[]).includes(m))];
  };

  // Calculer moyenne d'un élève pour une matière
  const getMoyenne=(eleveId,matiere,trimestre)=>{
    const ns=notes.filter(n=>n.eleveId===eleveId&&n.matiere===matiere&&n.trimestre===trimestre);
    if(ns.length===0)return null;
    const totalCoeff=ns.reduce((s,n)=>s+n.coeff,0);
    const totalPoints=ns.reduce((s,n)=>s+n.note*n.coeff,0);
    return totalPoints/totalCoeff;
  };

  // Calculer moyenne générale
  const getMoyenneGenerale=(eleveId,trimestre)=>{
    const mats=getMatieres(fClasse);
    const moyennes=mats.map(m=>getMoyenne(eleveId,m,trimestre)).filter(m=>m!==null);
    if(moyennes.length===0)return null;
    return moyennes.reduce((s,m)=>s+m,0)/moyennes.length;
  };

  // Appréciation selon la moyenne
  const getAppreciation=(moy)=>{
    if(moy===null)return{text:"—",color:"#636366"};
    if(moy>=16)return{text:"Excellent",color:"#30D158"};
    if(moy>=14)return{text:"Très bien",color:"#30D158"};
    if(moy>=12)return{text:"Bien",color:"#0A84FF"};
    if(moy>=10)return{text:"Assez bien",color:"#FF9F0A"};
    if(moy>=8) return{text:"Passable",color:"#FF9F0A"};
    return{text:"Insuffisant",color:"#FF453A"};
  };

  // Classement de la classe
  const classement=elevesClasse.map(e=>({
    ...e,
    moy:getMoyenneGenerale(e.id,fTrimestre)
  })).filter(e=>e.moy!==null).sort((a,b)=>b.moy-a.moy);

  const getRang=(eleveId)=>{
    const idx=classement.findIndex(e=>e.id===eleveId);
    return idx>=0?idx+1:null;
  };

  // Absences de l'élève
  const getNbAbsences=(eleveId)=>absences.filter(a=>a.eleveId===eleveId).length;

  const imprimer=()=>{
    const content=printRef.current.innerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>Bulletin ${selectedEleve?.prenom} ${selectedEleve?.nom}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:Arial,sans-serif;padding:20px;color:#1C1C1E;}
      table{width:100%;border-collapse:collapse;}
      th{background:#f5f5f7;padding:8px 10px;text-align:left;font-size:12px;font-weight:700;border:1px solid #e5e5ea;}
      td{padding:8px 10px;font-size:13px;border:1px solid #e5e5ea;}
      .bien{color:#30D158;font-weight:700;}
      .moyen{color:#FF9F0A;font-weight:700;}
      .faible{color:#FF453A;font-weight:700;}
    </style></head><body>${content}</body></html>`);
    w.document.close();w.print();
  };

  const matieres=getMatieres(fClasse);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>📊 Bulletins de notes</h1>
        {selectedEleve&&<button onClick={imprimer} style={{background:couleur,color:"#fff",border:"none",padding:"9px 20px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>🖨️ Imprimer le bulletin</button>}
      </div>

      {/* Filtres */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <select value={fClasse} onChange={e=>{setFClasse(e.target.value);setSelectedEleve(null);}}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {classes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fTrimestre} onChange={e=>{setFTrimestre(e.target.value);setSelectedEleve(null);}}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {["T1","T2","T3"].map(t=><option key={t} value={t}>{t==="T1"?"1er Trimestre":t==="T2"?"2ème Trimestre":"3ème Trimestre"}</option>)}
        </select>
      </div>

      {/* Liste élèves */}
      {!selectedEleve&&(
        <div>
          <Card style={{marginBottom:16}}>
            <CardTitle color={couleur}>Choisissez un élève — {fClasse} · {fTrimestre}</CardTitle>
            {elevesClasse.length===0
              ?<div style={{color:theme.textMuted,fontSize:13}}>Aucun élève dans cette classe</div>
              :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:10}}>
                {elevesClasse.map(e=>{
                  const moy=getMoyenneGenerale(e.id,fTrimestre);
                  const app=getAppreciation(moy);
                  const rang=getRang(e.id);
                  return (
                    <div key={e.id} onClick={()=>setSelectedEleve(e)}
                      style={{background:theme.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${theme.border}`,cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:theme.text}}>{e.prenom} {e.nom}</div>
                          <div style={{fontSize:11,color:theme.textMuted}}>{e.classe}</div>
                        </div>
                        {moy!==null&&<div style={{textAlign:"right"}}>
                          <div style={{fontSize:18,fontWeight:800,color:app.color}}>{moy.toFixed(2)}</div>
                          {rang&&<div style={{fontSize:11,color:theme.textMuted}}>{rang}ème / {classement.length}</div>}
                        </div>}
                      </div>
                      {moy===null&&<div style={{fontSize:12,color:theme.textMuted,marginTop:6}}>Aucune note</div>}
                    </div>
                  );
                })}
              </div>
            }
          </Card>
        </div>
      )}

      {/* Bulletin détaillé */}
      {selectedEleve&&(()=>{
        const moyGen=getMoyenneGenerale(selectedEleve.id,fTrimestre);
        const app=getAppreciation(moyGen);
        const rang=getRang(selectedEleve.id);
        const nbAbs=getNbAbsences(selectedEleve.id);
        const annee=`${new Date().getFullYear()-1}-${new Date().getFullYear()}`;

        return (
          <div>
            <button onClick={()=>setSelectedEleve(null)}
              style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:14,marginBottom:16,fontFamily:"inherit",padding:0}}>
              ← Retour à la liste
            </button>

            <Card style={{border:`1px solid ${couleur}44`}}>
              <div ref={printRef} style={{background:"#fff",color:"#1C1C1E",padding:"30px",fontFamily:"Arial,sans-serif"}}>

                {/* En-tête */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:16,borderBottom:`3px solid ${couleur}`}}>
                  <div>
                    <div style={{fontSize:22,fontWeight:900,color:couleur}}>{nomEcole}</div>
                    {adresse&&<div style={{fontSize:12,color:"#636366"}}>📍 {adresse}</div>}
                    {telephone&&<div style={{fontSize:12,color:"#636366"}}>📞 {telephone}</div>}
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:900,color:"#1C1C1E"}}>BULLETIN DE NOTES</div>
                    <div style={{fontSize:13,color:"#636366"}}>Année scolaire {annee}</div>
                    <div style={{fontSize:13,fontWeight:700,color:couleur}}>{fTrimestre==="T1"?"1er Trimestre":fTrimestre==="T2"?"2ème Trimestre":"3ème Trimestre"}</div>
                  </div>
                </div>

                {/* Infos élève */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20,padding:"12px 16px",background:"#f5f5f7",borderRadius:10}}>
                  <div>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:4}}>Élève</div>
                    <div style={{fontSize:16,fontWeight:700}}>{selectedEleve.prenom} {selectedEleve.nom}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:4}}>Classe</div>
                    <div style={{fontSize:16,fontWeight:700}}>{selectedEleve.classe}</div>
                  </div>
                  {selectedEleve.parent&&<div>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:4}}>Parent / Tuteur</div>
                    <div style={{fontSize:14}}>{selectedEleve.parent}</div>
                  </div>}
                  <div>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:4}}>Absences</div>
                    <div style={{fontSize:14,fontWeight:700,color:nbAbs>5?"#FF453A":"#1C1C1E"}}>{nbAbs} absence{nbAbs!==1?"s":""}</div>
                  </div>
                </div>

                {/* Tableau des notes */}
                <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
                  <thead>
                    <tr style={{background:"#f5f5f7"}}>
                      {["Matière","Notes","Moyenne","Appréciation"].map(h=>(
                        <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#636366",textTransform:"uppercase",border:"1px solid #e5e5ea"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matieres.map(m=>{
                      const ns=notes.filter(n=>n.eleveId===selectedEleve.id&&n.matiere===m&&n.trimestre===fTrimestre);
                      const moy=getMoyenne(selectedEleve.id,m,fTrimestre);
                      const app=getAppreciation(moy);
                      return (
                        <tr key={m} style={{borderBottom:"1px solid #e5e5ea"}}>
                          <td style={{padding:"10px 12px",fontSize:14,fontWeight:600,border:"1px solid #e5e5ea"}}>{m}</td>
                          <td style={{padding:"10px 12px",fontSize:12,color:"#636366",border:"1px solid #e5e5ea"}}>
                            {ns.length>0?ns.map(n=>`${n.note}/20`).join(" · "):"—"}
                          </td>
                          <td style={{padding:"10px 12px",fontSize:15,fontWeight:800,border:"1px solid #e5e5ea",color:moy!==null?(moy>=10?"#30D158":"#FF453A"):"#636366"}}>
                            {moy!==null?`${moy.toFixed(2)}/20`:"—"}
                          </td>
                          <td style={{padding:"10px 12px",fontSize:13,fontWeight:600,border:"1px solid #e5e5ea",color:app.color}}>
                            {app.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Résumé */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
                  <div style={{background:"#f5f5f7",borderRadius:10,padding:"14px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:6}}>Moyenne générale</div>
                    <div style={{fontSize:28,fontWeight:900,color:moyGen!==null?(moyGen>=10?couleur:"#FF453A"):"#636366"}}>
                      {moyGen!==null?`${moyGen.toFixed(2)}/20`:"—"}
                    </div>
                  </div>
                  <div style={{background:"#f5f5f7",borderRadius:10,padding:"14px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:6}}>Classement</div>
                    <div style={{fontSize:28,fontWeight:900,color:couleur}}>
                      {rang?`${rang}ème / ${classement.length}`:"—"}
                    </div>
                  </div>
                  <div style={{background:"#f5f5f7",borderRadius:10,padding:"14px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#636366",textTransform:"uppercase",marginBottom:6}}>Appréciation</div>
                    <div style={{fontSize:20,fontWeight:900,color:app.color}}>{app.text}</div>
                  </div>
                </div>

                {/* Signature */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20,marginTop:30,paddingTop:20,borderTop:"1px solid #e5e5ea"}}>
                  {["Le Directeur","Le Professeur Principal","Signature Parent"].map(s=>(
                    <div key={s} style={{textAlign:"center"}}>
                      <div style={{fontSize:12,color:"#636366",marginBottom:40}}>{s}</div>
                      <div style={{borderTop:"1px solid #1C1C1E",paddingTop:4,fontSize:11,color:"#636366"}}>Signature</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{marginTop:20,textAlign:"center",fontSize:11,color:"#8E8E93",borderTop:"1px solid #e5e5ea",paddingTop:12}}>
                  {nomEcole} · Bulletin officiel · {annee}
                </div>
              </div>

              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button onClick={imprimer} style={{background:couleur,color:"#fff",border:"none",padding:"10px 24px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>🖨️ Imprimer / PDF</button>
                <button onClick={()=>setSelectedEleve(null)} style={{background:theme.toggleBg,color:theme.text,border:`1px solid ${theme.border}`,padding:"10px 18px",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Fermer</button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Professeurs ──────────────────────────────────────────────────────────────
function Professeurs({professeurs,setProfesseurs,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur,classes,matieres,devise}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [show,setShow]=useState(false);
  const [editId,setEditId]=useState(null);
  const [showSalaire,setShowSalaire]=useState(null);
  const [salaires,setSalaires]=useState([]);
  const [formSalaire,setFormSalaire]=useState({montant:"",date:today(),mois:new Date().toISOString().slice(0,7),note:""});
  const [search,setSearch]=useState("");
  const [form,setForm]=useState({
    nom:"",prenom:"",telephone:"",email:"",
    matieres:[],classes:[],
    salaireMensuel:0,dateEmbauche:today(),
    statut:"Actif",note:""
  });

  const filtered=professeurs.filter(p=>{
    const q=search.toLowerCase();
    return !q||(p.nom+p.prenom+p.telephone).toLowerCase().includes(q);
  });

  const toggleMatiere=(m)=>setForm({...form,matieres:form.matieres.includes(m)?form.matieres.filter(x=>x!==m):[...form.matieres,m]});
  const toggleClasse=(c)=>setForm({...form,classes:form.classes.includes(c)?form.classes.filter(x=>x!==c):[...form.classes,c]});

  const add=async()=>{
    if(!form.nom||!form.prenom)return showToast("Nom et prénom requis",true);
    if(editId){
      await dbPatch("professeurs",editId,{nom:form.nom,prenom:form.prenom,telephone:form.telephone,email:form.email,matieres:JSON.stringify(form.matieres),classes:JSON.stringify(form.classes),salaire_mensuel:parseInt(form.salaireMensuel)||0,date_embauche:form.dateEmbauche,statut:form.statut,note:form.note});
      setProfesseurs(professeurs.map(p=>p.id===editId?{...p,...form}:p));
      setEditId(null);showToast("Professeur modifié ✓");
    } else {
      const rows=await dbAdd("professeurs",{nom:form.nom,prenom:form.prenom,telephone:form.telephone,email:form.email,matieres:JSON.stringify(form.matieres),classes:JSON.stringify(form.classes),salaire_mensuel:parseInt(form.salaireMensuel)||0,date_embauche:form.dateEmbauche,statut:form.statut,note:form.note});
      setProfesseurs([{...rows[0],matieres:form.matieres,classes:form.classes,salaireMensuel:parseInt(form.salaireMensuel)||0},...professeurs]);
      showToast("Professeur ajouté ✓");
    }
    setForm({nom:"",prenom:"",telephone:"",email:"",matieres:[],classes:[],salaireMensuel:0,dateEmbauche:today(),statut:"Actif",note:""});
    setShow(false);
  };

  const startEdit=(p)=>{
    setForm({
      nom:p.nom,prenom:p.prenom,telephone:p.telephone||"",email:p.email||"",
      matieres:Array.isArray(p.matieres)?p.matieres:(typeof p.matieres==="string"?JSON.parse(p.matieres||"[]"):[]),
      classes:Array.isArray(p.classes)?p.classes:(typeof p.classes==="string"?JSON.parse(p.classes||"[]"):[]),
      salaireMensuel:p.salaire_mensuel||p.salaireMensuel||0,
      dateEmbauche:p.date_embauche||p.dateEmbauche||today(),
      statut:p.statut||"Actif",note:p.note||""
    });
    setEditId(p.id);setShow(true);
  };

  const del=async(id)=>{await dbDel("professeurs",id);setProfesseurs(professeurs.filter(p=>p.id!==id));showToast("Supprimé");};

  const payerSalaire=async(prof)=>{
    if(!formSalaire.montant)return showToast("Montant requis",true);
    const newSal={id:Date.now(),professeurId:prof.id,nom:`${prof.prenom} ${prof.nom}`,...formSalaire,montant:parseInt(formSalaire.montant),type:"Salaire professeur"};
    setSalaires([newSal,...salaires]);
    // Enregistrer aussi dans les dépenses
    await dbAdd("depenses",{titre:`Salaire — ${prof.prenom} ${prof.nom}`,categorie:"Salaires",montant:parseInt(formSalaire.montant),date:formSalaire.date,statut:"Approuvée",note:formSalaire.note||`Mois: ${formSalaire.mois}`});
    setFormSalaire({montant:"",date:today(),mois:new Date().toISOString().slice(0,7),note:""});
    setShowSalaire(null);
    showToast("Salaire payé + dépense enregistrée ✓");
  };

  const getMatieres=(p)=>Array.isArray(p.matieres)?p.matieres:(typeof p.matieres==="string"?JSON.parse(p.matieres||"[]"):[]);
  const getClasses=(p)=>Array.isArray(p.classes)?p.classes:(typeof p.classes==="string"?JSON.parse(p.classes||"[]"):[]);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>👨‍🏫 Professeurs ({professeurs.length})</h1>
        <Btn onClick={()=>{setShow(!show);setEditId(null);setForm({nom:"",prenom:"",telephone:"",email:"",matieres:[],classes:[],salaireMensuel:0,dateEmbauche:today(),statut:"Actif",note:""}); }} color={couleur}>{show?"✕ Annuler":"+ Ajouter un professeur"}</Btn>
      </div>

      {/* Formulaire */}
      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:14}}>{editId?"✏️ Modifier":"Nouveau professeur"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <Inp label="Nom *" value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} placeholder="Nom de famille"/>
            <Inp label="Prénom *" value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} placeholder="Prénom"/>
            <Inp label="Téléphone" value={form.telephone} onChange={e=>setForm({...form,telephone:e.target.value})} placeholder="+221 77 000 00 00"/>
            <Inp label="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="prof@ecole.com"/>
            <Inp label={`Salaire mensuel (${devise})`} type="number" value={form.salaireMensuel} onChange={e=>setForm({...form,salaireMensuel:e.target.value})} placeholder="0"/>
            <Inp label="Date d'embauche" type="date" value={form.dateEmbauche} onChange={e=>setForm({...form,dateEmbauche:e.target.value})}/>
            <Sel label="Statut" value={form.statut} onChange={e=>setForm({...form,statut:e.target.value})} options={["Actif","Congé","Démissionné"]}/>
            <Inp label="Note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optionnel"/>
          </div>
          {/* Matières enseignées */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:theme.textMuted,display:"block",marginBottom:8}}>Matières enseignées</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {matieres.map(m=>(
                <button key={m} onClick={()=>toggleMatiere(m)}
                  style={{padding:"5px 12px",borderRadius:99,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",
                    borderColor:form.matieres.includes(m)?couleur:theme.border,
                    background:form.matieres.includes(m)?couleur+"22":"transparent",
                    color:form.matieres.includes(m)?couleur:theme.textMuted}}>
                  {form.matieres.includes(m)?"✓ ":""}{m}
                </button>
              ))}
            </div>
          </div>
          {/* Classes */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:theme.textMuted,display:"block",marginBottom:8}}>Classes assignées</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {classes.map(c=>(
                <button key={c} onClick={()=>toggleClasse(c)}
                  style={{padding:"5px 12px",borderRadius:99,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",
                    borderColor:form.classes.includes(c)?couleur:theme.border,
                    background:form.classes.includes(c)?couleur+"22":"transparent",
                    color:form.classes.includes(c)?couleur:theme.textMuted}}>
                  {form.classes.includes(c)?"✓ ":""}{c}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={add} color={couleur}>{editId?"💾 Sauvegarder":"Ajouter"}</Btn>
            {editId&&<BtnSec onClick={()=>{setEditId(null);setShow(false);}}>Annuler</BtnSec>}
          </div>
        </Card>
      )}

      {/* Modal paiement salaire */}
      {showSalaire&&(()=>{
        const prof=professeurs.find(p=>p.id===showSalaire);
        return prof?(
          <Card style={{marginBottom:16,borderColor:"rgba(48,209,88,0.3)"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#30D158",marginBottom:14}}>💰 Payer salaire — {prof.prenom} {prof.nom}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
              <Inp label={`Montant (${devise})`} type="number" value={formSalaire.montant} onChange={e=>setFormSalaire({...formSalaire,montant:e.target.value})} placeholder={`${prof.salaire_mensuel||0}`}/>
              <Inp label="Date" type="date" value={formSalaire.date} onChange={e=>setFormSalaire({...formSalaire,date:e.target.value})}/>
              <Inp label="Mois" type="month" value={formSalaire.mois} onChange={e=>setFormSalaire({...formSalaire,mois:e.target.value})}/>
              <Inp label="Note" value={formSalaire.note} onChange={e=>setFormSalaire({...formSalaire,note:e.target.value})} placeholder="Optionnel"/>
            </div>
            <div style={{fontSize:12,color:theme.textMuted,marginBottom:12}}>
              💡 Salaire mensuel habituel : <strong style={{color:couleur}}>{fmt(prof.salaire_mensuel||0)}</strong>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>payerSalaire(prof)} color="#30D158">💰 Confirmer le paiement</Btn>
              <BtnSec onClick={()=>setShowSalaire(null)}>Annuler</BtnSec>
            </div>
          </Card>
        ):null;
      })()}

      {/* Recherche */}
      <div style={{marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un professeur..."
          style={{width:"100%",background:theme.input,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 13px",color:theme.text,fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>

      {/* Liste */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {filtered.length===0&&<div style={{color:theme.textMuted,fontSize:13,gridColumn:"1/-1",textAlign:"center",padding:"2rem"}}>Aucun professeur</div>}
        {filtered.map(p=>{
          const mats=getMatieres(p);
          const cls=getClasses(p);
          return (
            <div key={p.id} style={{background:theme.bgCard,borderRadius:16,padding:"18px 20px",border:`1px solid ${theme.border}`,boxShadow:theme.shadow}}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:44,height:44,borderRadius:12,background:couleur+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>👨‍🏫</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:theme.text}}>{p.prenom} {p.nom}</div>
                    {p.telephone&&<div style={{fontSize:12,color:theme.textMuted}}>📞 {p.telephone}</div>}
                  </div>
                </div>
                <Badge label={p.statut||"Actif"} color={p.statut==="Actif"?"#30D158":p.statut==="Congé"?"#FF9F0A":"#FF453A"} bg={p.statut==="Actif"?"#1C3A27":p.statut==="Congé"?"#3A2F1C":"#3A1C1C"}/>
              </div>
              {/* Matières */}
              {mats.length>0&&(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:theme.textMuted,marginBottom:5}}>Matières</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {mats.map(m=><span key={m} style={{background:couleur+"22",color:couleur,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600}}>{m}</span>)}
                  </div>
                </div>
              )}
              {/* Classes */}
              {cls.length>0&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:theme.textMuted,marginBottom:5}}>Classes</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {cls.map(c=><span key={c} style={{background:"rgba(255,255,255,0.06)",color:theme.textSub,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600,border:`1px solid ${theme.border}`}}>{c}</span>)}
                  </div>
                </div>
              )}
              {/* Salaire */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:`1px solid ${theme.borderLight}`}}>
                <div style={{fontSize:12,color:theme.textMuted}}>Salaire mensuel</div>
                <div style={{fontWeight:700,color:"#30D158",fontSize:14}}>{fmt(p.salaire_mensuel||0)}</div>
              </div>
              {/* Actions */}
              <div style={{display:"flex",gap:6,marginTop:10}}>
                <button style={{flex:1,background:"rgba(48,209,88,0.12)",border:"1px solid #30D158",color:"#30D158",padding:"7px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}} onClick={()=>setShowSalaire(p.id)}>💰 Payer salaire</button>
                <button style={{background:"rgba(255,159,10,0.12)",border:"1px solid #FF9F0A",color:"#FF9F0A",padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}} onClick={()=>startEdit(p)}>✏️</button>
                <button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={()=>del(p.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Écran de Login ───────────────────────────────────────────────────────────
function LoginScreen({onLogin,cfg}) {
  const [dark]=useState(()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme=dark?DARK:LIGHT;
  const [email,setEmail]=useState("");
  const [mdp,setMdp]=useState("");
  const [erreur,setErreur]=useState("");
  const [loading,setLoading]=useState(false);
  const couleur=cfg?.couleur||"#0A84FF";
  const nomEcole=cfg?.nom||"Mon École";

  const login=async()=>{
    if(!email||!mdp)return setErreur("Email et mot de passe requis");
    setLoading(true);setErreur("");
    try{
      const res=await fetch(`${SUPA_URL}/rest/v1/utilisateurs?email=eq.${email}&mot_de_passe=eq.${mdp}&actif=eq.true`,{headers:dbHeaders});
      const rows=await res.json();
      if(rows&&rows.length>0){
        saveSession(rows[0]);
        onLogin(rows[0]);
      } else {
        setErreur("Email ou mot de passe incorrect");
      }
    }catch(e){setErreur("Erreur de connexion");}
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:dark?"#000":"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'SF Pro Display','Segoe UI',sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:12}}>🏫</div>
          <div style={{fontSize:24,fontWeight:900,color:couleur}}>{nomEcole}</div>
          <div style={{fontSize:14,color:dark?"#636366":"#8E8E93",marginTop:6}}>Connectez-vous pour accéder au logiciel</div>
        </div>
        <div style={{background:dark?"#1C1C1E":"#FFFFFF",borderRadius:20,padding:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"}`,boxShadow:"0 4px 24px rgba(0,0,0,0.1)"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:13,fontWeight:600,color:dark?"#8E8E93":"#636366"}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&login()}
                placeholder="votre@email.com"
                style={{background:dark?"rgba(255,255,255,0.07)":"#F2F2F7",border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.12)"}`,borderRadius:10,padding:"12px 14px",color:dark?"#F2F2F7":"#1C1C1E",fontSize:15,outline:"none",fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:13,fontWeight:600,color:dark?"#8E8E93":"#636366"}}>Mot de passe</label>
              <input type="password" value={mdp} onChange={e=>setMdp(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&login()}
                placeholder="••••••••"
                style={{background:dark?"rgba(255,255,255,0.07)":"#F2F2F7",border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.12)"}`,borderRadius:10,padding:"12px 14px",color:dark?"#F2F2F7":"#1C1C1E",fontSize:15,outline:"none",fontFamily:"inherit"}}/>
            </div>
          </div>
          {erreur&&<div style={{background:"#3A1C1C",color:"#FF453A",padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:600,marginBottom:14}}>❌ {erreur}</div>}
          <button onClick={login} style={{width:"100%",background:couleur,color:"#fff",border:"none",padding:"14px",borderRadius:12,fontWeight:700,cursor:"pointer",fontSize:16,fontFamily:"inherit",opacity:loading?0.7:1}}>
            {loading?"Connexion...":"Se connecter"}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:dark?"#3A3A3C":"#AEAEB2"}}>
          Compte admin par défaut : admin@ecole.com / admin123
        </div>
      </div>
    </div>
  );
}

// ─── Gestion Utilisateurs ─────────────────────────────────────────────────────
function Utilisateurs({utilisateurs,setUtilisateurs,cfg,showToast}) {
  const {theme}=useTheme();
  const {couleur}=cfg;
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({nom:"",prenom:"",email:"",mot_de_passe:"",role:"professeur",actif:true});

  const ROLES=[
    {v:"admin",    l:"👑 Administrateur — Accès total"},
    {v:"comptable",l:"💰 Comptable — Paiements et finances"},
    {v:"professeur",l:"👨‍🏫 Professeur — Notes et absences"},
  ];

  const add=async()=>{
    if(!form.nom||!form.email||!form.mot_de_passe)return showToast("Tous les champs sont requis",true);
    const rows=await dbAdd("utilisateurs",form);
    setUtilisateurs([rows[0],...utilisateurs]);
    setForm({nom:"",prenom:"",email:"",mot_de_passe:"",role:"professeur",actif:true});
    setShow(false);showToast("Utilisateur créé ✓");
  };

  const toggleActif=async(id,actif)=>{
    await dbPatch("utilisateurs",id,{actif:!actif});
    setUtilisateurs(utilisateurs.map(u=>u.id===id?{...u,actif:!actif}:u));
    showToast(actif?"Compte désactivé":"Compte activé ✓");
  };

  const del=async(id)=>{
    await dbDel("utilisateurs",id);
    setUtilisateurs(utilisateurs.filter(u=>u.id!==id));
    showToast("Supprimé");
  };

  const roleLabel=(r)=>r==="admin"?"👑 Admin":r==="comptable"?"💰 Comptable":"👨‍🏫 Professeur";
  const roleColor=(r)=>r==="admin"?"#FF9F0A":r==="comptable"?"#30D158":"#0A84FF";

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>👥 Utilisateurs ({utilisateurs.length})</h1>
        <Btn onClick={()=>setShow(!show)} color={couleur}>{show?"✕ Annuler":"+ Nouvel utilisateur"}</Btn>
      </div>

      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:14}}>Nouvel utilisateur</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <Inp label="Nom *" value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} placeholder="Nom de famille"/>
            <Inp label="Prénom" value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} placeholder="Prénom"/>
            <Inp label="Email *" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@ecole.com"/>
            <Inp label="Mot de passe *" value={form.mot_de_passe} onChange={e=>setForm({...form,mot_de_passe:e.target.value})} placeholder="Mot de passe"/>
            <Sel label="Rôle" value={form.role} onChange={e=>setForm({...form,role:e.target.value})} options={ROLES.map(r=>({v:r.v,l:r.l}))}/>
          </div>
          <Btn onClick={add} color={couleur}>Créer le compte</Btn>
        </Card>
      )}

      <TableWrap>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Utilisateur","Email","Rôle","Statut","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {utilisateurs.length===0&&<tr><Td colSpan={5} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucun utilisateur</Td></tr>}
            {utilisateurs.map(u=>(
              <tr key={u.id}>
                <Td><strong style={{color:theme.text}}>{u.prenom} {u.nom}</strong></Td>
                <Td style={{color:theme.textMuted,fontSize:12}}>{u.email}</Td>
                <Td><span style={{background:roleColor(u.role)+"22",color:roleColor(u.role),padding:"3px 10px",borderRadius:99,fontSize:12,fontWeight:700}}>{roleLabel(u.role)}</span></Td>
                <Td><Badge label={u.actif?"Actif":"Inactif"} color={u.actif?"#30D158":"#FF453A"} bg={u.actif?"#1C3A27":"#3A1C1C"}/></Td>
                <Td>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>toggleActif(u.id,u.actif)} style={{background:u.actif?"rgba(255,69,58,0.12)":"rgba(48,209,88,0.12)",border:`1px solid ${u.actif?"#FF453A":"#30D158"}`,color:u.actif?"#FF453A":"#30D158",padding:"4px 10px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>
                      {u.actif?"Désactiver":"Activer"}
                    </button>
                    <button style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"4px 8px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={()=>del(u.id)}>🗑</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,setDark]=useState(()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme=dark?DARK:LIGHT;
  const [cfg,setCfg]=useState(()=>loadCfg());
  const [user,setUser]=useState(()=>loadSession());
  const [page,setPage]=useState("dashboard");
  const [toast,setToast]=useState(null);
  const [loading,setLoading]=useState(true);
  const [offline,setOffline]=useState(false);
  const [utilisateurs,setUtilisateurs]=useState([]);
  const [changeMdp,setChangeMdp]=useState(false);
  const [ancienMdp,setAncienMdp]=useState("");
  const [nouveauMdp,setNouveauMdp]=useState("");
  const [confirmMdp,setConfirmMdp]=useState("");

  const [eleves,setElevesRaw]=useState([]);
  const [paiements,setPaiementsRaw]=useState([]);
  const [notes,setNotesRaw]=useState([]);
  const [absences,setAbsencesRaw]=useState([]);
  const [depenses,setDepensesRaw]=useState([]);
  const [recettes,setRecettesRaw]=useState([]);
  const [professeurs,setProfesseursRaw]=useState([]);

  // Charger config + données depuis Supabase au démarrage
  useEffect(()=>{
    (async()=>{
      try{
        // Charger config depuis Supabase
        const cfgRes=await fetch(`${SUPA_URL}/rest/v1/config?select=data&order=id.desc&limit=1`,{headers:dbHeaders});
        const cfgRows=await cfgRes.json();
        if(cfgRows&&cfgRows.length>0&&cfgRows[0].data){
          const remoteCfg=cfgRows[0].data;
          setCfg(remoteCfg);
          localStorage.setItem(STORAGE,JSON.stringify(remoteCfg));
        }

        // Charger données depuis Supabase
        const [e,p,n,a,d,r,pr,ut]=await Promise.all([
          dbGet("eleves"),dbGet("paiements"),dbGet("notes"),
          dbGet("absences"),dbGet("depenses"),dbGet("recettes"),
          dbGet("professeurs").catch(()=>[]),
          dbGet("utilisateurs").catch(()=>[])
        ]);
        const data={
          eleves:e||[],
          paiements:(p||[]).map(x=>({...x,eleveId:x.eleve_id})),
          notes:(n||[]).map(x=>({...x,eleveId:x.eleve_id})),
          absences:(a||[]).map(x=>({...x,eleveId:x.eleve_id})),
          depenses:d||[],
          recettes:r||[],
          professeurs:pr||[],
        };
        setElevesRaw(data.eleves);
        setPaiementsRaw(data.paiements);
        setNotesRaw(data.notes);
        setAbsencesRaw(data.absences);
        setDepensesRaw(data.depenses);
        setRecettesRaw(data.recettes);
        setProfesseursRaw(data.professeurs);
        setUtilisateurs(ut||[]);
        // Sauvegarder dans le cache local
        saveCache(data);
        setOffline(false);
      }catch(e){
        // Pas de connexion → utiliser le cache local
        console.log("Hors ligne, chargement du cache...");
        const cache=loadCache();
        if(cache){
          setElevesRaw(cache.eleves||[]);
          setPaiementsRaw(cache.paiements||[]);
          setNotesRaw(cache.notes||[]);
          setAbsencesRaw(cache.absences||[]);
          setDepensesRaw(cache.depenses||[]);
          setRecettesRaw(cache.recettes||[]);
          setProfesseursRaw(cache.professeurs||[]);
        }
        setOffline(true);
      }
      setLoading(false);
    })();
  },[]);

  // Détecter retour connexion → resynchroniser
  useEffect(()=>{
    const handleOnline=async()=>{
      // Synchroniser la file d'attente
      await syncQueue();
      setOffline(false);
      // Recharger les données depuis Supabase
      try{
        const [e,p,n,a,d,r]=await Promise.all([
          dbGet("eleves"),dbGet("paiements"),dbGet("notes"),
          dbGet("absences"),dbGet("depenses"),dbGet("recettes")
        ]);
        const data={
          eleves:e||[],
          paiements:(p||[]).map(x=>({...x,eleveId:x.eleve_id})),
          notes:(n||[]).map(x=>({...x,eleveId:x.eleve_id})),
          absences:(a||[]).map(x=>({...x,eleveId:x.eleve_id})),
          depenses:d||[],
          recettes:r||[],
        };
        setElevesRaw(data.eleves);
        setPaiementsRaw(data.paiements);
        setNotesRaw(data.notes);
        setAbsencesRaw(data.absences);
        setDepensesRaw(data.depenses);
        setRecettesRaw(data.recettes);
        saveCache(data);
      }catch(e){console.error(e);}
    };
    const handleOffline=()=>setOffline(true);
    window.addEventListener("online",handleOnline);
    window.addEventListener("offline",handleOffline);
    return ()=>{
      window.removeEventListener("online",handleOnline);
      window.removeEventListener("offline",handleOffline);
    };
  },[]);

  // Fonctions avec mise à jour du cache local
  const setEleves=(v)=>{setElevesRaw(v);const c=loadCache()||{};saveCache({...c,eleves:v});};
  const setPaiements=(v)=>{setPaiementsRaw(v);const c=loadCache()||{};saveCache({...c,paiements:v});};
  const setNotes=(v)=>{setNotesRaw(v);const c=loadCache()||{};saveCache({...c,notes:v});};
  const setAbsences=(v)=>{setAbsencesRaw(v);const c=loadCache()||{};saveCache({...c,absences:v});};
  const setDepenses=(v)=>{setDepensesRaw(v);const c=loadCache()||{};saveCache({...c,depenses:v});};
  const setRecettes=(v)=>{setRecettesRaw(v);const c=loadCache()||{};saveCache({...c,recettes:v});};
  const setProfesseurs=(v)=>{setProfesseursRaw(v);const c=loadCache()||{};saveCache({...c,professeurs:v});};

  useEffect(()=>{
    const mq=window.matchMedia("(prefers-color-scheme: dark)");
    const h=(e)=>setDark(e.matches);
    mq.addEventListener("change",h);
    return ()=>mq.removeEventListener("change",h);
  },[]);

  const showToast=(msg,err=false)=>{setToast({msg,err});setTimeout(()=>setToast(null),3000);};

  // Écran de chargement
  if(loading) return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <div style={{minHeight:"100vh",background:theme.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{fontSize:48}}>🏫</div>
        <div style={{fontSize:20,fontWeight:700,color:theme.text}}>Chargement...</div>
        <div style={{fontSize:13,color:theme.textMuted}}>Connexion à la base de données</div>
      </div>
    </ThemeCtx.Provider>
  );

  // Afficher login si pas de session
  if(!user) return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <LoginScreen onLogin={(u)=>setUser(u)} cfg={cfg}/>
    </ThemeCtx.Provider>
  );

  // Afficher setup si pas de config ET admin connecté
  if(!cfg&&user?.role==="admin") return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <Setup onDone={(c)=>{saveCfg(c);setCfg(c);}}/>
    </ThemeCtx.Provider>
  );

  const {couleur,nom,adresse,niveau}=cfg||{couleur:"#0A84FF",nom:"École",adresse:"",niveau:""};
  const alertes=eleves.filter(e=>e.statut==="Actif"&&paiements.filter(p=>p.eleveId===e.id&&p.mois===new Date().toISOString().slice(0,7)).reduce((s,p)=>s+p.montant,0)<(cfg?.fraisMensuel||0)).length;

  // Navigation selon le rôle
  const isAdmin=user?.role==="admin";
  const isComptable=user?.role==="comptable";
  const isProf=user?.role==="professeur";

  const NAV=[
    {id:"dashboard",   label:"Dashboard",    icon:"◈"},
    ...(isAdmin||isProf?[{id:"eleves",label:"Élèves",icon:"👨‍🎓"}]:[]),
    ...(isAdmin?[{id:"professeurs",label:"Professeurs",icon:"👨‍🏫"}]:[]),
    ...(isAdmin||isComptable?[{id:"paiements",label:"Paiements",icon:"💰",badge:alertes}]:[]),
    ...(isAdmin||isComptable?[{id:"recus",label:"Reçus",icon:"🧾"}]:[]),
    ...(isAdmin||isProf?[{id:"notes",label:"Notes",icon:"📝"}]:[]),
    ...(isAdmin||isProf?[{id:"bulletins",label:"Bulletins",icon:"📊"}]:[]),
    ...(isAdmin||isProf?[{id:"absences",label:"Absences",icon:"📅"}]:[]),
    ...(isAdmin||isProf?[{id:"emploi",label:"Emploi du temps",icon:"🗓️"}]:[]),
    ...(isAdmin||isComptable?[{id:"finances",label:"Finances",icon:"💼"}]:[]),
    ...(isAdmin||isComptable?[{id:"rapports",label:"Rapports",icon:"📈"}]:[]),
    ...(isAdmin?[{id:"utilisateurs",label:"Utilisateurs",icon:"👥"}]:[]),
    ...(isAdmin?[{id:"parametres",label:"Paramètres",icon:"⚙️"}]:[]),
  ];

  // Fonctions pour modifier la config sans reconfigurer
  const updateCfg=(newCfg)=>{saveCfg(newCfg);setCfg(newCfg);};

  return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <div style={{minHeight:"100vh",background:theme.bg,color:theme.text,fontFamily:"'SF Pro Display','Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",transition:"background 0.25s"}}>
        <header style={{background:theme.bgHeader,backdropFilter:"blur(20px)",borderBottom:`1px solid ${theme.border}`,position:"sticky",top:0,zIndex:100,boxShadow:theme.shadow}}>
          {/* Bandeau hors ligne */}
          {offline&&(
            <div style={{background:"#3A2F1C",borderBottom:"1px solid #FF9F0A",padding:"6px 24px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>📵</span>
              <span style={{fontSize:12,color:"#FF9F0A",fontWeight:600}}>
                Mode hors ligne — vous pouvez continuer à travailler normalement.
                {loadQueue().length>0&&` ${loadQueue().length} action(s) en attente de synchronisation.`}
                {" "}Synchronisation automatique dès reconnexion.
              </span>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px"}}>
            <div>
              <div style={{fontWeight:900,fontSize:18,color:couleur,letterSpacing:"-0.3px"}}>🏫 {nom}</div>
              <div style={{fontSize:10,color:theme.textMuted}}>{niveau}{adresse&&` · 📍 ${adresse}`}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:11,color:theme.textMuted}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long",year:"numeric"})}</div>
              <div style={{fontSize:11,color:couleur,fontWeight:700,background:couleur+"18",padding:"4px 10px",borderRadius:99}}>
                {user?.role==="admin"?"👑":user?.role==="comptable"?"💰":"👨‍🏫"} {user?.prenom} {user?.nom}
              </div>
              <button onClick={()=>setChangeMdp(true)} style={{background:theme.toggleBg,border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"5px 12px",borderRadius:9,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>🔑 Mot de passe</button>
              <button onClick={()=>setDark(d=>!d)} style={{background:theme.toggleBg,border:"none",borderRadius:20,padding:"6px 10px",cursor:"pointer",fontSize:16}}>{dark?"☀️":"🌙"}</button>
              <button onClick={()=>{clearSession();setUser(null);}} style={{background:"rgba(255,69,58,0.12)",border:"1px solid #FF453A",color:"#FF453A",padding:"5px 12px",borderRadius:9,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600}}>🚪 Déconnexion</button>
            </div>
          </div>
          <div style={{display:"flex",gap:4,padding:"0 24px 10px",flexWrap:"wrap"}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)}
                style={{padding:"6px 13px",borderRadius:10,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",transition:"all 0.15s",
                  borderColor:page===n.id?couleur+"66":theme.border,
                  background:page===n.id?couleur+"18":theme.toggleBg,
                  color:page===n.id?couleur:theme.textMuted,
                  display:"flex",alignItems:"center",gap:5}}>
                {n.icon} {n.label}
                {n.badge>0&&<span style={{background:"#FF453A",color:"#fff",borderRadius:99,padding:"1px 5px",fontSize:10,fontWeight:800}}>{n.badge}</span>}
              </button>
            ))}
          </div>
        </header>
        <main style={{flex:1,padding:"24px",maxWidth:1400,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
          {loading?<div style={{textAlign:"center",padding:"60px",fontSize:32}}>⏳ Chargement...</div>:(
            <>
              {page==="dashboard"   &&<Dashboard    eleves={eleves} paiements={paiements} depenses={depenses} recettes={recettes} absences={absences} cfg={cfg}/>}
              {page==="eleves"      &&<Eleves       eleves={eleves} setEleves={setEleves} cfg={cfg} showToast={showToast}/>}
              {page==="professeurs" &&<Professeurs  professeurs={professeurs} setProfesseurs={setProfesseurs} cfg={cfg} showToast={showToast}/>}
              {page==="paiements"   &&<Paiements    paiements={paiements} setPaiements={setPaiements} eleves={eleves} cfg={cfg} showToast={showToast}/>}
              {page==="recus"       &&<Recus        paiements={paiements} eleves={eleves} cfg={cfg}/>}
              {page==="notes"       &&<Notes        notes={notes} setNotes={setNotes} eleves={eleves} cfg={cfg} showToast={showToast}/>}
              {page==="bulletins"   &&<Bulletins    notes={notes} eleves={eleves} absences={absences} cfg={cfg}/>}
              {page==="absences"    &&<Absences     absences={absences} setAbsences={setAbsences} eleves={eleves} cfg={cfg} showToast={showToast}/>}
              {page==="finances"    &&<Finances     depenses={depenses} setDepenses={setDepenses} recettes={recettes} setRecettes={setRecettes} paiements={paiements} cfg={cfg} showToast={showToast}/>}
              {page==="rapports"     &&<Rapports     paiements={paiements} depenses={depenses} recettes={recettes} eleves={eleves} cfg={cfg}/>}
              {page==="emploi"       &&<EmploiDuTemps cfg={cfg} professeurs={professeurs}/>}
              {page==="parametres"  &&<Parametres   cfg={cfg} updateCfg={updateCfg} showToast={showToast}/>}
            </>
          )}
        </main>
        <footer style={{textAlign:"center",padding:"12px",fontSize:11,color:theme.textFaint,borderTop:`1px solid ${theme.border}`}}>
          {nom} · Logiciel de gestion scolaire 🏫
        </footer>
        {toast&&<Toast msg={toast.msg} err={toast.err}/>}

        {/* Modal changement mot de passe */}
        {changeMdp&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:theme.bgCard,borderRadius:20,padding:28,width:"100%",maxWidth:400,border:`1px solid ${theme.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
              <div style={{fontSize:16,fontWeight:800,color:theme.text,marginBottom:20}}>🔑 Changer mon mot de passe</div>
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
                <Inp label="Ancien mot de passe" value={ancienMdp} onChange={e=>setAncienMdp(e.target.value)} type="password" placeholder="••••••••"/>
                <Inp label="Nouveau mot de passe" value={nouveauMdp} onChange={e=>setNouveauMdp(e.target.value)} type="password" placeholder="••••••••"/>
                <Inp label="Confirmer le nouveau" value={confirmMdp} onChange={e=>setConfirmMdp(e.target.value)} type="password" placeholder="••••••••"/>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={async()=>{
                  if(!ancienMdp||!nouveauMdp||!confirmMdp)return showToast("Tous les champs sont requis",true);
                  if(ancienMdp!==user.mot_de_passe)return showToast("Ancien mot de passe incorrect",true);
                  if(nouveauMdp!==confirmMdp)return showToast("Les mots de passe ne correspondent pas",true);
                  if(nouveauMdp.length<6)return showToast("Minimum 6 caractères",true);
                  await dbPatch("utilisateurs",user.id,{mot_de_passe:nouveauMdp});
                  const newUser={...user,mot_de_passe:nouveauMdp};
                  setUser(newUser);saveSession(newUser);
                  setAncienMdp("");setNouveauMdp("");setConfirmMdp("");
                  setChangeMdp(false);showToast("Mot de passe changé ✓");
                }} style={{flex:1,background:couleur,color:"#fff",border:"none",padding:"11px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>
                  Confirmer
                </button>
                <button onClick={()=>{setChangeMdp(false);setAncienMdp("");setNouveauMdp("");setConfirmMdp("");}}
                  style={{background:theme.toggleBg,color:theme.text,border:`1px solid ${theme.border}`,padding:"11px 18px",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
