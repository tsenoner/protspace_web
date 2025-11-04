/**
 * Integration stories demonstrating scatterplot and legend interactions
 * Shows how components work together with auto-sync and manual coordination
 */

import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "@protspace/core";
import {
  generateMediumData,
  generateLargeData,
  generateManyFeaturesData,
  generateDataWithNulls,
  generateOverlappingData,
} from "./mock-data";

const meta: Meta = {
  title: "Integration/Scatterplot + Legend",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Integration stories showing how the scatterplot and legend components work together with synchronized interactions.",
      },
    },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;


/**
 * Demonstrates interactive click-to-hide/show with single-click toggling and double-click isolation of categories.
 */
export const BasicIntegration: Story = {
  render: () => {
    const data = generateMediumData();
    const featureValues = data.protein_ids.map(
      (_, i) => data.features.family.values[data.feature_data.family[i]],
    );

    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      const plot = e.target as any;

      // Handle selection based on modifier keys
      if (modifierKeys.ctrl || modifierKeys.shift) {
        // Multi-selection mode
        if (selectedProteins.includes(proteinId)) {
          selectedProteins = selectedProteins.filter((id) => id !== proteinId);
        } else {
          selectedProteins.push(proteinId);
        }
      } else {
        // Single selection mode
        if (selectedProteins.length === 1 && selectedProteins[0] === proteinId) {
          selectedProteins = [];
        } else {
          selectedProteins = [proteinId];
        }
      }

      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">
        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="hide-show-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"family"}
              .useCanvas=${true}
              style="display: block; height: 600px;"
              @protein-click=${handleProteinClick}
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              .data=${{ features: data.features }}
              .selectedFeature=${"family"}
              .featureValues=${featureValues}
              .proteinIds=${data.protein_ids}
              .autoSync=${true}
              .autoHide=${true}
              scatterplot-selector="#hide-show-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

/**
 * Shows z-order control via drag-and-drop reordering. Uses perfectly overlapping points to demonstrate how legend order affects visibility.
 */
export const DragToReorder: Story = {
  render: () => {
    const data = generateOverlappingData();
    const featureValues = data.protein_ids.map(
      (_, i) => data.features.family.values[data.feature_data.family[i]],
    );

    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      const plot = e.target as any;

      if (modifierKeys.ctrl || modifierKeys.shift) {
        if (selectedProteins.includes(proteinId)) {
          selectedProteins = selectedProteins.filter((id) => id !== proteinId);
        } else {
          selectedProteins.push(proteinId);
        }
      } else {
        if (selectedProteins.length === 1 && selectedProteins[0] === proteinId) {
          selectedProteins = [];
        } else {
          selectedProteins = [proteinId];
        }
      }

      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">
        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="zorder-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"family"}
              .useCanvas=${true}
              .config=${{ pointSize: 150 }}
              style="display: block; height: 600px;"
              @protein-click=${handleProteinClick}
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              .data=${{ features: data.features }}
              .selectedFeature=${"family"}
              .featureValues=${featureValues}
              .proteinIds=${data.protein_ids}
              .autoSync=${true}
              .autoHide=${true}
              scatterplot-selector="#zorder-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

/**
 * Integration with "Other" category grouping. Shows how less common values are automatically grouped and can be extracted on demand.
 */
export const OtherCategoryIntegration: Story = {
  render: () => {
    const data = generateManyFeaturesData();
    const featureValues = data.protein_ids.map(
      (_, i) => data.features.family.values[data.feature_data.family[i]],
    );

    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      const plot = e.target as any;

      if (modifierKeys.ctrl || modifierKeys.shift) {
        if (selectedProteins.includes(proteinId)) {
          selectedProteins = selectedProteins.filter((id) => id !== proteinId);
        } else {
          selectedProteins.push(proteinId);
        }
      } else {
        if (selectedProteins.length === 1 && selectedProteins[0] === proteinId) {
          selectedProteins = [];
        } else {
          selectedProteins = [proteinId];
        }
      }

      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">
        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="other-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"family"}
              .useCanvas=${true}
              style="display: block; height: 600px;"
              @protein-click=${handleProteinClick}
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              .data=${{ features: data.features }}
              .selectedFeature=${"family"}
              .featureValues=${featureValues}
              .proteinIds=${data.protein_ids}
              .maxVisibleValues=${8}
              .includeOthers=${true}
              .autoSync=${true}
              .autoHide=${true}
              scatterplot-selector="#other-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

/**
 * Both components using shape symbols in addition to colors for improved accessibility and visual differentiation.
 */
export const WithShapes: Story = {
  render: () => {
    const data = generateMediumData();
    const featureValues = data.protein_ids.map(
      (_, i) => data.features.family.values[data.feature_data.family[i]],
    );

    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      const plot = e.target as any;

      if (modifierKeys.ctrl || modifierKeys.shift) {
        if (selectedProteins.includes(proteinId)) {
          selectedProteins = selectedProteins.filter((id) => id !== proteinId);
        } else {
          selectedProteins.push(proteinId);
        }
      } else {
        if (selectedProteins.length === 1 && selectedProteins[0] === proteinId) {
          selectedProteins = [];
        } else {
          selectedProteins = [proteinId];
        }
      }

      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">
        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="shapes-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"family"}
              .useShapes=${true}
              .useCanvas=${true}
              style="display: block; height: 600px;"
              @protein-click=${handleProteinClick}
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              .data=${{ features: data.features }}
              .selectedFeature=${"family"}
              .featureValues=${featureValues}
              .proteinIds=${data.protein_ids}
              .includeShapes=${true}
              .autoSync=${true}
              .autoHide=${true}
              scatterplot-selector="#shapes-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

/**
 * Demonstrates synchronized feature switching between scatterplot and legend using a dropdown selector.
 */
export const FeatureSwitching: Story = {
  render: () => {
    const data = generateMediumData();

    // Create a simple feature selector
    const handleFeatureChange = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      const newFeature = select.value;

      // Update scatterplot
      const plot = document.getElementById("feature-switch-plot") as any;
      if (plot) {
        plot.selectedFeature = newFeature;
      }

      // Update legend manually (since auto-sync listens to events, we need to trigger update)
      const legend = document.getElementById("feature-switch-legend") as any;
      if (legend) {
        legend.selectedFeature = newFeature;

        // Update feature values for the new feature
        const featureValues = data.protein_ids.map(
          (_, i) =>
            data.features[newFeature].values[data.feature_data[newFeature][i]],
        );
        legend.featureValues = featureValues;
      }
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">

        <div
          style="margin-bottom: 1rem; padding: 1rem; background: white; border: 1px solid #ccc; border-radius: 8px;"
        >
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <strong>Selected Feature:</strong>
            <select
              @change=${handleFeatureChange}
              style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
            >
              <option value="family">Family</option>
              <option value="size">Size</option>
              <option value="organism">Organism</option>
            </select>
          </label>
        </div>

        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="feature-switch-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"family"}
              .useCanvas=${true}
              style="display: block; height: 600px;"
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              id="feature-switch-legend"
              .data=${{ features: data.features }}
              .selectedFeature=${"family"}
              .featureValues=${data.protein_ids.map(
                (_, i) =>
                  data.features.family.values[data.feature_data.family[i]],
              )}
              .proteinIds=${data.protein_ids}
              .autoSync=${false}
              .autoHide=${true}
              scatterplot-selector="#feature-switch-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

/**
 * Demonstrates synchronized handling of null and missing values across both scatterplot and legend, displayed as "N/A" in neutral gray.
 */
export const WithNullValues: Story = {
  render: () => {
    const data = generateDataWithNulls();
    const featureValues = data.protein_ids.map((_, i) => {
      const idx = data.feature_data.status[i];
      return data.features.status.values[idx];
    });

    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      const plot = e.target as any;

      if (modifierKeys.ctrl || modifierKeys.shift) {
        if (selectedProteins.includes(proteinId)) {
          selectedProteins = selectedProteins.filter((id) => id !== proteinId);
        } else {
          selectedProteins.push(proteinId);
        }
      } else {
        if (selectedProteins.length === 1 && selectedProteins[0] === proteinId) {
          selectedProteins = [];
        } else {
          selectedProteins = [proteinId];
        }
      }

      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="padding: 2rem; background: #f5f5f5; min-height: 100vh;">
        <div
          style="display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start;"
        >
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-scatterplot
              id="null-plot"
              .data=${data}
              .selectedProjectionIndex=${0}
              .selectedFeature=${"status"}
              .useCanvas=${true}
              style="display: block; height: 600px;"
              @protein-click=${handleProteinClick}
            ></protspace-scatterplot>
          </div>
          <div
            style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: white;"
          >
            <protspace-legend
              .data=${{ features: data.features }}
              .selectedFeature=${"status"}
              .featureValues=${featureValues}
              .proteinIds=${data.protein_ids}
              .autoSync=${true}
              .autoHide=${true}
              scatterplot-selector="#null-plot"
            ></protspace-legend>
          </div>
        </div>
      </div>
    `;
  },
};

