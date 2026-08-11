const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(n)||0);
const money=v=>{let n=parseFloat(String(v??"").replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:0};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const getLocal=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
const putLocal=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const SHARED_TRIPS_KEY="voyageNomadeLocalTripIds";
const SHARED_CURRENT_KEY="voyageNomadeCurrentLocalTrip";
const LOCAL_TRIPS_KEY="voyageNomadeLocalTrips";

function localTrips(){
  const value=getLocal(LOCAL_TRIPS_KEY,[]);
  return Array.isArray(value)?value.filter(Boolean):[];
}
function saveLocalTrips(list){
  putLocal(LOCAL_TRIPS_KEY,list);
}
function clone(value){
  return typeof structuredClone==="function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function setInterfaceMode(mode){
  document.body.classList.remove("booting","welcome-mode","app-mode");
  document.body.classList.add(mode==="welcome"?"welcome-mode":"app-mode");
}

function show(page){
  document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active",x.id===page));
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.page)));

const DEFAULT_TRIP={name:"Corse 2026",start:"",end:"",cover:"images/ile-rousse.jpg",names:[],contributions:[],expenses:[],steps:[],photos:[],settled:{},potBalance:0};
let trips=[];
let currentTripId="";
let names=[],contributions=[],expenses=[],steps=[],photos=[],potBalance=0;
let pendingSharedSaves=0;
let sharedSaveErrorShown=false;
const saveRevisions=new Map();

function newTripId(){return crypto.randomUUID()}
function currentTrip(){return trips.find(t=>t.id===currentTripId)||trips[0]||{id:currentTripId,...DEFAULT_TRIP}}
function rememberTrips(){
  putLocal(SHARED_TRIPS_KEY,trips.map(t=>t.id));
  localStorage.setItem(SHARED_CURRENT_KEY,currentTripId);
}
function setSharedTripUrl(id){
  const url=new URL(location.href);
  url.searchParams.set("carnet",id);
  history.replaceState(null,"",url);
}
function selectCurrentTripId(id){currentTripId=id;rememberTrips();setSharedTripUrl(id)}
function validSharedTripId(id){return /^[a-zA-Z0-9_-]{8,100}$/.test(String(id||""))}

function tripSnapshot(t=currentTrip()){
  return {
    name:typeof t.name==="string"?t.name:"Notre voyage",
    start:t.start||"",
    end:t.end||"",
    cover:typeof t.cover==="string"?t.cover:"images/ile-rousse.jpg",
    names:[...names],
    contributions:clone(contributions),
    expenses:clone(expenses),
    steps:clone(steps),
    photos:clone(photos),
    settled:clone(t.settled||{}),
    potBalance:Number(potBalance||0)
  };
}
function replaceTrip(localTrip){
  const index=trips.findIndex(t=>t.id===localTrip.id);
  if(index>=0)trips[index]=localTrip;else trips.push(localTrip);
  return localTrip;
}

async function fetchSharedTrip(id){
  const trip=localTrips().find(t=>t.id===id);
  if(!trip){
    const error=new Error("Ce carnet n’existe pas sur cet ordinateur.");
    error.status=404;
    throw error;
  }
  return clone(trip);
}
async function createBlankSharedTrip(){
  const trip={id:newTripId(),...clone(DEFAULT_TRIP),updatedAt:new Date().toISOString()};
  const all=localTrips();
  all.push(trip);
  saveLocalTrips(all);
  return clone(trip);
}
async function putSharedTrip(id,state){
  const all=localTrips();
  const index=all.findIndex(t=>t.id===id);
  const current=index>=0?all[index]:{};
  const remote={
    ...clone(current),
    ...clone(state),
    id,
    photos:Array.isArray(state?.photos)?clone(state.photos):(Array.isArray(current.photos)?clone(current.photos):[]),
    updatedAt:new Date().toISOString()
  };
  if(index>=0)all[index]=remote;else all.push(remote);
  saveLocalTrips(all);
  return clone(remote);
}
async function uploadSharedPhoto(photo,tripId=currentTripId){
  const all=localTrips();
  const index=all.findIndex(t=>t.id===tripId);
  if(index<0)throw new Error("Le carnet n’existe pas sur cet ordinateur.");
  const item={...clone(photo),id:newTripId()};
  all[index].photos=Array.isArray(all[index].photos)?all[index].photos:[];
  all[index].photos.push(item);
  all[index].updatedAt=new Date().toISOString();
  saveLocalTrips(all);
  return clone(item);
}
async function deleteSharedPhoto(photo){
  if(!photo?.id)throw new Error("Cette photo ne possède pas d’identifiant.");
  const all=localTrips();
  const index=all.findIndex(t=>t.id===currentTripId);
  if(index<0)throw new Error("Le carnet n’existe pas sur cet ordinateur.");
  all[index].photos=(all[index].photos||[]).filter(p=>p.id!==photo.id);
  all[index].updatedAt=new Date().toISOString();
  saveLocalTrips(all);
}

function sortStepsChronologically(){
  steps.sort((a,b)=>{
    const ad=String(a.date||"");
    const bd=String(b.date||"");
    if(ad && bd) return ad.localeCompare(bd);
    if(ad) return -1;
    if(bd) return 1;
    return 0;
  });
}
function syncTrip(){
  const t=currentTrip();
  names=t.names||[];
  contributions=t.contributions||[];
  expenses=t.expenses||[];
  steps=t.steps||[];
  sortStepsChronologically();
  photos=t.photos||[];
  potBalance=Number.isFinite(Number(t.potBalance))?Number(t.potBalance):0;
  // Repair older data: every person who paid a recorded card expense
  // must also appear among the trip participants.
  let repaired=false;
  expenses.forEach(x=>{
    const payer=String(x.person||"").trim();
    if(payer && !names.includes(payer)){names.push(payer);repaired=true}
  });
  if(repaired)saveTrip();
}
function saveTrip(){
  const t=currentTrip();
  t.names=names;
  t.contributions=contributions;
  t.expenses=expenses;
  t.steps=steps;
  t.photos=photos;
  t.potBalance=Number(potBalance||0);
  const tripId=t.id;
  const revision=(saveRevisions.get(tripId)||0)+1;
  saveRevisions.set(tripId,revision);
  pendingSharedSaves++;
  return putSharedTrip(tripId,tripSnapshot(t)).then(remote=>{
    if(saveRevisions.get(tripId)===revision)replaceTrip(remote);
    else t.updatedAt=remote.updatedAt;
    sharedSaveErrorShown=false;
    return remote;
  }).catch(error=>{
    if(!sharedSaveErrorShown){
      sharedSaveErrorShown=true;
      alert(error.message||"La sauvegarde locale n’a pas pu être effectuée.");
    }
    return null;
  }).finally(()=>{pendingSharedSaves--;});
}

