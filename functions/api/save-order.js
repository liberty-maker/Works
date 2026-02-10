export async function onRequestPost({ request, env }) {
  try {
    const need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN"];
    for (const k of need) if (!env[k]) return json({ ok:false, error:`Missing env var: ${k}` }, 500);

    const token = request.headers.get("x-admin-token") || "";
    if (token !== env.ADMIN_TOKEN) return json({ ok:false, error:"Unauthorized" }, 401);

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return json({ ok:false, error:"No items" }, 400);

    const rows = items.map((media_path, i) => ({ media_path, position: i * 10, updated_at: new Date().toISOString() }));

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/work_order`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        "prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const t = await res.text();
      return json({ ok:false, error:"DB upsert order failed", details:t }, 500);
    }

    return json({ ok:true }, 200);
  } catch (e) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json; charset=utf-8" } });
}
