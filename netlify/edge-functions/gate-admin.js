// Protection temporaire par mot de passe HTTP Basic Auth, le temps de
// reconstruire un vrai système de connexion par utilisateur sur Bailo Bnb.
// Bnb n'a actuellement AUCUNE authentification : toute personne visitant
// bnb.bailo.pro accède directement aux données (réservations, messages,
// codes d'accès). En attendant la vraie réparation, on verrouille l'accès
// à la page d'administration (index.html) uniquement.
//
// sejour.html (page destinée aux voyageurs) et les fonctions Netlify
// (webhooks, cron) restent volontairement accessibles sans mot de passe.

const USERNAME = 'bailo';
const PASSWORD = 'ChangeMoi2026!'; // À changer par Sébastien après activation

export default async (request, context) => {
  const url = new URL(request.url);

  // Ne jamais bloquer la page voyageurs ni les fonctions Netlify (cron, notifs)
  if (
    url.pathname.startsWith('/sejour.html') ||
    url.pathname.startsWith('/.netlify/functions/')
  ) {
    return context.next();
  }

  const auth = request.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${USERNAME}:${PASSWORD}`);

  if (auth !== expected) {
    return new Response('Authentification requise — accès Bailo Bnb restreint.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Bailo Bnb - Acces restreint"',
      },
    });
  }

  return context.next();
};

export const config = { path: '/*' };
