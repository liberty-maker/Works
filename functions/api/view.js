export async function onRequestPost({ request, env }) {
  try {
    const need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    for (const k of need) if (!env[k]) return json({ ok:false, error:`Missing env var: ${k}` }, 500);

    const { media_path } = await request.json();
    if (!media_path) return json({ ok:false, error:"No media_path" }, 400);

    // upsert row if missing
    await fetch(`${env.SUPABASE_URL}/rest/v1/work_stats`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        "prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ media_path, views: 0 }]),
    });

    // fetch current
    const cur = await fetch(`${env.SUPABASE_URL}/rest/v1/work_stats?select=views&media_path=eq.${encodeURIComponent(media_path)}`, {
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      }
    });
    const arr = await cur.json();
    const views = (arr?.[0]?.views || 0) + 1;

    // update
    const upd = await fetch(`${env.SUPABASE_URL}/rest/v1/work_stats?media_path=eq.${encodeURIComponent(media_path)}`, {
      method: "PATCH",
      headers: {
        "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ views, updated_at: new Date().toISOString() }),
    });

    if (!upd.ok) {
      const t = await upd.text();
      return json({ ok:false, error:"Update views failed", details:t }, 500);
    }

    return json({ ok:true, views }, 200);
  } catch (e) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json; charset=utf-8" } });
}
