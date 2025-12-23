(function () {
    let isSelecting = false;
    let startCell = null;
    let selectedCells = new Set();
    let statusBar = null;
    let settings = {
        enabled: true,
        theme: 'auto',
        overrideSelection: true,
        smartCopy: true
    };

    function init() {
        // Load initial settings
        chrome.storage.sync.get(settings, (loadedSettings) => {
            Object.assign(settings, loadedSettings);
            if (settings.enabled) {
                setupExtension();
            }
            applyTheme();
        });

        // Listen for setting changes
        chrome.storage.onChanged.addListener((changes) => {
            let needsReSetup = false;
            for (let [key, { newValue }] of Object.entries(changes)) {
                settings[key] = newValue;
                if (key === 'enabled') needsReSetup = true;
                if (key === 'theme') applyTheme();
            }

            if (needsReSetup) {
                if (settings.enabled) {
                    setupExtension();
                } else {
                    disableExtension();
                }
            }
        });
    }

    function setupExtension() {
        if (!statusBar) createStatusBar();
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);
    }

    function disableExtension() {
        clearSelection();
        if (statusBar) statusBar.classList.remove('visible');
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.classList.remove('sle-no-select');
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-sle-theme', settings.theme);
    }

    function createStatusBar() {
        statusBar = document.createElement('div');
        statusBar.id = 'sle-status-bar';
        updateStats(); // Initial build with locales
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
        if (!settings.enabled) return;
        const info = getCellInfo(e.target);
        if (!info) {
            clearSelection();
            return;
        }

        isSelecting = true;
        startCell = info;

        if (!(e.ctrlKey || e.metaKey)) {
            clearSelection();
        }
        addCellToSelection(info.element);

        if (settings.overrideSelection) {
            document.body.classList.add('sle-no-select');
        }
    }

    function handleMouseMove(e) {
        if (!isSelecting || !startCell) return;

        const currentCell = getCellInfo(e.target);
        if (!currentCell || currentCell.table !== startCell.table) return;

        updateSelectionRange(startCell, currentCell, (e.ctrlKey || e.metaKey));
    }

    function handleMouseUp() {
        if (isSelecting) {
            isSelecting = false;
            updateStats();
            document.body.classList.remove('sle-no-select');
        }
    }

    function handleKeyDown(e) {
        if (settings.smartCopy && (e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (selectedCells.size > 0) {
                copySelectedToClipboard();
            }
        }
    }

    function copySelectedToClipboard() {
        if (!startCell) return;

        const rows = new Map();
        selectedCells.forEach(cell => {
            const rowIdx = cell.parentElement.rowIndex;
            if (!rows.has(rowIdx)) rows.set(rowIdx, []);
            rows.get(rowIdx).push(cell);
        });

        const sortedRowIndices = Array.from(rows.keys()).sort((a, b) => a - b);
        const tsvLines = sortedRowIndices.map(rowIdx => {
            const cells = rows.get(rowIdx);
            return cells
                .sort((a, b) => a.cellIndex - b.cellIndex)
                .map(c => c.textContent.trim())
                .join('\t');
        });

        const tsv = tsvLines.join('\n');

        navigator.clipboard.writeText(tsv).then(() => {
            showCopyFeedback();
        });
    }

    function showCopyFeedback() {
        const sumLabel = document.querySelector('#sle-sum').parentElement;

        sumLabel.innerHTML = `
            <span class="sle-stat-label">${chrome.i18n.getMessage('copied') || 'Copied!'}</span>
            <span class="sle-stat-value">✓</span>
        `;

        setTimeout(() => {
            updateStats();
        }, 1500);
    }

    function updateSelectionRange(start, end, additive = false) {
        if (!additive) {
            clearSelectionStyles();
        }
        const prevSize = selectedCells.size;
        if (!additive) {
            selectedCells.clear();
        }

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

        if (selectedCells.size !== prevSize) {
            updateStats();
        }
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
            if (statusBar) statusBar.classList.remove('visible');
            return;
        }

        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const count = numbers.length;

        if (!statusBar) createStatusBar();

        const labels = {
            average: chrome.i18n.getMessage('average') || 'Average',
            count: chrome.i18n.getMessage('count') || 'Count',
            sum: chrome.i18n.getMessage('sum') || 'Sum'
        };

        statusBar.innerHTML = `
            <div class="sle-stat-item">
                <span class="sle-stat-label">${labels.average}</span>
                <span class="sle-stat-value" id="sle-avg">0</span>
            </div>
            <div class="sle-stat-item">
                <span class="sle-stat-label">${labels.count}</span>
                <span class="sle-stat-value" id="sle-count">0</span>
            </div>
            <div class="sle-stat-item">
                <span class="sle-stat-label">${labels.sum}</span>
                <span class="sle-stat-value" id="sle-sum">0</span>
            </div>
        `;

        document.getElementById('sle-sum').textContent = formatNumber(sum);
        document.getElementById('sle-avg').textContent = formatNumber(avg);
        document.getElementById('sle-count').textContent = count;

        statusBar.classList.add('visible');
    }

    function parseNumber(text) {
        let clean = text.replace(/[^\d.-]/g, '');
        if (clean === '' || clean === '-') return null;

        if (text.includes(',') && text.includes('.')) {
            clean = text.replace(/,/g, '');
        } else if (text.includes(',')) {
            const parts = text.split(',');
            if (parts[parts.length - 1].length === 3) {
                clean = text.replace(/,/g, '');
            } else {
                clean = text.replace(/,/g, '.');
            }
        }

        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
    }

    function formatNumber(num) {
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    init();
})();