function refreshPeople(){
  const opts='<option value="">Choisir un participant</option>'+names.filter(Boolean).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  ["contribPerson","expensePerson"].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=opts});
}
function renderParticipants(){
  const box=document.getElementById("peopleList"); if(!box)return;
  if(!names.length){box.innerHTML='<p class="hint">Ajoute d’abord les participants.</p>';return}
  const paidBy={}; names.forEach(n=>paidBy[n]=0);
  contributions.forEach(x=>paidBy[x.person]=(paidBy[x.person]||0)+Number(x.amount||0));
  box.innerHTML=names.map(n=>`<div class="personRow"><div class="personMain"><b>${esc(n)}</b><small>Versé dans le pot : ${euro(paidBy[n])}</small></div><div class="balance ok">Participation enregistrée</div></div>`).join("");
}

function calculateBalances(){
  // Les versements alimentent uniquement le pot.
  // Les mises à niveau sont calculées à partir des dépenses partagées :
  // chacun supporte une part égale, et la personne qui a payé avec la carte
  // est créditée de sa propre part.
  const paidBy={}; names.forEach(n=>paidBy[n]=0);
  contributions.forEach(x=>paidBy[x.person]=(paidBy[x.person]||0)+Number(x.amount||0));

  const net={}; names.forEach(n=>net[n]=0);

  expenses.forEach(x=>{
    if(x.shared===false) return;
    const cents=Math.round((Number(x.amount)||0)*100);
    const payer=String(x.person||"");
    if(!names.includes(payer) || cents<=0) return;

    const n=names.length;
    if(!n) return;

    const base=Math.floor(cents/n);
    const remainder=cents-base*n;

    // Pour les centimes restants, on les attribue au payeur afin d'éviter
    // de créer artificiellement une dette d'un centime.
    names.forEach((name,i)=>{
      const share=base + (name===payer ? remainder : 0);
      if(name===payer) net[name]+=share/100;
      else net[name]-=share/100;
    });
  });

  return names.map(name=>({
    name,
    paid:paidBy[name]||0,
    spent:expenses.filter(x=>x.person===name).reduce((a,x)=>a+Number(x.amount||0),0),
    balance:Number((net[name]||0).toFixed(2))
  }));
}

function buildTransfers(rows){
  const debtors=rows.filter(r=>r.balance<-0.005).map(r=>({...r,balance:Math.round(-r.balance*100)})).sort((a,b)=>b.balance-a.balance);
  const creditors=rows.filter(r=>r.balance>0.005).map(r=>({...r,balance:Math.round(r.balance*100)})).sort((a,b)=>b.balance-a.balance);
  const transfers=[];let i=0,j=0;
  while(i<debtors.length&&j<creditors.length){
    const cents=Math.min(debtors[i].balance,creditors[j].balance);
    if(cents>0) transfers.push({from:debtors[i].name,to:creditors[j].name,amount:cents/100});
    debtors[i].balance-=cents;creditors[j].balance-=cents;
    if(debtors[i].balance===0)i++;
    if(creditors[j].balance===0)j++;
  }
  return transfers;
}
function settlementKey(x){return `${x.from}|${x.to}|${Number(x.amount).toFixed(2)}`}
function getSettled(){return currentTrip().settled||{}}
function markSettled(x){
  const amount=Number(x.amount||0);
  if(amount<=0||!x.from)return;
  // Ici, le participant remet sa part directement dans le pot commun.
  contributions.push({person:x.from,amount,date:new Date().toLocaleDateString("fr-FR"),reason:"Équilibrage d'une dépense partagée"});
  potBalance=Number((potBalance+amount).toFixed(2));
  const t=currentTrip(); t.settled=t.settled||{}; t.settled[settlementKey(x)]=true;
  saveTrip(); renderPot();
}
function renderReimbursements(){
  const box=document.getElementById("reimbursementsList"); if(!box)return;
  const settled=getSettled();
  // Un versement d’équilibrage clôture cette dette : elle disparaît de la liste.
  const transfers=buildTransfers(calculateBalances()).filter(t=>!settled[settlementKey(t)]);
  if(!transfers.length){box.innerHTML='<p class="hint">Aucun versement à remettre dans le pot. Tout le monde est à jour. ✓</p>';return}
  box.innerHTML=transfers.map(t=>`<div class="reimburseRow">
    <div class="reimburseMain"><b>${esc(t.from)} doit remettre ${euro(t.amount)} dans le pot</b><small>Part de cette personne dans les dépenses partagées</small></div>
    <button class="reimburseBtn" onclick='markSettled(${JSON.stringify(t)})'>Versé au pot</button>
  </div>`).join("");
}

