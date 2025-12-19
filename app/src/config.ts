/**
 * Application configuration
 *
 * Uses centralized URL configuration from root config/urls.ts
 */
import { getUrls } from '../../config/urls';

const mode = import.meta.env.MODE === 'production' ? 'production' : 'development';
const urls = getUrls(mode);

export const DOCS_URL = urls.docs;
export const EXPLORE_URL = urls.explore;
export const BASE_URL = urls.base;
