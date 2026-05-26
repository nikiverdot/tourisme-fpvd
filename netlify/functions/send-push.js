const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:mfverdot@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const DB_URL    = process.env.FIREBASE_DB_URL;
const DB_SECRET = process.env.FIREBASE_DB_SECRET;
const PUSH_SECRET = process.env.PUSH_SECRET; // secret partagé pour authentifier l'appel

async function fetchFirebase(path) {
  const url = `${DB_URL}/${path}.json?auth=${DB_SECRET}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Firebase ${res.status}`);
  return res.json();
}

exports.handler = async (event) => {
  // Vérification du secret
  if (event.headers['x-push-secret'] !== PUSH_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { title, message } = body;

    if (!title || !message) {
      return { statusCode: 400, body: 'Missing title or message' };
    }

    // Récupérer tous les abonnements
    const subscriptions = await fetchFirebase('piffaut-push-subscriptions');
    if (!subscriptions || Object.keys(subscriptions).length === 0) {
      return { statusCode: 200, body: 'No subscriptions' };
    }

    const payload = JSON.stringify({
      title,
      body:  message,
      url:   'https://tourisme-fpvd.fr'
    });

    const subList = Object.values(subscriptions);
    const results = await Promise.allSettled(
      subList.map(entry => {
        if (!entry?.subscription) return Promise.reject('no sub');
        return webpush.sendNotification(entry.subscription, payload);
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { statusCode: 200, body: `${sent} sent, ${failed} failed` };

  } catch (err) {
    console.error('send-push error:', err);
    return { statusCode: 500, body: String(err) };
  }
};