function exportPotPdf(){
  const rows=calculateBalances(), transfers=buildTransfers(rows).filter(t=>!getSettled()[settlementKey(t)]);
  const spent=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const remaining=potBalance;
  const t=currentTrip();

  const peopleRows=rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="num">${euro(r.paid)}</td><td class="num">${euro(r.spent)}</td><td class="num">${r.balance>=0?"+":"−"}${euro(Math.abs(r.balance))}</td></tr>`).join("");
  const transferRows=transfers.length ? transfers.map(x=>`<tr><td>${esc(x.from)}</td><td class="num">${euro(x.amount)}</td></tr>`).join("") : `<tr><td colspan="2" class="empty">Tout le monde est équilibré.</td></tr>`;
  const expenseRows=expenses.slice().reverse().map(x=>`<tr><td>${esc(x.date||"")}</td><td>${esc(x.desc||"Achat")}</td><td>${esc(x.person||"")}</td><td class="num">${euro(x.amount)}</td></tr>`).join("");

  const w=window.open("","_blank");
  if(!w)return alert("Autorise les fenêtres surgissantes pour exporter le PDF.");

  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>État du pot commun — ${esc(t.name)}</title>
  <style>
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:11px}
  .toolbar{position:fixed;right:18px;top:14px;z-index:5}.toolbar button{background:#20304d;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700}
  .sheet{max-width:920px;margin:35px auto;padding:0 18px 30px}.top{border-bottom:2px solid #222;padding-bottom:8px;margin-bottom:12px}
  h1{font-size:21px;margin:0}.meta{color:#666;margin-top:3px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #bfc3c7;margin-bottom:16px}
  .summary div{padding:8px 10px;border-right:1px solid #d6d9dc}.summary div:last-child{border-right:0}.summary small{display:block;color:#666}.summary b{font-size:14px}
  h2{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #999;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:4px 6px;border:1px solid #c9cdd1;height:21px}th{background:#e9ecef;font-weight:700;text-align:left}td.num,th.num{text-align:right}.empty{text-align:center;color:#666}
  .footer{margin-top:10px;font-size:9px;color:#777;border-top:1px solid #bbb;padding-top:5px}
  @media print{.toolbar{display:none}.sheet{max-width:none;margin:0;padding:0}body{font-size:9px}.top{margin-bottom:8px}h1{font-size:17px}h2{margin:8px 0 3px}th,td{padding:2px 4px;height:17px}.summary div{padding:5px 7px}.summary b{font-size:11px}tr{page-break-inside:avoid}@page{size:A4 portrait;margin:10mm}}
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button></div>
  <main class="sheet">
    <div class="top"><h1>ÉTAT DU POT COMMUN — ${esc(t.name)}</h1><div class="meta">Document de suivi · ${new Date().toLocaleDateString("fr-FR")}</div></div>
    <div class="summary"><div><small>Dépenses enregistrées</small><b>${euro(spent)}</b></div><div><small>Solde disponible du pot</small><b>${euro(remaining)}</b></div></div>
    <h2>PARTICIPANTS</h2><table><thead><tr><th>Participant</th><th class="num">Dépensé</th><th class="num">Solde</th></tr></thead><tbody>${peopleRows||'<tr><td colspan="3" class="empty">Aucun participant.</td></tr>'}</tbody></table>
    <h2>À REMETTRE DANS LE POT</h2><table><thead><tr><th>Participant</th><th class="num">Montant à remettre</th></tr></thead><tbody>${transferRows}</tbody></table>
    <h2>DÉPENSES</h2><table><thead><tr><th style="width:14%">Date</th><th>Dépense</th><th style="width:20%">Payé par</th><th class="num" style="width:15%">Montant</th></tr></thead><tbody>${expenseRows||'<tr><td colspan="4" class="empty">Aucune dépense.</td></tr>'}</tbody></table>
    <div class="footer">Voyage Nomade · état du pot commun · Les montants correspondent aux dépenses enregistrées dans le carnet.</div>
  </main></body></html>`);
  w.document.close();
}
document.getElementById("exportPotPdf")?.addEventListener("click",exportPotPdf);

function renderPot(){
  const total=contributions.reduce((s,x)=>s+Number(x.amount||0),0);
  const spent=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  document.getElementById("potSpent").textContent=euro(potBalance);
  document.getElementById("homePot").textContent=`${euro(potBalance)} disponibles`;
  renderParticipants(); refreshPeople();
  const box=document.getElementById("expenseList");
  // Une dépense enregistrée correspond à une vraie opération de la carte.
  // On ne la divise jamais à l'affichage : si Polo a payé 317 € et Jojo 317 €,
  // on affiche bien deux opérations de 317 €.
  box.innerHTML=expenses.length?expenses.slice().reverse().map((x,ri)=>{
    const i=expenses.length-1-ri;
    return `<div class="expenseRow">
      <div class="expenseMain">
        <b>${esc(x.desc||"Achat")}</b>
        <small>${esc(x.person||"")} · ${esc(x.date||"")} · ${x.shared===false?"non partagée":"partagée"} · payé avec la carte</small>
      </div>
      <strong>${euro(x.amount)}</strong>
      <div class="stepActions">
        <button class="stepEdit" onclick="editExpense(${i})" aria-label="Modifier la dépense">✎</button>
        <button class="stepDelete" onclick="deleteExpense(${i})" aria-label="Supprimer la dépense">×</button>
      </div>
    </div>`;
  }).join(""):'<p class="hint">Aucune dépense enregistrée.</p>';
  renderReimbursements();
}
document.getElementById("addContribution").onclick=()=>{
  const person=document.getElementById("contribPerson").value, amount=money(document.getElementById("contribAmount").value);
  if(!person||amount<=0)return alert("Choisis un participant et indique un montant.");
  contributions.push({person,amount,date:new Date().toLocaleDateString("fr-FR")});
  potBalance=Number((potBalance+amount).toFixed(2));
  saveTrip();document.getElementById("contribAmount").value="";renderPot();
};
let editingExpenseIndex=-1;

function resetExpenseForm(){
  document.getElementById("expensePerson").value="";
  document.getElementById("expenseAmount").value="";
  document.getElementById("expenseDesc").value="";
  document.getElementById("expenseDate").value="";
  document.getElementById("expenseShared").checked=true;
  document.getElementById("expenseModalTitle").textContent="Ajouter une dépense";
  document.getElementById("saveExpense").textContent="Enregistrer la dépense";
  editingExpenseIndex=-1;
}

document.getElementById("addCardExpense").onclick=()=>{
  resetExpenseForm();
  document.getElementById("expenseModal").classList.add("open");
};
document.getElementById("closeExpense").onclick=()=>{
  document.getElementById("expenseModal").classList.remove("open");
  editingExpenseIndex=-1;
};

window.editExpense=i=>{
  const x=expenses[i]; if(!x)return;
  editingExpenseIndex=i;
  refreshPeople();
  document.getElementById("expensePerson").value=x.person||"";
  document.getElementById("expenseAmount").value=String(x.amount??"");
  document.getElementById("expenseDesc").value=x.desc||"";
  document.getElementById("expenseDate").value=x.date||"";
  document.getElementById("expenseShared").checked=x.shared!==false;
  document.getElementById("expenseModalTitle").textContent="Modifier la dépense";
  document.getElementById("saveExpense").textContent="Enregistrer les modifications";
  document.getElementById("expenseModal").classList.add("open");
};

