import { openLink } from '@/features/reads/openLink';
import { apiOrigin } from './native';

/** Where the public pages live: the site origin set at build time, else the API's origin (native) or this page's (web). */
const site = (import.meta.env.VITE_SITE_ORIGIN as string | undefined) ?? (apiOrigin || window.location.origin);
export const LEGAL = {
  privacy: `${site}/legal/privacy.html`,
  healthPrivacy: `${site}/legal/health-privacy.html`,
  terms: `${site}/legal/terms.html`,
  acknowledgements: `${site}/legal/acknowledgements.html`,
} as const;
export const SUPPORT = `${site}/legal/support.html`;
/** Placeholder until VITE_SUPPORT_EMAIL is set. The release script fails on example.com. */
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'support@example.com';
export const openExternal = (url: string) => openLink(url);
