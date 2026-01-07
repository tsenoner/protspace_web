# Navigating the Scatterplot

The scatterplot is the main visualization area where proteins appear as points. Learn how to navigate, select, and explore your data.

## Quick Reference

| Action              | How                                  |
| ------------------- | ------------------------------------ |
| Zoom in/out         | Mouse wheel or pinch gesture         |
| Pan                 | Click + drag on background           |
| Reset view          | Double-click on background           |
| Select one          | Click a point                        |
| Add to selection    | **⌘** (Mac) / **Ctrl** (Win) + click |
| Box select          | Click **Select** button, then drag   |
| Clear selection     | Press **Escape** or click **Clear**  |
| Exit selection mode | Press **Escape** (when no selection) |
| Focus search        | **⌘/Ctrl + K**                       |

## Navigation

![Zooming and panning](./images/zoom.gif)

- **Zoom**: Scroll wheel or pinch gesture
- **Pan**: Click and drag on the background
- **Reset**: Double-click the canvas to fit all proteins

## Selection

### Single & Multi-Select

![Single selection](./images/select-single.gif)

- **Click** a point to select it
- **⌘ + click** (Mac) or **Ctrl + click** (Windows) to add to selection
- Click the same point again to deselect it

### Box Selection

![Box selection](./images/select-box.gif)

1. Click the **Select** button in the control bar
2. Drag to draw a rectangle
3. All proteins inside are selected

::: tip Additive Mode
When the **Select** button is active, all selections (clicks and box drags) are additive. Without it, each new selection replaces the previous one.
:::

### Clearing

- Press **Escape** to clear selections (first press), then exit selection mode (second press)
- Click the **Clear** button

## Understanding the Display

### Point Position

Points close together have similar embeddings - often indicating similar structure, function, or evolutionary history.

### Point Colors

- **Categorical** (reviewed, protein family, species): Unique color per category
- **Multi-label** (EC numbers, domains): Pie charts showing multiple values
