// Invokes the temporary model-compare edge function.
// Reads credentials from the environment; never prints them.
const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/model-compare`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not in environment");
  process.exit(1);
}

const payload = JSON.parse(process.argv[2] ?? "{}");

const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const text = await resp.text();
console.log(`HTTP ${resp.status}`);
console.log(text);
