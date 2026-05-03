import type {
  DataErrorEventDetail,
  LegendErrorEventDetail,
  SelectionDisabledNotificationDetail,
} from '@protspace/core';
import type { NotifyOptions } from '../lib/notify';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

export function getDatasetPersistenceFailureNotification(error: unknown): NotifyOptions {
  const title = 'Dataset loaded, but automatic reload is unavailable.';

  if (error instanceof DOMException && error.name === 'SecurityError') {
    return {
      title,
      description:
        'ProtSpace could not access browser storage. This usually happens in private/incognito mode or when browser storage is restricted. Reopen ProtSpace in a normal browser window to restore automatic dataset reloads.',
      durationMs: 12_000,
      dedupeKey: 'dataset-persistence-security-error',
    };
  }

  if (
    error instanceof Error &&
    error.message === 'Origin Private File System is not supported in this browser.'
  ) {
    return {
      title,
      description:
        'This browser does not support the Origin Private File System (OPFS) used to restore your last imported dataset after a page reload.',
      durationMs: 12_000,
      dedupeKey: 'dataset-persistence-unsupported',
    };
  }

  return {
    title,
    description:
      'ProtSpace could not save this dataset in browser storage, so you may need to import it again after reloading the page.',
    durationMs: 12_000,
    dedupeKey: 'dataset-persistence-generic',
  };
}

export function getCorruptedPersistedDatasetNotification(context: string): NotifyOptions {
  return {
    title: 'Saved dataset was cleared.',
    description: `The dataset previously stored in browser storage ${context}. ProtSpace removed it and loaded the default demo dataset instead.`,
    durationMs: 10_000,
    dedupeKey: 'persisted-dataset-corrupt',
  };
}

export function getDataLoadFailureNotification(detail: DataErrorEventDetail): NotifyOptions {
  return {
    title: 'Dataset import failed.',
    description: detail.message,
    durationMs: 10_000,
    dedupeKey: `data-error:${detail.message}`,
  };
}

export function getExportSuccessNotification(filename: string): NotifyOptions {
  return {
    title: 'Export ready.',
    description: filename,
    durationMs: 4_000,
  };
}

export function getExportFailureNotification(error: unknown): NotifyOptions {
  return {
    title: 'Export failed.',
    description: getErrorMessage(error),
    durationMs: 10_000,
    dedupeKey: `export-error:${getErrorMessage(error)}`,
  };
}

export function getSelectionDisabledNotification(
  detail: SelectionDisabledNotificationDetail,
): NotifyOptions {
  const reason = detail.context?.reason ?? 'unknown';
  const dataSize = detail.context?.dataSize ?? 'unknown';

  return {
    title: 'Selection mode disabled.',
    description: detail.message,
    durationMs: 5_000,
    dedupeKey: `selection-disabled:${reason}:${dataSize}`,
  };
}

export function getLegendErrorNotification(detail: LegendErrorEventDetail): NotifyOptions {
  return {
    title: 'Legend update failed.',
    description: detail.message,
    durationMs: 10_000,
    dedupeKey: `legend-error:${detail.source}:${detail.message}`,
  };
}

export interface RecoveryBannerCopy {
  title: string;
  body: string;
  retryLabel: string;
  loadDefaultLabel: string;
  clearLabel: string;
}

export function getLoadRecoveryCopy(
  fileName: string,
  failedAttempts: number,
  lastError?: string,
): RecoveryBannerCopy {
  if (failedAttempts >= 3) {
    return {
      title: 'This dataset has failed to load multiple times',
      body:
        `"${fileName}" has not finished loading after ${failedAttempts} attempts.` +
        (lastError ? ` Last error: ${lastError}.` : '') +
        ' Consider clearing it or loading the default demo bundle.',
      retryLabel: 'Try again',
      loadDefaultLabel: 'Load default',
      clearLabel: 'Clear stored data',
    };
  }

  return {
    title: 'Previous dataset did not finish loading',
    body:
      `"${fileName}" was not fully loaded last time` +
      (lastError ? ` (${lastError})` : '') +
      '. You can retry, switch to the default demo, or clear the stored copy.',
    retryLabel: 'Try again',
    loadDefaultLabel: 'Load default',
    clearLabel: 'Clear stored data',
  };
}
