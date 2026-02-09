// ====== CONFIG (public) ======
const SUPABASE_URL = "https://lhewgyfmmeedzqxhjmhd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZXdneWZtbWVlZHpxeGhqbWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODQzNTUsImV4cCI6MjA4NjE2MDM1NX0.ZPfqhuunp7WaVM0OsuNWSYini_8f85RYbsVqDeQcMNo";
const BUCKET = "Works";
// =============================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const masonry = document.getElementById("masonry");
const loader = document.getElementById("loader");
const loadMoreBtn = document.getElementById("loadMore");

const nameEl = document.getElementById("name");
const taglineEl = document.getElementById("tagline");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const linksEl = document.getElementById("links");

const viewer = document.getElementById("viewer");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

const clientIdKey = "anna_client_id_v1";
const clientId = localStorage.getItem(clientIdKey) || crypto.randomUUID();
localStorage.setItem(clientIdKey, clientId);

let pageSize = 18;
let page = 0;
let loading = false;
let reachedEnd = false;

init().catch(console.error);

async function init(){
  await loadMeta();
  await loadNext();
  setupInfinite();
  setupViewer();
}

async function loadMeta(){
  const r = await fetch("/api/meta");
  const meta = await r.json();

  nameEl.textContent = meta.name || "ANNA";
  taglineEl.textContent = meta.tagline || "AI Visual Portfolio";
  titleEl.textContent = meta.title || "Portfolio";
  subtitleEl.textContent = meta.subtitle || "Infinite board of AI works";

  linksEl.innerHTML = "";
  const raw = (meta.links || "").trim();
  if(!raw) return;

  raw.split("\n").map(s=>s.trim()).filter(Boolean).forEach(line=>{
    const [label, url] = line.split("|").map(x=>x.trim());
    if(!url) return;
    const a = document.createElement("a");
    a.className = "pill";
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = label || url;
    linksEl.appendChild(a);
  });
}

async function loadNext(){
  if(loading || reachedEnd) return;
  loading = true;
  loader.style.display = "block";

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // order: берем work_order если есть, иначе created_at
  const { data: orderRows } = await sb
    .from("work_order")
    .select("media_path, position")
    .order("position", { ascending: true });
