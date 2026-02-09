const SUPABASE_URL = "https://lhewgyfmmeedzqxhjmhd.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZXdneWZtbWVlZHpxeGhqbWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODQzNTUsImV4cCI6MjA4NjE2MDM1NX0.ZPfqhuunp7WaVM0OsuNWSYini_8f85RYbsVqDeQcMNo";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const board = document.getElementById("board");
const loadMoreBtn = document.getElementById("loadMore");

const metaName = document.getElementById("metaName");
const metaTagline = document.getElementById("metaTagline");
const metaTitle = document.getElementById("metaTitle");
const metaSubtitle = document.getElementById("metaSubtitle");
const metaLinks = document.getElementById("metaLinks");

const viewer = document.getElementById("viewer");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

const clientIdKey = "anna_client_id_v1";
const clientId = localStorage.getItem(clientIdKey) || crypto.randomUUID();
localStorage.setItem(clientIdKey, clientId);

// pagination
let pageSize = 18;
let page = 0;
let loading = false;
let reachedEnd = false;

init().catch(console.error);

async function init(){
  bindViewer();
  await loadMeta();
  await loadNextPage();

  loadMoreBtn.addEventListener("click", loadNextPage);

  // infinite scroll
  const io = new IntersectionObserver((entries)=>{
    if(entries.some(e=>e.isIntersecting)){
      loadNextPage();
    }
  }, {rootMargin:"600px"});
  io.observe(loadMoreBtn);
}

async function loadMeta(){
  const { data, error } = await sb.from("site_meta").select("key,value").in("key", ["name","tagline","title","subtitle","links"]);
  if(error){ console.warn(error); return; }

  const m = Object.fromEntries((data||[]).map(r=>[r.key, r.value]));
  if(m.name) metaName.textContent = m.name;
  if(m.tagline) metaTagline.textContent = m.tagline;
  if(m.title) metaTitle.textContent = m.title;
  if(m.subtitle) metaSubtitle.textContent = m.subtitle;

  metaLinks.innerHTML = "";
  const links = (m.links && Array.isArray(m.links.items)) ? m.links.items : [];
  for(const item of links){
    const a = document.createElement("a");
    a.className = "pill";
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = item.label;
    metaLinks.appendChild(a);
  }
}

async function loadNextPage(){
  if(loading || reachedEnd) return;
  loading = true;
  loadMoreBtn.textContent = "Loading…";

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // works are stored in table `works`
  const { data, error } = await sb
    .from("works")
    .select("id, title, caption, media_path, media_type, created_at")
    .order("position", { ascending: true })
    .range(from, to);

  if(error){
    console.warn(error);
    loadMoreBtn.textContent = "Load more";
    loading = false;
    return;
  }

  if(!data || data.length === 0){
    reachedEnd = true;
    loadMoreBtn.textContent = "End";
    loadMoreBtn.disabled = true;
    return;
  }

  for(const item of data){
    board.appendChild(renderCard(item));
    // view count: once per session per item
    bumpView(item.media_path).catch(()=>{});
  }

  page++;
  loadMoreBtn.textContent = "Load more";
  loading = false;
}

function publicUrl(path){
  // Works bucket must be PUBLIC, or use signed urls (we keep simple)
  return `${SUPABASE_URL}/storage/v1/object/public/Works/${encodeURIComponent(path)}`;
}

