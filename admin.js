// ====== НАСТРОЙКИ ======
const ADMIN_PASSWORD = "123456"; // ← поменяй на свой

const SUPABASE_URL = "https://avvvwhriftnynhvltguuc.supabase.co";
const SUPABASE_SERVICE_KEY = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE";
const BUCKET = "works";
// ======================

function login() {
  const input = document.getElementById("password").value;

  if (input === ADMIN_PASSWORD) {
    document.getElementById("admin-panel").style.display = "block";
    alert("Access granted");
  } else {
    alert("Wrong password");
  }
}

async function upload() {
  const fileInput = document.getElementById("file");
  const type = document.getElementById("type").value;
  const file = fileInput.files[0];

  if (!file) {
    alert("Choose a file");
    return;
  }

  const path = `${type}/${Date.now()}-${file.name}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": file.type
    },
    body: file
  });

  if (res.ok) {
    alert("Uploaded successfully");
  } else {
    const err = await res.text();
    alert("Upload error: " + err);
  }
}
