// The tutorial link's cache IS the `photos.tutorial_link` JSONB column (see data-model.md) —
// there's no separate cache table/store. This module only decides *when* cached metadata
// should be treated as stale enough to warrant a background refresh.

const DEFAULT_MAX_AGE_DAYS = 30;

/**
 * @param {{addedAt?: string, metadataReady?: boolean}|null} tutorialLink
 * @param {number} maxAgeDays
 * @returns {boolean} true if the cached metadata is old enough to refresh, or was never
 *   successfully fetched in the first place (metadataReady === false)
 */
export function isMetadataStale(tutorialLink, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  if (!tutorialLink) return false;
  if (tutorialLink.metadataReady === false) return true;
  if (!tutorialLink.addedAt) return false;

  const addedAt = new Date(tutorialLink.addedAt);
  if (Number.isNaN(addedAt.getTime())) return false;

  const ageMs = Date.now() - addedAt.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

/** Invalidation is just overwriting the field — exposed here so callers don't reach into db.js
 * directly and so the "what counts as invalidation" decision lives in one place. */
export function buildInvalidatedTutorialLink(newMetadata) {
  return { ...newMetadata, addedAt: new Date().toISOString(), metadataReady: true };
}
