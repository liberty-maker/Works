console.log("admin.js loaded");
document.getElementById("jsLoaded").textContent = "JS: admin.js loaded ✅";

const fileEl = document.getElementById("file");
const typeEl = document.getElementById("type");
const titleEl = document.getElementById("title");
const captionEl = document.getElementById("caption");
const uploadBtn = document.getElementById("upload");
const uploadStatus = document.getElementById("uploadStatus");

const adminBoard = document.getElementById("adminBoard");
const saveOrderBtn = document.getElementById("saveOrder");
const orderStatus = document.getElementById("orderStatus");

// meta
const mName = document.getElementById("mName");
const mTagline = document.getElementById("mTagline");
const mTitle = document.getElementById("mTitle");
const mSubtitle = document.getElementById("mSubtitle");
const mLinks = document.getElementById("mLinks");
const saveMetaBtn = document.getElementById("saveMeta");
const metaStatus = document.getElementById("metaStatus");

// viewer
const viewer = document.getElementById("viewer");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

let items = []; // {id, title, caption, media_path, media_type, position}

init().catch(console.error);

async function init(){
  bindViewer();

  uploadBtn.addEventListener("click", onUpload);
  saveOrderBtn.addEventListener("click", saveOrder);

  saveMetaBtn.addEventListener("click", saveMeta);

  await loadMeta();
  await loadBoard();
  enableDnD();
}

function bindViewer(){
  viewerClose.addEventListener("click", closeViewer);
  viewer.addEventListener("click", (e)=>{ if(e.target===viewer) closeViewer(); });
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeViewer(); });
}

function openViewer(type, url){
  viewerBody.innerHTML = "";
  if(type === "video"){
    const v = document.createElement("video");
    v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true;
    viewerBody.appendChild(v);
  }else{
    const img = document.createElement("img");
    img.src = url;
    viewerBody.appendChild(img);
  }
  viewer.setAttribute("aria-hidden","false");
}
function closeViewer(){
  viewer.setAttribute("aria-hidden","true");
  viewerBody.innerHTML = "";
}

async function api(body){
  const res = await fetch("/api/admin", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(json?.error || "API error");
  return json;
}

// ===== META =====
async function loadMeta(){
  try{
    const json = await api({ action:"get_meta" });
    mName.value = json.meta?.name || "ANNA";
    mTagline.value = json.meta?.tagline || "AI Visual Portfolio";
    mTitle.value = json.meta?.title || "Portfolio";
    mSubtitle.value = json.meta?.subtitle || "Infinite board of AI works";

    const links = json.meta?.links?.items || [];
    mLinks.value = links.map(x => `${x.label} | ${x.url}`).join("\n");
  }catch(e){
    metaStatus.textContent = e.message;
  }
}

async function saveMeta(){
  metaStatus.textContent = "Saving…";
  const links = (mLinks.value || "")
    .split("\n")
    .map(s=>s.trim())
    .filter(Boolean)
    .map(line=>{
      const [label, url] = line.split("|").map(x=>x.trim());
      return { label: label || "Link", url: url || "" };
    })
    .filter(x=>x.url);

  try{
    await api({
      action:"set_meta",
      meta:{
        name: mName.value.trim(),
        tagline: mTagline.value.trim(),
        title: mTitle.value.trim(),
        subtitle: mSubtitle.value.trim(),
        links:{ items: links }
      }
    });
    metaStatus.textContent = "Saved ✓";
  }catch(e){
    metaStatus.textContent = e.message;
  }
}

// ===== BOARD =====
async function loadBoard(){
  adminBoard.innerHTML = "";
  orderStatus.textContent = "";
  uploadStatus.textContent = "";

  const json = await api({ action:"list_works" });
  items = json.items || [];

  for(const it of items){
    adminBoard.appendChild(renderAdminCard(it));
  }
}

function renderAdminCard(it){
  const card = document.createElement("article");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = it.id;

  const url = it.public_url;

  const media = (it.media_type === "video") ? makeVideo(url) : makeImg(url);
  card.appendChild(media);

  const meta = document.createElement("div");
  meta.className = "meta";

  const top = document.createElement("div");
  top.className = "meta__top";

  const t = document.createElement("div");
  t.className = "meta__title";
  t.textContent = it.title || "Untitled";

  const actions = document.createElement("div");
  actions.className = "stats";

  const del = document.createElement("button");
  del.className = "iconBtn";
  del.type = "button";
  del.textContent = "Delete";
  del.addEventListener("click", async (e)=>{
    e.stopPropagation();
    if(!confirm("Delete this item?")) return;
    await api({ action:"delete_work", id: it.id });
    await loadBoard();
    enableDnD();
  });

  actions.appendChild(del);
  top.appendChild(t);
  top.appendChild(actions);

  meta.appendChild(top);

  if(it.caption){
    const c = document.createElement("div");
    c.className = "meta__caption";
    c.textContent = it.caption;
    meta.appendChild(c);
  }

  card.appendChild(meta);

  card.addEventListener("click", ()=>{
    openViewer(it.media_type, url);
  });

  return card;
}

function makeImg(url){
  const img = document.createElement("img");
  img.className = "media";
  img.loading = "lazy";
  img.src = url;
  return img;
}
function makeVideo(url){
  const v = document.createElement("video");
  v.className = "media";
  v.src = url;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  return v;
}

async function onUpload(){
  uploadStatus.textContent = "";

  const f = fileEl.files?.[0];
  if(!f){ uploadStatus.textContent = "Choose a file"; return; }

  uploadBtn.disabled = true;
  uploadStatus.textContent = "Uploading…";

  try{
    // send as base64 (fast to implement, ok for portfolio sizes)
    const b64 = await fileToBase64(f);

    const json = await api({
      action:"upload_work",
      file:{
        name: f.name,
        type: f.type,
        data_base64: b64,
      },
      meta:{
        media_type: typeEl.value,
        title: titleEl.value.trim(),
        caption: captionEl.value.trim(),
      }
    });

    uploadStatus.textContent = "Added ✓";
    fileEl.value = "";
    titleEl.value = "";
    captionEl.value = "";

    await loadBoard();
    enableDnD();
  }catch(e){
    uploadStatus.textContent = e.message;
  }finally{
    uploadBtn.disabled = false;
  }
}

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> {
      // result like "data:image/png;base64,...."
      const s = String(r.result);
      resolve(s.split(",")[1] || "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// DnD reorder
function enableDnD(){
  const cards = Array.from(adminBoard.querySelectorAll(".card"));

  let dragEl = null;

  cards.forEach(card=>{
    card.addEventListener("dragstart", ()=>{
      dragEl = card;
      card.style.opacity = "0.6";
    });
    card.addEventListener("dragend", ()=>{
      card.style.opacity = "1";
      dragEl = null;
    });

    card.addEventListener("dragover", (e)=>{
      e.preventDefault();
      if(!dragEl || dragEl === card) return;
      const rect = card.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      adminBoard.insertBefore(dragEl, before ? card : card.nextSibling);
    });
  });
}

async function saveOrder(){
  orderStatus.textContent = "Saving…";
  const ids = Array.from(adminBoard.querySelectorAll(".card")).map(x=>x.dataset.id);

  try{
    await api({ action:"set_order", ids });
    orderStatus.textContent = "Saved ✓";
  }catch(e){
    orderStatus.textContent = e.message;
  }
}
