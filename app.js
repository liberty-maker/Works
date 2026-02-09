// ====== PASTE HERE (Supabase Settings → API) ======
const SUPABASE_URL = "https://lhewgyfmmeedzqxhjmhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_qogHp4h5jucsviDIjSE_Ow_EfycJdGq";
const BUCKET = "Works";
// ==================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const board = document.getElementById("board");
const loader = document.getElementById("loader");

// meta
const metaName = document.getElementById("metaName");
const metaTagline = document.getElementById("metaTagline");
const metaTitle = document.getElementById("metaTitle");
const metaSubtitle = document.getElementById("metaSubtitle");
const metaLinks = document.getElementById("metaLinks");
const editMetaBtn = document.getElementById("editMetaBtn");
const metaModal = document.getElementById("metaModal");
const metaClose = document.getElementById("metaClose");
const metaSave = document.getElementById("metaSave");
const metaStatus = document.getElementById("metaStatus");

const mName = document.getElementById("mName");
const mTagline = document.getElementById("mTagline");
const mTitle = document.getElementById("mTitle");
const mSubtitle = document.getElementById("mSubtitle");
const mLinks = document.getElementById("mLinks");

// lightbox
const lightbox = document.getElementById("lightbox");
const lbInner = document.getElementById("lbInner");
const lbClose = document.getElementById("lbClose");
const lbTitle = document.getElementById("lbTitle");
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
const viewCount = document.getElementById("viewCount");

const CLIENT_KEY = "anna.client_id.v1";
const ADMIN_FLAG = "anna.admin_mode.v1";

function getClientId(){
  let id = localStorage.getItem(CLIENT_KEY);
  if(!id){
    id = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(16).slice(2) + Date.now().toString(16));
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}
const clientId = getClientId();

// ===== Meta from DB (site_meta)
async function loadMeta(){
  const { data } = await sb.from("site_meta").select("value").eq("key","main").maybeSingle();
  const v = data?.value || {};

  metaName.textContent = v.name || "ANNA";
  metaTagline.textContent = v.tagline || "AI Visual Portfolio";
  metaTitle.textContent = v.title || "Portfolio";
  metaSubtitle.textContent = v.subtitle || "Infinite board of AI works";

  renderLinks(v.links || []);
  // preload modal
  mName.value = v.name || "";
  mTagline.value = v.tagline || "";
  mTitle.value = v.title || "";
  mSubtitle.value = v.subtitle || "";
  mLinks.value = (v.links || []).map(x => `${x.label}|${x.url}`).join("\n");
}
function renderLinks(list){
  metaLinks.innerHTML = "";
  (list || []).slice(0,6).forEach(l=>{
    const a = document.createElement("a");
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = l.label;
    metaLinks.appendChild(a);
  });
}

// ===== Admin mode for editing meta (simple, not public button)
function isAdminMode(){
  return localStorage.getItem(ADMIN_FLAG) === "1";
}
function setAdminMode(v){
  localStorage.setItem(ADMIN_FLAG, v ? "1" : "0");
  editMetaBtn.style.display = v ? "inline-block" : "none";
}
setAdminMode(isAdminMode());

// hidden shortcut: type "anna" and press Enter to toggle edit button
let secret = "";
window.addEventListener("keydown", (e)=>{
  if(e.key.length === 1) secret += e.key.toLowerCase();
  if(e.key === "Enter"){
    if(secret.includes("anna")){
      setAdminMode(!isAdminMode());
      secret = "";
    }
  }
  if(secret.length > 20) secret = secret.slice(-20);
});

editMetaBtn.addEventListener("click", ()=>{
  metaModal.classList.add("isOpen");
  metaModal.setAttribute("aria-hidden","false");
});
metaClose.addEventListener("click", closeMeta);
metaModal.addEventListener("click", (e)=>{ if(e.target === metaModal) closeMeta(); });
function closeMeta(){
  metaModal.classList.remove("isOpen");
  metaModal.setAttribute("aria-hidden","true");
}

metaSave.addEventListener("click", async ()=>{
  metaStatus.textContent = "Saving…";
  try{
    const links = mLinks.value
      .split("\n")
      .map(s=>s.trim())
      .filter(Boolean)
      .map(line=>{
        const [label, url] = line.split("|").map(x=>x.trim());
        return { label: label || "Link", url: url || "#" };
      });

    const payload = {
      name: mName.value.trim() || "ANNA",
      tagline: mTagline.value.trim() || "AI Visual Portfolio",
      title: mTitle.value.trim() || "Portfolio",
      subtitle: mSubtitle.value.trim() || "Infinite board of AI works",
      links
    };

    // save via function (no direct write policy needed)
    const { error } = await sb.rpc("set_site_meta", { p_key:"main", p_value: payload });
    if(error) throw error;

    metaStatus.textContent = "Saved ✓";
    await loadMeta();
    setTimeout(()=> metaStatus.textContent="", 1200);
  }catch(e){
    console.error(e);
    metaStatus.textContent = "Error";
    alert(e.message || e);
  }
});

// ===== Load works from Storage (pagination)
let page = 0;
let loading = false;
let done = false;
const PAGE_SIZE = 24;

const works = []; // {path,url,type,title,caption,position,views,likes,likedByMe}

async function listStoragePage(){
  const { data, error } = await sb.storage.from(BUCKET).list("", {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy: { column: "created_at", order: "desc" }
  });
  if(error) throw error;

  // filter folders + hidden
  const files = (data || []).filter(x => x.name && !x.name.endsWith("/"));
  return files.map(f => f.name);
}

