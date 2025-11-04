/**
 * Storybook stories for the Scatterplot component
 * Demonstrates various configurations and interactions
 */

import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "@protspace/core";
import {
  generateMediumData,
  generateLargeData,
  generateDataWithNulls,
} from "./mock-data";

const meta: Meta = {
  title: "Components/Scatterplot",
  component: "protspace-scatterplot",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "High-performance canvas-based scatterplot component for visualizing protein data with support for zooming, panning, and interactive selections. Custom events are logged to the browser console.",
      },
    },
  },
  argTypes: {
    selectedProjectionIndex: {
      control: { type: "number", min: 0, max: 2 },
      description: "Index of the projection to display",
    },
    projectionPlane: {
      control: { type: "select" },
      options: ["xy", "xz", "yz"],
      description: "Which plane to display for 3D projections",
    },
    selectedFeature: {
      control: { type: "select" },
      options: ["family", "size", "organism"],
      description: "Feature to use for coloring points",
    },
    selectionMode: {
      control: { type: "boolean" },
      description: "Enable brush selection mode",
    },
    useCanvas: {
      control: { type: "boolean" },
      description: "Use canvas rendering (recommended for >100 points)",
    },
    useShapes: {
      control: { type: "boolean" },
      description: "Use different shapes for different feature values",
    },
  },
};

export default meta;
type Story = StoryObj;

/**
 * Interactive scatterplot demonstrating hover tooltips, click selection, zoom, pan, and reset functionality.
 * Events are logged to the browser console.
 */
export const Interactive: Story = {
  args: {
    data: generateMediumData(),
    selectedProjectionIndex: 0,
    selectedFeature: "family",
    useCanvas: true,
    selectionMode: false,
  },
  render: (args) => {
    let selectedProteins: string[] = [];

    const handleProteinClick = (e: CustomEvent) => {
      const { proteinId, modifierKeys } = e.detail;
      console.log("Protein click:", e.detail);

      // Get the scatterplot element
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
          // Clicking the same protein again - deselect it
          selectedProteins = [];
        } else {
          // Select new protein
          selectedProteins = [proteinId];
        }
      }

      // Update the scatterplot's selectedProteinIds
      plot.selectedProteinIds = [...selectedProteins];
      plot.requestUpdate();
    };

    return html`
      <div style="width: 800px; height: 600px; border: 1px solid #ccc;">
        <protspace-scatterplot
          .data=${args.data}
          .selectedProjectionIndex=${args.selectedProjectionIndex}
          .selectedFeature=${args.selectedFeature}
          .useCanvas=${args.useCanvas}
          .selectionMode=${args.selectionMode}
          @protein-hover=${(e: CustomEvent) => console.log("Protein hover:", e.detail)}
          @protein-click=${handleProteinClick}
        ></protspace-scatterplot>
      </div>
    `;
  },
};

/**
 * Large dataset with 100,000 proteins demonstrating canvas rendering for optimal performance.
 */
export const LargeDataset: Story = {
  args: {
    data: generateLargeData(),
    selectedProjectionIndex: 0,
    selectedFeature: "family",
    useCanvas: true,
  },
  render: (args) => html`
    <div style="width: 800px; height: 600px; border: 1px solid #ccc;">
      <protspace-scatterplot
        .data=${args.data}
        .selectedProjectionIndex=${args.selectedProjectionIndex}
        .selectedFeature=${args.selectedFeature}
        .useCanvas=${args.useCanvas}
      ></protspace-scatterplot>
    </div>
  `,
};


/**
 * Displays the same dataset colored by different features to compare how various metadata affects visualization.
 */
export const FeatureComparison: Story = {
  args: {
    data: generateMediumData(),
    selectedProjectionIndex: 0,
  },
  render: (args) => html`
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
      ${Object.keys(args.data.features).map(
        (feature) => html`
          <div>
            <h3 style="margin: 0 0 0.5rem 0; text-align: center;">
              Colored by: ${feature}
            </h3>
            <div style="width: 100%; height: 400px; border: 1px solid #ccc;">
              <protspace-scatterplot
                .data=${args.data}
                .selectedProjectionIndex=${args.selectedProjectionIndex}
                .selectedFeature=${feature}
                .useCanvas=${true}
              ></protspace-scatterplot>
            </div>
          </div>
        `,
      )}
    </div>
  `,
};

/**
 * Uses different shape symbols (circle, square, triangle, diamond, star) in addition to colors for enhanced visual differentiation.
 */
export const WithShapes: Story = {
  args: {
    data: generateMediumData(),
    selectedProjectionIndex: 0,
    selectedFeature: "family",
    useShapes: true,
    useCanvas: true,
  },
  render: (args) => html`
    <div style="width: 800px; height: 600px; border: 1px solid #ccc;">
      <protspace-scatterplot
        .data=${args.data}
        .selectedProjectionIndex=${args.selectedProjectionIndex}
        .selectedFeature=${args.selectedFeature}
        .useShapes=${args.useShapes}
        .useCanvas=${args.useCanvas}
      ></protspace-scatterplot>
    </div>
  `,
};

/**
 * Brush selection mode allowing click-and-drag to select multiple points. Events are logged to the console.
 */
export const BrushSelection: Story = {
  args: {
    data: generateMediumData(),
    selectedProjectionIndex: 0,
    selectedFeature: "family",
    selectionMode: true,
    useCanvas: true,
  },
  render: (args) => html`
    <div style="width: 800px; height: 600px; border: 1px solid #ccc;">
      <protspace-scatterplot
        .data=${args.data}
        .selectedProjectionIndex=${args.selectedProjectionIndex}
        .selectedFeature=${args.selectedFeature}
        .selectionMode=${args.selectionMode}
        .useCanvas=${args.useCanvas}
        @brush-selection=${(e: CustomEvent) => console.log("Brush selection:", e.detail)}
      ></protspace-scatterplot>
    </div>
  `,
};

/**
 * Demonstrates handling of null and missing values, shown in neutral gray with unknown labels in tooltips.
 */
export const WithNullValues: Story = {
  args: {
    data: generateDataWithNulls(),
    selectedProjectionIndex: 0,
    selectedFeature: "status",
    useCanvas: true,
  },
  render: (args) => html`
    <div style="width: 800px; height: 600px; border: 1px solid #ccc;">
      <protspace-scatterplot
        .data=${args.data}
        .selectedProjectionIndex=${args.selectedProjectionIndex}
        .selectedFeature=${args.selectedFeature}
        .useCanvas=${args.useCanvas}
      ></protspace-scatterplot>
    </div>
  `,
};

