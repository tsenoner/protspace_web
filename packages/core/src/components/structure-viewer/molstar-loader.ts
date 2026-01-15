// Mol* dynamic loader and viewer factory

export const MOLSTAR_VERSION = '3.44.0';
const MOLSTAR_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS_URL = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;

export interface MolstarViewer {
  loadPdb: (pdbId: string) => Promise<void>;
  loadStructureFromUrl: (
    url: string,
    format?: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  dispose: () => void;
}

declare global {
  interface Window {
    molstar: {
      Viewer: {
        create: (
          target: string | HTMLElement,
          options?: {
            layoutIsExpanded?: boolean;
            layoutShowControls?: boolean;
            layoutShowRemoteState?: boolean;
            layoutShowSequence?: boolean;
            layoutShowLog?: boolean;
            layoutShowLeftPanel?: boolean;
            viewportShowExpand?: boolean;
            viewportShowSelectionMode?: boolean;
            viewportShowAnimation?: boolean;
            pdbProvider?: string;
            emdbProvider?: string;
            validationProvider?: string;
            extensions?: unknown[];
          },
        ) => Promise<MolstarViewer>;
      };
    };
  }
}

export async function ensureMolstarResourcesLoaded(): Promise<void> {
  if (!document.getElementById('molstar-script')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'molstar-script';
      script.src = MOLSTAR_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  if (!document.getElementById('molstar-style')) {
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.id = 'molstar-style';
      link.rel = 'stylesheet';
      link.href = MOLSTAR_CSS_URL;
      link.onload = () => resolve();
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }
}

// Install a global fetch interceptor once to silently block Molstar validation server requests.
// Molstar tries to fetch validation data from localhost:9000 by default, which doesn't exist
// in our setup. This interceptor prevents console errors without affecting functionality.
let validationInterceptorInstalled = false;

function installValidationInterceptor(): void {
  if (validationInterceptorInstalled) return;

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Extract URL from various input types
    let url: string | undefined;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else if (input instanceof URL) {
      url = input.href;
    }

    // Block Molstar validation server requests (they're optional and fail silently in Molstar anyway)
    if (url && (url.includes('localhost:9000') || url.includes('/v2/list_entries/'))) {
      return Promise.resolve(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    return originalFetch.call(this, input, init);
  };

  validationInterceptorInstalled = true;
}

export async function createMolstarViewer(container: HTMLElement): Promise<MolstarViewer> {
  await ensureMolstarResourcesLoaded();

  // Install fetch interceptor to suppress validation server errors
  installValidationInterceptor();

  const viewer = await window.molstar?.Viewer.create(container, {
    layoutIsExpanded: false,
    layoutShowControls: false,
    layoutShowRemoteState: false,
    layoutShowSequence: false,
    layoutShowLog: false,
    layoutShowLeftPanel: false,
    viewportShowExpand: false,
    viewportShowSelectionMode: false,
    viewportShowAnimation: false,
  });

  if (!viewer) {
    throw new Error('Failed to initialize Mol* viewer');
  }
  return viewer;
}
