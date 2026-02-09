import { assertAdmin } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const authResp = assertAdmin(request, env);
  if (authResp) return authResp;

  const { filename } = await request.json();
  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const path = `${Date.now()}_${safeName}`;

  const url = `${env.SUPABASE_URL}/storage/v1/object/upload/sign/${env.SUPABASE_BUCKET}/${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 600 }),
  });

  const txt = await r.text();
  if (!r.ok) return new Response(txt, { status: 500 });

  const json = JSON.parse(txt);
  return new Response(JSON.stringify({ path, signedUrl: json.signedURL }), {
    headers: { "content-type": "application/json" },
  });
}
