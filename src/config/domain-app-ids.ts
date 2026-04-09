/**
 * Centralized mapping of domains to their OAuth and legacy app IDs
 * This configuration maps each domain/environment to its corresponding:
 * - legacy_app_id: Used for the "app_id" parameter in OAuth requests (Deriv routing)
 * - new_app_id: OAuth 2.0 Client ID (used for authentication)
 */

export interface AppIDConfig {
    legacy_app_id: number;
    new_app_id: string;
}

export const DOMAIN_APP_IDS: Record<string, AppIDConfig> = {
    'new.dbtraders.com': {
        legacy_app_id: 108853,
        new_app_id: '32yLjK6GVP6Z85WvbLAfo',
    },
    'newdbtraders.vercel.app': {
        legacy_app_id: 108853,
        new_app_id: '32yLjK6GVP6Z85WvbLAfo',
    },
    // Fallback for localhost and development
    'localhost': {
        legacy_app_id: 108853,
        new_app_id: '32yLjK6GVP6Z85WvbLAfo',
    },
    // Fallback for ngrok URLs (match by prefix)
    'ngrok': {
        legacy_app_id: 108853,
        new_app_id: '32yLjK6GVP6Z85WvbLAfo',
    },
};

/**
 * Get app IDs for the current domain
 * Falls back to localhost config if domain not found
 * @returns AppIDConfig with legacy_app_id and new_app_id
 */
export const getCurrentDomainAppIDs = (): AppIDConfig => {
    const hostname = window.location.hostname;

    // Direct domain match
    if (DOMAIN_APP_IDS[hostname]) {
        return DOMAIN_APP_IDS[hostname];
    }

    // Try matching ngrok domains (they have random prefixes)
    if (hostname.includes('ngrok')) {
        return DOMAIN_APP_IDS['ngrok'];
    }

    // Try matching localhost variants (localhost:8443, localhost:3000, etc)
    if (hostname.startsWith('localhost')) {
        return DOMAIN_APP_IDS['localhost'];
    }

    // Fallback to localhost config
    console.warn(`[Config] Domain "${hostname}" not found in DOMAIN_APP_IDS, using localhost fallback`);
    return DOMAIN_APP_IDS['localhost'];
};

/**
 * Get the OAuth 2.0 Client ID for current domain
 * @returns Client ID (new_app_id)
 */
export const getCurrentClientID = (): string => {
    return getCurrentDomainAppIDs().new_app_id;
};

/**
 * Get the legacy app ID for current domain (used in OAuth redirect)
 * @returns Legacy app ID
 */
export const getCurrentLegacyAppID = (): number => {
    return getCurrentDomainAppIDs().legacy_app_id;
};
