// YYYY-MM-DD for the user's own calendar day. toISOString() would give the UTC day, which in the
// Americas turns "this evening" into tomorrow.
export function toLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The local calendar day after an ISO date string, as an ISO date string.
export function nextIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toLocalIsoDate(new Date(year, month - 1, day + 1));
}
