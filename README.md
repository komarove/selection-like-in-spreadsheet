# Selection like in Spreadsheet

A browser extension that allows you to select HTML table cells with mouse-dragging (exactly like in Microsoft Excel) and see instant calculations in a sleek status bar.

## Features

- **Excel-style Selection**: Drag your cursor over table cells to select a range.
- **Instant Stats**: Automatic calculation of **Sum**, **Average**, and **Count** for selected numeric values.
- **Smart Copy (Ctrl+C)**: Copy selected cells as Tab-Separated Values (TSV), ready to be pasted directly into Excel or Google Sheets.
- **Customizable**:
  - Toggle extension on/off.
  - Theme support (Light, Dark, and System).
  - "Override Selection" mode to prevent default browser text behavior while selecting cells.
- **Premium Design**: Modern, glassmorphic status bar that appears dynamically.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the project directory.

## Usage

1. Open any website with a `<table>` element (e.g., Wikipedia tables, financial reports, or the included `test.html`).
2. Click and drag over the cells you want to analyze.
3. Check the status bar in the bottom-right corner for calculations.
4. Press `Ctrl+C` (or `Cmd+C` on Mac) to copy the data.

## Developer

Developed with ❤️ using Vanilla JavaScript and CSS.