window.deleteExpense=i=>{
  const x=expenses[i]; if(!x)return;
  if(!confirm(`Supprimer la dépense « ${x.desc||"Achat"} » de ${euro(x.amount)} ?`))return;
  potBalance=Number((potBalance+Number(x.amount||0)).toFixed(2));
  expenses.splice(i,1);
  saveTrip(); renderPot();
};

document.getElementById("saveExpense").onclick=()=>{
  const person=document.getElementById("expensePerson").value;
  const amount=money(document.getElementById("expenseAmount").value);
  const desc=document.getElementById("expenseDesc").value.trim();
  const shared=document.getElementById("expenseShared").checked;
  const date=document.getElementById("expenseDate").value||new Date().toLocaleDateString("fr-FR");

  if(!person||amount<=0)return alert("Choisis la personne et indique le montant.");

  if(editingExpenseIndex>=0){
    const old=expenses[editingExpenseIndex];
    // Restore the old amount before applying the corrected one.
    potBalance=Number((potBalance+Number(old.amount||0)-amount).toFixed(2));
    expenses[editingExpenseIndex]={...old,person,amount,desc:desc||"Achat",date,shared};
  }else{
    if(amount>potBalance+0.005){
      if(!confirm(`Le pot ne contient que ${euro(potBalance)}. Enregistrer quand même cette dépense ?`)) return;
    }
    expenses.push({person,amount,desc:desc||"Achat",date,shared});
    potBalance=Number((potBalance-amount).toFixed(2));
  }

  saveTrip();
  resetExpenseForm();
  document.getElementById("expenseModal").classList.remove("open");
  renderPot();
};

function loadNames(){
  syncTrip();
  ["name1","name2","name3","name4"].forEach((id,i)=>document.getElementById(id).value=names[i]||"");
  document.getElementById("savedNames").textContent=names.length?names.join(" · "):"Aucun participant enregistré";
  refreshPeople();renderPot();
}
document.getElementById("saveNames").onclick=()=>{
  names=["name1","name2","name3","name4"].map(id=>document.getElementById(id).value.trim()).filter(Boolean);
  saveTrip();loadNames();
};

function renderSteps(){
  sortStepsChronologically();
  const box=document.getElementById("steps");
  document.getElementById("homeSteps").textContent=`${steps.length} étape${steps.length>1?"s":""}`;
  if(!steps.length){box.innerHTML='<p class="hint">Aucune étape pour le moment.</p>';return}
  box.innerHTML=steps.map((s,i)=>{
    const d=s.date?new Date(s.date+"T12:00:00"):null;
    const day=d?d.getDate():"—", mon=d?d.toLocaleDateString("fr-FR",{month:"short"}):"date";
    return `<div class="stepRow">
      <div class="datePill"><b>${day}</b><small>${mon}</small></div>
      <div class="stepLine"><i class="stepDot"></i></div>
      <div class="stepMain"><b>${esc(s.place)}</b><small>${esc(s.note||"Étape du voyage")}</small></div>
      <div class="stepActions">
        <button class="stepEdit" onclick="editStep(${i})" aria-label="Modifier l'étape">✎</button>
        <button class="stepDelete" onclick="deleteStep(${i})" aria-label="Supprimer l'étape">×</button>
      </div>
    </div>`;
  }).join("");
}
let editingStepIndex=-1;
window.editStep=i=>{
  const s=steps[i]; if(!s)return;
  editingStepIndex=i;
  document.getElementById("stepPlace").value=s.place||"";
  document.getElementById("stepDate").value=s.date||"";
  document.getElementById("stepNote").value=s.note||"";
  document.getElementById("stepModalTitle").textContent="Modifier l'étape";
  document.getElementById("saveStep").textContent="Enregistrer les modifications";
  document.getElementById("stepModal").classList.add("open");
};
window.deleteStep=i=>{
  const s=steps[i]; if(!s)return;
  if(!confirm(`Supprimer l'étape « ${s.place||"sans nom"} » ?`))return;
  steps.splice(i,1); saveTrip(); renderSteps(); renderHome(); renderMap();
};
document.getElementById("addStep").onclick=()=>{
  editingStepIndex=-1;
  document.getElementById("stepPlace").value="";
  document.getElementById("stepDate").value="";
  document.getElementById("stepNote").value="";
  document.getElementById("stepModalTitle").textContent="Ajouter une étape";
  document.getElementById("saveStep").textContent="Ajouter l'étape";
  document.getElementById("stepModal").classList.add("open");
};
document.getElementById("closeStep").onclick=()=>document.getElementById("stepModal").classList.remove("open");
document.getElementById("saveStep").onclick=()=>{
  const place=document.getElementById("stepPlace").value.trim();
  if(!place)return alert("Indique un lieu.");
  const item={place,date:document.getElementById("stepDate").value,note:document.getElementById("stepNote").value.trim()};
  if(editingStepIndex>=0) steps[editingStepIndex]=item;
  else steps.push(item);
  sortStepsChronologically();
  saveTrip();
  ["stepPlace","stepDate","stepNote"].forEach(id=>document.getElementById(id).value="");
  editingStepIndex=-1;
  document.getElementById("stepModal").classList.remove("open");
  renderSteps();renderHome();renderMap();
};

function renderGallery(){
  const grid=document.getElementById("galleryGrid"), strip=document.getElementById("memoryStrip");
  document.getElementById("homePhotos").textContent=`${photos.length} photo${photos.length>1?"s":""}`;
  if(!photos.length){grid.innerHTML='<p class="hint">Aucune photo partagée pour le moment.</p>';strip.innerHTML='<div class="emptyMini">Aucune photo partagée pour le moment.</div>';return}
  grid.innerHTML=photos.map((p,i)=>`<div class="galleryItem"><button class="galleryPhotoFrame" type="button" onclick="openSlide(${i})" aria-label="Afficher ${esc(p.name||"cette photo")}"><img src="${esc(p.src||"")}" alt="${esc(p.name||"Souvenir")}"></button><button class="photoDeleteButton" type="button" onclick="requestPhotoDeletion(${i})">🗑️ Supprimer</button></div>`).join("");
  strip.innerHTML=photos.slice(-4).reverse().map(p=>`<img src="${p.src}" alt="">`).join("");
}

