# Centralized Configuration

Single source of truth for all URLs, ports, navigation, and environment settings.

## Structure

### URLs Configuration (`urls.ts`)

```typescript
PORTS = { app: 8080, docs: 5174 }
PRODUCTION_DOMAIN = 'https://protspace.app'
URLS = { production: {...}, development: {...} }
```

### Navigation Configuration (`navigation.ts`)

```typescript
NavItem = { text, link, internal?, target?, icon? }
getNavigation(mode) // Returns all navigation items
getPrimaryNavigation(mode) // Returns main nav (excludes external)
getExternalLinks(mode) // Returns external links only
```

## Usage

### URLs

```typescript
// VitePress config
import { getUrls } from '../../config/urls';
const urls = getUrls(mode);

// React app
import { getUrls } from '../../config/urls';
export const DOCS_URL = getUrls(mode).docs;
```

### Navigation

```typescript
// React app
import { getNavigation } from '../../config/navigation';
const navItems = getNavigation(mode);

// VitePress config
import { getPrimaryNavigation } from '../../config/navigation';
const primaryNav = getPrimaryNavigation(mode);
```

## Development Proxy

In development, the app server (`localhost:8080`) proxies `/docs` requests to the VitePress dev server (`localhost:5174`). This ensures that:

- Development and production use identical relative URLs (`/docs/`)
- No CORS issues when navigating between app and docs
- Simplified configuration (same URL structure in both environments)

The proxy is configured in `app/vite.config.ts`.

## Note

The docs port (`5174`) appears in both `config/urls.ts` and `package.json` for simplicity - ports rarely change.
