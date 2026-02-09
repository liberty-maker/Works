import { assertAdmin } from "./_auth.js";

export async function onRequestGet({ env }) {
  const url = `${env.SUPABASE_URL}/rest/v1/site_meta?key=eq.main&select=value`;
  const r = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  const data = await r.json();
  return new Response(JSON.stringify(data?.[0]?.value || {}), {
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  const authResp = assertAdmin(request, env);
  if (authResp) return authResp;

  const body = await request.json();
  const url = `${env.SUPABASE_URL}/rest/v1/site_meta`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      key: "main",
      value: body,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) return new Response(await r.text(), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