function isHeicFile(file){
  return /\.(heic|heif)$/i.test(file.name||"") || /image\/(heic|heif)/i.test(file.type||"");
}

async function galleryCompatibleBlob(file){
  if(!isHeicFile(file))return file;
  if(typeof HeicTo!=="function"){
    throw new Error("Le convertisseur des photos iPhone n'est pas chargé. Vérifie que l'ordinateur est connecté à Internet puis réessaie.");
  }
  const converted=await HeicTo({
    blob:file,
    type:"image/jpeg",
    quality:.92
  });
  return converted instanceof Blob ? converted : new Blob([converted],{type:"image/jpeg"});
}

async function galleryPhotoDataUrl(file){
  const blob=await galleryCompatibleBlob(file);
  const bitmap=await createImageBitmap(blob,{imageOrientation:"from-image"});
  // Photos iPhone : on conserve l'orientation et le ratio d'origine.
  // Aucun recadrage : portrait, paysage et autres formats restent entiers.
  const maxDimension=2200;
  const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();

  let quality=.9;
  let dataUrl=canvas.toDataURL("image/jpeg",quality);
  while(dataUrl.length>1200000 && quality>.55){
    quality-=.08;
    dataUrl=canvas.toDataURL("image/jpeg",quality);
  }
  return dataUrl;
}

document.getElementById("photoInput").onchange=async e=>{
  const files=[...e.target.files];
  for(const f of files){
    try{
      const src=await galleryPhotoDataUrl(f);
      const photo=await uploadSharedPhoto({src,name:f.name,date:new Date().toLocaleDateString("fr-FR")});
      photos.push(photo);
      currentTrip().photos=photos;
    }catch(error){
      alert(error.message||`La photo « ${f.name} » n’a pas pu être ajoutée.`);
    }
  }
  e.target.value="";renderGallery();
};
let slideIndex=0;
window.openSlide=i=>{slideIndex=i;showSlide();document.getElementById("slideModal").classList.add("open")};
function showSlide(){const p=photos[slideIndex];if(!p)return;document.getElementById("slideImage").src=p.src;document.getElementById("slideCaption").textContent=p.name||""}
document.getElementById("closeSlide").onclick=()=>document.getElementById("slideModal").classList.remove("open");
document.getElementById("prevSlide").onclick=()=>{slideIndex=(slideIndex-1+photos.length)%photos.length;showSlide()};
document.getElementById("nextSlide").onclick=()=>{slideIndex=(slideIndex+1)%photos.length;showSlide()};
document.getElementById("slideshowBtn").onclick=()=>{if(!photos.length)return alert("Ajoute d’abord une photo.");openSlide(0);};

let photoDeletionIndex=null;
window.requestPhotoDeletion=i=>{
  if(!photos[i])return;
  photoDeletionIndex=i;
  document.getElementById("deletePhotoModal").classList.add("open");
};
function closePhotoDeletion(){
  photoDeletionIndex=null;
  document.getElementById("deletePhotoModal").classList.remove("open");
}
document.getElementById("cancelPhotoDeletion").onclick=closePhotoDeletion;
document.getElementById("confirmPhotoDeletion").onclick=async()=>{
  if(photoDeletionIndex===null || !photos[photoDeletionIndex])return closePhotoDeletion();
  const deletedPhoto=photos[photoDeletionIndex];
  try{
    await deleteSharedPhoto(deletedPhoto);
    photos.splice(photoDeletionIndex,1);
    currentTrip().photos=photos;
  }catch(e){
    alert("La photo n’a pas pu être supprimée. Réessaie.");
    return;
  }
  closePhotoDeletion();
  renderGallery();
};


function renderHome(){
  const t=currentTrip();
  const img=document.getElementById("homeHeroImage");
  const hero=document.querySelector("#home .heroCard");
  const hasCover=Boolean(t.cover);
  if(img){img.hidden=!hasCover;if(hasCover)img.src=t.cover;img.alt=hasCover?`Photo de ${t.name||"ce voyage"}`:"";}
  hero?.classList.toggle("noCover",!hasCover);
  const title=document.querySelector("#home .heroText h1");
  if(title)title.textContent=t.name||"Mon carnet de voyage";
  const preview=document.getElementById("routePreview");
  if(preview)preview.textContent=steps.length?steps.map(s=>s.place).join(" → "):"Ajoute tes étapes pour construire le parcours";
}
async function fileToDataURL(file){
  // Les photos d'iPhone peuvent être très lourdes. On les réduit avant de les
  // enregistrer dans le stockage local, sinon l'image peut ne plus s'afficher.
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=reject;
    reader.onload=()=>{
      const src=reader.result;
      const img=new Image();
      img.onload=()=>{
        const max=1400;
        const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.82));
      };
      img.onerror=()=>reject(new Error('Cette image ne peut pas être lue par le navigateur. Choisis une photo JPG/PNG.'));
      img.src=src;
    };
    reader.readAsDataURL(file);
  });
}


