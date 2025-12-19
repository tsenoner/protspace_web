import { useEffect } from 'react';
import Header from '@/components/Header';
import './Explore.css';

const Explore = () => {
  useEffect(() => {
    let mounted = true;
    let scatterplot: HTMLElement | null = null;

    // Setup file drop handler
    const handleFileDrop = (e: CustomEvent) => {
      const file = e.detail.file;
      const loader = document.getElementById('myDataLoader') as any;
      if (file && loader) {
        loader.loadFromFile(file);
      }
    };

    // Initialize demo asynchronously
    const init = async () => {
      try {
        // Import and initialize demo
        const { initializeDemo } = await import('../demo/main.ts');

        // Only proceed if component is still mounted
        if (!mounted) return;

        // Wait for custom elements to be defined and initialized
        await initializeDemo();

        // Setup file drop handler after initialization
        if (mounted) {
          scatterplot = document.getElementById('myPlot');
          scatterplot?.addEventListener('file-dropped', handleFileDrop as EventListener);
        }
      } catch (error) {
        console.error('Failed to initialize demo:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      if (scatterplot) {
        scatterplot.removeEventListener('file-dropped', handleFileDrop as EventListener);
      }
    };
  }, []);

  return (
    <div className="h-screen w-full bg-[#f4f4f4] flex flex-col overflow-y-auto">
      <div className="h-16 flex-none z-50">
        <Header />
      </div>
      <div className="explore-wrapper flex-1 relative min-h-[600px]">
        <div className="explore-container h-full">
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
    </div>
  );
};

export default Explore;
