/**
 * TypeScript declarations for ProtSpace custom web components
 */

declare namespace JSX {
  interface IntrinsicElements {
    'protspace-data-loader': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
      },
      HTMLElement
    >;
    'protspace-control-bar': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
        'selected-projection'?: string;
        'selected-feature'?: string;
        'selected-proteins-count'?: string;
        'auto-sync'?: string;
        'scatterplot-selector'?: string;
      },
      HTMLElement
    >;
    'protspace-scatterplot': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
      },
      HTMLElement
    >;
    'protspace-legend': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
        'auto-sync'?: string;
        'auto-hide'?: string;
        'scatterplot-selector'?: string;
      },
      HTMLElement
    >;
    'protspace-structure-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
        title?: string;
        height?: string;
        'show-header'?: string;
        'show-close-button'?: string;
        'show-tips'?: string;
        'auto-sync'?: string;
        'auto-show'?: string;
        'scatterplot-selector'?: string;
      },
      HTMLElement
    >;
  }
}

