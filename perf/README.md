## Perf plotting

### Setup (kept entirely in `perf/`)

From repo root:

1. Create/sync a venv under `perf/.venv` (managed by uv):

- `cd perf`
- `uv sync`

### Generate plots

From `perf/`:

- `uv run python plot_perf_results.py`

This writes one grouped bar chart **per scenario** into `perf/plots/`:

- browsers on x-axis
- one bar per dataset
- error bars are **95% CI of the mean** (normal approx; CI = 1.96 \* SEM)

It also writes one scatter plot **per scenario** into `perf/plots/`:

- x-axis: dataset size (number of points / proteins)
- y-axis: mean render time per pass (ms)
- points colored by browser, with 95% CI error bars
- includes a per-browser linear regression line
