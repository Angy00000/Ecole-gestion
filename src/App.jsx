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

// ─── Config locale ────────────────────────────────────────────────────────────
const STORAGE = "ecole_config";
const DATA_KEY = "ecole_data";
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(STORAGE)||"null"); } catch { return null; } };
const saveCfg = (c) => localStorage.setItem(STORAGE, JSON.stringify(c));
const loadData = () => { try { return JSON.parse(localStorage.getItem(DATA_KEY)||"null"); } catch { return null; } };
const saveData = (d) => localStorage.setItem(DATA_KEY, JSON.stringify(d));

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
    fraisInscription:50000,fraisMensuel:15000,
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

  const add=()=>{
    if(!form.nom||!form.prenom)return showToast("Nom et prénom requis",true);
    if(editId){
      setEleves(eleves.map(e=>e.id===editId?{...e,...form}:e));
      setEditId(null);showToast("Élève modifié ✓");
    } else {
      setEleves([{...form,id:Date.now()},...eleves]);
      showToast("Élève inscrit ✓");
    }
    setForm({nom:"",prenom:"",classe:classes[0]||"",dateNaissance:"",telephone:"",parent:"",telephoneParent:"",adresse:"",dateInscription:today(),statut:"Actif",note:""});
    setShow(false);
  };
  const startEdit=(e)=>{setForm({...e});setEditId(e.id);setShow(true);};
  const del=(id)=>{setEleves(eleves.filter(e=>e.id!==id));showToast("Supprimé");};

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
  const {couleur,devise,fraisMensuel,fraisInscription}=cfg;
  const fmt=(n)=>xof(n,devise);
  const [show,setShow]=useState(false);
  const [fMois,setFMois]=useState("");
  const [form,setForm]=useState({eleveId:"",type:"Mensualité",montant:fraisMensuel,date:today(),mois:new Date().toISOString().slice(0,7),note:""});

  const filtered=paiements.filter(p=>!fMois||p.mois===fMois);
  const total=filtered.reduce((s,p)=>s+p.montant,0);

  const add=()=>{
    if(!form.eleveId)return showToast("Sélectionnez un élève",true);
    setPaiements([{...form,id:Date.now(),montant:parseInt(form.montant)},...paiements]);
    setForm({eleveId:"",type:"Mensualité",montant:fraisMensuel,date:today(),mois:new Date().toISOString().slice(0,7),note:""});
    setShow(false);showToast("Paiement enregistré ✓");
  };
  const del=(id)=>{setPaiements(paiements.filter(p=>p.id!==id));showToast("Supprimé");};

  // Élèves avec impayés ce mois
  const moisCourant=new Date().toISOString().slice(0,7);
  const impayes=eleves.filter(e=>e.statut==="Actif"&&paiements.filter(p=>p.eleveId===e.id&&p.mois===moisCourant).reduce((s,p)=>s+p.montant,0)<fraisMensuel);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontWeight:800,fontSize:24,margin:0,color:theme.text}}>💰 Paiements</h1>
        <Btn onClick={()=>setShow(!show)} color={couleur}>{show?"✕ Annuler":"+ Nouveau paiement"}</Btn>
      </div>
      {show&&(
        <Card style={{marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Sel label="Élève *" value={form.eleveId} onChange={e=>setForm({...form,eleveId:Number(e.target.value)})}
              options={[{v:"",l:"-- Choisir un élève --"},...eleves.map(e=>({v:e.id,l:`${e.prenom} ${e.nom} (${e.classe})`}))]}/>
            <Sel label="Type" value={form.type} onChange={e=>setForm({...form,type:e.target.value,montant:e.target.value==="Inscription"?fraisInscription:e.target.value==="Mensualité"?fraisMensuel:form.montant})}
              options={["Mensualité","Inscription","Cantine","Transport","Autre"]}/>
            <Inp label={`Montant (${devise}) *`} type="number" value={form.montant} onChange={e=>setForm({...form,montant:e.target.value})} placeholder="0"/>
            <Inp label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            <Inp label="Mois concerné" type="month" value={form.mois} onChange={e=>setForm({...form,mois:e.target.value})}/>
            <Inp label="Note" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optionnel"/>
          </div>
          <Btn onClick={add} color={couleur}>Enregistrer le paiement</Btn>
        </Card>
      )}

      {/* Impayés */}
      {impayes.length>0&&(
        <Card style={{marginBottom:16,borderColor:"rgba(255,69,58,0.3)"}}>
          <CardTitle color="#FF453A">⚠️ Élèves avec impayés ce mois ({impayes.length})</CardTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {impayes.map(e=>(
              <div key={e.id} style={{padding:"6px 12px",background:"rgba(255,69,58,0.1)",borderRadius:99,border:"1px solid rgba(255,69,58,0.3)"}}>
                <span style={{color:"#FF453A",fontSize:12,fontWeight:600}}>{e.prenom} {e.nom} — {e.classe}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
        <Inp label="" value={fMois} onChange={e=>setFMois(e.target.value)} type="month" placeholder="Filtrer par mois"/>
        <div style={{marginLeft:"auto",color:theme.textMuted,fontSize:13}}>Total : <strong style={{color:"#30D158"}}>{fmt(total)}</strong></div>
      </div>
      <TableWrap>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Élève","Type","Mois","Montant","Date","Actions"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><Td colSpan={6} style={{textAlign:"center",color:theme.textMuted,padding:"2rem"}}>Aucun paiement</Td></tr>}
            {filtered.map(p=>{
              const eleve=eleves.find(e=>e.id===p.eleveId);
              return (
                <tr key={p.id}>
                  <Td><strong style={{color:theme.text}}>{eleve?`${eleve.prenom} ${eleve.nom}`:"—"}</strong>{eleve&&<div style={{fontSize:11,color:theme.textMuted}}>{eleve.classe}</div>}</Td>
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
  const {couleur,matieres,classes}=cfg;
  const [show,setShow]=useState(false);
  const [fClasse,setFClasse]=useState(classes[0]||"");
  const [fMatiere,setFMatiere]=useState(matieres[0]||"");
  const [form,setForm]=useState({eleveId:"",matiere:matieres[0]||"",note:"",coeff:1,type:"Devoir",trimestre:"T1",date:today()});

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

  const add=()=>{
    if(!form.eleveId||form.note==="")return showToast("Élève et note requis",true);
    const n=parseFloat(form.note);
    if(n<0||n>20)return showToast("Note entre 0 et 20",true);
    setNotes([{...form,id:Date.now(),note:n,coeff:parseInt(form.coeff)||1},...notes]);
    setForm({...form,eleveId:"",note:""});
    showToast("Note enregistrée ✓");
  };
  const del=(id)=>{setNotes(notes.filter(n=>n.id!==id));showToast("Supprimée");};

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
            <Sel label="Classe" value={form.classe||fClasse} onChange={e=>setForm({...form,classe:e.target.value})} options={classes}/>
            <Sel label="Élève *" value={form.eleveId} onChange={e=>setForm({...form,eleveId:Number(e.target.value)})}
              options={[{v:"",l:"-- Choisir --"},...eleves.filter(e=>e.classe===(form.classe||fClasse)&&e.statut==="Actif").map(e=>({v:e.id,l:`${e.prenom} ${e.nom}`}))]}/>
            <Sel label="Matière" value={form.matiere} onChange={e=>setForm({...form,matiere:e.target.value})} options={matieres}/>
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
        <select value={fClasse} onChange={e=>setFClasse(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {classes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fMatiere} onChange={e=>setFMatiere(e.target.value)}
          style={{background:theme.sel,border:`1px solid ${theme.border}`,borderRadius:9,padding:"8px 12px",color:theme.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {matieres.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
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

  const add=()=>{
    if(!form.eleveId)return showToast("Sélectionnez un élève",true);
    setAbsences([{...form,id:Date.now()},...absences]);
    setForm({...form,eleveId:"",motif:"",justifie:false});
    showToast("Absence enregistrée ✓");
  };
  const del=(id)=>{setAbsences(absences.filter(a=>a.id!==id));showToast("Supprimée");};
  const toggle=(id)=>setAbsences(absences.map(a=>a.id===id?{...a,justifie:!a.justifie}:a));

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

  const addDep=()=>{
    if(!formDep.titre||!formDep.montant)return showToast("Titre et montant requis",true);
    setDepenses([{...formDep,id:Date.now(),montant:parseInt(formDep.montant)},...depenses]);
    setFormDep({titre:"",categorie:"Salaires",montant:"",date:today(),statut:"En attente",note:""});
    setShowDep(false);showToast("Dépense enregistrée ✓");
  };
  const addRec=()=>{
    if(!formRec.titre||!formRec.montant)return showToast("Titre et montant requis",true);
    setRecettes([{...formRec,id:Date.now(),montant:parseInt(formRec.montant)},...recettes]);
    setFormRec({titre:"",categorie:"Autres",montant:"",date:today(),note:""});
    setShowRec(false);showToast("Recette enregistrée ✓");
  };
  const chStat=(id,statut)=>setDepenses(depenses.map(d=>d.id===id?{...d,statut}:d));
  const delDep=(id)=>{setDepenses(depenses.filter(d=>d.id!==id));showToast("Supprimée");};
  const delRec=(id)=>{setRecettes(recettes.filter(r=>r.id!==id));showToast("Supprimée");};

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

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,setDark]=useState(()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme=dark?DARK:LIGHT;
  const [cfg,setCfg]=useState(()=>loadCfg());
  const [page,setPage]=useState("dashboard");
  const [toast,setToast]=useState(null);

  // Données
  const initData=loadData()||{eleves:[],paiements:[],notes:[],absences:[],depenses:[],recettes:[]};
  const [eleves,setElevesRaw]=useState(initData.eleves);
  const [paiements,setPaiementsRaw]=useState(initData.paiements);
  const [notes,setNotesRaw]=useState(initData.notes);
  const [absences,setAbsencesRaw]=useState(initData.absences);
  const [depenses,setDepensesRaw]=useState(initData.depenses);
  const [recettes,setRecettesRaw]=useState(initData.recettes);

  // Auto-save
  const persist=(key,val)=>{const d=loadData()||{};saveData({...d,[key]:val});};
  const setEleves=(v)=>{setElevesRaw(v);persist("eleves",v);};
  const setPaiements=(v)=>{setPaiementsRaw(v);persist("paiements",v);};
  const setNotes=(v)=>{setNotesRaw(v);persist("notes",v);};
  const setAbsences=(v)=>{setAbsencesRaw(v);persist("absences",v);};
  const setDepenses=(v)=>{setDepensesRaw(v);persist("depenses",v);};
  const setRecettes=(v)=>{setRecettesRaw(v);persist("recettes",v);};

  useEffect(()=>{
    const mq=window.matchMedia("(prefers-color-scheme: dark)");
    const h=(e)=>setDark(e.matches);
    mq.addEventListener("change",h);
    return ()=>mq.removeEventListener("change",h);
  },[]);

  const showToast=(msg,err=false)=>{setToast({msg,err});setTimeout(()=>setToast(null),3000);};

  if(!cfg) return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <Setup onDone={(c)=>{saveCfg(c);setCfg(c);}}/>
    </ThemeCtx.Provider>
  );

  const {couleur,nom,adresse,niveau}=cfg;
  const alertes=eleves.filter(e=>e.statut==="Actif"&&paiements.filter(p=>p.eleveId===e.id&&p.mois===new Date().toISOString().slice(0,7)).reduce((s,p)=>s+p.montant,0)<cfg.fraisMensuel).length;

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:"◈"},
    {id:"eleves",   label:"Élèves",   icon:"👨‍🎓"},
    {id:"paiements",label:"Paiements", icon:"💰",badge:alertes},
    {id:"notes",    label:"Notes",     icon:"📝"},
    {id:"absences", label:"Absences",  icon:"📅"},
    {id:"finances", label:"Finances",  icon:"💼"},
  ];

  return (
    <ThemeCtx.Provider value={{dark,toggle:()=>setDark(d=>!d),theme}}>
      <div style={{minHeight:"100vh",background:theme.bg,color:theme.text,fontFamily:"'SF Pro Display','Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",transition:"background 0.25s"}}>
        <header style={{background:theme.bgHeader,backdropFilter:"blur(20px)",borderBottom:`1px solid ${theme.border}`,position:"sticky",top:0,zIndex:100,boxShadow:theme.shadow}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px"}}>
            <div>
              <div style={{fontWeight:900,fontSize:18,color:couleur,letterSpacing:"-0.3px"}}>🏫 {nom}</div>
              <div style={{fontSize:10,color:theme.textMuted}}>{niveau}{adresse&&` · 📍 ${adresse}`}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:11,color:theme.textMuted}}>{new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long",year:"numeric"})}</div>
              <button onClick={()=>setDark(d=>!d)} style={{background:theme.toggleBg,border:"none",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:16}}>{dark?"☀️":"🌙"}</button>
              <button onClick={()=>{if(window.confirm("Reconfigurer ?"))setCfg(null);}} style={{background:"none",border:`1px solid ${theme.border}`,color:theme.textMuted,padding:"5px 10px",borderRadius:9,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>⚙️</button>
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
          {page==="dashboard"&&<Dashboard eleves={eleves} paiements={paiements} depenses={depenses} recettes={recettes} absences={absences} cfg={cfg}/>}
          {page==="eleves"   &&<Eleves    eleves={eleves} setEleves={setEleves} cfg={cfg} showToast={showToast}/>}
          {page==="paiements"&&<Paiements paiements={paiements} setPaiements={setPaiements} eleves={eleves} cfg={cfg} showToast={showToast}/>}
          {page==="notes"    &&<Notes     notes={notes} setNotes={setNotes} eleves={eleves} cfg={cfg} showToast={showToast}/>}
          {page==="absences" &&<Absences  absences={absences} setAbsences={setAbsences} eleves={eleves} cfg={cfg} showToast={showToast}/>}
          {page==="finances" &&<Finances  depenses={depenses} setDepenses={setDepenses} recettes={recettes} setRecettes={setRecettes} paiements={paiements} cfg={cfg} showToast={showToast}/>}
        </main>
        <footer style={{textAlign:"center",padding:"12px",fontSize:11,color:theme.textFaint,borderTop:`1px solid ${theme.border}`}}>
          {nom} · Logiciel de gestion scolaire 🏫
        </footer>
        {toast&&<Toast msg={toast.msg} err={toast.err}/>}
      </div>
    </ThemeCtx.Provider>
  );
}
