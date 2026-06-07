// Proxy server-side pour l'API FareHarbor (évite CORS et corsproxy.io)
// Les clés API sont transmises par le client via headers custom et ne sont pas stockées ici.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://tourisme-fpvd.fr',
        'Access-Control-Allow-Headers': 'x-fh-app-key, x-fh-user-key',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const appKey  = event.headers['x-fh-app-key']  || '';
  const userKey = event.headers['x-fh-user-key'] || '';
  const url     = (event.queryStringParameters && event.queryStringParameters.url) || '';

  if (!appKey || !userKey) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Clés API FareHarbor manquantes' }) };
  }
  if (!url.startsWith('https://fareharbor.com/api/v1/')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'URL non autorisée' }) };
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'X-FareHarbor-API-App':  appKey,
        'X-FareHarbor-API-User': userKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    });
    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': 'https://tourisme-fpvd.fr',
        'Cache-Control': 'no-store',
      },
      body,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': 'https://tourisme-fpvd.fr' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
