/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    'protspace-control-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'selected-projection'?: string;
      'selected-feature'?: string;
      'selected-proteins-count'?: string;
      'auto-sync'?: string;
      'scatterplot-selector'?: string;
    }, HTMLElement>;
    'protspace-scatterplot': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'protspace-data-loader': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'protspace-legend': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'auto-sync'?: string;
      'auto-hide'?: string;
      'scatterplot-selector'?: string;
    }, HTMLElement>;
    'protspace-structure-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      title?: string;
      height?: string;
      'show-header'?: string;
      'show-close-button'?: string;
      'show-tips'?: string;
      'auto-sync'?: string;
      'auto-show'?: string;
      'scatterplot-selector'?: string;
    }, HTMLElement>;
  }
}
