const SUPABASE_URL = "https://avvvhriftymnhvltguuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_gHv7Y8uxZRkxdfCcch0kRw_SAoMOr3U";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

const grid = document.getElementById("grid");
const totalWorks = document.getElementById("totalWorks");

let offset = 0;
const limit = 12;

async function loadWorks(){
  const { data, error, count } = await supabase
    .from("works")
    .select("*", { count:"exact" })
    .order("created_at",{ascending:false})
    .range(offset, offset+limit-1);

  if(error){console.error(error);return}

  totalWorks.textContent = `${count} works`;

  data.forEach(w=>{
    const el = document.createElement("div");
    el.className="card";
    el.innerHTML = w.media_type==="video"
      ? `<video src="${w.media_url}" muted></video>`
      : `<img src="${w.media_url}" />`;
    grid.appendChild(el);
  });

  offset += limit;
}

const observer = new IntersectionObserver(e=>{
  if(e[0].isIntersecting) loadWorks();
},{rootMargin:"800px"});

observer.observe(document.getElementById("sentinel"));
loadWorks();