const editTripModal=document.getElementById("editTripModal");
const removeTripCoverButton=document.getElementById("removeTripCover");
let removeCoverRequested=false;
document.getElementById("editTripButton")?.addEventListener("click",()=>{
  const t=currentTrip();
  removeCoverRequested=false;
  document.getElementById("editTripName").value=t.name||"";
  document.getElementById("editTripStart").value=t.start||"";
  document.getElementById("editTripEnd").value=t.end||"";
  const f=document.getElementById("editTripCover");
  if(f)f.value="";
  if(removeTripCoverButton){
    removeTripCoverButton.disabled=!t.cover;
    removeTripCoverButton.textContent="🗑️ Supprimer la photo";
    removeTripCoverButton.classList.remove("pending");
  }
  editTripModal?.classList.add("open");
});
document.getElementById("closeEditTrip")?.addEventListener("click",()=>{
  editTripModal?.classList.remove("open");
});
editTripModal?.addEventListener("click",e=>{
  if(e.target===editTripModal)editTripModal.classList.remove("open");
});
document.getElementById("editTripCover")?.addEventListener("change",event=>{
  if(!event.target.files?.length)return;
  removeCoverRequested=false;
  if(removeTripCoverButton){
    removeTripCoverButton.disabled=false;
    removeTripCoverButton.textContent="🗑️ Supprimer la photo";
    removeTripCoverButton.classList.remove("pending");
  }
});
removeTripCoverButton?.addEventListener("click",()=>{
  removeCoverRequested=true;
  const fileInput=document.getElementById("editTripCover");
  if(fileInput)fileInput.value="";
  removeTripCoverButton.disabled=true;
  removeTripCoverButton.textContent="Photo supprimée à l’enregistrement";
  removeTripCoverButton.classList.add("pending");
});
document.getElementById("saveTripEdits")?.addEventListener("click",async()=>{
  const t=currentTrip();
  const name=document.getElementById("editTripName").value.trim();
  if(!name)return alert("Le voyage doit avoir un nom.");
  const coverFile=document.getElementById("editTripCover")?.files?.[0];
  let newCover=typeof t.cover==="string"?t.cover:"images/ile-rousse.jpg";
  if(removeCoverRequested)newCover="";
  else if(coverFile){
    try{
      newCover=await fileToDataURL(coverFile);
    }catch(err){
      return alert(err.message||"Impossible d'utiliser cette photo.");
    }
  }
  t.name=name;
  t.start=document.getElementById("editTripStart").value;
  t.end=document.getElementById("editTripEnd").value;
  t.cover=newCover;
  if(!await saveTrip())return;
  removeCoverRequested=false;
  editTripModal.classList.remove("open");
  renderTrips();
  renderHome();
});


document.getElementById("deleteTripButton")?.addEventListener("click",async()=>{
  const t=currentTrip();
  if(!t)return;

  const ok=confirm(
    `Supprimer définitivement le voyage « ${t.name||"sans nom"} » ?\n\n`+
    `Son itinéraire, son pot commun, ses dépenses, sa galerie, sa couverture et son carnet souvenir seront supprimés de cet ordinateur.`
  );
  if(!ok)return;

  const index=trips.findIndex(x=>x.id===currentTripId);
  if(index<0)return;
  const deletedTripId=currentTripId;
  const deleteButton=document.getElementById("deleteTripButton");
  deleteButton.disabled=true;

  try{
    const all=localTrips().filter(x=>x.id!==deletedTripId);
    saveLocalTrips(all);
    trips.splice(index,1);
    saveRevisions.delete(deletedTripId);
  }catch(error){
    alert(error.message||"Le voyage n’a pas pu être supprimé.");
    deleteButton.disabled=false;
    return;
  }

  if(!trips.length){
    const remainingKnownIds=getLocal(SHARED_TRIPS_KEY,[]).filter(id=>validSharedTripId(id)&&id!==deletedTripId);
    currentTripId="";
    names=[];contributions=[];expenses=[];steps=[];photos=[];potBalance=0;
    if(remainingKnownIds.length)putLocal(SHARED_TRIPS_KEY,remainingKnownIds);
    else localStorage.removeItem(SHARED_TRIPS_KEY);
    localStorage.removeItem(SHARED_CURRENT_KEY);
    const url=new URL(location.href);
    url.searchParams.delete("carnet");
    history.replaceState(null,"",url);
    routeMarkers.forEach(marker=>marker.remove());
    routeMarkers=[];
    editTripModal?.classList.remove("open");
    deleteButton.disabled=false;
    setWelcomeStatus("Le carnet a été supprimé. Vous pouvez en créer un nouveau.",true);
    showGeneralHome(remainingKnownIds);
    return;
  }

  selectCurrentTripId(trips[Math.max(0,index-1)].id);
  syncTrip();

  editTripModal?.classList.remove("open");
  renderTrips();
  renderPot();
  renderSteps();
  renderGallery();
  renderHome();
  renderMap();
  show("trips");
  deleteButton.disabled=false;
});

document.getElementById("coverInput")?.addEventListener("change",async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    currentTrip().cover=await fileToDataURL(file);
    if(await saveTrip()){renderHome();renderTrips()}
  }catch(err){alert(err.message||"Impossible d'utiliser cette photo.");}
  e.target.value="";
});
function renderTrips(){
 const box=document.getElementById("tripList");if(!box)return;
 box.innerHTML=trips.map(t=>`<article class="tripChoice ${t.id===currentTripId?"selected":""}" onclick="selectTrip('${t.id}')"><div class="tripThumb ${t.cover?"":"noCover"}">${t.cover?`<img src="${t.cover}" alt="">`:"⌁"}</div><div class="tripInfo"><small>VOYAGE</small><h2>${esc(t.name||"Mon carnet de voyage")}</h2><p>${t.start||"Départ à définir"} → ${t.end||"Retour à définir"}</p></div><span class="arrow">›</span></article>`).join("");
}
window.selectTrip=id=>{selectCurrentTripId(id);syncTrip();renderTrips();renderPot();renderSteps();renderGallery();renderHome();renderMap();show("home")};
document.getElementById("createTrip").onclick=async ()=>{
 const name=document.getElementById("newTripName").value.trim();if(!name)return alert("Donne un nom au voyage.");
 const id=newTripId();
 const previousTripId=currentTripId;
 const coverFile=document.getElementById("newTripCover")?.files?.[0];
 let cover="images/ile-rousse.jpg";
 if(coverFile){try{cover=await fileToDataURL(coverFile)}catch(e){alert(e.message);return}}
 trips.push({id,name,start:document.getElementById("newTripStart").value,end:document.getElementById("newTripEnd").value,cover,names:[],contributions:[],expenses:[],steps:[],photos:[]});
 selectCurrentTripId(id);syncTrip();
 if(!await saveTrip()){trips=trips.filter(t=>t.id!==id);selectCurrentTripId(previousTripId);syncTrip();return}
 document.getElementById("newTripName").value="";document.getElementById("newTripStart").value="";document.getElementById("newTripEnd").value="";if(document.getElementById("newTripCover"))document.getElementById("newTripCover").value="";renderTrips();renderPot();renderSteps();renderGallery();renderHome();renderMap();show("home");
};


