const { schedule } = require('@netlify/functions');
const webpush = require('web-push');

// ── Config VAPID (variables d'environnement Netlify) ──────────────────────────
webpush.setVapidDetails(
  'mailto:mfverdot@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const DB_URL    = process.env.FIREBASE_DB_URL;    // ex: https://planning-tourisme-default-rtdb.europe-west1.firebasedatabase.app
const DB_SECRET = process.env.FIREBASE_DB_SECRET; // legacy secret Firebase

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchFirebase(path) {
  const url = `${DB_URL}/${path}.json?auth=${DB_SECRET}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Firebase fetch error: ${res.status}`);
  return res.json();
}

function todayKeyFrance() {
  // 07:00 UTC = 09:00 Paris (été CEST) / 08:00 Paris (hiver CET)
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const DAYS_FR   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function formatDateFR(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${DAYS_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]}`;
}

function buildBoutiqueSummary(boutique, boutiqueData, todayKey) {
  const rawBookings = boutiqueData?.bookings?.[todayKey];
  const bks = rawBookings
    ? (Array.isArray(rawBookings) ? rawBookings : Object.values(rawBookings)).filter(Boolean)
    : [];
  const totalPax = bks.reduce((s, b) => s + (parseInt(b?.pax) || 0), 0);

  // Statuts employés
  const employees = boutiqueData?.employees || [];
  const schedule  = boutiqueData?.schedule  || {};
  const dayData   = schedule[todayKey] || {};
  const ABBR = { va:'VA', ad:'AD', conges:'CP', repos:'REPOS', off:'—', absent:'ABS', formation:'FORM' };
  const empLine = employees
    .map(e => {
      const s = dayData[e];
      return s ? `${e.split(' ')[0]}: ${ABBR[s] || s}` : null;
    })
    .filter(Boolean)
    .join(' · ');

  if (bks.length === 0) {
    return empLine ? `Pas de visite\n${empLine}` : 'Pas de visite';
  }
  const visitLine = `${bks.length} visite${bks.length > 1 ? 's' : ''} · ${totalPax} pax`;
  return empLine ? `${visitLine}\n${empLine}` : visitLine;
}

// ── Handler principal ─────────────────────────────────────────────────────────
const handler = async () => {
  try {
    const todayKey = todayKeyFrance();
    const dateLabel = formatDateFR(todayKey);

    // Récupérer abonnements push
    const subscriptions = await fetchFirebase('piffaut-push-subscriptions');
    if (!subscriptions || Object.keys(subscriptions).length === 0) {
      console.log('No push subscriptions found.');
      return { statusCode: 200, body: 'No subscriptions' };
    }

    // Récupérer les données du planning
    const data = await fetchFirebase('planning-piffaut-v1');
    if (!data?.boutiques) return { statusCode: 200, body: 'No planning data' };

    const bulleLine   = buildBoutiqueSummary('bulle',   data.boutiques.bulle,   todayKey);
    const delormeLine = buildBoutiqueSummary('delorme', data.boutiques.delorme, todayKey);

    const payload = JSON.stringify({
      title: `📅 ${dateLabel}`,
      body:  `🫧 Bulle — ${bulleLine}\n🍾 André Delorme — ${delormeLine}`,
      url:   'https://tourisme-fpvd.fr'
    });

    // Envoyer à tous les appareils abonnés
    const subList = Object.values(subscriptions);
    const results = await Promise.allSettled(
      subList.map(entry => {
        if (!entry?.subscription) return Promise.reject('no sub');
        return webpush.sendNotification(entry.subscription, payload);
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`Push sent: ${sent} ok, ${failed} failed`);
    return { statusCode: 200, body: `${sent} sent, ${failed} failed` };

  } catch (err) {
    console.error('daily-push error:', err);
    return { statusCode: 500, body: String(err) };
  }
};

// Exécution à 07:00 UTC = 09:00 Paris (été) / 08:00 Paris (hiver)
exports.handler = schedule('0 7 * * *', handler);
