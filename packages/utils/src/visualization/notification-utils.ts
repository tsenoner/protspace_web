export interface NotificationOptions {
  type?: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxWidth?: string;
}

export interface NotificationStyles {
  background: string;
  color: string;
  position: {
    top?: string;
    right?: string;
    left?: string;
    bottom?: string;
  };
}

const NOTIFICATION_STYLES: Record<string, NotificationStyles> = {
  info: {
    background: 'rgba(23, 162, 184, 0.9)',
    color: '#0c5460',
    position: { top: '20px', right: '20px' },
  },
  warning: {
    background: 'rgba(255, 193, 7, 0.9)',
    color: '#856404',
    position: { top: '20px', right: '20px' },
  },
  error: {
    background: 'rgba(220, 53, 69, 0.9)',
    color: '#721c24',
    position: { top: '20px', right: '20px' },
  },
  success: {
    background: 'rgba(40, 167, 69, 0.9)',
    color: '#155724',
    position: { top: '20px', right: '20px' },
  },
};

const POSITION_STYLES: Record<string, Partial<NotificationStyles['position']>> = {
  'top-right': { top: '20px', right: '20px' },
  'top-left': { top: '20px', left: '20px' },
  'bottom-right': { bottom: '20px', right: '20px' },
  'bottom-left': { bottom: '20px', left: '20px' },
};

/**
 * Show a temporary notification to the user
 * This is an optional utility that can be used by applications
 * Most frameworks have better notification systems, so this is just a fallback
 */
export function showNotification(message: string, options: NotificationOptions = {}): void {
  const { type = 'info', duration = 3000, position = 'top-right', maxWidth = '300px' } = options;

  const styles = NOTIFICATION_STYLES[type];
  const positionStyle = POSITION_STYLES[position];

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; 
    z-index: 10000;
    background: ${styles.background}; 
    color: ${styles.color}; 
    padding: 12px 16px;
    border-radius: 6px; 
    font-size: 14px; 
    max-width: ${maxWidth};
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ${Object.entries(positionStyle)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ')};
  `;
  notification.innerHTML = message;

  // Add animation styles if not already present
  if (!document.getElementById('protspace-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'protspace-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after duration
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

/**
 * Event detail for selection-disabled notifications
 */
export interface SelectionDisabledEventDetail {
  reason: string;
  dataSize: number;
  message: string;
}

/**
 * Create a standardized selection-disabled event
 */
export function createSelectionDisabledEvent(
  reason: string,
  dataSize: number,
): CustomEvent<SelectionDisabledEventDetail> {
  const message =
    reason === 'insufficient-data'
      ? `Selection mode disabled: Only ${dataSize} point${dataSize !== 1 ? 's' : ''} remaining`
      : 'Selection mode disabled';

  return new CustomEvent('selection-disabled-notification', {
    detail: { reason, dataSize, message },
    bubbles: true,
    composed: true,
  });
}
