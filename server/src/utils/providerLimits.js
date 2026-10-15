/**
 * utils/providerLimits.js
 *
 * Single source of truth for:
 *   • Per-provider default hourly sending limits (campaigns)
 *   • Mail-account limits (per user / per group)
 *
 * Used by campaigns.controller.js, campaignMailer.service.js and
 * routes/inbox/accounts.js so the numbers never drift apart again.
 */

// ── Default emails / hour per From account, by provider ─────────────
export const PROVIDER_HOURLY_LIMITS = {
  gmail:  40,
  gsuite: 150,
  rediff: 30,
  yahoo:  10,
  amazon: 60,
  custom: 60,
};

// Older accounts were saved with provider "redff" (typo) — map aliases
// so they still pick up the Rediff limit.
const PROVIDER_ALIASES = {
  redff: "rediff",
  rediffmail: "rediff",
  googleworkspace: "gsuite",
  workspace: "gsuite",
  ymail: "yahoo",
};

export function normalizeProvider(provider) {
  const key = String(provider || "custom").toLowerCase().trim();
  return PROVIDER_ALIASES[key] || key;
}

export function getProviderLimit(provider) {
  const key = normalizeProvider(provider);
  return PROVIDER_HOURLY_LIMITS[key] || PROVIDER_HOURLY_LIMITS.custom;
}

/**
 * Hourly limit for one account in a campaign.
 * A per-campaign custom limit (customLimits[accountId]) wins over the default.
 */
export function getAccountHourlyLimit(provider, accountId = null, customLimits = {}) {
  if (accountId != null && customLimits && customLimits[accountId]) {
    return Number(customLimits[accountId]);
  }
  return getProviderLimit(provider);
}

// ── Mail-account limits ─────────────────────────────────────────────
export const MAX_ACCOUNTS_PER_USER  = 70;
export const MAX_ACCOUNTS_PER_GROUP = 8;