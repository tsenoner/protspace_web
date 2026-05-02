import { type RecoveryBannerCopy, getLoadRecoveryCopy } from './notifications';

interface RecoveryBannerHandlers {
  onRetry(): Promise<void> | void;
  onLoadDefault(): Promise<void> | void;
  onClear(): Promise<void> | void;
}

interface ShowRecoveryBannerParams {
  fileName: string;
  failedAttempts: number;
  lastError?: string;
  handlers: RecoveryBannerHandlers;
  /** Mount target — defaults to document.body. */
  parent?: HTMLElement;
}

const BANNER_ID = 'protspace-recovery-banner';

export function dismissRecoveryBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

export function showRecoveryBanner(params: ShowRecoveryBannerParams): void {
  dismissRecoveryBanner();

  const copy: RecoveryBannerCopy = getLoadRecoveryCopy(
    params.fileName,
    params.failedAttempts,
    params.lastError,
  );
  const blocking = params.failedAttempts >= 3;

  const root = document.createElement('div');
  root.id = BANNER_ID;
  root.className =
    'fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[90%] ' +
    'rounded-lg border border-amber-400 bg-amber-50 text-amber-900 ' +
    'shadow-lg p-4 flex flex-col gap-3 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700';
  root.setAttribute('role', 'alert');

  const title = document.createElement('div');
  title.className = 'font-semibold text-sm';
  title.textContent = copy.title;

  const body = document.createElement('div');
  body.className = 'text-sm';
  body.textContent = copy.body;

  const actions = document.createElement('div');
  actions.className = 'flex gap-2 justify-end pt-1';

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className =
    'px-3 py-1 rounded text-sm font-medium ' +
    (blocking
      ? 'bg-amber-200 text-amber-700 cursor-not-allowed dark:bg-amber-900 dark:text-amber-400'
      : 'bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700');
  retryButton.textContent = copy.retryLabel;
  retryButton.disabled = blocking;
  retryButton.addEventListener('click', () => {
    void params.handlers.onRetry();
  });

  const defaultButton = document.createElement('button');
  defaultButton.type = 'button';
  defaultButton.className =
    'px-3 py-1 rounded text-sm font-medium border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900';
  defaultButton.textContent = copy.loadDefaultLabel;
  defaultButton.addEventListener('click', () => {
    void params.handlers.onLoadDefault();
  });

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className =
    'px-3 py-1 rounded text-sm font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900';
  clearButton.textContent = copy.clearLabel;
  clearButton.addEventListener('click', () => {
    void params.handlers.onClear();
  });

  actions.append(retryButton, defaultButton, clearButton);
  root.append(title, body, actions);

  (params.parent ?? document.body).appendChild(root);
}
