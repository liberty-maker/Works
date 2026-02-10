export async function onRequestPost({ request, env }) {
  try {
    const need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN"];
    for (const k of need) if (!env[k]) return json({ ok:false, error:`Missing env var: ${k}` }, 500);

    const token = request.headers.get("x-admin-token") || "";
    if (token !== env.ADMIN_TOKEN) return json({ ok:false, error:"Unauthorized" }, 401);

    const form = await request.formData();
    const file = form.get("file");
    const type = (form.get("type") || "image").toString();
    const title = (form.get("title") || "").toString();
    const caption = (form.get("caption") || "").toString();

    if (!file || typeof file === "string") return json({ ok:false, error:"No file" }, 400);

    const ext = guessExt(file.name, type);
    const safeBase = safeName(file.name.replace(/\.[^/.]+$/, "")) || "work";
    const stamp = Date.now();
    const media_path = `${stamp}-${safeBase}.${ext}`;

    // 1) Upload to Storage (bucket Works)
    const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/Works/${encodeURIComponent(media_path)}`;
    const upRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": file.type || (type === "video" ? "video/mp4" : "image/jpeg"),
        "x-upsert": "false",
      },
      body: await file.arrayBuffer(),
    });

    if (!upRes.ok) {
      const t = await upRes.text();
      return json({ ok:false, error:"Storage upload failed", details:t }, 500);
    }

    // 2) Insert into works
    const worksRes = await fetch(`${env.SUPABASE_URL}/rest/v1/works`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        "prefer": "return=representation",
      },
      body: JSON.stringify([{ media_path, type, title, caption }]),
    });

    if (!worksRes.ok) {
      const t = await worksRes.text();
      return json({ ok:false, error:"DB insert works failed", details:t, media_path }, 500);
    }

    // 3) Set default order (append to end)
    const pos = 100000 + stamp % 100000; // простая “в конец”
    const ordRes = await fetch(`${env.SUPABASE_URL}/rest/v1/work_order`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        "prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ media_path, position: pos }]),
    });

    if (!ordRes.ok) {
      const t = await ordRes.text();
      return json({ ok:false, error:"DB upsert order failed", details:t, media_path }, 500);
    }

    return json({ ok:true, media_path }, 200);
  } catch (e) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type":"application/json; charset=utf-8" }
  });
}

function safeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function guessExt(filename, type) {
  const m = (filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (m?.[1]) return m[1];
  return type === "video" ? "mp4" : "jpg";
}
