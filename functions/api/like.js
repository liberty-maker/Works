export async function onRequestPost({ request, env }) {
  try {
    const need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    for (const k of need) if (!env[k]) return json({ ok:false, error:`Missing env var: ${k}` }, 500);

    const { media_path, client_id } = await request.json();
    if (!media_path || !client_id) return json({ ok:false, error:"No media_path/client_id" }, 400);

    // toggle: если есть — удаляем, если нет — вставляем
    const existsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/likes?select=media_path&media_path=eq.${encodeURIComponent(media_path)}&client_id=eq.${encodeURIComponent(client_id)}`, {
      headers: { "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "apikey": env.SUPABASE_SERVICE_ROLE_KEY }
    });
    const exists = await existsRes.json();

    if (exists?.length) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/likes?media_path=eq.${encodeURIComponent(media_path)}&client_id=eq.${encodeURIComponent(client_id)}`, {
        method: "DELETE",
        headers: { "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "apikey": env.SUPABASE_SERVICE_ROLE_KEY }
      });
    } else {
      await fetch(`${env.SUPABASE_URL}/rest/v1/likes`, {
        method: "POST",
        headers: {
          "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify([{ media_path, client_id }]),
      });
    }

    const countRes = await fetch(`${env.SUPABASE_URL}/rest/v1/likes?select=media_path&media_path=eq.${encodeURIComponent(media_path)}`, {
      headers: { "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "apikey": env.SUPABASE_SERVICE_ROLE_KEY }
    });
    const all = await countRes.json();

    return json({ ok:true, liked: !exists?.length, likes: all?.length || 0 }, 200);
  } catch (e) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json; charset=utf-8" } });
}
