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

export async function createMolstarViewer(container: HTMLElement): Promise<MolstarViewer> {
  await ensureMolstarResourcesLoaded();
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
