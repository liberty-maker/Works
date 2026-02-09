const SUPABASE_URL = "https://avvvhriftymnhvltguuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_gHv7Y8uxZRkxdfCcch0kRw_SAoMOr3U";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

login.onclick = async ()=>{
  const { error } = await supabase.auth.signInWithPassword({
    email:email.value,
    password:password.value
  });
  status.textContent = error ? error.message : "Logged in";
};

upload.onclick = async ()=>{
  const f = file.files[0];
  if(!f) return;

  const path = `${Date.now()}_${f.name}`;
  const { error:upErr } = await supabase.storage.from("works").upload(path,f);
  if(upErr){status.textContent=upErr.message;return;}

  const { data } = supabase.storage.from("works").getPublicUrl(path);

  await supabase.from("works").insert({
    media_url:data.publicUrl,
    media_type:type.value
  });

  status.textContent="Uploaded";
};
