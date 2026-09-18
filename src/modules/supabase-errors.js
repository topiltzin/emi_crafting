// Classifies a Supabase (Postgrest/Auth/Storage) error, or an app-level validation failure,
// into the three error codes callers (src/app.js) branch on: 'network', 'auth', 'validation'.
// See specs/004-supabase-data-migration/contracts/data-access.md, "Error surfacing contract".

export class DataAccessError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'DataAccessError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export function validationError(message) {
  return new DataAccessError(message, 'validation');
}

function isNetworkFailure(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true; // fetch() throws TypeError on network failure
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed') ||
    message.includes('timeout')
  );
}

function isAuthFailure(error) {
  if (!error) return false;
  if (error.name === 'AuthApiError' || error.name === 'AuthSessionMissingError') return true;
  if (error.status === 401 || error.status === 403) return true;
  return false;
}

export function classifySupabaseError(error, fallbackMessage = 'Something went wrong') {
  if (error instanceof DataAccessError) return error;

  const message = (error && error.message) || fallbackMessage;

  if (isNetworkFailure(error)) {
    return new DataAccessError(message, 'network', error);
  }

  if (isAuthFailure(error)) {
    return new DataAccessError(message, 'auth', error);
  }

  // Anything else from Postgrest/Storage (constraint violations, bad input, RLS denial that
  // isn't a plain 401/403) is treated as a validation-shaped failure the caller can display.
  return new DataAccessError(message, 'validation', error);
}

export function throwClassified(error, fallbackMessage) {
  throw classifySupabaseError(error, fallbackMessage);
}
