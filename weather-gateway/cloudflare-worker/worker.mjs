import { createMetNorwayLocationforecastAdapter } from '../providers/met-norway-locationforecast-v2.mjs';
import { createHttpWeatherHandler } from '../runtime/http-weather-handler.mjs';
import { createCloudflareWeatherCache } from './cache-kv.mjs';

export default {
  async fetch(request, env) {
    const provider = createMetNorwayLocationforecastAdapter({
      userAgent: env?.MET_NORWAY_USER_AGENT || 'IRGEZTNE-Weather-Gateway/1.0 (+https://irgeztne.com/contact)'
    });
    const handle = createHttpWeatherHandler({
      provider,
      cache: createCloudflareWeatherCache(env?.WEATHER_CACHE)
    });
    return handle(request);
  }
};

