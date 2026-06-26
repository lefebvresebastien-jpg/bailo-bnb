const { createClient } = require('@supabase/supabase-js');

exports.handler = async () => {
  const db = createClient(
    process.env.SUPABASE_URL || 'https://hvkguyddmhqbvarujlyr.supabase.co',
    process.env.SUPABASE_SERVICE_KEY
  );
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const BAILLEUR_EMAIL = process.env.BAILLEUR_EMAIL || 'contact@bailo.pro';

  const today = new Date();
  const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r.toISOString().slice(0,10); };
  const todayStr = today.toISOString().slice(0,10);

  // Charger réservations actives
  const { data: resas } = await db.from('bnb_bookings')
    .select('*, bnb_properties(nom, adresse)')
    .neq('statut', 'annulee');

  const emails = [];

  for (const r of (resas || [])) {
    const bienNom = r.bnb_properties?.nom || '—';

    // J-7 : envoyer lien séjour
    if (r.arrivee === addDays(today, 7) && r.token_voyageur) {
      emails.push({
        subject: `📅 J-7 : ${r.guest_nom} arrive dans 7 jours — ${bienNom}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f59e0b;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">📅 Rappel J-7</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> arrive dans <strong>7 jours</strong> le ${fmt(r.arrivee)}.</p>
            <p><strong>Bien :</strong> ${bienNom}</p>
            <p><strong>Durée :</strong> ${Math.round((new Date(r.depart)-new Date(r.arrivee))/86400000)} nuits — ${r.nb_voyageurs||1} personne(s)</p>
            <p style="margin-top:16px"><strong>Actions recommandées :</strong></p>
            <ul>
              <li>Envoyer le lien espace voyageur</li>
              <li>Confirmer le code d'accès</li>
              <li>Préparer le logement</li>
            </ul>
            <a href="https://bailo-bnb.netlify.app/sejour?token=${r.token_voyageur}" 
               style="display:inline-block;background:#f59e0b;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:12px">
              🔗 Lien espace voyageur
            </a>
            <a href="https://bailo-bnb.netlify.app" 
               style="display:inline-block;background:#3b5bdb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:12px;margin-left:8px">
              Ouvrir Bailo →
            </a>
          </div>
        </div>`
      });
    }

    // J-1 : préparer le logement
    if (r.arrivee === addDays(today, 1)) {
      emails.push({
        subject: `🏠 Demain : arrivée de ${r.guest_nom} — ${bienNom}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#10b981;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">🏠 Arrivée demain</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> arrive <strong>demain</strong> le ${fmt(r.arrivee)} à partir de 15h00.</p>
            <p><strong>Bien :</strong> ${bienNom}</p>
            <p style="margin-top:16px"><strong>Checklist avant l'arrivée :</strong></p>
            <ul>
              <li>✅ Logement nettoyé et prêt</li>
              <li>✅ Code boîte à clés vérifié</li>
              <li>✅ Serviettes et linge propre</li>
              <li>✅ Lien espace voyageur envoyé</li>
            </ul>
          </div>
        </div>`
      });
    }

    // J+1 après départ : demander avis + restitution dépôt
    if (r.depart === todayStr && r.statut !== 'terminee') {
      // Marquer comme terminée
      await db.from('bnb_bookings').update({ statut: 'terminee' }).eq('id', r.id);

      emails.push({
        subject: `✅ Départ de ${r.guest_nom} — ${bienNom} — Pensez à l'avis`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3b5bdb;padding:20px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0">✅ Séjour terminé</h2>
          </div>
          <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
            <p><strong>${r.guest_nom}</strong> a quitté <strong>${bienNom}</strong> aujourd'hui.</p>
            ${r.depot_garantie ? `<p>⚠️ <strong>Dépôt de garantie de ${r.depot_garantie}€</strong> en attente de restitution (72h maximum).</p>` : ''}
            <p style="margin-top:16px"><strong>Actions recommandées :</strong></p>
            <ul>
              <li>Vérifier l'état du logement</li>
              <li>${r.depot_garantie ? 'Restituer le dépôt de garantie sous 72h' : 'Demander un avis sur Airbnb/Booking'}</li>
              <li>Marquer la réservation comme terminée</li>
            </ul>
            <a href="https://bailo-bnb.netlify.app" 
               style="display:inline-block;background:#3b5bdb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:12px">
              Gérer dans Bailo →
            </a>
          </div>
        </div>`
      });
    }

    // Dépôt non restitué 3 jours après départ
    if (r.depot_garantie && r.depot_statut === 'en_attente' && r.statut === 'terminee') {
      const departPlus3 = addDays(new Date(r.depart), 3);
      if (todayStr === departPlus3) {
        emails.push({
          subject: `🔒 URGENT : Dépôt de garantie à restituer — ${r.guest_nom}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#ef4444;padding:20px;border-radius:12px 12px 0 0">
              <h2 style="color:white;margin:0">🔒 Dépôt de garantie</h2>
            </div>
            <div style="background:#f5f6fa;padding:20px;border-radius:0 0 12px 12px">
              <p>Le dépôt de garantie de <strong>${r.depot_garantie}€</strong> pour <strong>${r.guest_nom}</strong> doit être restitué.</p>
              <p>Délai légal : <strong>72h après le départ</strong> (départ le ${fmt(r.depart)}).</p>
              <a href="https://bailo-bnb.netlify.app" style="display:inline-block;background:#ef4444;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:12px">
                Gérer dans Bailo →
              </a>
            </div>
          </div>`
        });
      }
    }
  }

  // Envoyer tous les emails
  for (const email of emails) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Bailo Airbnb <noreply@bailo.pro>',
        to: [BAILLEUR_EMAIL],
        subject: email.subject,
        html: email.html
      })
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent: emails.length, checked: resas?.length || 0 })
  };
};
