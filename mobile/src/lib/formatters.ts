/**
 * formatters.ts
 *
 * Helper utilities to clean up raw database/JSON strings, enum codes,
 * and snake_case values into user-friendly display labels.
 */

/**
 * Humanizes snake_case, SCREAMING_SNAKE_CASE, or kebab-case strings into Title Case.
 * Example: 'PENDING_APPROVAL' -> 'Pending Approval'
 * Example: 'escrow_locked' -> 'Escrow Locked'
 */
export function humanizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Maps transaction and DAO status strings to user-friendly titles.
 */
export function formatStatusLabel(status?: string | null): string {
  if (!status) return 'Pending';
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case 'pending_approval':
      return 'Pending Approval';
    case 'pending_release':
      return 'Pending Release';
    case 'released':
      return 'Released';
    case 'requested':
      return 'Requested';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'completed':
      return 'Completed';
    case 'locked':
      return 'Locked';
    case 'active':
      return 'Active';
    case 'closed':
      return 'Closed';
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'in_progress':
      return 'In Progress';
    case 'draft':
      return 'Draft';
    default:
      return humanizeText(status);
  }
}

/**
 * Formats Philippine Peso currency cleanly.
 */
export function formatPhp(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
