(function (root) {
  'use strict';

  var FIELD_TYPES = ['short', 'long', 'email', 'number', 'select', 'radio', 'checkbox', 'date'];

  function clone(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return fallback; }
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeField(field, index) {
    field = field && typeof field === 'object' ? clone(field, {}) : {};
    var type = FIELD_TYPES.indexOf(String(field.type)) !== -1 ? String(field.type) : 'short';
    var options = Array.isArray(field.options) ? field.options.map(String).filter(Boolean) : [];
    if ((type === 'select' || type === 'radio') && !options.length) options = ['Option 1', 'Option 2'];
    return {
      id: String(field.id || uid('form-field')),
      type: type,
      label: String(field.label || 'Question ' + (index + 1)),
      help: String(field.help || ''),
      placeholder: String(field.placeholder || ''),
      required: Boolean(field.required),
      options: options
    };
  }

  function normalizeResponse(response, index) {
    response = response && typeof response === 'object' ? clone(response, {}) : {};
    return {
      id: String(response.id || uid('form-response')),
      submittedAt: String(response.submittedAt || new Date().toISOString()),
      answers: response.answers && typeof response.answers === 'object' ? response.answers : {},
      number: Number(response.number) > 0 ? Number(response.number) : index + 1
    };
  }

  function normalizePayload(payload) {
    payload = payload && typeof payload === 'object' ? clone(payload, {}) : {};
    return {
      locale: payload.locale === 'ru' || payload.locale === 'en' ? payload.locale : '',
      description: String(payload.description || ''),
      status: ['draft', 'open', 'closed'].indexOf(String(payload.status)) !== -1 ? String(payload.status) : 'draft',
      fields: Array.isArray(payload.fields) ? payload.fields.map(normalizeField) : [],
      responses: Array.isArray(payload.responses) ? payload.responses.map(normalizeResponse) : [],
      responseSheetId: String(payload.responseSheetId || '')
    };
  }

  function createPayload(seed) {
    seed = seed && typeof seed === 'object' ? seed : {};
    return normalizePayload({
      locale: seed.locale,
      description: seed.description || '',
      status: seed.status || 'draft',
      fields: Array.isArray(seed.fields) ? seed.fields : [],
      responses: [],
      responseSheetId: ''
    });
  }

  function addField(payload, type, seed) {
    payload = payload || createPayload();
    var field = normalizeField(Object.assign({}, seed || {}, { type: type }), payload.fields.length);
    payload.fields.push(field);
    return field;
  }

  function updateField(payload, fieldId, patch) {
    var field = payload && payload.fields && payload.fields.find(function (entry) { return entry.id === String(fieldId); });
    if (!field || !patch) return null;
    if (patch.type != null && FIELD_TYPES.indexOf(String(patch.type)) !== -1) field.type = String(patch.type);
    ['label', 'help', 'placeholder'].forEach(function (key) { if (patch[key] != null) field[key] = String(patch[key]); });
    if (patch.required != null) field.required = Boolean(patch.required);
    if (patch.options != null) field.options = (Array.isArray(patch.options) ? patch.options : String(patch.options).split('\n')).map(String).map(function (value) { return value.trim(); }).filter(Boolean);
    return field;
  }

  function removeField(payload, fieldId) {
    var before = payload.fields.length;
    payload.fields = payload.fields.filter(function (field) { return field.id !== String(fieldId); });
    return payload.fields.length !== before;
  }

  function moveField(payload, fieldId, direction) {
    var index = payload.fields.findIndex(function (field) { return field.id === String(fieldId); });
    var target = Math.max(0, Math.min(payload.fields.length - 1, index + Number(direction || 0)));
    if (index < 0 || index === target) return false;
    var field = payload.fields.splice(index, 1)[0];
    payload.fields.splice(target, 0, field);
    return true;
  }

  function addResponse(payload, answers) {
    var response = normalizeResponse({
      answers: answers || {},
      number: payload.responses.length + 1,
      submittedAt: new Date().toISOString()
    }, payload.responses.length);
    payload.responses.push(response);
    return response;
  }

  function answerText(value, locale) {
    if (Array.isArray(value)) return value.join(', ');
    if (value === true) return locale === 'ru' ? 'Да' : 'Yes';
    if (value === false) return locale === 'ru' ? 'Нет' : 'No';
    return String(value == null ? '' : value);
  }

  function responseRows(payload, locale) {
    payload = normalizePayload(payload);
    var header = [locale === 'ru' ? 'Отправлено' : 'Submitted at'].concat(payload.fields.map(function (field) { return field.label; }));
    return [header].concat(payload.responses.map(function (response) {
      return [response.submittedAt].concat(payload.fields.map(function (field) { return answerText(response.answers[field.id], locale); }));
    }));
  }

  function toCsv(payload, locale) {
    function value(source) {
      source = String(source == null ? '' : source);
      return /[",\n\r]/.test(source) ? '"' + source.replace(/"/g, '""') + '"' : source;
    }
    return responseRows(payload, locale).map(function (row) { return row.map(value).join(','); }).join('\n');
  }

  function typeOptions(current, t) {
    var labels = {
      short: t('Короткий текст', 'Short text'), long: t('Длинный текст', 'Long text'),
      email: 'Email', number: t('Число', 'Number'), select: t('Список', 'Dropdown'),
      radio: t('Один вариант', 'Single choice'), checkbox: t('Флажок', 'Checkbox'), date: t('Дата', 'Date')
    };
    return FIELD_TYPES.map(function (type) { return '<option value="' + type + '"' + (type === current ? ' selected' : '') + '>' + escapeHtml(labels[type]) + '</option>'; }).join('');
  }

  function renderBuilderField(field, index, t) {
    var needsOptions = field.type === 'select' || field.type === 'radio';
    return '<article class="ns-office-form__field-card" data-form-field="' + escapeHtml(field.id) + '">' +
      '<div class="ns-office-form__field-order"><strong>' + (index + 1) + '</strong><button type="button" data-form-action="up" title="' + escapeHtml(t('Выше', 'Move up')) + '">↑</button><button type="button" data-form-action="down" title="' + escapeHtml(t('Ниже', 'Move down')) + '">↓</button></div>' +
      '<div class="ns-office-form__field-content"><label><span>' + escapeHtml(t('Вопрос', 'Question')) + '</span><input data-form-field-prop="label" value="' + escapeHtml(field.label) + '"></label>' +
      '<div class="ns-office-form__field-grid"><label><span>' + escapeHtml(t('Тип', 'Type')) + '</span><select data-form-field-prop="type">' + typeOptions(field.type, t) + '</select></label><label><span>' + escapeHtml(t('Подсказка', 'Help text')) + '</span><input data-form-field-prop="help" value="' + escapeHtml(field.help) + '"></label></div>' +
      (needsOptions ? '<label><span>' + escapeHtml(t('Варианты, по одному на строку', 'Options, one per line')) + '</span><textarea data-form-field-prop="options">' + escapeHtml(field.options.join('\n')) + '</textarea></label>' : '') +
      '<label class="ns-office-form__required"><input type="checkbox" data-form-field-prop="required"' + (field.required ? ' checked' : '') + '> ' + escapeHtml(t('Обязательное поле', 'Required field')) + '</label></div>' +
      '<button class="ns-office-form__remove" type="button" data-form-action="remove" title="' + escapeHtml(t('Удалить поле', 'Delete field')) + '">×</button></article>';
  }

  function renderAnswer(field, t) {
    var label = '<span>' + escapeHtml(field.label) + (field.required ? ' <b>*</b>' : '') + '</span>';
    var common = ' name="' + escapeHtml(field.id) + '"' + (field.required ? ' required' : '');
    if (field.type === 'long') return '<label>' + label + '<textarea' + common + ' placeholder="' + escapeHtml(field.placeholder) + '"></textarea><small>' + escapeHtml(field.help) + '</small></label>';
    if (field.type === 'select') return '<label>' + label + '<select' + common + '><option value="">' + escapeHtml(t('Выбрать…', 'Choose…')) + '</option>' + field.options.map(function (option) { return '<option>' + escapeHtml(option) + '</option>'; }).join('') + '</select><small>' + escapeHtml(field.help) + '</small></label>';
    if (field.type === 'radio') return '<fieldset><legend>' + label + '</legend>' + field.options.map(function (option) { return '<label class="ns-office-form__choice"><input type="radio"' + common + ' value="' + escapeHtml(option) + '"> ' + escapeHtml(option) + '</label>'; }).join('') + '<small>' + escapeHtml(field.help) + '</small></fieldset>';
    if (field.type === 'checkbox') return '<label class="ns-office-form__choice"><input type="checkbox"' + common + ' value="yes"> ' + label + '</label>';
    var inputType = field.type === 'short' ? 'text' : field.type;
    return '<label>' + label + '<input type="' + inputType + '"' + common + ' placeholder="' + escapeHtml(field.placeholder) + '"><small>' + escapeHtml(field.help) + '</small></label>';
  }

  function renderResponses(payload, t, locale) {
    if (!payload.responses.length) return '<div class="ns-office-form__empty"><strong>' + escapeHtml(t('Ответов пока нет', 'No responses yet')) + '</strong><span>' + escapeHtml(t('Откройте форму и отправьте тестовый ответ.', 'Open the form and submit a test response.')) + '</span></div>';
    return '<div class="ns-office-form__responses-table"><table><thead><tr><th>#</th><th>' + escapeHtml(t('Отправлено', 'Submitted')) + '</th>' + payload.fields.map(function (field) { return '<th>' + escapeHtml(field.label) + '</th>'; }).join('') + '</tr></thead><tbody>' + payload.responses.map(function (response) { return '<tr><td>' + response.number + '</td><td>' + escapeHtml(new Date(response.submittedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')) + '</td>' + payload.fields.map(function (field) { return '<td>' + escapeHtml(answerText(response.answers[field.id], locale)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function render(object, locale) {
    var payload = normalizePayload(object && object.payload);
    var ru = locale === 'ru';
    function t(ruText, enText) { return ru ? ruText : enText; }
    return '<section class="ns-office-form" data-office-form data-office-id="' + escapeHtml(object.id) + '">' +
      '<div class="ns-office-form__tabs" role="tablist"><button type="button" class="is-active" data-form-tab="builder">' + escapeHtml(t('Поля', 'Fields')) + '</button><button type="button" data-form-tab="preview">' + escapeHtml(t('Форма', 'Form')) + '</button><button type="button" data-form-tab="responses">' + escapeHtml(t('Ответы', 'Responses')) + ' <b>' + payload.responses.length + '</b></button><input class="ns-office-form__object-title" data-form-title value="' + escapeHtml(object.title || '') + '" aria-label="' + escapeHtml(t('Название формы', 'Form title')) + '" placeholder="' + escapeHtml(t('Название формы', 'Form title')) + '"></div>' +
      '<section data-form-panel="builder"><div class="ns-office-form__meta"><label><span>' + escapeHtml(t('Описание', 'Description')) + '</span><textarea data-form-meta="description">' + escapeHtml(payload.description) + '</textarea></label><label><span>' + escapeHtml(t('Статус', 'Status')) + '</span><select data-form-meta="status"><option value="draft"' + (payload.status === 'draft' ? ' selected' : '') + '>' + escapeHtml(t('Черновик', 'Draft')) + '</option><option value="open"' + (payload.status === 'open' ? ' selected' : '') + '>' + escapeHtml(t('Открыта', 'Open')) + '</option><option value="closed"' + (payload.status === 'closed' ? ' selected' : '') + '>' + escapeHtml(t('Закрыта', 'Closed')) + '</option></select></label></div>' +
      '<div class="ns-office-form__add"><strong>' + escapeHtml(t('Добавить поле', 'Add field')) + '</strong>' + FIELD_TYPES.map(function (type) { return '<button type="button" data-form-add="' + type + '">+ ' + typeOptions(type, t).match(/selected>([^<]+)/)[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ns-office-form__fields">' + (payload.fields.length ? payload.fields.map(function (field, index) { return renderBuilderField(field, index, t); }).join('') : '<div class="ns-office-form__empty"><strong>' + escapeHtml(t('Нет полей', 'No fields yet')) + '</strong><span>' + escapeHtml(t('Добавьте первый вопрос или выберите шаблон.', 'Add the first question or choose a template.')) + '</span></div>') + '</div></section>' +
      '<section data-form-panel="preview" hidden><div class="ns-office-form__preview-head"><h3>' + escapeHtml(object.title) + '</h3><p>' + escapeHtml(payload.description) + '</p></div><form data-form-response>' + payload.fields.map(function (field) { return renderAnswer(field, t); }).join('') + '<button class="ns-office-form__submit" type="submit"' + (payload.status !== 'open' ? ' disabled' : '') + '>' + escapeHtml(payload.status === 'open' ? t('Отправить', 'Submit') : t('Откройте форму для ответов', 'Open the form for responses')) + '</button></form></section>' +
      '<section data-form-panel="responses" hidden><div class="ns-office-form__response-actions"><button type="button" data-form-action="response-sheet"' + (!payload.responses.length ? ' disabled' : '') + '>' + escapeHtml(t('Создать таблицу ответов', 'Create response spreadsheet')) + '</button><button type="button" data-form-action="export-csv"' + (!payload.responses.length ? ' disabled' : '') + '>' + escapeHtml(t('Экспорт CSV', 'Export CSV')) + '</button>' + (payload.responseSheetId ? '<span>' + escapeHtml(t('Таблица создана', 'Spreadsheet created')) + '</span>' : '') + '</div>' + renderResponses(payload, t, ru ? 'ru' : 'en') + '</section></section>';
  }

  function bind(container, object, api) {
    if (!container || !object || !api) return;
    var host = container.querySelector('[data-office-form]');
    if (!host || host.dataset.bound) return;
    host.dataset.bound = 'true';
    function payload() { return normalizePayload(object.payload); }
    function save(next, message) { api.save(next, message || api.t('Форма сохранена.', 'Form saved.')); }

    host.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-form-tab]');
      if (tab) {
        host.querySelectorAll('[data-form-tab]').forEach(function (button) { button.classList.toggle('is-active', button === tab); });
        host.querySelectorAll('[data-form-panel]').forEach(function (panel) { panel.hidden = panel.getAttribute('data-form-panel') !== tab.getAttribute('data-form-tab'); });
        return;
      }
      var add = event.target.closest('[data-form-add]');
      if (add) {
        var nextAdd = payload();
        var contentLocale = nextAdd.locale === 'ru' || nextAdd.locale === 'en' ? nextAdd.locale : api.locale;
        var fieldType = add.getAttribute('data-form-add');
        var fieldNumber = nextAdd.fields.length + 1;
        nextAdd.locale = contentLocale;
        addField(nextAdd, fieldType, {
          label: (contentLocale === 'ru' ? 'Вопрос ' : 'Question ') + fieldNumber,
          options: fieldType === 'select' || fieldType === 'radio'
            ? (contentLocale === 'ru' ? ['Вариант 1', 'Вариант 2'] : ['Option 1', 'Option 2'])
            : []
        });
        save(nextAdd);
        return;
      }
      var actionButton = event.target.closest('[data-form-action]');
      if (!actionButton || actionButton.disabled) return;
      var action = actionButton.getAttribute('data-form-action');
      var next = payload();
      var card = actionButton.closest('[data-form-field]');
      var fieldId = card && card.getAttribute('data-form-field');
      if (action === 'up') moveField(next, fieldId, -1);
      else if (action === 'down') moveField(next, fieldId, 1);
      else if (action === 'remove') { if (!api.confirm(api.t('Удалить это поле?', 'Delete this field?'))) return; removeField(next, fieldId); }
      else if (action === 'response-sheet') {
        if (typeof api.createResponseSheet !== 'function') return;
        var sheet = api.createResponseSheet(next, object);
        if (sheet) next.responseSheetId = sheet.id;
      } else if (action === 'export-csv') { api.download((object.title || 'form-responses') + '.csv', 'text/csv;charset=utf-8', toCsv(next, next.locale || api.locale)); return; }
      else return;
      save(next);
    });

    host.addEventListener('change', function (event) {
      if (event.target.matches('[data-form-title]')) { api.updateTitle(event.target.value); return; }
      var next = payload();
      var meta = event.target.getAttribute('data-form-meta');
      if (meta) { next[meta] = event.target.value; save(next); return; }
      var property = event.target.getAttribute('data-form-field-prop');
      var card = event.target.closest('[data-form-field]');
      if (!property || !card) return;
      var value = property === 'required' ? event.target.checked : event.target.value;
      updateField(next, card.getAttribute('data-form-field'), property === 'options' ? { options: value } : (function () { var patch = {}; patch[property] = value; return patch; })());
      save(next);
    });

    host.addEventListener('submit', function (event) {
      var form = event.target.closest('[data-form-response]');
      if (!form) return;
      event.preventDefault();
      var next = payload();
      var data = new FormData(form);
      var answers = {};
      next.fields.forEach(function (field) { answers[field.id] = field.type === 'checkbox' ? data.has(field.id) : String(data.get(field.id) || ''); });
      addResponse(next, answers);
      save(next, api.t('Ответ сохранён.', 'Response saved.'));
    });
  }

  root.NSOfficeFormV1 = Object.freeze({
    FIELD_TYPES: Object.freeze(FIELD_TYPES.slice()),
    createPayload: createPayload, normalizePayload: normalizePayload,
    addField: addField, updateField: updateField, removeField: removeField, moveField: moveField,
    addResponse: addResponse, responseRows: responseRows, toCsv: toCsv,
    render: render, bind: bind
  });
})(window);
