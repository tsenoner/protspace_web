---
'@protspace/app': patch
---

Centralize URL configuration

Introduces `config/urls.ts` as single source of truth for all URLs, ports, and domains.

**Changes:**

- New `config/urls.ts` with `PORTS`, `PRODUCTION_DOMAIN`, and `URLS` exports
- Updated `docs/.vitepress/config.mts` to import from central config
- Updated `app/src/config.ts` to import from central config
- Updated `app/vite.config.ts` to use `PORTS.app`
- Simplified `package.json` build script (uses `NODE_ENV` instead of `VITE_HOME_URL`)

**Benefits:** Type-safe, maintainable, single source of truth for all environment settings.
