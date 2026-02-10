// functions/api/add-work.js
// POST multipart/form-data: file, title, caption, type
// Header: x-admin-token: <ADMIN_TOKEN>

export async function onRequestPost({ request, env }) {
  try {
    // --- auth ---
    const token = request.headers.get("x-admin-token") || "";
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // --- env ---
    const SUPABASE_URL = env.SUPABASE_URL;
    const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = env.SUPABASE_BUCKET || "Works";

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ ok: false, error: "Missing env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }, 500);
    }

    // --- parse form ---
    const form = await request.formData();
    const file = form.get("file");
    const title = (form.get("title") || "").toString().trim();
    const caption = (form.get("caption") || "").toString().trim();
    const type = (form.get("type") || "image").toString();

    if (!file || typeof file === "string") {
      return json({ ok: false, error: "No file uploaded" }, 400);
    }

    // filename -> safe path
    const originalName = (file.name || "file").toString();
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
    const ts = Date.now();
    const rand = Math.random().toString(16).slice(2);
    const safeExt = ext ? "." + ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) : "";
    const path = `${ts}-${rand}${safeExt}`;

    // --- upload to Supabase Storage (service role) ---
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(path)}`;

    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });

    if (!up.ok) {
      const t = await up.text().catch(() => "");
      return json({ ok: false, error: "Storage upload failed", details: t }, 500);
    }

    // public URL (bucket должен быть PUBLIC)
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    // --- insert into DB (public.works) ---
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/works`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "content-type": "application/json",
        "prefer": "return=representation",
      },
      body: JSON.stringify([{
        media_path: path,
        media_type: type,
        title,
        caption,
      }]),
    });

    if (!ins.ok) {
      const t = await ins.text().catch(() => "");
      return json({ ok: false, error: "DB insert failed", details: t, path, publicUrl }, 500);
    }

    const data = await ins.json();

    // ensure order row exists
    await fetch(`${SUPABASE_URL}/rest/v1/work_order`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "content-type": "application/json",
        "prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ media_path: path, position: 100000 }]),
    }).catch(() => {});

    return json({ ok: true, path, publicUrl, row: data?.[0] || null }, 200);

  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
