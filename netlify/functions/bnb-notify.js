exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { type, data } = JSON.parse(event.body);
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const BAILLEUR_EMAIL = process.env.BAILLEUR_EMAIL || 'contact@bailo.pro';

    let subject, html;

    if (type === 'nouveau_message') {
      subject = `💬 Nouveau message de ${data.guest_nom} — ${data.bien_nom}`;
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3b5bdb;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">💬 Nouveau message voyageur</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>De :</strong> ${data.guest_nom}</p>
            <p><strong>Bien :</strong> ${data.bien_nom}</p>
            <p><strong>Séjour :</strong> ${data.arrivee} → ${data.depart}</p>
            <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #3b5bdb">
              <p style="margin:0">${data.contenu}</p>
            </div>
            <a href="https://bailo-bnb.netlify.app" style="background:#3b5bdb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
              Répondre dans Bailo Airbnb →
            </a>
          </div>
        </div>`;
    }

    else if (type === 'nouvel_incident') {
      const urgenceColor = { faible: '#3b5bdb', normale: '#f59e0b', urgente: '#ef4444' };
      const color = urgenceColor[data.urgence] || '#3b5bdb';
      subject = `🚨 [${data.urgence?.toUpperCase()}] Incident signalé — ${data.bien_nom}`;
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:${color};padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">🚨 Incident signalé</h2>
            <p style="color:rgba(255,255,255,.8);margin:4px 0 0">Urgence : ${data.urgence}</p>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>Signalé par :</strong> ${data.guest_nom}</p>
            <p><strong>Bien :</strong> ${data.bien_nom}</p>
            <p><strong>Type :</strong> ${data.type_incident}</p>
            <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid ${color}">
              <p style="margin:0">${data.description}</p>
            </div>
            <a href="https://bailo-bnb.netlify.app" style="background:${color};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
              Gérer l'incident →
            </a>
          </div>
        </div>`;
    }

    else if (type === 'nouvelle_reservation') {
      subject = `📅 Nouvelle réservation — ${data.guest_nom} — ${data.bien_nom}`;
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#10b981;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">📅 Nouvelle réservation</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>Voyageur :</strong> ${data.guest_nom}</p>
            <p><strong>Email :</strong> ${data.guest_email || '—'}</p>
            <p><strong>Téléphone :</strong> ${data.guest_tel || '—'}</p>
            <p><strong>Bien :</strong> ${data.bien_nom}</p>
            <p><strong>Arrivée :</strong> ${data.arrivee}</p>
            <p><strong>Départ :</strong> ${data.depart}</p>
            <p><strong>Voyageurs :</strong> ${data.nb_voyageurs}</p>
            <p><strong>Montant :</strong> ${data.montant} €</p>
            <p><strong>Plateforme :</strong> ${data.plateforme}</p>
            <a href="https://bailo-bnb.netlify.app" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">
              Voir dans Bailo Airbnb →
            </a>
          </div>
        </div>`;
    }

    else if (type === 'rappel') {
      subject = data.subject;
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f59e0b;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">${data.emoji} ${data.titre}</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p>${data.message}</p>
            <p><strong>Bien :</strong> ${data.bien_nom}</p>
            <p><strong>Voyageur :</strong> ${data.guest_nom}</p>
            <p><strong>Date :</strong> ${data.date}</p>
            <a href="https://bailo-bnb.netlify.app" style="background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">
              Ouvrir Bailo Airbnb →
            </a>
          </div>
        </div>`;
    }

    if (!subject) return { statusCode: 400, body: 'Type inconnu' };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Bailo Airbnb <noreply@bailo.pro>',
        to: [BAILLEUR_EMAIL],
        subject,
        html
      })
    });

    const result = await res.json();
    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
