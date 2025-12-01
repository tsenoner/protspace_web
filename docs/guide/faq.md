# FAQ

Frequently asked questions about ProtSpace Web.

## General

### Do I need machine learning knowledge?

No. ProtSpace Web is designed for biologists and researchers without machine learning expertise. You only need protein data.

### Is my data uploaded to a server?

No. Everything runs entirely in your browser. Your data never leaves your computer.

### Which file formats are supported?

Only `.parquetbundle` files. See [Data Preparation](/guide/data-preparation) for how to generate them.

### Can I use it offline?

Yes. After the initial page load, ProtSpace Web works offline. However, loading 3D structures requires internet connectivity.

### Is it free?

Yes. ProtSpace Web is open source under the Apache 2.0 license.

## Data

### How do I generate a .parquetbundle?

See the [Data Preparation](/guide/data-preparation) guide. Use either:

- Google Colab notebook (no installation)
- Python ProtSpace CLI (local processing)

### What is the recommended dataset size?

- **Optimal**: < 100,000 proteins
- **Good**: 100K - 500K proteins
- **Challenging**: > 500K proteins (may be slow)

Browser performance varies by device and GPU capabilities.

### Can I add custom metadata?

Yes. Add columns to the features table before bundling. See [Data Format](/guide/data-format).

### How do I include 3D structures?

Include UniProt accessions or PDB IDs in your metadata. The structure viewer will automatically fetch them from AlphaFold or RCSB PDB.

## Visualization

### Why is the plot empty?

Common causes:

- Missing projections in the bundle
- All categories hidden in legend
- Invalid data format

Check the browser console for error messages.

### Why do colors look strange?

The feature type may be misinterpreted (numerical vs. categorical). Regenerate the bundle with correct feature types.

### How do I export high-quality images?

Use the export button in the control bar:

- **PNG**: Raster format, good for presentations
- **SVG**: Vector format, scalable, best for publications

### Can I customize colors?

Currently, colors are automatically generated. Custom color schemes will be supported in future versions.

### What are multi-label features?

Features where proteins have multiple values (e.g., multiple GO terms). Displayed as pie charts with each slice representing one value.

## Performance

### The browser is slow or freezing

Try these solutions:

1. Reduce dataset size
2. Use a smaller point size
3. Close other browser tabs
4. Use Chrome (best WebGL performance)
5. Update graphics drivers

### Which browser works best?

Chrome and Edge provide the best performance due to optimized WebGL support. Firefox and Safari also work but may be slower with large datasets.

### Can I visualize 1 million proteins?

Technically possible but not recommended. Performance degrades significantly above 500K proteins. Consider subsetting your data or using server-side filtering.

## Integration

### Can I embed ProtSpace Web in my website?

Yes. ProtSpace Web provides web components that work in any HTML page. See [Integration guides](/guide/integration-html).

### Does it work offline?

Yes, after initial load. Structure viewing requires internet for fetching PDB/AlphaFold data.

### Can I use it in React/Vue/Angular?

Yes. Web components work in all frameworks. See integration guides:

- [React](/guide/integration-react)
- [Vue](/guide/integration-vue)
- HTML/Angular (same as vanilla JS)

### Is there a backend API?

No. ProtSpace Web is purely client-side. All processing happens in the browser.

## Technical

### What are the system requirements?

**Browser**: Modern browser with WebGL 2.0 support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

**Hardware**: Any modern computer. Better GPU = better performance.

### How is data loaded programmatically?

See [Data Loading API](/api/data-loading) for utilities and examples.

### Can I access the raw canvas?

The canvas is encapsulated in Shadow DOM. Use the component's export methods instead.

### Is TypeScript supported?

Yes. Full TypeScript definitions are included with `@protspace/core`.

## Data Format

### What's inside a .parquetbundle?

Three Parquet files bundled together:

1. Projection coordinates (x, y, z)
2. Projection metadata (methods, parameters)
3. Feature data (protein annotations)

See [Data Format](/guide/data-format) for details.

### Can I create bundles manually?

Yes, but it's complex. Use the Python CLI or Colab notebook instead. See [Data Preparation](/guide/data-preparation).

### Why Parquet format?

Parquet provides:

- Excellent compression (10-20x smaller than CSV)
- Fast columnar access
- Browser compatibility via hyparquet
- Type preservation

## Troubleshooting

### "File type not recognized"

Ensure the file ends with `.parquetbundle` extension and is a valid bundle file.

### "Bundle missing required tables"

The bundle is incomplete. Regenerate using the Python CLI or Colab notebook.

### Structure viewer shows "not found"

The protein may not have a structure in AlphaFold DB or PDB. Not all proteins have known structures.

### Export fails

Check browser console for errors. Ensure pop-ups are not blocked for downloads.

### Components not rendering

Check:

1. Web Components are supported (modern browser required)
2. Import statement is correct
3. Browser console for JavaScript errors

## Contributing

### How can I contribute?

See [Developer Guide](/guide/developer-guide) and [CONTRIBUTING.md](https://github.com/tsenoner/protspace_web/blob/main/CONTRIBUTING.md).

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

- **Documentation**: Browse the full [documentation](/guide/)
- **GitHub Discussions**: [Ask the community](https://github.com/tsenoner/protspace_web/discussions)
- **Issues**: [Report bugs](https://github.com/tsenoner/protspace_web/issues)
