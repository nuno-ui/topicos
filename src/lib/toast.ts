/**
 * Typed toast helpers for consistent messaging across the app.
 * Wraps Sonner's toast API with domain-specific helpers.
 */
import { toast } from 'sonner';

/**
 * Show a success toast
 */
export function showSuccess(message: string) {
  toast.success(message);
}

/**
 * Show an error toast with optional retry action
 */
export function showError(message: string, onRetry?: () => void) {
  if (onRetry) {
    toast.error(message, {
      action: {
        label: 'Retry',
        onClick: onRetry,
      },
    });
  } else {
    toast.error(message);
  }
}

/**
 * Show an info toast
 */
export function showInfo(message: string) {
  toast.info(message);
}

/**
 * Show a warning toast
 */
export function showWarning(message: string) {
  toast.warning(message);
}

/**
 * Show a loading toast that can be updated when the operation completes.
 * Returns a function to dismiss/update the toast.
 */
export function showLoading(message: string): {
  success: (msg: string) => void;
  error: (msg: string) => void;
  dismiss: () => void;
} {
  const id = toast.loading(message);
  return {
    success: (msg: string) => toast.success(msg, { id }),
    error: (msg: string) => toast.error(msg, { id }),
    dismiss: () => toast.dismiss(id),
  };
}

/**
 * Show a promise-based toast that automatically tracks loading/success/error states.
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) {
  return toast.promise(promise, messages);
}

/**
 * Domain-specific toast helpers
 */
export const toasts = {
  // Sync operations
  syncStarted: () => showInfo('Syncing all sources...'),
  syncComplete: (count: number) => showSuccess(`Sync complete: ${count} new items`),
  syncFailed: () => showError('Sync failed. Please try again.'),

  // Topic operations
  topicCreated: (title: string) => showSuccess(`Created topic "${title}"`),
  topicUpdated: () => showSuccess('Topic updated'),
  topicDeleted: () => showSuccess('Topic moved to archive'),
  topicError: (action: string) => showError(`Failed to ${action} topic`),

  // Contact operations
  contactCreated: (name: string) => showSuccess(`Added contact "${name}"`),
  contactUpdated: () => showSuccess('Contact updated'),
  contactEnriched: () => showSuccess('Contact enriched with AI'),
  contactError: (action: string) => showError(`Failed to ${action} contact`),

  // AI operations
  agentStarted: (agent: string) => showInfo(`Running ${agent.replace(/_/g, ' ')}...`),
  agentComplete: (agent: string) => showSuccess(`${agent.replace(/_/g, ' ')} complete`),
  agentFailed: (agent: string) => showError(`${agent.replace(/_/g, ' ')} failed`),

  // General
  copied: (item?: string) => showSuccess(item ? `${item} copied to clipboard` : 'Copied to clipboard'),
  saved: () => showSuccess('Changes saved'),
  deleted: (item: string) => showSuccess(`${item} deleted`),
  notFound: (item: string) => showError(`${item} not found`),
  permissionDenied: () => showError('You don\'t have permission to do this'),
  networkError: () => showError('Network error. Please check your connection.'),
  rateLimited: (seconds: number) => showInfo(`Please wait ${seconds}s before trying again`),
} as const;
