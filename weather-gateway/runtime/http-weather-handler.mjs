import { createWeatherGateway } from '../core/weather-core.mjs';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60'
  };
}

export function createHttpWeatherHandler(options = {}) {
  const gateway = createWeatherGateway(options);
  return async function handle(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...corsHeaders(), Allow: 'GET, OPTIONS' }
      });
    }
    if (url.pathname === '/weather/v1/health') {
      return new Response(JSON.stringify({ ok: true, api_version: 'weather.v1' }), {
        status: 200,
        headers: corsHeaders()
      });
    }
    if (url.pathname !== '/weather/v1' && url.pathname !== '/weather/v1/') {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: corsHeaders() });
    }
    const result = await gateway.getForecast({
      lat: url.searchParams.get('lat'),
      lon: url.searchParams.get('lon'),
      altitude: url.searchParams.get('altitude'),
      force: url.searchParams.get('refresh') === '1'
    });
    return new Response(JSON.stringify(result.payload), { status: result.statusCode, headers: corsHeaders() });
  };
}

