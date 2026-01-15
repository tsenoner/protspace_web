import { css } from 'lit';

export const controlBarStyles = css`
  :host {
    display: block;
    font-family: var(--font-family);

    /* Color Palette */
    --primary: #00a3e0;
    --primary-hover: #008ec4;
    --primary-light: #eef6fb; /* Light blue for hover/highlight */
    --surface: #ffffff;
    --border: #d9e2ec;
    --muted: #4a5568;
    --text-dark: #0b0f19;
    --text-light: #ffffff; /* White text for active states */
    --focus-ring: rgba(0, 163, 224, 0.15);

    /* Destructive Actions */
    --danger: #e42121;
    --danger-hover: #c20909;
    --danger-border: #d06868;

    /* Additional UI Colors */
    --border-light: #cfe8f5; /* Very light blue border for chips */
    --hint: #d6d7da; /* Hint/placeholder text */
    --scrollbar: #cbd5e0; /* Scrollbar track color */
    --hover-bg: #f7fafc; /* Hover background */

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.05);
    --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.08);

    /* Spacing Scale */
    --spacing-xs: 0.25rem; /* 4px */
    --spacing-sm: 0.5rem; /* 8px */
    --spacing-md: 0.75rem; /* 12px */
    --spacing-lg: 1rem; /* 16px */

    /* Border & Radius */
    --border-width: 1px;
    --radius: 0.25rem; /* 4px everywhere for consistency */

    /* Typography Scale */
    --font-family: system-ui, -apple-system, sans-serif;
    --text-xs: 0.625rem; /* 10px */
    --text-sm: 0.75rem; /* 12px */
    --text-base: 0.875rem; /* 14px */
    --text-md: 1rem; /* 16px - for section headers */

    /* Font Weights */
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;

    /* Animations */
    --transition-fast: all 0.1s ease;
    --transition: all 0.15s ease;

    /* Layout */
    --dropdown-offset: 0.3125rem; /* 5px */
    --dropdown-z: 50;

    /* Component sizing */
    --input-padding-y: 0.375rem; /* 6px */
    --input-padding-x: 0.5625rem; /* 9px */
    --button-padding-y: 0.3rem;
    --button-padding-x: var(--spacing-md);
  }

  .control-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--surface);
    border-bottom: var(--border-width) solid var(--border);
    box-shadow: var(--shadow-sm);
    flex-wrap: nowrap;
    border-radius: var(--radius);
  }

  .left-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    /* Let inner controls wrap when space is tight */
    flex-wrap: wrap;
    min-width: 0;
  }

  .right-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    /* Let action buttons wrap when space is tight */
    flex-wrap: wrap;
    min-width: 0;
  }

  .control-group {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  /* Center search should expand to take remaining horizontal space */
  .search-group {
    flex: 1 1 12rem;
    min-width: 0;
    margin: 0 0.5rem;
    display: flex;
    align-items: center;
  }

  .search-group > protspace-protein-search {
    width: 100%;
    min-width: 0;
  }

  label {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--muted);
  }

  /* ==========================================
     SHARED COMPONENT SYSTEM
     ========================================== */

  /* Base input/select styling - shared across all inputs */
  select,
  input[type='text'],
  input[type='search'],
  .input-base {
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--muted);
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
  }

  select:focus,
  input[type='text']:focus,
  input[type='search']:focus,
  .input-base:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  select {
    max-width: 100%;
  }

  /* Base button component - shared across all buttons */
  .btn,
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--muted);
    font-size: var(--text-base);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
  }

  .btn:hover:not(:disabled),
  button:hover:not(:disabled) {
    background: var(--primary-light);
  }

  .btn:disabled,
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Active/selected state - SAME EVERYWHERE: white text on blue background */
  .btn.active,
  .btn.selected,
  button.active,
  button.selected {
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
    fill: var(--text-light);
  }

  .btn.active:hover:not(:disabled),
  .btn.selected:hover:not(:disabled),
  button.active:hover:not(:disabled),
  button.selected:hover:not(:disabled) {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  /* Dropdown item component - shared hover/selection states */
  .dropdown-item {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-base);
    color: var(--muted);
    cursor: pointer;
    transition: var(--transition-fast);
    border-left: 2px solid transparent;
  }

  .dropdown-item:hover {
    background: var(--primary-light);
  }

  .dropdown-item.highlighted,
  .dropdown-item:focus {
    background: var(--primary-light);
    border-left-color: var(--primary);
  }

  .dropdown-item.selected {
    font-weight: var(--font-semibold);
    color: var(--primary);
  }

  .dropdown-item.selected.highlighted,
  .dropdown-item.selected:hover {
    background: var(--primary-light);
  }

  /* Legacy support for existing classes */
  .right-controls-button {
    /* Inherits from button base styles above */
  }

  /* Make Filter/Export button text more visible */
  .right-controls .export-container > button,
  .right-controls .filter-container > button {
    color: var(--text-dark);
    font-weight: var(--font-normal);
  }

  .icon {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  /* Dropdown containers share common styling */
  .export-container,
  .filter-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .export-container > button,
  .filter-container > button {
    /* Inherits from .btn base, just needs active state trigger */
  }

  .export-container > button.active,
  .filter-container > button.active {
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
  }
  .export-container {
    position: relative;
  }

  /* Shared dropdown menu styling */
  .filter-menu,
  .export-menu {
    position: absolute;
    right: 0;
    top: calc(100% + var(--dropdown-offset));
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--dropdown-z);
    display: flex;
    flex-direction: column;
    padding: var(--input-padding-y) 10px 14px;
  }

  .filter-menu {
    width: max-content;
    row-gap: 20px;
  }

  .filter-menu-list {
    list-style: none;
    margin: 0;
    display: flex;
    padding: 1rem 0.25rem 0.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    cursor: auto;
    row-gap: 17px;
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .filter-menu-list-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    row-gap: 7px;
    width: 100%;
    position: relative;
  }

  .filter-menu-list-item > label,
  .filter-menu-list-item input {
    cursor: pointer;
  }
  .filter-menu-list-item > label {
    color: var(--text-dark);
    font-weight: var(--font-normal);
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    column-gap: 8px;
  }

  .filter-menu-list-item > button {
    /* Inherits from .btn base */
    display: flex;
    align-self: flex-start;
    margin-left: 18px;
    padding: var(--button-padding-y) var(--spacing-md);
  }

  .filter-menu-list-item-options {
    position: relative;
    width: 100%;
    margin-top: 5px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    display: flex;
    z-index: 10;
    flex-direction: column;
    row-gap: 14px;
    padding: 9px 10px 14px;
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-selection {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    column-gap: 11px;
  }

  .filter-menu-list-item-options-selection > button {
    /* Inherits from .btn base */
    padding: var(--spacing-xs) var(--spacing-md);
  }

  /* Destructive action - clear/delete button */
  .filter-menu-list-item-options-selection > button:last-child {
    background-color: var(--danger);
    border-color: var(--danger-border);
    color: var(--text-light);
    font-weight: var(--font-bold);
  }

  .filter-menu-list-item-options-selection > button:last-child:hover {
    background-color: var(--danger-hover);
  }
  .filter-menu-list-item-options-inputs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    row-gap: var(--spacing-sm);
    max-height: 10rem;
    overflow-y: scroll;
    scrollbar-width: thin;
    scrollbar-color: var(--border) var(--surface);
    padding: var(--spacing-sm) var(--spacing-xs);
  }

  .filter-menu-list-item-options-inputs > label {
    display: flex;
    flex-direction: row-reverse;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-sm);
    padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
    box-sizing: border-box;
    transition: var(--transition);
    cursor: pointer;
  }

  .filter-menu-list-item-options-inputs > label:hover {
    box-shadow: var(--shadow-md);
    background: var(--hover-bg);
  }
  .filter-menu-list-item-options-done {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }

  .filter-menu-list-item-options-done > button {
    /* Inherits from .btn base, uses primary blue style */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--button-padding-y) var(--spacing-lg);
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
    font-weight: var(--font-bold);
  }

  .filter-menu-list-item-options-done > button:hover {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .filter-menu-buttons {
    width: 100%;
    border: none;
    font-size: var(--text-base);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-direction: row;
    column-gap: 9px;
  }

  .filter-menu-buttons > button {
    /* Inherits from .btn base */
    padding: var(--button-padding-y) var(--spacing-lg);
  }

  .filter-menu-buttons > button:first-child {
    /* Cancel button - default neutral style */
    background: var(--surface);
    color: var(--muted);
  }

  .filter-menu-buttons > button:first-child:hover {
    background: var(--hover-bg);
  }

  .filter-menu-buttons > button.active {
    /* Apply button - uses standard active (blue) style from .btn.active */
  }

  /* Removed - now handled by .btn:hover base style */

  .export-menu {
    width: 280px;
  }

  .export-menu-header {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.75rem;
  }

  .export-menu-header span {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--muted);
  }

  .export-option-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .export-option-label {
    font-size: var(--text-sm);
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .export-option-value {
    font-weight: var(--font-medium);
    color: var(--text-dark);
  }

  /* Reuse filter button grid style for format buttons */
  .export-format-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.375rem;
  }

  .export-format-btn {
    /* Uses .btn base styles */
    padding: 0.3rem var(--spacing-sm);
    font-size: var(--text-sm);
  }

  /* .active state handled by .btn.active base style */

  /* Sliders reuse standard input styles */
  .export-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    border-radius: 1.5px;
    background: var(--border);
    outline: none;
    cursor: pointer;
  }

  .export-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--primary);
    border: 2px solid var(--surface);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .export-slider::-webkit-slider-thumb:hover {
    background: var(--primary-hover);
  }

  .export-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--primary);
    border: 2px solid var(--surface);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .export-slider::-moz-range-thumb:hover {
    background: var(--primary-hover);
  }

  .export-slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--muted);
    opacity: 0.7;
    margin-top: 0.125rem;
  }

  .export-dimensions-group {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.75rem;
  }

  .export-aspect-lock {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--text-sm);
    color: var(--muted);
    cursor: pointer;
    margin-top: 0.375rem;
    user-select: none;
  }

  .export-aspect-lock input[type='checkbox'] {
    cursor: pointer;
  }

  /* Reuse filter button action styles */
  .export-actions {
    display: flex;
    gap: 0.375rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .export-action-btn {
    /* Primary action button - inherits from .btn base */
    flex: 1;
    padding: var(--button-padding-y) var(--spacing-md);
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .export-action-btn:hover {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .export-reset-btn {
    /* Inherits from .btn base */
    padding: var(--button-padding-y) var(--spacing-md);
    font-size: var(--text-sm);
  }

  /* Reset button hover handled by .btn:hover */

  .chevron-down {
    width: 1rem;
    height: 1rem;
    margin-left: var(--spacing-xs);
  }

  .control-group select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: url('data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"%3E%3Cpath d="M6 9L12 15L18 9" stroke="%23000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E');
    background-color: var(--surface);
    background-repeat: no-repeat;
    background-position: right var(--spacing-xs) center;
    width: max-content;
    padding: var(--input-padding-y) 30px var(--input-padding-y) var(--input-padding-x);
  }
  .control-group select option {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--surface);
  }

  /* Annotation select component styling */
  .control-group protspace-annotation-select {
    display: inline-block;
    width: max-content;
    min-width: 10rem;
  }

  .right-controls-data > button {
    color: var(--text-dark);
    font-weight: var(--font-normal);
    padding-right: 0.9rem;
  }

  /* Responsive layout: stack controls on small screens */
  @media (max-width: 1024px) {
    .control-bar {
      flex-wrap: wrap;
      align-items: stretch;
      gap: 0.5rem 0;
    }

    /* Ensure three distinct rows in order: left, search, right */
    .left-controls,
    .search-group,
    .right-controls {
      width: 100%;
      justify-content: flex-start;
      flex-basis: 100%;
    }

    .left-controls {
      order: 1;
    }
    .search-group {
      order: 2;
    }
    .right-controls {
      order: 3;
    }

    .control-group {
      width: 100%;
    }

    /* Make selects expand to available width inside a row */
    .control-group select {
      width: 100%;
    }

    /* Annotation select should also expand on small screens */
    .control-group protspace-annotation-select {
      width: 100%;
    }
  }
`;