function renderCard(item){
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.path = item.media_path;

  const url = publicUrl(item.media_path);

  const media = (item.media_type === "video")
    ? makeVideo(url)
    : makeImg(url);

  const meta = document.createElement("div");
  meta.className = "meta";

  const top = document.createElement("div");
  top.className = "meta__top";

  const title = document.createElement("div");
  title.className = "meta__title";
  title.textContent = item.title || "Untitled";

  const stats = document.createElement("div");
  stats.className = "stats";

  const viewsEl = document.createElement("span");
  viewsEl.textContent = "👁 0";

  const likeBtn = document.createElement("button");
  likeBtn.className = "iconBtn";
  likeBtn.type = "button";
  likeBtn.innerHTML = `❤️ <span>0</span>`;
  likeBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    toggleLike(item.media_path, likeBtn).catch(console.warn);
  });

  stats.appendChild(viewsEl);
  stats.appendChild(likeBtn);

  top.appendChild(title);
  top.appendChild(stats);

  const caption = document.createElement("div");
  caption.className = "meta__caption";
  caption.textContent = item.caption || "";

  meta.appendChild(top);
  if(item.caption) meta.appendChild(caption);

  card.appendChild(media);
  card.appendChild(meta);

  card.addEventListener("click", ()=>{
    openViewer(item.media_type, url);
  });

  // hydrate counters
  hydrateStats(item.media_path, viewsEl, likeBtn).catch(()=>{});

  return card;
}

function makeImg(url){
  const img = document.createElement("img");
  img.className = "media";
  img.loading = "lazy";
  img.src = url;
  img.alt = "";
  return img;
}

function makeVideo(url){
  const v = document.createElement("video");
  v.className = "media";
  v.src = url;
  v.controls = false;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  v.addEventListener("mouseenter", ()=>v.play().catch(()=>{}));
  v.addEventListener("mouseleave", ()=>v.pause());
  return v;
}

// ====== VIEWER ======
function bindViewer(){
  viewerClose.addEventListener("click", closeViewer);
  viewer.addEventListener("click", (e)=>{
    if(e.target === viewer) closeViewer();
  });
  window.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeViewer();
  });
}

function openViewer(type, url){
  viewerBody.innerHTML = "";
  if(type === "video"){
    const v = document.createElement("video");
    v.src = url;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    viewerBody.appendChild(v);
  }else{
    const img = document.createElement("img");
    img.src = url;
    viewerBody.appendChild(img);
  }
  viewer.setAttribute("aria-hidden", "false");
}

function closeViewer(){
  viewer.setAttribute("aria-hidden", "true");
  viewerBody.innerHTML = "";
}

// ====== STATS (likes/views) ======
// Tables created by твоим SQL: work_stats(media_path, views), likes(media_path, client_id)

async function hydrateStats(path, viewsEl, likeBtn){
  const [{ data: s1 }, { data: s2 }] = await Promise.all([
    sb.from("work_stats").select("views").eq("media_path", path).maybeSingle(),
    sb.from("likes").select("client_id").eq("media_path", path).eq("client_id", clientId).maybeSingle(),
  ]);

  const views = s1?.views ?? 0;
  viewsEl.textContent = `👁 ${views}`;

  // likes count
  const { count } = await sb.from("likes").select("*", { count:"exact", head:true }).eq("media_path", path);
  const n = count ?? 0;
  likeBtn.querySelector("span").textContent = String(n);

  // state
  if(s2?.client_id) likeBtn.dataset.liked = "1";
  else delete likeBtn.dataset.liked;
}

async function bumpView(path){
  const key = `viewed_${path}`;
  if(sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  // increment with upsert + update (simple)
  // 1) ensure row exists
  await sb.from("work_stats").upsert({ media_path: path, views: 0 }, { onConflict:"media_path" });
  // 2) increment
  const { data } = await sb.from("work_stats").select("views").eq("media_path", path).maybeSingle();
  const v = (data?.views ?? 0) + 1;
  await sb.from("work_stats").update({ views: v }).eq("media_path", path);
}

async function toggleLike(path, btn){
  const liked = btn.dataset.liked === "1";

  if(liked){
    await sb.from("likes").delete().eq("media_path", path).eq("client_id", clientId);
    delete btn.dataset.liked;
  }else{
    await sb.from("likes").upsert({ media_path: path, client_id: clientId });
    btn.dataset.liked = "1";
  }

  const { count } = await sb.from("likes").select("*", { count:"exact", head:true }).eq("media_path", path);
  btn.querySelector("span").textContent = String(count ?? 0);
}
