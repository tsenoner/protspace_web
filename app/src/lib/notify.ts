import { toast } from '../components/ui/sonner';

export interface NotifyOptions {
  title: string;
  description?: string;
  durationMs?: number;
  dedupeKey?: string;
}

type NotifyLevel = 'success' | 'info' | 'warning' | 'error';

const DEFAULT_DURATIONS_MS: Record<NotifyLevel, number> = {
  success: 4_000,
  info: 5_000,
  warning: 8_000,
  error: 10_000,
};

const DEDUPE_WINDOW_MS = 5_000;
const recentNotifications = new Map<string, number>();

function pruneExpiredDedupes(now: number): void {
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp >= DEDUPE_WINDOW_MS) {
      recentNotifications.delete(key);
    }
  }
}

function shouldSkipNotification(dedupeKey?: string): boolean {
  if (!dedupeKey) {
    return false;
  }

  const now = Date.now();
  pruneExpiredDedupes(now);

  const previousTimestamp = recentNotifications.get(dedupeKey);
  if (previousTimestamp && now - previousTimestamp < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentNotifications.set(dedupeKey, now);
  return false;
}

function emitNotification(level: NotifyLevel, options: NotifyOptions): void {
  if (shouldSkipNotification(options.dedupeKey)) {
    return;
  }

  const description = options.description?.trim();
  const duration = options.durationMs ?? DEFAULT_DURATIONS_MS[level];

  toast[level](options.title, {
    description,
    duration,
  });
}

export const notify = {
  success(options: NotifyOptions): void {
    emitNotification('success', options);
  },
  info(options: NotifyOptions): void {
    emitNotification('info', options);
  },
  warning(options: NotifyOptions): void {
    emitNotification('warning', options);
  },
  error(options: NotifyOptions): void {
    emitNotification('error', options);
  },
};

export function resetNotifyStateForTests(): void {
  recentNotifications.clear();
}
