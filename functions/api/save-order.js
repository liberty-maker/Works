import { assertAdmin } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const authResp = assertAdmin(request, env);
  if (authResp) return authResp;

  const { paths } = await request.json(); // array media_path in order

  const rows = paths.map((p, i) => ({
    media_path: p,
    position: i,
    updated_at: new Date().toISOString(),
  }));

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/work_order`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!r.ok) return new Response(await r.text(), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
