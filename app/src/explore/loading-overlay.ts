interface LoadingOverlayController {
  update(show: boolean, progress?: number, message?: string, subMessage?: string): void;
  dispose(): void;
}

export function createLoadingOverlayController(doc: Document = document): LoadingOverlayController {
  let overlayRemovalTimeout = 0;

  const update = (
    show: boolean,
    progress: number = 0,
    message: string = '',
    subMessage: string = '',
  ) => {
    let overlay = doc.getElementById('progressive-loading');

    if (!show) {
      if (overlay) {
        if (overlayRemovalTimeout) {
          clearTimeout(overlayRemovalTimeout);
        }
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        overlayRemovalTimeout = window.setTimeout(() => {
          overlay?.remove();
          overlayRemovalTimeout = 0;
        }, 500);
      }
      return;
    }

    if (overlayRemovalTimeout) {
      clearTimeout(overlayRemovalTimeout);
      overlayRemovalTimeout = 0;
    }

    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = 'progressive-loading';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-atomic', 'true');
      overlay.setAttribute('aria-busy', 'true');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,40,0.9));
        color: white; z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      overlay.innerHTML = `
        <div style="text-align: center; max-width: 500px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🚀 Loading ProtSpace</div>
          <div id="processing-text" style="font-size: 18px; margin-bottom: 20px;">
            ${subMessage}
          </div>
          <div style="width: 300px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 20px auto;">
            <div id="progress-bar" style="height: 100%; background: linear-gradient(90deg, #3b82f6, #06b6d4); border-radius: 2px; width: 0%; transition: width 0.3s ease;"></div>
          </div>
          <div id="progress-text" style="font-size: 14px; opacity: 0.8; margin-top: 10px;">
            ${message}
          </div>
        </div>
      `;
      doc.body.appendChild(overlay);
    } else {
      overlay.style.opacity = '1';
      overlay.style.transition = 'none';
    }

    overlay.setAttribute('aria-label', [subMessage, message].filter(Boolean).join('. '));

    const progressBar = doc.getElementById('progress-bar');
    const progressText = doc.getElementById('progress-text');
    const processingText = doc.getElementById('processing-text');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = message;
    if (processingText) processingText.textContent = subMessage;
  };

  return {
    update,
    dispose() {
      if (overlayRemovalTimeout) {
        clearTimeout(overlayRemovalTimeout);
        overlayRemovalTimeout = 0;
      }
      doc.getElementById('progressive-loading')?.remove();
    },
  };
}
