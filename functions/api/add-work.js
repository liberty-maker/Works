import { assertAdmin } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const authResp = assertAdmin(request, env);
  if (authResp) return authResp;

  const body = await request.json(); // {title, caption, media_path, media_type}
  const url = `${env.SUPABASE_URL}/rest/v1/works`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: body.title || "",
      caption: body.caption || "",
      media_path: body.media_path,
      media_type: body.media_type || "image",
    }),
  });

  const txt = await r.text();
  if (!r.ok) return new Response(txt, { status: 500 });

  // дефолтная позиция в order (чтобы сразу сортировалось)
  await fetch(`${env.SUPABASE_URL}/rest/v1/work_order`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      media_path: body.media_path,
      position: 100000,
      updated_at: new Date().toISOString(),
    }),
  });

  return new Response(txt, { headers: { "content-type": "application/json" } });
}