function guessTypeByName(name){
  const n = name.toLowerCase();
  if(n.endsWith(".mp4") || n.endsWith(".mov") || n.endsWith(".webm")) return "video";
  return "image";
}

function publicUrl(path){
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function fetchCounts(paths){
  if(paths.length === 0) return;

  // views
  const { data: vrows } = await sb.from("work_stats").select("media_path,views").in("media_path", paths);
  const viewsMap = new Map((vrows||[]).map(r=>[r.media_path, r.views]));

  // likes counts
  const { data: lrows } = await sb.from("likes").select("media_path,client_id").in("media_path", paths);
  const likeCountMap = new Map();
  const likedMap = new Map();

  (lrows||[]).forEach(r=>{
    likeCountMap.set(r.media_path, (likeCountMap.get(r.media_path)||0) + 1);
    if(r.client_id === clientId) likedMap.set(r.media_path, true);
  });

  // ordering
  const { data: orows } = await sb.from("work_order").select("media_path,position").in("media_path", paths);
  const posMap = new Map((orows||[]).map(r=>[r.media_path, r.position]));

  // apply
  works.forEach(w=>{
    if(paths.includes(w.path)){
      w.views = viewsMap.get(w.path) || 0;
      w.likes = likeCountMap.get(w.path) || 0;
      w.likedByMe = likedMap.get(w.path) || false;
      w.position = posMap.get(w.path) ?? 100000;
    }
  });
}

function render(){
  // stable order: DB position first, then fallback by created order in list (already desc)
  const sorted = works.slice().sort((a,b)=> (a.position??100000) - (b.position??100000));

  board.innerHTML = "";
  sorted.forEach(w=>{
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.path = w.path;

    const media = w.type === "video"
      ? `<video src="${w.url}" muted playsinline loop preload="metadata"></video>`
      : `<img src="${w.url}" loading="lazy" alt="">`;

    card.innerHTML = `
      <div class="card__media">${media}</div>
      <div class="card__footer">
        <div class="card__title">${escapeHTML(w.title || niceTitle(w.path))}</div>
        <div class="card__meta">
          <span class="badge">❤️ ${w.likes||0}</span>
          <span class="badge">👁 ${w.views||0}</span>
        </div>
      </div>
    `;

    // hover play
    const vid = card.querySelector("video");
    if(vid){
      card.addEventListener("mouseenter", ()=> vid.play().catch(()=>{}));
      card.addEventListener("mouseleave", ()=> { vid.pause(); vid.currentTime = 0; });
    }

    card.addEventListener("click", ()=> openLightbox(w));
    board.appendChild(card);
  });
}

function niceTitle(path){
  const base = path.replace(/\.[^.]+$/,"").replaceAll("_"," ");
  return base.length > 38 ? base.slice(0,38) + "…" : base;
}
function escapeHTML(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

// ===== Infinite load
async function loadMore(){
  if(loading || done) return;
  loading = true;
  loader.style.display = "inline-block";
  try{
    const names = await listStoragePage();
    if(names.length === 0){ done = true; loader.textContent = "End"; return; }

    const batch = names.map(path=>{
      const type = guessTypeByName(path);
      return {
        path,
        url: publicUrl(path),
        type,
        title: "",
        caption: "",
        position: 100000,
        likes: 0,
        views: 0,
        likedByMe: false
      };
    });

    works.push(...batch);

    await fetchCounts(names);
    render();

    page++;
    loader.textContent = "Loading…";
  }catch(e){
    console.error(e);
    loader.textContent = "Load error";
  }finally{
    loading = false;
    if(!done) loader.style.display = "none";
  }
}

const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting) loadMore();
  });
},{ root:null, threshold: 0.1 });

io.observe(loader);

// ===== Lightbox behavior (no browser back)
let current = null;

function openLightbox(w){
  current = w;
  lightbox.classList.add("isOpen");
  lightbox.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";

  lbInner.innerHTML = "";
  if(w.type === "video"){
    const v = document.createElement("video");
    v.src = w.url;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.style.maxHeight = "100%";
    lbInner.appendChild(v);
  }else{
    const img = document.createElement("img");
    img.src = w.url;
    lbInner.appendChild(img);
  }

  lbTitle.textContent = w.title || niceTitle(w.path);
  likeCount.textContent = String(w.likes||0);
  viewCount.textContent = String(w.views||0);
  likeBtn.classList.toggle("liked", !!w.likedByMe);

  // increment view in DB
  sb.rpc("increment_view", { p_media_path: w.path }).then(async ()=>{
    // refresh view count for this item
    const { data } = await sb.from("work_stats").select("views").eq("media_path", w.path).maybeSingle();
    w.views = data?.views || (w.views||0)+1;
    viewCount.textContent = String(w.views||0);
    render(); // refresh badges
  }).catch(console.error);
}

function closeLightbox(){
  lightbox.classList.remove("isOpen");
  lightbox.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
  lbInner.innerHTML = "";
  current = null;
}

lbClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e)=>{ if(e.target === lightbox) closeLightbox(); });
window.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && current) closeLightbox(); });

// Like toggle (no login)
likeBtn.addEventListener("click", async ()=>{
  if(!current) return;
  try{
    if(current.likedByMe){
      const { error } = await sb.from("likes").delete().eq("media_path", current.path).eq("client_id", clientId);
      if(error) throw error;
      current.likedByMe = false;
      current.likes = Math.max(0, (current.likes||0) - 1);
    }else{
      const { error } = await sb.from("likes").insert({ media_path: current.path, client_id: clientId });
      if(error) throw error
