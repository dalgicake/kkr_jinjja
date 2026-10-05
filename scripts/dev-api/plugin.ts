// DEV ONLY — Vite plugin: `vite dev` serves /api/* by running api/*.ts (Vercel functions locally).
// apply: 'serve' (and never under Vitest), so `vite build` never sees it.
//
// Server env: .env files are loaded into process.env of the dev-server process only, for the
// handlers. Nothing goes through `define` / import.meta.env, and client-prefixed (VITE_) keys
// are skipped, so the client bundle is unaffected.
import { join } from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { createApiMiddleware } from './middleware.js';

type EnvTarget = Record<string, string | undefined>;

// Survives Vite's config re-bundle on restart (e.g. after .env.local changes) so a restart can
// replace the values this plugin injected instead of keeping stale ones.
const INJECTED_KEY = Symbol.for('kkr.devApi.injectedEnv');
function injectedStore(): Map<string, string> {
  const g = globalThis as { [INJECTED_KEY]?: Map<string, string> };
  return (g[INJECTED_KEY] ??= new Map());
}

/** Removes values a previous run injected (and nobody changed since). */
export function clearInjectedEnv(target: EnvTarget, injected: Map<string, string>): void {
  for (const [key, value] of injected) if (target[key] === value) delete target[key];
  injected.clear();
}

/**
 * Copies file env into `target` without overriding what the shell already set and without
 * client-prefixed keys. Returns the number of keys injected.
 */
export function applyServerEnv(
  fileEnv: Record<string, string>,
  target: EnvTarget,
  injected: Map<string, string>,
  clientPrefixes: readonly string[],
): number {
  let count = 0;
  for (const [key, value] of Object.entries(fileEnv)) {
    if (clientPrefixes.some((p) => key.startsWith(p))) continue;
    if (target[key] !== undefined) continue;
    target[key] = value;
    injected.set(key, value);
    count++;
  }
  return count;
}

function loadServerEnv(server: ViteDevServer): number {
  const { mode, envDir, envPrefix } = server.config;
  const injected = injectedStore();
  clearInjectedEnv(process.env, injected); // so loadEnv sees the files, not last run's values
  if (envDir === false) return 0;
  const fileEnv = loadEnv(mode, envDir, '');
  const prefixes = Array.isArray(envPrefix) ? envPrefix : [envPrefix ?? 'VITE_'];
  return applyServerEnv(fileEnv, process.env, injected, prefixes);
}

export function devApi(options: { dir?: string; bodyLimit?: number } = {}): Plugin {
  return {
    name: 'kkr:dev-api',
    apply: (_config, env) => env.command === 'serve' && env.mode !== 'test' && !process.env.VITEST,
    configureServer(server) {
      const logger = server.config.logger;
      const apiDir = join(server.config.root, options.dir ?? 'api');
      const count = loadServerEnv(server);
      logger.info(`dev-api: /api/* -> api/*.ts (${count} server env keys from .env files)`, {
        timestamp: true,
      });
      server.middlewares.use(
        createApiMiddleware({
          apiDir,
          bodyLimit: options.bodyLimit,
          loadModule: (file) => server.ssrLoadModule(file, { fixStacktrace: true }),
          onError: (error, file) => {
            const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
            logger.error(`dev-api: ${file ?? 'request'} failed\n${detail}`, { timestamp: true });
          },
        }),
      );
    },
  };
}
