/**
 * Storybook stories for the Legend component
 * Demonstrates legend features, interactions, and customization
 */

import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "@protspace/core";
import {
  MINIMAL_DATA,
  generateMediumData,
  generateManyFeaturesData,
  generateDataWithNulls,
} from "./mock-data";

const meta: Meta = {
  title: "Components/Legend",
  component: "protspace-legend",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Interactive legend component with support for hiding/showing values, drag-and-drop reordering, and automatic 'Other' category grouping.",
      },
    },
  },
  argTypes: {
    featureName: {
      control: "text",
      description: "Name of the feature to display",
    },
    maxVisibleValues: {
      control: { type: "number", min: 3, max: 20 },
      description:
        "Maximum number of values to display individually. Values below this threshold are grouped into the 'Other' category (configurable, not fixed at 10).",
    },
    includeOthers: {
      control: "boolean",
      description: "Show 'Other' category for values below the maxVisibleValues threshold",
    },
    includeShapes: {
      control: "boolean",
      description: "Show shape symbols in addition to colors",
    },
    autoSync: {
      control: "boolean",
      description: "Automatically sync with scatterplot",
    },
    autoHide: {
      control: "boolean",
      description: "Automatically hide points when legend items are toggled",
    },
  },
};

export default meta;
type Story = StoryObj;

/**
 * Basic legend with minimal data demonstrating the default appearance and functionality.
 */
export const Basic: Story = {
  args: {
    data: { features: MINIMAL_DATA.features },
    selectedFeature: "family",
    featureValues: MINIMAL_DATA.protein_ids.map(
      (_, i) =>
        MINIMAL_DATA.features.family.values[
          MINIMAL_DATA.feature_data.family[i]
        ],
    ),
    proteinIds: MINIMAL_DATA.protein_ids,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Legend with a medium-sized dataset (100 proteins across 5 families) showing count display for each category.
 */
export const MediumDataset: Story = {
  args: {
    data: (() => {
      const data = generateMediumData();
      return { features: data.features };
    })(),
    selectedFeature: "family",
    featureValues: (() => {
      const data = generateMediumData();
      return data.protein_ids.map(
        (_, i) => data.features.family.values[data.feature_data.family[i]],
      );
    })(),
    proteinIds: generateMediumData().protein_ids,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Demonstrates interactive features: click to toggle visibility, double-click to isolate, and drag to reorder items.
 * Events are logged to the browser console.
 */
export const InteractiveFeatures: Story = {
  args: {
    data: (() => {
      const data = generateMediumData();
      return { features: data.features };
    })(),
    selectedFeature: "family",
    featureValues: (() => {
      const data = generateMediumData();
      return data.protein_ids.map(
        (_, i) => data.features.family.values[data.feature_data.family[i]],
      );
    })(),
    proteinIds: generateMediumData().protein_ids,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
        @legend-item-click=${(e: CustomEvent) => {
          console.log("Legend item clicked:", e.detail);
        }}
        @legend-zorder-change=${(e: CustomEvent) => {
          console.log("Z-order changed:", e.detail.zOrderMapping);
        }}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Shows automatic grouping of less common values into an "Other" category. Values can be extracted individually by clicking "(view)".
 * Configure the threshold using the maxVisibleValues property.
 */
export const OtherCategoryManagement: Story = {
  args: {
    data: (() => {
      const data = generateManyFeaturesData();
      return { features: data.features };
    })(),
    selectedFeature: "family",
    featureValues: (() => {
      const data = generateManyFeaturesData();
      return data.protein_ids.map(
        (_, i) => data.features.family.values[data.feature_data.family[i]],
      );
    })(),
    proteinIds: generateManyFeaturesData().protein_ids,
    maxVisibleValues: 8,
    includeOthers: true,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .maxVisibleValues=${args.maxVisibleValues}
        .includeOthers=${args.includeOthers}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
        @legend-item-click=${(e: CustomEvent) => {
          if (e.detail.action === "extract") {
            console.log("Extracted from Other:", e.detail.value);
          }
        }}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Displays shape symbols (circle, square, triangle, diamond, star) in addition to colors for better differentiation.
 */
export const ShapeOptions: Story = {
  args: {
    data: (() => {
      const data = generateMediumData();
      return { features: data.features };
    })(),
    selectedFeature: "family",
    featureValues: (() => {
      const data = generateMediumData();
      return data.protein_ids.map(
        (_, i) => data.features.family.values[data.feature_data.family[i]],
      );
    })(),
    proteinIds: generateMediumData().protein_ids,
    includeShapes: true,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .includeShapes=${args.includeShapes}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Demonstrates the settings dialog accessed via the gear icon, allowing customization of max items, shape size, sorting, and more.
 */
export const SettingsDialog: Story = {
  args: {
    data: (() => {
      const data = generateManyFeaturesData();
      return { features: data.features };
    })(),
    selectedFeature: "family",
    featureValues: (() => {
      const data = generateManyFeaturesData();
      return data.protein_ids.map(
        (_, i) => data.features.family.values[data.feature_data.family[i]],
      );
    })(),
    proteinIds: generateManyFeaturesData().protein_ids,
    maxVisibleValues: 10,
    includeOthers: true,
    includeShapes: true,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .maxVisibleValues=${args.maxVisibleValues}
        .includeOthers=${args.includeOthers}
        .includeShapes=${args.includeShapes}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
      ></protspace-legend>
    </div>
  `,
};

/**
 * Shows handling of null and missing values, which are displayed as "N/A" with a neutral gray color.
 */
export const WithNullValues: Story = {
  args: {
    data: (() => {
      const data = generateDataWithNulls();
      return { features: data.features };
    })(),
    selectedFeature: "status",
    featureValues: (() => {
      const data = generateDataWithNulls();
      return data.protein_ids.map((_, i) => {
        const idx = data.feature_data.status[i];
        return data.features.status.values[idx];
      });
    })(),
    proteinIds: generateDataWithNulls().protein_ids,
    autoSync: false,
    autoHide: false,
  },
  render: (args) => html`
    <div
      style="width: 300px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
    >
      <protspace-legend
        .data=${args.data}
        .selectedFeature=${args.selectedFeature}
        .featureValues=${args.featureValues}
        .proteinIds=${args.proteinIds}
        .autoSync=${args.autoSync}
        .autoHide=${args.autoHide}
      ></protspace-legend>
    </div>
  `,
};