let routeMapInstance=null;
let routeMarkers=[];
async function geocodePlace(place){
  try{
    const q=encodeURIComponent(place+", Corse, France");
    const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,{headers:{"Accept-Language":"fr"}});
    const a=await r.json(); if(!a.length)return null;
    return [Number(a[0].lat),Number(a[0].lon)];
  }catch(e){return null}
}
async function renderMap(){
  const el=document.getElementById("routeMap"); if(!el || typeof L==="undefined")return;
  if(!routeMapInstance){
    routeMapInstance=L.map(el,{scrollWheelZoom:false}).setView([42.15,9.05],9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(routeMapInstance);
  }
  routeMarkers.forEach(m=>m.remove()); routeMarkers=[];
  const coords=[];
  for(const [i,s] of steps.entries()){
    const c=await geocodePlace(s.place); if(!c)continue;
    const m=L.marker(c).addTo(routeMapInstance).bindPopup(`<b>${i+1}. ${esc(s.place)}</b>${s.date?`<br>${esc(s.date)}`:""}`);
    routeMarkers.push(m);coords.push(c);
  }
  if(coords.length===1)routeMapInstance.setView(coords[0],12);
  if(coords.length>1)routeMapInstance.fitBounds(coords,{padding:[25,25]});
}
document.getElementById("openRouteMaps")?.addEventListener("click",()=>{
  const places=steps.map(s=>s.place).filter(Boolean);
  if(!places.length)return alert("Ajoute d’abord des étapes.");
  const url="https://www.google.com/maps/dir/"+places.map(p=>encodeURIComponent(p+", Corse")).join("/");
  window.open(url,"_blank");
});

function renderSharedTrip(){
  setInterfaceMode("app");syncTrip();renderTrips();renderPot();renderSteps();renderGallery();renderHome();renderMap();
}

function showGeneralHome(knownIds=[]){
  const resumeButton=document.getElementById("resumeNotebook");
  const preferred=localStorage.getItem(SHARED_CURRENT_KEY);
  const resumeId=knownIds.includes(preferred)?preferred:knownIds[0];
  if(resumeButton){resumeButton.hidden=!resumeId;resumeButton.dataset.tripId=resumeId||"";}
  setInterfaceMode("welcome");
}

function sharedTripIdFromInput(value){
  const input=String(value||"").trim();
  if(validSharedTripId(input))return input;
  try{
    const id=new URL(input,location.origin).searchParams.get("carnet");
    return validSharedTripId(id)?id:"";
  }catch{return ""}
}

async function openExistingSharedTrip(id){
  const knownIds=getLocal(SHARED_TRIPS_KEY,[]).filter(validSharedTripId);
  const remote=await fetchSharedTrip(id);
  trips=[remote];
  selectCurrentTripId(id);
  putLocal(SHARED_TRIPS_KEY,[...new Set([...knownIds,id])]);
  renderSharedTrip();
  show("home");
}

const welcomeStatus=document.getElementById("welcomeStatus");
function setWelcomeStatus(message,success=false){
  if(!welcomeStatus)return;
  welcomeStatus.textContent=message;
  welcomeStatus.classList.toggle("success",success);
}

document.getElementById("createNotebook")?.addEventListener("click",async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  setWelcomeStatus("Création du carnet vierge…");
  try{
    const knownIds=getLocal(SHARED_TRIPS_KEY,[]).filter(validSharedTripId);
    const remote=await createBlankSharedTrip();
    trips=[remote];
    selectCurrentTripId(remote.id);
    putLocal(SHARED_TRIPS_KEY,[...new Set([...knownIds,remote.id])]);
    renderSharedTrip();
    show("home");
  }catch(error){
    setWelcomeStatus(error.message||"Le carnet n’a pas pu être créé.");
  }finally{button.disabled=false;}
});

document.getElementById("resumeNotebook")?.addEventListener("click",async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  setWelcomeStatus("Ouverture du carnet…");
  try{await openExistingSharedTrip(button.dataset.tripId)}
  catch(error){setWelcomeStatus(error.message||"Ce carnet n’a pas pu être ouvert.")}
  finally{button.disabled=false;}
});

document.getElementById("existingNotebookToggle")?.addEventListener("click",event=>{
  const form=document.getElementById("existingNotebookForm");
  const expanded=event.currentTarget.getAttribute("aria-expanded")==="true";
  event.currentTarget.setAttribute("aria-expanded",String(!expanded));
  form.hidden=expanded;
  if(!expanded)document.getElementById("existingNotebookLink")?.focus();
});

document.getElementById("existingNotebookForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector("button");
  const id=sharedTripIdFromInput(document.getElementById("existingNotebookLink")?.value);
  if(!id)return setWelcomeStatus("Collez un lien Voyage Nomade contenant ?carnet=…");
  button.disabled=true;
  setWelcomeStatus("Ouverture du carnet…");
  try{await openExistingSharedTrip(id)}
  catch(error){setWelcomeStatus(error.status===404?"Ce carnet est introuvable. Vérifiez le lien.":error.message||"Ce carnet n’a pas pu être ouvert.")}
  finally{button.disabled=false;}
});

function legacyTrips(){
  const raw=localStorage.getItem("voyageNomadeTrips");
  if(!raw)return [];
  try{return JSON.parse(raw).filter(Boolean)}catch{return []}
}

async function createSharedTripFromLegacy(id,legacy){
  const source={
    ...clone(DEFAULT_TRIP),
    ...clone(legacy),
    id,
    photos:Array.isArray(legacy?.photos)?clone(legacy.photos):[]
  };
  source.updatedAt=new Date().toISOString();
  const all=localTrips();
  const index=all.findIndex(t=>t.id===id);
  if(index>=0)all[index]=source;else all.push(source);
  saveLocalTrips(all);
  return clone(source);
}

async function loadOrCreateSharedTrip(id,fallback=DEFAULT_TRIP){
  try{return await fetchSharedTrip(id)}
  catch(error){
    if(error.status!==404)throw error;
    return createSharedTripFromLegacy(id,fallback);
  }
}

