// Proxy server-side pour les flux ICS FareHarbor/Winalist (contourne CORS)
exports.handler = async (event) => {
  const url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url) {
    return { statusCode: 400, body: 'Paramètre url manquant' };
  }

  // Sécurité : autoriser seulement les domaines connus
  const allowed = ['fareharbor.com', 'winalist.fr', 'winalist.com'];
  let hostname;
  try { hostname = new URL(url).hostname; } catch(e) {
    return { statusCode: 400, body: 'URL invalide' };
  }
  if (!allowed.some(d => hostname.endsWith(d))) {
    return { statusCode: 403, body: 'Domaine non autorisé' };
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
