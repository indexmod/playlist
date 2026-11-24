/* Cloudflare Worker: bind KV namespace as SCHEDULES and add RADIO_WRITE_KEY secret. */
const headers = {
  'Access-Control-Allow-Origin': 'https://indexmod.github.io',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Radio-Key',
  'Content-Type': 'application/json; charset=utf-8'
};
const empty = { version: 2, settings: { timezone: 'Europe/Moscow', defaultUrl: '', defaultTitle: '', idDuration: 30, idUrl: 'assets/station_id_30s.mp3' }, slots: {} };
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response('', { headers });
    if (request.method === 'GET') {
      const data = await env.SCHEDULES.get('current');
      return new Response(data || JSON.stringify(empty), { headers });
    }
    if (request.method === 'PUT') {
      if (request.headers.get('X-Radio-Key') !== env.RADIO_WRITE_KEY) return new Response('{"error":"forbidden"}', { status: 403, headers });
      const body = await request.text();
      if (body.length > 200000) return new Response('{"error":"too large"}', { status: 413, headers });
      const value = JSON.parse(body);
      if (!value || value.version !== 2 || !value.settings || !value.slots) return new Response('{"error":"invalid schedule"}', { status: 400, headers });
      await env.SCHEDULES.put('current', JSON.stringify(value));
      return new Response('{"ok":true}', { headers });
    }
    return new Response('{"error":"method not allowed"}', { status: 405, headers });
  }
};
