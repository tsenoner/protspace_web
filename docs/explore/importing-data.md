# Importing Data

ProtSpace uses `.parquetbundle` files containing protein embeddings and annotations.

## Drag and Drop (Recommended)

The easiest way to load data:

1. Locate your `.parquetbundle` file on your computer
2. Drag it onto the scatterplot canvas
3. Drop when you see the drop indicator
4. Data loads automatically

::: tip Drop Anywhere
You can drop the file anywhere on the scatterplot area - it doesn't need to be a specific location.
:::

## Import Button

Alternatively, use the **Import** button in the control bar:

1. Click the **Import** button in the top-right corner
2. Select your `.parquetbundle` file from the file picker
3. Click **Open**

## Example Datasets

Don't have data yet? Download example `.parquetbundle` files from the [GitHub data folder](https://github.com/tsenoner/protspace_web/tree/main/app/public/data).

## What Happens When You Load Data

After successfully loading a file:

1. **Scatterplot populates**: All proteins appear as colored points
2. **First projection loads**: Typically PCA if available
3. **Colors are assigned**: Based on the first annotation in your data
4. **Legend appears**: Shows all categories with color assignments
5. **Ready to explore**: You can now pan, zoom, and interact with the data

::: info Loading Time
Small datasets (< 10K proteins) load instantly. Larger datasets may take a few seconds to process and render.
:::

## Need a Data File?

To create your own `.parquetbundle` files:

- **[Using Google Colab](/guide/data-preparation)** - No installation required (recommended)
- **[Using Python CLI](/guide/python-cli)** - For local processing or automation

Or download example datasets from the [GitHub data folder](https://github.com/tsenoner/protspace_web/tree/main/app/public/data).
