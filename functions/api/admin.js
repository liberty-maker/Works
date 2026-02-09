export async function onRequestPost(ctx) {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } = ctx.env;
    const bucket = SUPABASE_BUCKET || "Works";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }, 500);
    }

    const body = await ctx.request.json().catch(() => ({}));
    const action = body.action;

    const headers = {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    const sb = {
      async select(table, query) {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        return fetch(url, { headers });
      },
      async insert(table, payload, prefer = "return=representation") {
        const url = `${SUPABASE_URL}/rest/v1/${table}`;
        return fetch(url, {
          method: "POST",
          headers: { ...headers, "Prefer": prefer },
          body: JSON.stringify(payload),
        });
      },
      async upsert(table, payload, onConflict, prefer = "return=representation") {
        const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
        return fetch(url, {
          method: "POST",
          headers: { ...headers, "Prefer": `resolution=merge-duplicates,${prefer}` },
          body: JSON.stringify(payload),
        });
      },
      async patch(table, query, payload) {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        return fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      },
      async del(table, query) {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        return fetch(url, { method: "DELETE", headers });
      },
    };

    // ---- actions ----
    if (action === "get_meta") {
      const res = await sb.select("site_meta", `?select=key,value&key=in.("name","tagline","title","subtitle","links")`);
      const arr = await res.json();
      const meta = {};
      for (const r of arr) meta[r.key] = r.value;
      return json({ meta });
    }

    if (action === "set_meta") {
      const meta = body.meta || {};
      const rows = [
        { key: "name", value: meta.name || "ANNA" },
        { key: "tagline", value: meta.tagline || "AI Visual Portfolio" },
        { key: "title", value: meta.title || "Portfolio" },
        { key: "subtitle", value: meta.subtitle || "Infinite board of AI works" },
        { key: "links", value: meta.links || { items: [] } },
      ];
      for (const r of rows) {
        await sb.upsert("site_meta", r, "key", "return=minimal");
      }
      return json({ ok: true });
    }

    if (action === "list_works") {
      const res = await sb.select("works", `?select=id,title,caption,media_path,media_type,position,created_at&order=position.asc`);
      const arr = await res.json();
      const items = (arr || []).map((x) => ({
        ...x,
        public_url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(x.media_path)}`,
      }));
      return json({ items });
    }

    if (action === "upload_work") {
      const file = body.file || {};
      const meta = body.meta || {};
      if (!file.data_base64) return json({ error: "No file data" }, 400);

      // filename
      const ext = (file.name || "").split(".").pop() || "bin";
      const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
      const id = crypto.randomUUID();
      const path = `${Date.now()}_${id}.${safeExt}`;

      // upload to Storage via storage API
      const bin = Uint8Array.from(atob(file.data_base64), (c) => c.charCodeAt(0));
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: bin,
      });

      if (!up.ok) {
        const t = await up.text();
        return json({ error: `Storage upload failed: ${t}` }, 500);
      }

      // get max position
      const maxRes = await sb.select("works", `?select=position&order=position.desc&limit=1`);
      const maxArr = await maxRes.json();
      const nextPos = (maxArr?.[0]?.position ?? 0) + 100;

      // insert into works table
      const payload = {
        title: meta.title || "Untitled",
        caption: meta.caption || "",
        media_path: path,
        media_type: meta.media_type || "image",
        position: nextPos,
      };

      const ins = await sb.insert("works", payload, "return=representation");
      if (!ins.ok) {
        const t = await ins.text();
        return json({ error: `DB insert failed: ${t}` }, 500);
      }
      const saved = (await ins.json())?.[0];

      return json({
        ok: true,
        item: {
          ...saved,
          public_url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`,
        },
      });
    }

    if (action === "set_order") {
      const ids = body.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) return json({ error: "No ids" }, 400);

      // update each with incrementing position (keeps gaps)
      let pos = 100;
      for (const id of ids) {
        await sb.patch("works", `?id=eq.${encodeURIComponent(id)}`, { position: pos });
        pos += 100;
      }
      return json({ ok: true });
    }

    if (action === "delete_work") {
      const id = body.id;
      if (!id) return json({ error: "No id" }, 400);

      // get row
      const res = await sb.select("works", `?select=media_path&id=eq.${encodeURIComponent(id)}&limit=1`);
      const arr = await res.json();
      const media_path = arr?.[0]?.media_path;

      // delete row
      await sb.del("works", `?id=eq.${encodeURIComponent(id)}`);

      // delete file (best effort)
      if (media_path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${media_path}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }).catch(()=>{});
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message || "Server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
