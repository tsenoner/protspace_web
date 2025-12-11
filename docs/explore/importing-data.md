# Importing Data

ProtSpace uses `.parquetbundle` files containing protein embeddings and annotations.

## Drag and Drop

The easiest way to load data:

![Drag and drop - file being dropped onto canvas](./images/drag-drop.gif)

1. Find your `.parquetbundle` file
2. Drag it onto the scatterplot canvas
3. Drop when you see the indicator
4. Data loads automatically

## Import Button

Alternatively, use the Import button in the control bar:

![Import button location](./images/import-button.png)

1. Click the **Import** button
2. Select your `.parquetbundle` file
3. Click Open

## Example Datasets

Don't have data? Download examples from the [GitHub data folder](https://github.com/tsenoner/protspace_web/tree/main/data).

## What Happens When You Load Data

1. Proteins appear as points in the scatterplot
2. First projection is selected
3. First annotation is used for coloring
4. Legend populates with categories

## Generating Data

To create your own `.parquetbundle` files:

- **[Using Google Colab](/guide/data-preparation)** - No installation required
- **[Using Python CLI](/guide/python-cli)** - For local processing
