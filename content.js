(function() {
    let isSelecting = false;
    let startCell = null;
    let selectedCells = new Set();
    let statusBar = null;

    function init() {
        createStatusBar();
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    function createStatusBar() {
        statusBar = document.createElement('div');
        statusBar.id = 'sle-status-bar';
        statusBar.innerHTML = `
            <div class="sle-stat-item">
                <span class="sle-stat-label">Average</span>
                <span class="sle-stat-value" id="sle-avg">0</span>
            </div>
            <div class="sle-stat-item">
                <span class="sle-stat-label">Count</span>
                <span class="sle-stat-value" id="sle-count">0</span>
            </div>
            <div class="sle-stat-item">
                <span class="sle-stat-label">Sum</span>
                <span class="sle-stat-value" id="sle-sum">0</span>
            </div>
        `;
        document.body.appendChild(statusBar);
    }

    function getCellInfo(element) {
        const cell = element.closest('td, th');
        if (!cell) return null;
        const row = cell.parentElement;
        const table = row.closest('table');
        if (!table) return null;

        return {
            element: cell,
            rowIndex: row.rowIndex,
            colIndex: cell.cellIndex,
            table: table
        };
    }

    function handleMouseDown(e) {
        const info = getCellInfo(e.target);
        if (!info) {
            clearSelection();
            return;
        }

        // Check if we are already selecting or if it's a new selection
        isSelecting = true;
        startCell = info;
        
        // Clear previous selection unless Shift is held (advanced feature, keeping it simple for now)
        clearSelection();
        addCellToSelection(info.element);
    }

    function handleMouseMove(e) {
        if (!isSelecting || !startCell) return;

        const currentCell = getCellInfo(e.target);
        if (!currentCell || currentCell.table !== startCell.table) return;

        updateSelectionRange(startCell, currentCell);
    }

    function handleMouseUp() {
        if (isSelecting) {
            isSelecting = false;
            updateStats();
        }
    }

    function updateSelectionRange(start, end) {
        clearSelectionStyles();
        selectedCells.clear();

        const table = start.table;
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minCol = Math.min(start.colIndex, end.colIndex);
        const maxCol = Math.max(start.colIndex, end.colIndex);

        for (let r = minRow; r <= maxRow; r++) {
            const row = table.rows[r];
            if (!row) continue;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = row.cells[c];
                if (cell) {
                    addCellToSelection(cell);
                }
            }
        }
        updateStats();
    }

    function addCellToSelection(cell) {
        cell.classList.add('sle-selected');
        selectedCells.add(cell);
    }

    function clearSelection() {
        clearSelectionStyles();
        selectedCells.clear();
        updateStats();
    }

    function clearSelectionStyles() {
        document.querySelectorAll('.sle-selected').forEach(el => {
            el.classList.remove('sle-selected');
        });
    }

    function updateStats() {
        const numbers = [];
        selectedCells.forEach(cell => {
            const val = parseNumber(cell.textContent);
            if (val !== null) {
                numbers.push(val);
            }
        });

        if (numbers.length === 0) {
            statusBar.classList.remove('visible');
            return;
        }

        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const count = numbers.length;

        document.getElementById('sle-sum').textContent = formatNumber(sum);
        document.getElementById('sle-avg').textContent = formatNumber(avg);
        document.getElementById('sle-count').textContent = count;

        statusBar.classList.add('visible');
    }

    function parseNumber(text) {
        // Remove whitespace, currency symbols, and handle commas
        let clean = text.replace(/[^\d.-]/g, '');
        if (clean === '' || clean === '-') return null;
        
        // Handle cases like "1,234.56" vs "1.234,56"
        // This is a bit tricky, simple approach for now:
        // If there's a comma AND a dot, assume comma is thousands separator
        // If just a comma, could be decimal or thousands. 
        // We'll try to be smart:
        if (text.includes(',') && text.includes('.')) {
            clean = text.replace(/,/g, '');
        } else if (text.includes(',')) {
            // Check if comma is followed by 3 digits (likely thousands)
            const parts = text.split(',');
            if (parts[parts.length - 1].length === 3) {
                clean = text.replace(/,/g, '');
            } else {
                clean = text.replace(/,/g, '.');
            }
        } else {
            clean = text;
        }

        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
    }

    function formatNumber(num) {
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // Run init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