async function bootstrapSharedTrips(){
  const urlId=new URL(location.href).searchParams.get("carnet");
  let knownIds=getLocal(SHARED_TRIPS_KEY,[]).filter(validSharedTripId);
  const legacy=legacyTrips();
  let stored=localTrips();

  // Reprendre l’ancien prototype local s’il existe encore.
  if(!stored.length && legacy.length){
    stored=legacy.map(old=>({
      ...clone(DEFAULT_TRIP),
      ...clone(old),
      id:validSharedTripId(old.id)?old.id:newTripId(),
      photos:Array.isArray(old.photos)?clone(old.photos):[],
      updatedAt:new Date().toISOString()
    }));
    saveLocalTrips(stored);
    localStorage.removeItem("voyageNomadeTrips");
    localStorage.removeItem("voyageNomadeCurrentTrip");
    knownIds=stored.map(t=>t.id);
  }

  if(!knownIds.length) knownIds=stored.map(t=>t.id);

  let chosen=urlId&&validSharedTripId(urlId)?urlId:localStorage.getItem(SHARED_CURRENT_KEY);
  if(!chosen || !knownIds.includes(chosen)) chosen=knownIds[0]||"";

  if(!chosen){
    const created=await createBlankSharedTrip();
    stored=[created];
    chosen=created.id;
    knownIds=[chosen];
  }

  trips=localTrips();
  currentTripId=chosen;
  if(!trips.some(t=>t.id===currentTripId)){
    const created=await createBlankSharedTrip();
    trips=localTrips();
    currentTripId=created.id;
  }
  selectCurrentTripId(currentTripId);
  renderSharedTrip();
}

async function refreshSharedTrip(){
  // Version locale : aucune synchronisation réseau nécessaire.
  return;
}

bootstrapSharedTrips().catch(error=>{
  trips=[{id:newTripId(),...clone(DEFAULT_TRIP)}];
  currentTripId=trips[0].id;
  saveLocalTrips(trips);
  renderSharedTrip();
  alert(error.message||"Le carnet local n’a pas pu être chargé.");
});

function exportSouvenirPdf(){
  const t=currentTrip();
  const w=window.open("","_blank");
  if(!w)return alert("Autorise les fenêtres surgissantes pour créer le carnet.");
  const hero=t.cover||"";
  const displayName=t.name||"Mon carnet de voyage";
  const stepsHtml=steps.length?steps.map((s,i)=>{
    const d=s.date?new Date(s.date+"T12:00:00"):null;
    const date=d?d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):"Date à définir";
    const p=photos[i%Math.max(photos.length,1)];
    return `<section class="page stepPage"><div class="kicker">ÉTAPE ${i+1}</div><h2>${esc(s.place)}</h2><div class="date">${esc(date)}</div>${p?`<img src="${p.src}" alt="">`:""}<p>${esc(s.note||"Un souvenir de notre voyage.")}</p></section>`;
  }).join(""):`<section class="page"><h2>Notre itinéraire</h2><p>Aucune étape enregistrée pour le moment.</p></section>`;
  const galleryHtml=photos.length?`<section class="page"><div class="kicker">SOUVENIRS</div><h2>Nos photos</h2><div class="photoGrid">${photos.map(p=>`<img src="${p.src}" alt="">`).join("")}</div></section>`:"";
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(displayName)} — Carnet souvenir</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eee;color:#1b2940;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .toolbar{position:fixed;right:18px;top:18px;z-index:10}.toolbar button{background:#20304d;color:white;border:0;border-radius:10px;padding:10px 15px;font-weight:700}
  .book{max-width:800px;margin:auto}.page{background:white;min-height:1120px;padding:70px 70px;page-break-after:always;display:flex;flex-direction:column;justify-content:center}
  .cover{padding:0;position:relative;overflow:hidden;color:white;justify-content:flex-end;background:linear-gradient(145deg,#214c3b,#9f8150)}.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cover:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 35%,rgba(5,20,35,.78))}
  .coverText{position:relative;z-index:2;padding:65px}.cover h1{font-size:58px;margin:0 0 10px}.cover h3{font-size:24px;font-weight:500;margin:0}.kicker{letter-spacing:3px;font-size:11px;font-weight:800;color:#77828d}.page h2{font-size:42px;margin:10px 0}.date{color:#6f7d89;margin-bottom:24px}.stepPage>img{width:100%;max-height:620px;object-fit:cover;border-radius:18px;margin:12px 0 22px}.stepPage p{font-size:20px;line-height:1.6}.photoGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px}.photoGrid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}@media print{.toolbar{display:none}body{background:white}.page{min-height:0;height:297mm;padding:18mm}.cover{padding:0}.book{max-width:none}}@media screen{.book{padding:25px 0}.page{margin:20px 0;box-shadow:0 8px 35px #0002}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div><div class="book">
  <section class="page cover">${hero?`<img src="${hero}" alt="Photo de couverture" onerror="this.remove()">`:""}<div class="coverText"><div class="kicker" style="color:white">VOYAGE NOMADE</div><h1>${esc(displayName)}</h1><h3>${t.start&&t.end?esc(t.start)+" → "+esc(t.end):"Notre carnet de voyage"}</h3></div></section>
  <section class="page"><div class="kicker">NOTRE VOYAGE</div><h2>${esc(displayName)}</h2><p>Un carnet construit au fil de nos étapes, de nos photos et de nos souvenirs.</p><h3>${steps.length} étape${steps.length>1?"s":""} · ${photos.length} photo${photos.length>1?"s":""}</h3><h3>Notre itinéraire</h3><p>${steps.map(s=>`📍 ${esc(s.place)}`).join(" → ")||"À compléter"}</p></section>
  ${stepsHtml}${galleryHtml}
  <section class="page"><div class="kicker">FIN DU VOYAGE</div><h2>À bientôt pour le prochain départ…</h2><p>Voyage Nomade · carnet souvenir</p></section>
  </div></body></html>`);
  w.document.close();
}
document.getElementById("souvenirBtn")?.addEventListener("click",exportSouvenirPdf);

// V40: le total cumulé des versements n'est pas un indicateur principal.
// Le pot affiche prioritairement les dépenses réelles avec la carte.

// V41 : le montant total des versements n'est plus affiché comme indicateur.

// V43 : le pot est une caisse courante. Les dépenses restent dans l'historique,
// tandis que potBalance représente uniquement l'argent actuellement disponible.

// V45 : une dépense de carte représente toujours une opération bancaire réelle.
// Exemple : Polo 317 € + Jojo 317 € = 634 € au total. Aucun partage automatique.
