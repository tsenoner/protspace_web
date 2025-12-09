---
'@protspace/app': patch
---

Centralize URL configuration and add development proxy

Introduces `config/urls.ts` as single source of truth for all URLs, ports, and domains. Additionally, configures a development proxy to make dev/prod behavior consistent.

**Changes:**

- New `config/urls.ts` with `PORTS`, `PRODUCTION_DOMAIN`, and `URLS` exports
- Updated `docs/.vitepress/config.mts` to import from central config
- Updated `app/src/config.ts` to import from central config
- Updated `app/vite.config.ts` to use `PORTS.app` and proxy `/docs` to VitePress dev server
- Development now uses relative paths (`/docs/`) matching production behavior
- Simplified `package.json` build script (uses `NODE_ENV` instead of `VITE_HOME_URL`)

**Benefits:** Type-safe, maintainable, single source of truth for all environment settings. Dev/prod parity with identical URL structures.
