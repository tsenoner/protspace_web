# FAQ

Frequently asked questions about ProtSpace.

## General

### Do I need machine learning knowledge?

No. ProtSpace is designed for biologists and researchers without machine learning expertise. You only need protein embeddings.

### Is my data uploaded to a server?

No. Everything runs entirely in your browser. Your data never leaves your computer.

### Which file formats are supported?

Only `.parquetbundle` files. See [Using Google Colab](/guide/data-preparation) for how to generate them.

### Can I use it offline?

Yes. After the initial page load, ProtSpace works offline. However, loading 3D structures requires internet connectivity.

### Is it free?

Yes. ProtSpace is open source under the Apache 2.0 license.

## Data

### How do I generate a .parquetbundle?

Two options:

- [Google Colab notebook](/guide/data-preparation) - No installation required
- [Python CLI](/guide/python-cli) - For local processing

### What is the recommended dataset size?

| Size           | Performance                       |
| -------------- | --------------------------------- |
| < 10K proteins | Optimal - smooth experience       |
| 10K - 500K     | Good - may slow on older devices  |
| > 500K         | Challenging - consider subsetting |

Browser performance varies by device and GPU capabilities.

### Can I add custom annotations?

Yes. Add annotation columns to your data when generating the bundle. See [Data Format](/guide/data-format).

### How do I include 3D structures?

The structure viewer automatically fetches from AlphaFold when the protein ID is a UniProt accession.

## Visualization

### Can I customize colors?

Currently, colors are automatically generated. Custom color schemes will be supported in future versions.

### What are multi-label annotations?

Annotations where proteins have multiple values (e.g., multiple EC numbers or domains). Displayed as pie charts with each slice representing one value.

## Performance

### The browser is slow or freezing

Try these solutions:

1. Change browser - Chrome has best performance
2. Reduce dataset size

### Which browser works best?

| Browser | Performance |
| ------- | ----------- |
| Chrome  | Best        |
| Brave   | Best        |
| Edge    | Excellent   |
| Safari  | Good        |
| Firefox | Slower      |

### Can I visualize 1 million proteins?

Not recommended. Performance degrades above 500K proteins. Consider subsetting your data.

## Technical

### What are the system requirements?

**Browser**: Modern browser with WebGL 2.0 support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

**Hardware**: Any modern computer. Better GPU = better performance.

### What's inside a .parquetbundle?

Three Parquet files bundled together:

1. Annotation data (protein metadata)
2. Projection metadata (methods, parameters)
3. Projection coordinates (x, y, z)

See [Data Format](/guide/data-format) for details.

## Contributing

### How can I contribute?

See [CONTRIBUTING.md](https://github.com/tsenoner/protspace_web/blob/main/CONTRIBUTING.md) on GitHub.

### Where do I report bugs?

[GitHub Issues](https://github.com/tsenoner/protspace_web/issues)

### Can I request features?

Yes! Open an issue or start a discussion on GitHub.

## Citation

### How do I cite ProtSpace?

```
Senoner, T., et al. (2025). ProtSpace: A Tool for Visualizing Protein Space.
Journal of Molecular Biology. DOI: 10.1016/j.jmb.2025.168940
```

BibTeX:

```bibtex
@article{senoner2025protspace,
  title={ProtSpace: A Tool for Visualizing Protein Space},
  author={Senoner, T. and others},
  journal={Journal of Molecular Biology},
  year={2025},
  doi={10.1016/j.jmb.2025.168940}
}
```

## Still Have Questions?

- **GitHub Discussions**: [Ask the community](https://github.com/tsenoner/protspace_web/discussions)
- **Issues**: [Report bugs](https://github.com/tsenoner/protspace_web/issues)
