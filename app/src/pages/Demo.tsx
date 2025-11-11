import { useEffect } from 'react';
import './Demo.css';

const Demo = () => {
  useEffect(() => {
    // Import demo initialization
    import('../demo/main.ts');

    // Setup file drop handler
    const handleFileDrop = (e: CustomEvent) => {
      const file = e.detail.file;
      const loader = document.getElementById('myDataLoader') as any;
      if (file && loader) {
        loader.loadFromFile(file);
      }
    };

    const scatterplot = document.getElementById('myPlot');
    scatterplot?.addEventListener('file-dropped', handleFileDrop as EventListener);

    return () => {
      scatterplot?.removeEventListener('file-dropped', handleFileDrop as EventListener);
    };
  }, []);

  return (
    <div className="demo-wrapper">
      <div className="demo-container">
        <protspace-data-loader id="myDataLoader"></protspace-data-loader>

        <protspace-control-bar
          id="myControlBar"
          selected-projection="UMAP"
          selected-feature="family"
          selected-proteins-count="0"
          auto-sync="true"
          scatterplot-selector="#myPlot"
        ></protspace-control-bar>

        <div className="visualization-container">
          <protspace-scatterplot id="myPlot"></protspace-scatterplot>

          <div className="right-panel">
            <protspace-legend
              id="myLegend"
              auto-sync="true"
              auto-hide="true"
              scatterplot-selector="#myPlot"
            ></protspace-legend>
            <protspace-structure-viewer
              id="myStructureViewer"
              title="AlphaFold2 Structure"
              height="340px"
              show-header="true"
              show-close-button="true"
              show-tips="true"
              auto-sync="true"
              auto-show="true"
              scatterplot-selector="#myPlot"
              style={{ display: 'none' }}
            ></protspace-structure-viewer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
