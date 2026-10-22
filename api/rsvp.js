// RSVP & wishes, stored in the Supabase table `rsvp` through its REST API.
// GET  /api/rsvp -> { wishes: [{ name, attend, msg, t }], counts: { Hadir, 'Tidak Hadir', 'Masih Ragu' } }
// POST /api/rsvp { name, attend, msg } -> 201 { ok: true }
const ATTEND = ['Hadir', 'Tidak Hadir', 'Masih Ragu'];

function supa(path, init = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...init.headers };
  // legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only in apikey
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  // accept the project URL with or without a trailing /rest/v1
  return fetch(url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/' + path, { ...init, headers });
}

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const r = await supa('rsvp?select=name,attend,msg,created_at&order=created_at.desc&limit=500');
      if (!r.ok) throw new Error('select ' + r.status + ' ' + (await r.text()));
      const rows = await r.json();
      const counts = { Hadir: 0, 'Tidak Hadir': 0, 'Masih Ragu': 0 };
      rows.forEach(w => { if (w.attend in counts) counts[w.attend]++; });
      return res.status(200).json({
        wishes: rows.map(w => ({ name: w.name, attend: w.attend, msg: w.msg, t: w.created_at })),
        counts,
      });
    }

    if (req.method === 'POST') {
      let body = req.body || {};
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (body.website) return res.status(201).json({ ok: true }); // honeypot: bots fill the hidden field
      const name = clean(body.name, 60), msg = clean(body.msg, 500), attend = clean(body.attend, 20);
      if (!name || !msg || !ATTEND.includes(attend)) return res.status(400).json({ error: 'Data tidak lengkap' });

      // ignore an exact repeat (double tap, resubmit)
      const dup = await supa('rsvp?select=id&limit=1&name=eq.' + encodeURIComponent(name) + '&msg=eq.' + encodeURIComponent(msg));
      if (dup.ok && (await dup.json()).length) return res.status(201).json({ ok: true });

      const r = await supa('rsvp', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name, attend, msg }) });
      if (!r.ok) throw new Error('insert ' + r.status + ' ' + (await r.text()));
      return res.status(201).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
};
