# Data Format Reference

ProtSpace uses `.parquetbundle` files - a single file containing all visualization data. This page explains the structure for users who want to understand the file format.

## What is a .parquetbundle?

A `.parquetbundle` is a single file containing three Parquet tables bundled together, with an optional settings section:

```
.parquetbundle file
├── selected_annotations.parquet  # Protein metadata and annotations
├── ---PARQUET_DELIMITER---       # Separator
├── projections_metadata.parquet  # Projection method information
├── ---PARQUET_DELIMITER---       # Separator
├── projections_data.parquet      # 2D/3D coordinates
├── ---PARQUET_DELIMITER---       # Optional separator
└── settings.json                 # Optional: legend + export settings
```

This bundled format allows efficient loading in the browser while keeping everything in one convenient file.

The optional `settings.json` section stores legend customizations (colors, shapes, ordering, visibility, palette) and export options (image dimensions, legend sizing) per annotation. When present, these settings are applied automatically on load so the visualization renders exactly as it was exported.

## Tables

### 1. Annotations Table

Contains metadata and biological annotations for each protein.

| Column       | Type          | Description                |
| ------------ | ------------- | -------------------------- |
| `identifier` | string        | Protein ID (e.g., P12345)  |
| _others_     | string/number | Any biological annotations |

The columns `gene_name`, `protein_name`, and `uniprot_kb_id` are **tooltip-only** — shown on hover but excluded from the annotation dropdown.

### 2. Projections Metadata

| Column            | Type    | Description                    |
| ----------------- | ------- | ------------------------------ |
| `projection_name` | string  | Method name (e.g., `PCA_2`)    |
| `dimensions`      | integer | 2 or 3                         |
| `info_json`       | json    | Method parameters and settings |

### 3. Projections Data

| Column            | Type   | Description                 |
| ----------------- | ------ | --------------------------- |
| `projection_name` | string | Method name (e.g., `PCA_2`) |
| `identifier`      | string | Protein ID                  |
| `x`               | float  | X coordinate                |
| `y`               | float  | Y coordinate                |
| `z`               | float  | Z coordinate (null for 2D)  |

## Annotation Types

- **Categorical**: Text values (taxonomy, family). Distinct colors per category.
- **Multi-Label**: Semicolon-separated values (e.g., `EC:1.1.1;EC:2.1.1`). Displayed as pie charts.

### Missing Values

Proteins with missing, empty, or whitespace-only annotation values are displayed as **N/A** in
the legend and tooltip. N/A items receive a dedicated color (#DDDDDD) and can be toggled,
isolated, or reordered in the legend like any other category.

### Scored Annotations

Annotation values can include a numeric score after a pipe character:

- Single score: `PF00001|1.5e-10`
- Multiple scores: `PF00001|1.5e-10,2.3e-5`

Scores are displayed in the protein tooltip when hovering over a point. This is commonly used for InterPro domain E-values.

### Evidence-Coded Annotations

Annotation values can include an [ECO evidence code](https://www.evidenceontology.org/) after a pipe character:

- `Cytoplasm|EXP` (experimental evidence)
- `apoptotic process|IDA` (inferred from direct assay)

Recognized evidence codes: `EXP`, `HDA`, `IDA`, `TAS`, `NAS`, `IC`, `ISS`, `SAM`, `COMB`, `IMP`, `IEA`

Evidence codes are displayed in the protein tooltip alongside the annotation value.

## Creating Files

Use the [Google Colab notebook](/guide/data-preparation) or [Python CLI](/guide/python-cli) to generate `.parquetbundle` files.
