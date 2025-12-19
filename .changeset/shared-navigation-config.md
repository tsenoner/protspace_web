---
'@protspace/app': patch
---

Add shared navigation configuration

Introduces `config/navigation.ts` as single source of truth for navigation items across the app and docs, ensuring consistent menu structure.

**Changes:**

- New `config/navigation.ts` with `NavItem` interface and `getNavigation()` helpers
- Updated `app/src/components/Header.tsx` to use shared navigation config
- Updated `docs/.vitepress/config.mts` to use shared navigation config
- Navigation items now defined once and consumed by both React app and VitePress

**Benefits:** Guaranteed synchronization of navigation items, easier maintenance, type-safe navigation structure.
