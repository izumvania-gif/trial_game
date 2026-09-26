// A single self-contained page for moderating notes. The token is typed in and kept in
// sessionStorage only; every request sends it as a Bearer header.
export const ADMIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eferon · notes</title>
<style>
  body { font: 15px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #1b1f1d; color: #cfe0d6; margin: 0; padding: 1.5rem; }
  h1 { font-size: 1rem; letter-spacing: .2em; text-transform: uppercase; }
  input, button, select { font: inherit; background: #232a27; color: inherit; border: 1px solid #4d5c54; padding: .3rem .6rem; }
  li { margin: .6rem 0; padding: .6rem; background: #232a27; list-style: none; }
  li button { margin-right: .4rem; }
  ul { padding: 0; }
</style></head><body>
<h1>Notes in the waves</h1>
<p><input id="token" type="password" placeholder="admin token" size="32">
<select id="status"><option>pending</option><option>approved</option><option>rejected</option></select>
<button id="load">Load</button></p>
<ul id="list"></ul>
<script>
const $ = (id) => document.getElementById(id);
$('token').value = sessionStorage.getItem('eferon.admin') || '';
const headers = () => ({ authorization: 'Bearer ' + $('token').value, 'content-type': 'application/json' });
async function load() {
  sessionStorage.setItem('eferon.admin', $('token').value);
  const res = await fetch('/api/admin/notes?status=' + $('status').value, { headers: headers() });
  const list = $('list');
  list.textContent = '';
  if (!res.ok) { list.textContent = 'Error ' + res.status; return; }
  for (const n of (await res.json()).notes) {
    const li = document.createElement('li');
    const text = document.createElement('p');
    text.textContent = n.text;
    li.append(text);
    for (const s of ['approved', 'rejected']) {
      const b = document.createElement('button');
      b.textContent = s === 'approved' ? 'Approve' : 'Reject';
      b.onclick = async () => {
        const r = await fetch('/api/admin/notes/' + n.id, { method: 'POST', headers: headers(), body: JSON.stringify({ status: s }) });
        if (r.ok) li.remove();
      };
      li.append(b);
    }
    list.append(li);
  }
}
$('load').onclick = load;
</script></body></html>`;
