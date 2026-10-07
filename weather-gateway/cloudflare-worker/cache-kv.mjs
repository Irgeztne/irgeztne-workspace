import { createMemoryWeatherCache } from '../core/weather-core.mjs';

const fallback = createMemoryWeatherCache();

export function createCloudflareWeatherCache(namespace) {
  if (!namespace || typeof namespace.get !== 'function' || typeof namespace.put !== 'function') return fallback;
  return {
    async get(key) {
      const value = await namespace.get(String(key), { type: 'json' });
      return value && typeof value === 'object' ? value : null;
    },
    async put(key, value, options = {}) {
      const ttl = Math.max(60, Number(options.ttlSeconds) || 7 * 24 * 60 * 60);
      await namespace.put(String(key), JSON.stringify(value), { expirationTtl: ttl });
    }
  };
}

