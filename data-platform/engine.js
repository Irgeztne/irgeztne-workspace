import { startServer } from './src/server.js';
import { refreshSnapshot } from './src/refresh.js';

if (process.argv.includes('--refresh-only')) {
  const snapshot = await refreshSnapshot();
  console.log(`[IRGEZTNE Data Platform] ${snapshot.series.length} series refreshed`);
  process.exit(0);
}

await startServer();
