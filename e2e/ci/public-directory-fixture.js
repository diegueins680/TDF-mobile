const { createServer } = require('node:http');

// Read-only data for the real native UI. Never proxy requests to a live service.
function createPublicDirectoryFixture() {
  const requests = [];
  const location = { city: 'Quito', countryCode: 'EC', precision: 'city' };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1:18128').pathname;
    requests.push({ method: request.method, pathname });
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    let body;
    if (request.method !== 'GET') {
      response.statusCode = 405;
      body = { error: 'This UI fixture is read-only' };
    } else if (pathname === '/directory/taxonomies') {
      body = { locale: 'es', cities: [], professions: [], classifiedCategories: [],
        compensationTypes: [], serviceOfferings: [], currencies: [], instruments: [], genres: [], languages: [] };
    } else if (pathname === '/directory/search') {
      body = { items: [{ id: '42', type: 'event', slug: 'concierto-de-prueba',
        title: 'Concierto de prueba', location, score: 1, scoreBreakdown: {}, sponsored: false,
        taxonomy: { professionIds: [], serviceIds: [], instrumentIds: [], genreIds: [] },
        effectiveAt: '2030-04-10T20:00:00Z' }], sponsoredItems: [],
      facets: { entityTypes: { event: 1 }, cities: [], total: 1 }, nextCursor: null };
    } else if (pathname === '/directory/events/42') {
      body = { id: 42, title: 'Concierto de prueba', description: 'Evento sintético para comprobar la navegación pública.',
        startTime: '2030-04-10T20:00:00Z', endTime: '2030-04-10T22:00:00Z', timezone: 'UTC',
        location, canonicalUrl: '/eventos/42' };
    } else {
      response.statusCode = 404;
      body = { error: 'No fixture for this path' };
    }
    response.end(JSON.stringify(body));
  });
  return { server, requests };
}

module.exports = { createPublicDirectoryFixture };
