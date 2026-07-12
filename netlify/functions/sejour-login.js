// Établit une vraie session Supabase pour un voyageur à partir de son
// lien de séjour (?token=xxx ou ?sejour=xxx), sur le même principe que
// artisan-login.js. Avant le 12/07/2026, sejour.html interrogeait
// Supabase directement avec la clé anonyme sans aucune vérification
// serveur — n'importe qui pouvait accéder à n'importe quelle réservation
// en devinant/testant des tokens, la policy RLS ne filtrant rien.
const https = require('https');

const CHANTIER_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
const CHANTIER_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: payload ? { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data || 'null') }); } catch(e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type' } };
  }

  try {
    const { token } = JSON.parse(event.body || '{}');
    if (!token || !CHANTIER_SERVICE_KEY) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Token manquant' }) };
    }

    const svcHeaders = { apikey: CHANTIER_SERVICE_KEY, Authorization: 'Bearer ' + CHANTIER_SERVICE_KEY };

    // Retrouver la réservation via son token (clé service, contourne RLS)
    const resaRes = await request('GET',
      CHANTIER_URL + '/rest/v1/bnb_bookings?token_voyageur=eq.' + encodeURIComponent(token) + '&select=*',
      svcHeaders
    );
    const resa = Array.isArray(resaRes.body) ? resaRes.body[0] : null;
    if (!resa) {
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Lien invalide ou expiré' }) };
    }
    if (!resa.guest_email) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Aucun email associé à cette réservation, contactez votre hôte' }) };
    }

    let guestUserId = resa.guest_user_id;

    // Créer le compte Supabase du voyageur s'il n'existe pas encore
    if (!guestUserId) {
      const createRes = await request('POST', CHANTIER_URL + '/auth/v1/admin/users', svcHeaders, {
        email: resa.guest_email,
        password: 'guest-' + Math.random().toString(36).slice(2) + Date.now(),
        email_confirm: true,
        user_metadata: { role: 'bnb_guest', booking_id: resa.id }
      });
      if (createRes.status >= 300 || !createRes.body?.id) {
        // Le filtre ?email= de l'API admin n'est pas fiable (renvoie parfois
        // un autre utilisateur) — on liste tout et on filtre nous-mêmes.
        const listRes = await request('GET', CHANTIER_URL + '/auth/v1/admin/users?per_page=1000', svcHeaders);
        const allUsers = listRes.body?.users || (Array.isArray(listRes.body) ? listRes.body : []);
        const existing = allUsers.find(u => u.email?.toLowerCase() === resa.guest_email.toLowerCase());
        if (!existing?.id) {
          return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Impossible de créer le compte voyageur' }) };
        }
        guestUserId = existing.id;
      } else {
        guestUserId = createRes.body.id;
      }
      await request('PATCH',
        CHANTIER_URL + '/rest/v1/bnb_bookings?id=eq.' + resa.id,
        svcHeaders,
        { guest_user_id: guestUserId }
      );
    }

    // Générer un lien magique pour établir une vraie session côté client
    const linkRes = await request('POST', CHANTIER_URL + '/auth/v1/admin/generate_link', svcHeaders, {
      type: 'magiclink',
      email: resa.guest_email
    });
    const hashedToken = linkRes.body?.properties?.hashed_token || linkRes.body?.hashed_token;
    if (!hashedToken) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Impossible de générer la session' }) };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ email: resa.guest_email, hashed_token: hashedToken })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
