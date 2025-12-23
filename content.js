(function () {
    let isSelecting = false;
    let startCell = null;
    let selectedCells = new Set();
    let statusBar = null;
    let settings = {
        enabled: true,
        theme: 'auto',
        overrideSelection: true,
        smartCopy: true,
        strictMode: false
    };

    const locales = {
        average: 'Average',
        count: 'Count',
        sum: 'Sum',
        copied: 'Copied!'
    };

    function isOrphaned() {
        return typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id;
    }

    function loadLocales() {
        try {
            if (!isOrphaned()) {
                ['average', 'count', 'sum', 'copied'].forEach(key => {
                    const msg = chrome.i18n.getMessage(key);
                    if (msg) locales[key] = msg;
                });
            }
        } catch (e) {
            // Context invalidated
        }
    }

    function init() {
        loadLocales();
        // Load initial settings
        if (isOrphaned()) return;
        chrome.storage.sync.get(settings, (loadedSettings) => {
            Object.assign(settings, loadedSettings);
            if (settings.enabled) {
                setupExtension();
            }
            applyTheme();
        });

        // Listen for setting changes
        if (isOrphaned()) return;
        chrome.storage.onChanged.addListener((changes) => {
            if (isOrphaned()) return;
            let needsReSetup = false;
            let needsClear = false;
            for (let [key, { newValue }] of Object.entries(changes)) {
                settings[key] = newValue;
                if (key === 'enabled') needsReSetup = true;
                if (key === 'theme') applyTheme();
                if (key === 'strictMode') needsClear = true;
            }

            if (needsClear) {
                clearSelection();
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
        if (isOrphaned() || !settings.enabled) return;
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
        if (isOrphaned() || !settings.smartCopy || !(e.ctrlKey || e.metaKey) || e.key !== 'c') return;
        if (selectedCells.size > 0) {
            copySelectedToClipboard();
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
        const sumElement = document.querySelector('#sle-sum');
        if (!sumElement) return;

        const sumLabel = sumElement.parentElement;
        if (!sumLabel) return;

        sumLabel.innerHTML = `
            <span class="sle-stat-label">${locales.copied}</span>
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
        const val = parseNumber(cell.textContent, settings.strictMode);
        const hasNumber = val !== null;
        if (hasNumber) {
            cell.classList.add('sle-selected');
        } else {
            cell.classList.add('sle-selected-text');
        }
        selectedCells.add(cell);
    }

    function clearSelection() {
        clearSelectionStyles();
        selectedCells.clear();
        updateStats();
    }

    function clearSelectionStyles() {
        document.querySelectorAll('.sle-selected, .sle-selected-text').forEach(el => {
            el.classList.remove('sle-selected', 'sle-selected-text');
        });
    }

    function updateStats() {
        const numbers = [];
        selectedCells.forEach(cell => {
            const val = parseNumber(cell.textContent, settings.strictMode);
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

        const labels = locales;

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

    function parseNumber(text, strict = false) {
        if (strict) {
            // Remove whitespace and check if it's a pure number
            const trimmed = text.trim();
            // Match integers or floats (with . or , as decimal separator)
            // But only if there are no other characters
            if (/^-?\d+([.,]\d+)?$/.test(trimmed)) {
                const clean = trimmed.replace(',', '.');
                const num = parseFloat(clean);
                return isNaN(num) ? null : num;
            }
            return null;
        }

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
