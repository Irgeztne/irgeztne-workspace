(function (root) {
  'use strict';

  var COLUMN_TYPES = ['text', 'number', 'currency', 'percent', 'date'];

  function clone(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return fallback; }
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function clamp(value, min, max) {
    value = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min));
  }

  function columnLabel(index) {
    var label = '';
    var value = Number(index) + 1;
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }

  function columnIndex(label) {
    return String(label || '').toUpperCase().split('').reduce(function (sum, char) {
      var code = char.charCodeAt(0) - 64;
      return code >= 1 && code <= 26 ? sum * 26 + code : sum;
    }, 0) - 1;
  }

  function cellAddress(column, row) {
    return columnLabel(column) + String(row);
  }

  function parseAddress(address) {
    var match = /^([A-Z]+)(\d+)$/i.exec(String(address || '').trim());
    return match ? { column: columnIndex(match[1]), row: Number(match[2]) } : null;
  }

  function makeColumns(count) {
    return Array.from({ length: clamp(count || 8, 1, 26) }, function (_, index) {
      var id = columnLabel(index);
      return { id: id, name: id, type: 'text' };
    });
  }

  function normalizeSheet(sheet, index) {
    sheet = sheet && typeof sheet === 'object' ? clone(sheet, {}) : {};
    var columns = Array.isArray(sheet.columns) && sheet.columns.length ? sheet.columns : makeColumns(sheet.columnCount || 8);
    columns = columns.slice(0, 26).map(function (column, columnNumber) {
      column = column && typeof column === 'object' ? column : {};
      var id = columnLabel(columnNumber);
      return {
        id: id,
        name: String(column.name || column.id || id),
        type: COLUMN_TYPES.indexOf(String(column.type)) !== -1 ? String(column.type) : 'text'
      };
    });
    var cells = {};
    Object.keys(sheet.cells && typeof sheet.cells === 'object' ? sheet.cells : {}).forEach(function (address) {
      var parsed = parseAddress(address);
      if (!parsed || parsed.column >= columns.length) return;
      var cell = sheet.cells[address];
      cells[cellAddress(parsed.column, parsed.row)] = {
        raw: String(cell && typeof cell === 'object' && cell.raw != null ? cell.raw : (cell && cell.value != null ? cell.value : cell == null ? '' : cell))
      };
    });
    return {
      id: String(sheet.id || uid('sheet')),
      name: String(sheet.name || 'Sheet ' + (index + 1)),
      rowCount: clamp(sheet.rowCount || 20, 1, 200),
      columns: columns,
      cells: cells,
      filter: {
        column: String(sheet.filter && sheet.filter.column || ''),
        query: String(sheet.filter && sheet.filter.query || '')
      },
      sort: {
        column: String(sheet.sort && sheet.sort.column || ''),
        direction: sheet.sort && sheet.sort.direction === 'desc' ? 'desc' : 'asc'
      }
    };
  }

  function normalizePayload(payload) {
    payload = payload && typeof payload === 'object' ? clone(payload, {}) : {};
    var locale = payload.locale === 'ru' || payload.locale === 'en' ? payload.locale : '';
    var sheets = Array.isArray(payload.sheets) && payload.sheets.length
      ? payload.sheets.map(normalizeSheet)
      : [normalizeSheet({}, 0)];
    var activeSheetId = String(payload.activeSheetId || '');
    if (!sheets.some(function (sheet) { return sheet.id === activeSheetId; })) activeSheetId = sheets[0].id;
    return { sheets: sheets, activeSheetId: activeSheetId, locale: locale };
  }

  function createPayload(options) {
    options = options || {};
    var locale = options.locale === 'ru' || options.locale === 'en' ? options.locale : '';
    var sheet = normalizeSheet({
      id: options.sheetId || uid('sheet'),
      name: options.sheetName || (locale === 'ru' ? 'Лист 1' : 'Sheet 1'),
      rowCount: options.rows || 20,
      columns: makeColumns(options.columns || 8),
      cells: {}
    }, 0);
    return { sheets: [sheet], activeSheetId: sheet.id, locale: locale };
  }

  function getSheet(payload, sheetId) {
    payload = payload && typeof payload === 'object' ? payload : {};
    var sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
    return sheets.find(function (sheet) { return sheet.id === String(sheetId || payload.activeSheetId || ''); }) || sheets[0] || null;
  }

  function getCellRaw(payload, sheetId, address) {
    var sheet = getSheet(payload, sheetId);
    var cell = sheet && sheet.cells ? sheet.cells[String(address || '').toUpperCase()] : null;
    return String(cell && cell.raw != null ? cell.raw : '');
  }

  function setCell(payload, sheetId, address, rawValue) {
    var sheet = getSheet(payload, sheetId);
    var parsed = parseAddress(address);
    if (!sheet || !parsed || parsed.column >= sheet.columns.length || parsed.row < 1 || parsed.row > sheet.rowCount) return payload;
    var key = cellAddress(parsed.column, parsed.row);
    var raw = String(rawValue == null ? '' : rawValue);
    if (raw) sheet.cells[key] = { raw: raw };
    else delete sheet.cells[key];
    return payload;
  }

  function numeric(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    var normalized = String(value == null ? '' : value).trim().replace(',', '.');
    if (!normalized) return 0;
    var number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function rangeAddresses(start, end) {
    var first = parseAddress(start);
    var last = parseAddress(end);
    if (!first || !last) return [];
    var addresses = [];
    for (var row = Math.min(first.row, last.row); row <= Math.max(first.row, last.row); row += 1) {
      for (var column = Math.min(first.column, last.column); column <= Math.max(first.column, last.column); column += 1) {
        addresses.push(cellAddress(column, row));
      }
    }
    return addresses;
  }

  function arithmetic(expression) {
    var tokens = String(expression || '').match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
    var compact = String(expression || '').replace(/\s+/g, '');
    if (tokens.join('') !== compact) return '#ERROR!';
    var index = 0;
    function factor() {
      var token = tokens[index++];
      if (token === '(') {
        var value = sum();
        if (tokens[index++] !== ')') throw new Error('parenthesis');
        return value;
      }
      if (token === '-') return -factor();
      if (token === '+') return factor();
      var number = Number(token);
      if (!Number.isFinite(number)) throw new Error('number');
      return number;
    }
    function product() {
      var value = factor();
      while (tokens[index] === '*' || tokens[index] === '/') {
        var operator = tokens[index++];
        var right = factor();
        value = operator === '*' ? value * right : (right === 0 ? NaN : value / right);
      }
      return value;
    }
    function sum() {
      var value = product();
      while (tokens[index] === '+' || tokens[index] === '-') {
        var operator = tokens[index++];
        var right = product();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    }
    try {
      var result = sum();
      return index === tokens.length && Number.isFinite(result) ? result : '#ERROR!';
    } catch (error) {
      return '#ERROR!';
    }
  }

  function getCellComputed(payload, sheetId, address, trail) {
    var raw = getCellRaw(payload, sheetId, address);
    if (!raw || raw.charAt(0) !== '=') return /^[-+]?\d+(?:[.,]\d+)?$/.test(raw.trim()) ? numeric(raw) : raw;
    trail = trail || Object.create(null);
    var key = String(address).toUpperCase();
    if (trail[key]) return '#CYCLE!';
    trail[key] = true;
    var expression = raw.slice(1).trim();
    var functionMatch = /^(SUM|AVERAGE|MIN|MAX|COUNT)\((.*)\)$/i.exec(expression);
    var result;
    if (functionMatch) {
      var addresses = [];
      functionMatch[2].split(',').forEach(function (argument) {
        var range = /^([A-Z]+\d+):([A-Z]+\d+)$/i.exec(argument.trim());
        if (range) addresses = addresses.concat(rangeAddresses(range[1], range[2]));
        else if (/^[A-Z]+\d+$/i.test(argument.trim())) addresses.push(argument.trim().toUpperCase());
      });
      var values = addresses.map(function (cell) { return getCellComputed(payload, sheetId, cell, Object.assign({}, trail)); })
        .filter(function (value) { return typeof value === 'number' && Number.isFinite(value); });
      var name = functionMatch[1].toUpperCase();
      if (name === 'COUNT') result = values.length;
      else if (!values.length) result = 0;
      else if (name === 'SUM') result = values.reduce(function (sum, value) { return sum + value; }, 0);
      else if (name === 'AVERAGE') result = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
      else if (name === 'MIN') result = Math.min.apply(Math, values);
      else result = Math.max.apply(Math, values);
    } else {
      var replaced = expression.replace(/[A-Z]+\d+/gi, function (cell) {
        return String(numeric(getCellComputed(payload, sheetId, cell.toUpperCase(), Object.assign({}, trail))));
      });
      result = arithmetic(replaced);
    }
    delete trail[key];
    return result;
  }

  function getCellDisplay(payload, sheetId, address) {
    var sheet = getSheet(payload, sheetId);
    var parsed = parseAddress(address);
    var value = getCellComputed(payload, sheetId, address);
    if (!sheet || !parsed) return String(value == null ? '' : value);
    var type = sheet.columns[parsed.column] ? sheet.columns[parsed.column].type : 'text';
    if (typeof value !== 'number') return String(value == null ? '' : value);
    if (type === 'currency') return value.toFixed(2) + ' $';
    if (type === 'percent') return (value * 100).toFixed(2).replace(/\.00$/, '') + '%';
    if (type === 'date') {
      var date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
    }
    return String(Math.round(value * 1000000) / 1000000);
  }

  function addRow(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (sheet) sheet.rowCount = clamp(sheet.rowCount + 1, 1, 200);
    return payload;
  }

  function removeRow(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (!sheet || sheet.rowCount <= 1) return payload;
    var row = sheet.rowCount;
    Object.keys(sheet.cells).forEach(function (address) {
      var parsed = parseAddress(address);
      if (parsed && parsed.row === row) delete sheet.cells[address];
    });
    sheet.rowCount -= 1;
    return payload;
  }

  function addColumn(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (!sheet || sheet.columns.length >= 26) return payload;
    var id = columnLabel(sheet.columns.length);
    sheet.columns.push({ id: id, name: id, type: 'text' });
    return payload;
  }

  function removeColumn(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (!sheet || sheet.columns.length <= 1) return payload;
    var column = sheet.columns.length - 1;
    Object.keys(sheet.cells).forEach(function (address) {
      var parsed = parseAddress(address);
      if (parsed && parsed.column === column) delete sheet.cells[address];
    });
    sheet.columns.pop();
    return payload;
  }

  function setColumn(payload, sheetId, column, patch) {
    var sheet = getSheet(payload, sheetId);
    column = Number(column);
    if (!sheet || !sheet.columns[column]) return payload;
    if (patch && patch.name != null) sheet.columns[column].name = String(patch.name || sheet.columns[column].id);
    if (patch && COLUMN_TYPES.indexOf(String(patch.type)) !== -1) sheet.columns[column].type = String(patch.type);
    return payload;
  }

  function comparable(value) {
    if (typeof value === 'number') return value;
    var number = Number(String(value || '').replace(',', '.'));
    return String(value || '').trim() && Number.isFinite(number) ? number : String(value || '').toLocaleLowerCase();
  }

  function getVisibleRows(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (!sheet) return [];
    var rows = Array.from({ length: sheet.rowCount }, function (_, index) { return index + 1; });
    var query = String(sheet.filter && sheet.filter.query || '').trim().toLocaleLowerCase();
    var filterColumn = String(sheet.filter && sheet.filter.column || '').toUpperCase();
    if (query) {
      rows = rows.filter(function (row) {
        var columns = filterColumn ? [filterColumn] : sheet.columns.map(function (column) { return column.id; });
        return columns.some(function (column) {
          var address = column + row;
          return (getCellRaw(payload, sheetId, address) + ' ' + getCellDisplay(payload, sheetId, address)).toLocaleLowerCase().includes(query);
        });
      });
    }
    var sortColumn = String(sheet.sort && sheet.sort.column || '').toUpperCase();
    if (sortColumn) {
      var direction = sheet.sort.direction === 'desc' ? -1 : 1;
      rows.sort(function (left, right) {
        var a = comparable(getCellComputed(payload, sheetId, sortColumn + left));
        var b = comparable(getCellComputed(payload, sheetId, sortColumn + right));
        if (a === '' && b !== '') return 1;
        if (b === '' && a !== '') return -1;
        return (a < b ? -1 : a > b ? 1 : left - right) * direction;
      });
    }
    return rows;
  }

  function parseCsv(text) {
    var rows = [[]];
    var value = '';
    var quoted = false;
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    for (var index = 0; index < text.length; index += 1) {
      var char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { rows[rows.length - 1].push(value); value = ''; }
      else if (char === '\n') { rows[rows.length - 1].push(value.replace(/\r$/, '')); value = ''; rows.push([]); }
      else value += char;
    }
    rows[rows.length - 1].push(value.replace(/\r$/, ''));
    if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    return rows;
  }

  function fromCsv(text) {
    var rows = parseCsv(text);
    var columnCount = Math.max(1, Math.min(26, rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0)));
    var payload = createPayload({ rows: Math.max(1, rows.length), columns: columnCount, sheetName: 'CSV' });
    rows.forEach(function (row, rowIndex) {
      row.slice(0, columnCount).forEach(function (value, columnIndex) {
        setCell(payload, payload.activeSheetId, cellAddress(columnIndex, rowIndex + 1), value);
      });
    });
    return payload;
  }

  function csvValue(value) {
    value = String(value == null ? '' : value);
    return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  function toCsv(payload, sheetId) {
    var sheet = getSheet(payload, sheetId);
    if (!sheet) return '';
    return Array.from({ length: sheet.rowCount }, function (_, rowIndex) {
      return sheet.columns.map(function (column) {
        return csvValue(getCellRaw(payload, sheet.id, column.id + (rowIndex + 1)));
      }).join(',');
    }).join('\n');
  }

  function addSheet(payload, name, locale) {
    locale = payload.locale === 'ru' || payload.locale === 'en'
      ? payload.locale
      : (locale === 'ru' ? 'ru' : 'en');
    payload.locale = locale;
    var sheet = normalizeSheet({ name: name || (locale === 'ru' ? 'Лист ' : 'Sheet ') + (payload.sheets.length + 1), rowCount: 20, columns: makeColumns(8) }, payload.sheets.length);
    payload.sheets.push(sheet);
    payload.activeSheetId = sheet.id;
    return payload;
  }

  function removeSheet(payload, sheetId) {
    if (!payload.sheets || payload.sheets.length <= 1) return payload;
    payload.sheets = payload.sheets.filter(function (sheet) { return sheet.id !== sheetId; });
    if (!payload.sheets.some(function (sheet) { return sheet.id === payload.activeSheetId; })) payload.activeSheetId = payload.sheets[0].id;
    return payload;
  }

  function renameSheet(payload, sheetId, name) {
    var sheet = getSheet(payload, sheetId);
    if (sheet && String(name || '').trim()) sheet.name = String(name).trim();
    return payload;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(object, locale) {
    var ru = locale === 'ru';
    var payload = normalizePayload(object && object.payload);
    var sheet = getSheet(payload, payload.activeSheetId);
    var rows = getVisibleRows(payload, sheet.id);
    function t(ruText, enText) { return ru ? ruText : enText; }
    function columnOptions(selected, blankLabel) {
      return '<option value="">' + escapeHtml(blankLabel) + '</option>' + sheet.columns.map(function (column) {
        return '<option value="' + column.id + '"' + (selected === column.id ? ' selected' : '') + '>' + escapeHtml(column.name) + '</option>';
      }).join('');
    }
    var typeLabels = {
      text: t('Текст', 'Text'), number: t('Число', 'Number'), currency: t('Валюта', 'Currency'),
      percent: t('Процент', 'Percent'), date: t('Дата', 'Date')
    };
    return [
      '<section class="ns-office-sheet" data-office-spreadsheet data-office-id="' + escapeHtml(object.id) + '">',
      '  <div class="ns-office-sheet__toolbar">',
      '    <input class="ns-office-sheet__object-title" value="' + escapeHtml(object.title || '') + '" data-sheet-title aria-label="' + escapeHtml(t('Название таблицы', 'Spreadsheet title')) + '" placeholder="' + escapeHtml(t('Название таблицы', 'Spreadsheet title')) + '">',
      '    <button type="button" data-sheet-action="add-sheet">' + escapeHtml(t('Новый лист', 'New sheet')) + '</button>',
      '    <button type="button" data-sheet-action="rename-sheet">' + escapeHtml(t('Переименовать лист', 'Rename sheet')) + '</button>',
      '    <button type="button" data-sheet-action="remove-sheet"' + (payload.sheets.length <= 1 ? ' disabled' : '') + '>' + escapeHtml(t('Удалить лист', 'Delete sheet')) + '</button>',
      '    <button type="button" data-sheet-action="add-row">' + escapeHtml(t('Добавить строку', 'Add row')) + '</button>',
      '    <button type="button" data-sheet-action="remove-row"' + (sheet.rowCount <= 1 ? ' disabled' : '') + '>' + escapeHtml(t('Убрать строку', 'Remove row')) + '</button>',
      '    <button type="button" data-sheet-action="add-column">' + escapeHtml(t('Добавить столбец', 'Add column')) + '</button>',
      '    <button type="button" data-sheet-action="remove-column"' + (sheet.columns.length <= 1 ? ' disabled' : '') + '>' + escapeHtml(t('Убрать столбец', 'Remove column')) + '</button>',
      '    <label class="ns-office-sheet__file">' + escapeHtml(t('Импорт CSV', 'Import CSV')) + '<input type="file" accept=".csv,text/csv" data-sheet-import hidden></label>',
      '    <button type="button" data-sheet-action="export-csv">' + escapeHtml(t('Экспорт CSV', 'Export CSV')) + '</button>',
      '  </div>',
      '  <div class="ns-office-sheet__tabs">' + payload.sheets.map(function (entry) {
        return '<button type="button" class="' + (entry.id === sheet.id ? 'is-active' : '') + '" data-sheet-open="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.name) + '</button>';
      }).join('') + '</div>',
      '  <div class="ns-office-sheet__controls">',
      '    <select data-sheet-control="filter-column">' + columnOptions(sheet.filter.column, t('Все столбцы', 'All columns')) + '</select>',
      '    <input data-sheet-control="filter-query" value="' + escapeHtml(sheet.filter.query) + '" placeholder="' + escapeHtml(t('Фильтр значений…', 'Filter values…')) + '">',
      '    <select data-sheet-control="sort-column">' + columnOptions(sheet.sort.column, t('Без сортировки', 'No sorting')) + '</select>',
      '    <select data-sheet-control="sort-direction"><option value="asc"' + (sheet.sort.direction === 'asc' ? ' selected' : '') + '>' + escapeHtml(t('По возрастанию', 'Ascending')) + '</option><option value="desc"' + (sheet.sort.direction === 'desc' ? ' selected' : '') + '>' + escapeHtml(t('По убыванию', 'Descending')) + '</option></select>',
      '    <button type="button" data-sheet-action="clear-view">' + escapeHtml(t('Сбросить', 'Clear')) + '</button>',
      '  </div>',
      '  <p class="ns-office-sheet__formula-help">' + escapeHtml(t('Формулы: =A1*2+5, =SUM(A1:A5), AVERAGE, MIN, MAX, COUNT.', 'Formulas: =A1*2+5, =SUM(A1:A5), AVERAGE, MIN, MAX, COUNT.')) + '</p>',
      '  <div class="ns-office-sheet__grid-wrap"><table class="ns-office-sheet__grid"><thead><tr><th class="ns-office-sheet__corner">#</th>' + sheet.columns.map(function (column, columnNumber) {
        return '<th><input data-sheet-column-name="' + columnNumber + '" value="' + escapeHtml(column.name) + '" aria-label="' + escapeHtml(t('Имя столбца', 'Column name')) + '"><select data-sheet-column-type="' + columnNumber + '">' + COLUMN_TYPES.map(function (type) { return '<option value="' + type + '"' + (type === column.type ? ' selected' : '') + '>' + escapeHtml(typeLabels[type]) + '</option>'; }).join('') + '</select></th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr><th>' + row + '</th>' + sheet.columns.map(function (column, columnNumber) {
          var address = column.id + row;
          var raw = getCellRaw(payload, sheet.id, address);
          var display = getCellDisplay(payload, sheet.id, address);
          return '<td><div class="ns-office-sheet__cell"><input data-sheet-cell="' + address + '" data-sheet-row="' + row + '" data-sheet-column="' + columnNumber + '" value="' + escapeHtml(raw) + '" title="' + escapeHtml(display) + '" aria-label="' + address + '">' + (raw.charAt(0) === '=' ? '<output>' + escapeHtml(display) + '</output>' : '') + '</div></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>',
      '  <div class="ns-office-sheet__foot"><span>' + escapeHtml(t('Автосохранение в Office', 'Autosaved in Office')) + '</span><span>' + rows.length + ' / ' + sheet.rowCount + ' ' + escapeHtml(t('строк', 'rows')) + '</span></div>',
      '</section>'
    ].join('');
  }

  function bind(container, object, api) {
    if (!container || !object || !api) return;
    var host = container.querySelector('[data-office-spreadsheet]');
    if (!host || host.dataset.bound) return;
    host.dataset.bound = 'true';

    function workingPayload() { return normalizePayload(object.payload); }
    function save(payload, message) { api.save(payload, message); }

    host.addEventListener('change', function (event) {
      var target = event.target;
      var payload = workingPayload();
      var sheet = getSheet(payload, payload.activeSheetId);
      if (target.matches('[data-sheet-title]')) { api.updateTitle(target.value); return; }
      if (target.matches('[data-sheet-cell]')) setCell(payload, sheet.id, target.getAttribute('data-sheet-cell'), target.value);
      else if (target.matches('[data-sheet-column-name]')) setColumn(payload, sheet.id, target.getAttribute('data-sheet-column-name'), { name: target.value });
      else if (target.matches('[data-sheet-column-type]')) setColumn(payload, sheet.id, target.getAttribute('data-sheet-column-type'), { type: target.value });
      else if (target.matches('[data-sheet-control="filter-column"]')) sheet.filter.column = target.value;
      else if (target.matches('[data-sheet-control="filter-query"]')) sheet.filter.query = target.value;
      else if (target.matches('[data-sheet-control="sort-column"]')) sheet.sort.column = target.value;
      else if (target.matches('[data-sheet-control="sort-direction"]')) sheet.sort.direction = target.value === 'desc' ? 'desc' : 'asc';
      else if (target.matches('[data-sheet-import]')) {
        var file = target.files && target.files[0];
        if (!file || typeof FileReader === 'undefined') return;
        var reader = new FileReader();
        reader.onload = function () { save(fromCsv(reader.result), api.t('CSV импортирован.', 'CSV imported.')); };
        reader.onerror = function () { api.notice(api.t('Не удалось прочитать CSV.', 'Could not read CSV.')); };
        reader.readAsText(file);
        return;
      } else return;
      save(payload, api.t('Таблица сохранена.', 'Spreadsheet saved.'));
    });

    host.addEventListener('click', function (event) {
      var open = event.target.closest('[data-sheet-open]');
      if (open) {
        var openPayload = workingPayload();
        openPayload.activeSheetId = open.getAttribute('data-sheet-open');
        save(openPayload);
        return;
      }
      var button = event.target.closest('[data-sheet-action]');
      if (!button || button.disabled) return;
      var action = button.getAttribute('data-sheet-action');
      var payload = workingPayload();
      var sheet = getSheet(payload, payload.activeSheetId);
      if (action === 'add-sheet') addSheet(payload, '', api.locale);
      else if (action === 'rename-sheet') {
        var name = api.prompt(api.t('Название листа', 'Sheet name'), sheet.name);
        if (name == null) return;
        renameSheet(payload, sheet.id, name);
      } else if (action === 'remove-sheet') {
        if (!api.confirm(api.t('Удалить текущий лист?', 'Delete the current sheet?'))) return;
        removeSheet(payload, sheet.id);
      } else if (action === 'add-row') addRow(payload, sheet.id);
      else if (action === 'remove-row') removeRow(payload, sheet.id);
      else if (action === 'add-column') addColumn(payload, sheet.id);
      else if (action === 'remove-column') removeColumn(payload, sheet.id);
      else if (action === 'clear-view') { sheet.filter = { column: '', query: '' }; sheet.sort = { column: '', direction: 'asc' }; }
      else if (action === 'export-csv') {
        api.download((object.title || 'spreadsheet') + '.csv', 'text/csv;charset=utf-8', toCsv(payload, sheet.id));
        return;
      } else return;
      save(payload, api.t('Таблица сохранена.', 'Spreadsheet saved.'));
    });

    host.addEventListener('keydown', function (event) {
      var cell = event.target.closest('[data-sheet-cell]');
      if (!cell || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
      var row = Number(cell.getAttribute('data-sheet-row'));
      var column = Number(cell.getAttribute('data-sheet-column'));
      if (event.key === 'ArrowUp') row -= 1;
      if (event.key === 'ArrowDown' || event.key === 'Enter') row += 1;
      if (event.key === 'ArrowLeft') column -= 1;
      if (event.key === 'ArrowRight') column += 1;
      var next = host.querySelector('[data-sheet-row="' + row + '"][data-sheet-column="' + column + '"]');
      if (!next) return;
      event.preventDefault();
      next.focus();
      next.select();
    });
  }

  root.NSOfficeSpreadsheetV1 = Object.freeze({
    COLUMN_TYPES: Object.freeze(COLUMN_TYPES.slice()),
    createPayload: createPayload,
    normalizePayload: normalizePayload,
    setCell: setCell,
    getCellRaw: getCellRaw,
    getCellComputed: getCellComputed,
    getCellDisplay: getCellDisplay,
    addRow: addRow,
    removeRow: removeRow,
    addColumn: addColumn,
    removeColumn: removeColumn,
    setColumn: setColumn,
    getVisibleRows: getVisibleRows,
    fromCsv: fromCsv,
    toCsv: toCsv,
    addSheet: addSheet,
    removeSheet: removeSheet,
    renameSheet: renameSheet,
    render: render,
    bind: bind
  });
})(window);
