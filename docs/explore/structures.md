# Viewing 3D Structures

ProtSpace integrates with AlphaFold to display 3D protein structures alongside your embedding visualization.

![Structure viewer](./images/structure-viewer-full.png)

## How It Works

When you select a protein with a UniProt accession:

1. The structure viewer appears in the sidebar below the legend
2. Links to [AlphaFold Database](https://alphafold.ebi.ac.uk/) and [UniProt](https://www.uniprot.org/) entry appear at the top - click them anytime
3. The AlphaFold structure loads automatically via [3D-Beacons API](https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons/)

::: tip Supported Structures
Currently, ProtSpace supports **AlphaFold structures** only. PDB experimental structures are not yet integrated.
:::

## Viewer Controls

| Action           | Effect               |
| ---------------- | -------------------- |
| **Left drag**    | Rotate the structure |
| **Right drag**   | Pan the view         |
| **Scroll**       | Zoom in/out          |
| **Double-click** | Reset the view       |

![Structure viewer controls](./images/structure-controls.gif)

## When Structures Aren't Available

Not all proteins have AlphaFold structures. When no structure is found, the viewer displays:

> "No 3D structure was found for \<Protein ID\>"

## Next Steps

- [Exporting Results](/explore/exporting) - Save your findings
- [FAQ](/guide/faq) - Common questions
