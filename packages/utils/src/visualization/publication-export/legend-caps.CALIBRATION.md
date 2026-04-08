# Legend row caps (`MAX_LEGEND_ITEMS`)

## 2026-04-07 — layoutId rework

Calibrated against:

- DPI: 300
- Body font: 7 pt floor (worst case)
- Row height: 2 lines @ 7 pt with 1.15 line-height
- Header reserve: 5 mm
- Footer reserve: 1 row when overflow active

Computed caps (then subtract 1 for safety):

| Layout           | Legend rect H (mm) | Rows | Cols | Raw cap | Final cap |
| ---------------- | ------------------ | ---- | ---- | ------- | --------- |
| one_column_below | 20                 | 2    | 2    | 4       | 3         |
| two_column_right | 90 (inner height)  | 14   | 1    | 14      | 13        |
| two_column_below | 26                 | 3    | 3    | 9       | 8         |
| full_page_top    | 38                 | 5    | 3    | 15      | 14        |
