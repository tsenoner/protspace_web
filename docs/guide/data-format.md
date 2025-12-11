# Data Format Reference

ProtSpace uses `.parquetbundle` files - a single file containing all visualization data. This page explains the structure for users who want to understand the file format.

## What is a .parquetbundle?

A `.parquetbundle` is a single file containing three Parquet tables bundled together:

```
.parquetbundle file
├── selected_features.parquet    # Protein metadata and annotations
├── ---PARQUET_DELIMITER---      # Separator
├── projections_metadata.parquet # Projection method information
├── ---PARQUET_DELIMITER---      # Separator
└── projections_data.parquet     # 2D/3D coordinates
```

This bundled format allows efficient loading in the browser while keeping everything in one convenient file.

## Tables

### 1. Annotations Table

Contains metadata and biological annotations for each protein.

| Column       | Type          | Description                |
| ------------ | ------------- | -------------------------- |
| `identifier` | string        | Protein ID (e.g., P12345)  |
| _others_     | string/number | Any biological annotations |

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

## Creating Files

Use the [Google Colab notebook](/guide/data-preparation) or [Python CLI](/guide/python-cli) to generate `.parquetbundle` files.
