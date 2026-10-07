import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function createFileWeatherCache(directory) {
  const root = path.resolve(directory);
  function fileFor(key) {
    return path.join(root, crypto.createHash('sha256').update(String(key)).digest('hex') + '.json');
  }
  return {
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(fileFor(key), 'utf8'));
      } catch (error) {
        if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async put(key, value) {
      await fs.mkdir(root, { recursive: true });
      const target = fileFor(key);
      const temporary = target + '.tmp';
      await fs.writeFile(temporary, JSON.stringify(value), 'utf8');
      await fs.rename(temporary, target);
    }
  };
}

