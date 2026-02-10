const $ = (id) => document.getElementById(id);

const tokenKey = "anna_admin_token_v1";
const ADMIN_TOKEN = localStorage.getItem(tokenKey) || "";

document.addEventListener("DOMContentLoaded", () => {
  // ping
  const jsLoaded = $("jsLoaded");
  if (jsLoaded) jsLoaded.textContent = "JS: loaded ✅";

  // token
  const tokenInput = $("adminToken");
  if (tokenInput) tokenInput.value = ADMIN_TOKEN;

  const tokenBtn = $("saveToken");
  if (tokenBtn) tokenBtn.addEventListener("click", () => {
    const v = (tokenInput?.value || "").trim();
    localStorage.setItem(tokenKey, v);
    toast("Saved token ✅");
  });

  // meta save
  $("metaSave")?.addEventListener("click", async () => {
    try {
      $("metaStatus").textContent = "Saving...";
      const body = {
        name: $("mName")?.value || "",
        tagline: $("mTagline")?.value || "",
        title: $("mTitle")?.value || "",
        subtitle: $("mSubtitle")?.value || "",
        links: $("mLinks")?.value || "",
      };
      const res = await fetch("/api/save-meta", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": localStorage.getItem(tokenKey) || "" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data.error || "Save meta failed");
      $("metaStatus").textContent = "Saved ✅";
    } catch (e) {
      $("metaStatus").textContent = `Error: ${e.message}`;
    }
  });

  // upload add
  $("uploadAdd")?.addEventListener("click", async () => {
    try {
      $("addStatus").textContent = "Uploading...";
      const file = $("file")?.files?.[0];
      if (!file) throw new Error("Choose a file");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", $("type")?.value || "image");
      fd.append("title", $("title")?.value || "");
      fd.append("caption", $("caption")?.value || "");

      const res = await fetch("/api/add-work", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem(tokenKey) || "" },
        body: fd,
      });

      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");

      $("addStatus").textContent = `Added ✅ (${data.media_path})`;
      // обновим список
      await loadBoard();
    } catch (e) {
      $("addStatus").textContent = `Error: ${e.message}`;
    }
  });

  loadBoard().catch(console.error);
});

async function loadBoard(){
  const wrap = $("adminBoard");
  if (!wrap) return;
  wrap.innerHTML = "Loading...";
  // берём список из публичного сайта (он уже тянет из Supabase)
  const res = await fetch("/index.html", { method: "GET" });
  if (!res.ok) { wrap.textContent = "Could not refresh"; return; }
  wrap.textContent = "Теперь просто перезагрузи страницу — борд обновится ✅";
}

function toast(msg){
  alert(msg);
}
