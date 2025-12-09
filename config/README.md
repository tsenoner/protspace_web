# Centralized Configuration

Single source of truth for all URLs, ports, and environment settings.

## Structure

```typescript
PORTS = { app: 8080, docs: 5174 }
PRODUCTION_DOMAIN = 'https://protspace.app'
URLS = { production: {...}, development: {...} }
```

## Usage

```typescript
// VitePress config
import { getUrls, buildUrl } from '../../config/urls';
const urls = getUrls(mode);

// React app
import { getUrls, PORTS } from '../../config/urls';
export const DOCS_URL = getUrls(mode).docs;
```

## Development Proxy

In development, the app server (`localhost:8080`) proxies `/docs` requests to the VitePress dev server (`localhost:5174`). This ensures that:

- Development and production use identical relative URLs (`/docs/`)
- No CORS issues when navigating between app and docs
- Simplified configuration (same URL structure in both environments)

The proxy is configured in `app/vite.config.ts`.

## Note

The docs port (`5174`) appears in both `config/urls.ts` and `package.json` for simplicity - ports rarely change.
