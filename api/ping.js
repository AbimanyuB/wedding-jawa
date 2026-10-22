// Daily Vercel Cron hit (see vercel.json) so the free Supabase project never pauses for inactivity.
module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL, key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s+/g, '');
  if (!url || !key) return res.status(500).json({ ok: false });
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  try {
    const r = await fetch(url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/rsvp?select=id&limit=1', { headers });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
};
