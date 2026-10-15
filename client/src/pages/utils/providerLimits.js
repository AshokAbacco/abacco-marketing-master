// src/pages/utils/providerLimits.js
// Keep in sync with server/src/utils/providerLimits.js

// Default emails / hour per From account, by provider
export const PROVIDER_HOURLY_LIMITS = {
  gmail:  40,
  gsuite: 150,
  rediff: 30,
  yahoo:  10,
  amazon: 60,
  custom: 60,
};

// Older accounts were saved with provider "redff" (typo)
const PROVIDER_ALIASES = {
  redff: "rediff",
  rediffmail: "rediff",
  googleworkspace: "gsuite",
  workspace: "gsuite",
  ymail: "yahoo",
};

export const PROVIDER_LABELS = {
  gmail: "Gmail",
  gsuite: "GSuite",
  rediff: "Rediff",
  yahoo: "Yahoo",
  amazon: "Amazon",
  custom: "Custom",
};

export function normalizeProvider(provider) {
  const key = String(provider || "custom").toLowerCase().trim();
  return PROVIDER_ALIASES[key] || key;
}

export function getProviderLimit(provider) {
  const key = normalizeProvider(provider);
  return PROVIDER_HOURLY_LIMITS[key] || PROVIDER_HOURLY_LIMITS.custom;
}

// Mail-account limits
export const MAX_ACCOUNTS_PER_USER  = 70;
export const MAX_ACCOUNTS_PER_GROUP = 8;