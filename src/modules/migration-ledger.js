// Local (per-browser, not Supabase) record of migration progress — see data-model.md's
// "migration_ledger" section. Lets a partially-completed migration resume without re-uploading
// already-migrated photos or creating duplicates (FR-010).
const LEDGER_KEY = 'emi-craft-migration-ledger';
const STATUS_KEY = 'emi-craft-migration-status';
const VALID_STATUSES = new Set(['not_started', 'in_progress', 'completed']);

export function getMigrationStatus() {
  const status = localStorage.getItem(STATUS_KEY);
  return VALID_STATUSES.has(status) ? status : 'not_started';
}

export function setMigrationStatus(status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid migration status: ${status}`);
  }
  localStorage.setItem(STATUS_KEY, status);
}

export function buildLocalPhotoKey(albumDate, filename, uploadDate) {
  return `${albumDate}:${filename}:${uploadDate}`;
}

export function isPhotoMigrated(localPhotoKey) {
  return Object.prototype.hasOwnProperty.call(loadLedger(), localPhotoKey);
}

export function recordMigratedPhoto(localPhotoKey, cloudPhotoId) {
  const ledger = loadLedger();
  ledger[localPhotoKey] = { cloud_photo_id: cloudPhotoId, migrated_at: new Date().toISOString() };
  saveLedger(ledger);
}

function loadLedger() {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLedger(ledger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

// Test-only helper.
export function resetMigrationLedgerForTests() {
  localStorage.removeItem(LEDGER_KEY);
  localStorage.removeItem(STATUS_KEY);
}
