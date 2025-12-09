/**
 * Centralized configuration for ProtSpace web application
 *
 * Single source of truth for all URLs, ports, and deployment settings.
 */

// Development server ports
export const PORTS = {
  app: 8080,
  docs: 5174, // Note: must match package.json "dev:docs" script port
} as const;

// Production domain
export const PRODUCTION_DOMAIN = 'https://protspace.app';

// URL configuration for each environment
export const URLS = {
  production: {
    base: PRODUCTION_DOMAIN,
    docs: '/docs/',
    explore: '/explore',
  },
  development: {
    base: `http://localhost:${PORTS.app}`,
    docs: `http://localhost:${PORTS.docs}/docs/`,
    explore: '/explore',
  },
} as const;

export type Environment = keyof typeof URLS;

/**
 * Get URLs for the specified environment
 */
export const getUrls = (mode: Environment) => URLS[mode];

/**
 * Construct full URL from base + path
 */
export const buildUrl = (mode: Environment, path: keyof typeof URLS.production) => {
  const urls = URLS[mode];
  if (path === 'base') return urls.base;
  return `${urls.base}${urls[path]}`;
};
