const SUPABASE_URL = "https://avvvhriftymnhvltguuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_qogHp4h5jucsviDIjSE_Ow_EfycJdGq";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI
const board = document.getElementById("board");
const totalWorks = document.getElementById("totalWorks");
const sentinel = document.getElementById("sentinel");

// Lightbox
const lb = document.getElementById("lightbox");
const lbClose = document.getElementById("lbClose");
const lbMedia = document.getElementById("lbMedia");
const lbTitle = document.getElementById("lbTitle");
const lbCaption = document.getElementById("lbCaption");
const lbViews = document.getElementById("lbViews");
const lbLikes = document.getElementById("lbLikes");
const lbLike = document.getElementById("lbLike");

// Infinite
let from = 0;
const page = 12;
let loading = false;
let totalCount = null;

// Anti-spam (на одного человека — один просмотр/лайк)
const seenKey = (id) => `seen:${id}`;
const likedKey = (id) => `liked:${id}`;

function isSeen(id){ return localStorage.getItem(seenKey(id)) === "1"; }
function markSeen(id){ localStorage.setItem(seenKey(id), "1"); }
function isLiked(id){ return localStorage.getItem(likedKey(id)) === "1"; }
function markLiked(id){ localStorage.setItem(likedKey(id), "1"); }

function pickTitle(w){
  if (w.title && w.title.trim()) return w.title.trim();
  return "Untitled";
}

function statsOf(w){
  // work_stats приходит как массив/объект в зависимости от relationship
  const s = w.work_stats;
  if (Array.isArray(s)) return s[0] || { views: 0, likes: 0 };
  return s || { views: 0, likes: 0 };
}

async function loadNext(){
  if (loading) return;
  if (totalCount !== null && from >= totalCount) return;

  loading = true;

  const { data, error, count } = await supabase
    .from("works")
    .select("id,title,caption,media_url,media_type,created_at,work_stats(views,likes)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + page - 1);

  if (error) {
    console.error(error);
    loading = false;
    return;
  }

  totalCount = count ?? totalCount;
  totalWorks.textContent = `${totalCount ?? "…"} works`;

  data.forEach(renderCard);

  from += page;
  loading = false;
}

function renderCard(w){
  const st = statsOf(w);

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = w.id;

  const mediaHTML = w.media_type === "video"
    ? `<video src="${w.media_url}" muted playsinline preload="metadata"></video>`
    : `<img src="${w.media_url}" loading="lazy" alt="">`;

  card.innerHTML = `
    <div class="card__media">${mediaHTML}</div>
    <div class="card__footer">
      <div class="card__meta">
        <div class="card__title">${escapeHTML(pickTitle(w))}</div>
      </div>
      <div class="card__stats">
        <button class="like ${isLiked(w.id) ? "liked" : ""}" aria-label="Like">♡ <span>${st.likes ?? 0}</span></button>
        <div>👁 <span>${st.views ?? 0}</span></div>
      </div>
    </div>
  `;

  // click on card -> open lightbox + view increment
  card.addEventListener("click", (e) => {
    // если нажали кнопку лайка — не открываем
    if (e.target.closest(".like")) return;
    openLightbox(w);
  });

  // like button
  const likeBtn = card.querySelector(".like");
  likeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (isLiked(w.id)) return;

    markLiked(w.id);
    likeBtn.classList.add("liked");

    // optimistic +1
    const span = likeBtn.querySelector("span");
    span.textContent = String((Number(span.textContent) || 0) + 1);

    // rpc
    await supabase.rpc("increment_like", { p_work_id: w.id });

    // sync lightbox if same work opened
    if (lb.getAttribute("aria-hidden") === "false" && lb.dataset.id === w.id) {
      lbLikes.textContent = span.textContent;
      lbLike.classList.add("liked");
    }
  });

  // autoplay on hover for video (премиум “живость”)
  const vid = card.querySelector("video");
  if (vid){
    card.addEventListener("mouseenter", () => vid.play().catch(()=>{}));
    card.addEventListener("mouseleave", () => { vid.pause(); vid.currentTime = 0; });
  }

  board.appendChild(card);
}

async function openLightbox(w){
  lb.dataset.id = w.id;

  lbMedia.innerHTML = w.media_type === "video"
    ? `<video src="${w.media_url}" controls playsinline></video>`
    : `<img src="${w.media_url}" alt="">`;

  lbTitle.textContent = pickTitle(w);
  lbCaption.textContent = w.caption || "";

  // подсветить лайк
  lbLike.classList.toggle("liked", isLiked(w.id));

  // подтянуть текущие значения stats из БД (точнее, чем в карточке)
  const { data } = await supabase
    .from("work_stats")
    .select("views,likes")
    .eq("work_id", w.id)
    .maybeSingle();

  lbViews.textContent = String(data?.views ?? 0);
  lbLikes.textContent = String(data?.likes ?? 0);

  // +1 view один раз на устройство
  if (!isSeen(w.id)){
    markSeen(w.id);
    await supabase.rpc("increment_view", { p_work_id: w.id });

    // обновим lightbox UI
    lbViews.textContent = String((Number(lbViews.textContent) || 0) + 1);

    // обновим карточку (если найдём)
    const card = board.querySelector(`.card[data-id="${w.id}"]`);
    if (card){
      const viewsSpan = card.querySelector(".card__stats div span");
      if (viewsSpan) viewsSpan.textContent = lbViews.textContent;
    }
  }

  // like in lightbox
  lbLike.onclick = async () => {
    if (isLiked(w.id)) return;

    markLiked(w.id);
    lbLike.classList.add("liked");
    lbLikes.textContent = String((Number(lbLikes.textContent) || 0) + 1);
    await supabase.rpc("increment_like", { p_work_id: w.id });

    // sync card like count
    const card = board.querySelector(`.card[data-id="${w.id}"]`);
    if (card){
      const btn = card.querySelector(".like");
      const span = btn?.querySelector("span");
      if (btn && span){
        btn.classList.add("liked");
        span.textContent = lbLikes.textContent;
      }
    }
  };

  lb.setAttribute("aria-hidden", "false");
}

function closeLightbox(){
  lb.setAttribute("aria-hidden", "true");
  lbMedia.innerHTML = "";
  lb.dataset.id = "";
}

lbClose.addEventListener("click", closeLightbox);
lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

function escapeHTML(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// infinite trigger
const io = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadNext();
}, { rootMargin: "900px" });

io.observe(sentinel);
loadNext();
