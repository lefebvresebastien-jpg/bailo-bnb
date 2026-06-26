exports.handler = async () => {
  const SUPABASE_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const BAILLEUR_EMAIL = process.env.BAILLEUR_EMAIL || 'contact@bailo.pro';

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
  const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  // Charger réservations via REST
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bnb_bookings?statut=neq.annulee&select=*,bnb_properties(nom,adresse)`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const resas = await res.json();

  const emails = [];

  for (const r of (Array.isArray(resas) ? resas : [])) {
    const bienNom = r.bnb_properties?.nom || '—';
    const nuits = r.arrivee && r.depart ? Math.round((new Date(r.depart)-new Date(r.arrivee))/86400000) : '—';

    // J-7
    if (r.arrivee === addDays(7) && r.token_voyageur) {
      emails.push({
        subject: `📅 J-7 : ${r.guest_nom} arrive dans 7 jours — ${bienNom}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f59e0b;padding:20px;border-radius:12px 12px 0 0"><h2 style="color:white;margin:0">📅 Rappel J-7</h2></div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> arrive dans 7 jours le <strong>${fmt(r.arrivee)}</strong></p>
            <p>Bien : ${bienNom} — ${nuits} nuits — ${r.nb_voyageurs||1} pers.</p>
            <ul><li>Envoyer le lien espace voyageur</li><li>Confirmer le code d'accès</li><li>Préparer le logement</li></ul>
            <a href="https://bailo-bnb.netlify.app/sejour?token=${r.token_voyageur}" style="display:inline-block;background:#f59e0b;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">🔗 Lien séjour voyageur</a>
            <a href="https://bailo-bnb.netlify.app" style="display:inline-block;background:#3b5bdb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px;margin-left:8px">Ouvrir Bailo →</a>
          </div></div>`
      });
    }

    // J-1
    if (r.arrivee === addDays(1)) {
      emails.push({
        subject: `🏠 Demain : arrivée de ${r.guest_nom} — ${bienNom}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#10b981;padding:20px;border-radius:12px 12px 0 0"><h2 style="color:white;margin:0">🏠 Arrivée demain</h2></div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> arrive <strong>demain</strong> le ${fmt(r.arrivee)} à partir de 15h00</p>
            <p>Bien : ${bienNom}</p>
            <ul><li>✅ Logement nettoyé et prêt</li><li>✅ Code boîte à clés vérifié</li><li>✅ Linge propre</li><li>✅ Lien séjour envoyé</li></ul>
            <a href="https://bailo-bnb.netlify.app" style="display:inline-block;background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">Ouvrir Bailo →</a>
          </div></div>`
      });
    }

    // Jour du départ
    if (r.depart === todayStr && r.statut !== 'terminee') {
      await fetch(`${SUPABASE_URL}/rest/v1/bnb_bookings?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'terminee' })
      });
      emails.push({
        subject: `✅ Départ de ${r.guest_nom} aujourd'hui — ${bienNom}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3b5bdb;padding:20px;border-radius:12px 12px 0 0"><h2 style="color:white;margin:0">✅ Séjour terminé</h2></div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> quitte <strong>${bienNom}</strong> aujourd'hui avant 11h00</p>
            ${r.depot_garantie ? `<p>⚠️ Dépôt de garantie <strong>${r.depot_garantie}€</strong> à restituer sous 72h</p>` : ''}
            <ul><li>Vérifier l'état du logement</li><li>${r.depot_garantie ? 'Restituer le dépôt sous 72h' : 'Laisser un avis sur la plateforme'}</li></ul>
            <a href="https://bailo-bnb.netlify.app" style="display:inline-block;background:#3b5bdb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">Gérer dans Bailo →</a>
          </div></div>`
      });
    }

    // J+3 dépôt non restitué
    if (r.depot_garantie && r.depot_statut === 'en_attente' && r.statut === 'terminee') {
      const d = new Date(r.depart); d.setDate(d.getDate()+3);
      if (d.toISOString().slice(0,10) === todayStr) {
        emails.push({
          subject: `🔒 URGENT : Dépôt de ${r.depot_garantie}€ à restituer — ${r.guest_nom}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#ef4444;padding:20px;border-radius:12px 12px 0 0"><h2 style="color:white;margin:0">🔒 Dépôt à restituer</h2></div>
            <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
              <p>Le dépôt de <strong>${r.depot_garantie}€</strong> pour <strong>${r.guest_nom}</strong> doit être restitué.</p>
              <p>Délai légal : 72h après le départ (${fmt(r.depart)})</p>
              <a href="https://bailo-bnb.netlify.app" style="display:inline-block;background:#ef4444;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">Gérer dans Bailo →</a>
            </div></div>`
        });
      }
    }
  }

  // Envoyer emails
  for (const email of emails) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Bailo Airbnb <noreply@bailo.pro>', to: [BAILLEUR_EMAIL], subject: email.subject, html: email.html })
    });
  }

  return { statusCode: 200, body: JSON.stringify({ sent: emails.length, checked: resas?.length || 0 }) };
};
