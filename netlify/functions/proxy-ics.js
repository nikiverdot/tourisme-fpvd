// Proxy server-side pour les flux ICS FareHarbor/Winalist
// Les URLs des flux sont stockées dans les variables d'environnement Netlify — jamais exposées côté client.
exports.handler = async (event) => {
  // Mapping feed → variable d'environnement
  const FEEDS = {
    'fh-delorme':       process.env.ICS_FH_DELORME,
    'fh-bulle':         process.env.ICS_FH_BULLE,
    'winalist-bulle':   process.env.ICS_WINALIST_BULLE,
    'winalist-delorme': process.env.ICS_WINALIST_DELORME,
  };

  const feed = event.queryStringParameters && event.queryStringParameters.feed;
  if (!feed) {
    return { statusCode: 400, body: 'Paramètre feed manquant' };
  }

  const url = FEEDS[feed];
  if (!url) {
    return { statusCode: 400, body: 'Feed inconnu : ' + feed };
  }

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PiffautPlanning/1.0)' }
    });
    if (!resp.ok) {
      return { statusCode: resp.status, body: 'Erreur upstream: ' + resp.status };
    }
    const body = await resp.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': 'https://tourisme-fpvd.fr',
        'Cache-Control': 'no-store'
      },
      body
    };
  } catch (e) {
    return { statusCode: 502, body: 'Fetch échoué: ' + e.message };
  }
};
