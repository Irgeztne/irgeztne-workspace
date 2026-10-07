(function (root) {
  'use strict';

  var COMMANDS = {
    alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', theta:'θ', lambda:'λ', mu:'μ',
    pi:'π', rho:'ρ', sigma:'σ', phi:'φ', omega:'ω', Gamma:'Γ', Delta:'Δ', Theta:'Θ',
    Lambda:'Λ', Pi:'Π', Sigma:'Σ', Phi:'Φ', Omega:'Ω', sum:'∑', prod:'∏', int:'∫',
    infty:'∞', times:'×', cdot:'·', pm:'±', le:'≤', ge:'≥', ne:'≠', approx:'≈', to:'→'
  };

  function escapeXml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function Parser(source) {
    this.source = String(source == null ? '' : source);
    this.index = 0;
  }

  Parser.prototype.peek = function () { return this.source.charAt(this.index); };
  Parser.prototype.done = function () { return this.index >= this.source.length; };
  Parser.prototype.skipSpaces = function () {
    while (!this.done() && /\s/.test(this.peek())) this.index += 1;
  };
  Parser.prototype.error = function (message) {
    throw new Error(message + ' (position ' + (this.index + 1) + ')');
  };
  Parser.prototype.enclosed = function (open, close, label, fenced) {
    if (this.peek() !== open) this.error('Expected ' + open + (label ? ' for ' + label : ''));
    this.index += 1;
    var node = this.sequence(close);
    if (this.peek() !== close) this.error('Missing closing ' + close);
    this.index += 1;
    return fenced ? { kind:'fenced', open:open, close:close, body:node } : node;
  };
  Parser.prototype.group = function (label) {
    return this.enclosed('{', '}', label, false);
  };
  Parser.prototype.atom = function () {
    this.skipSpaces();
    if (this.done()) this.error('Expected an expression');
    if (this.peek() === '{') return this.group('script');
    return this.primary();
  };
  Parser.prototype.command = function () {
    this.index += 1;
    var start = this.index;
    while (/[A-Za-z]/.test(this.peek())) this.index += 1;
    var name = this.source.slice(start, this.index);
    if (!name) {
      if (this.done()) this.error('Incomplete command');
      return { kind:'text', value:this.source.charAt(this.index++) };
    }
    if (name === 'frac') return { kind:'frac', top:this.group('fraction numerator'), bottom:this.group('fraction denominator') };
    if (name === 'sqrt') return { kind:'sqrt', body:this.group('square root') };
    if (name === 'text') return { kind:'text', value:plainText(this.group('text')) };
    if (!Object.prototype.hasOwnProperty.call(COMMANDS, name)) this.error('Unsupported command \\' + name);
    return { kind:name === 'sum' || name === 'prod' || name === 'int' ? 'largeop' : 'op', value:COMMANDS[name] };
  };
  Parser.prototype.primary = function () {
    var ch = this.peek();
    if (this.source.slice(this.index, this.index + 2) === '+-') {
      this.index += 2;
      return { kind:'op', value:'±' };
    }
    if (ch === '\\') return this.command();
    if (ch === '(') return this.enclosed('(', ')', 'parenthesized expression', true);
    if (ch === '[') return this.enclosed('[', ']', 'bracketed expression', true);
    if (ch === '}') this.error('Unexpected }');
    this.index += 1;
    if (/[0-9]/.test(ch)) {
      var number = ch;
      while (/[0-9.,]/.test(this.peek())) number += this.source.charAt(this.index++);
      return { kind:'number', value:number };
    }
    if (/[A-Za-zА-Яа-яЁё]/.test(ch)) {
      var identifier = ch;
      while (/[A-Za-zА-Яа-яЁё]/.test(this.peek())) identifier += this.source.charAt(this.index++);
      if (identifier === 'sqrt') {
        this.skipSpaces();
        if (this.peek() === '(') return { kind:'sqrt', body:this.enclosed('(', ')', 'square root', false) };
        if (this.peek() === '{') return { kind:'sqrt', body:this.group('square root') };
      }
      if (identifier === 'sum' || identifier === 'prod' || identifier === 'int') {
        return { kind:'largeop', value:COMMANDS[identifier] };
      }
      return { kind:'id', value:identifier };
    }
    return { kind:/[=+\-*/()\[\],.;:<>%±×·≤≥≠≈→∞∑∏∫]/.test(ch) ? 'op' : 'text', value:ch };
  };
  Parser.prototype.sequence = function (stop) {
    var nodes = [];
    while (!this.done() && (!stop || this.peek() !== stop)) {
      if (/\s/.test(this.peek())) { this.index += 1; continue; }
      var marker = this.peek();
      if (marker === '^' || marker === '_') {
        if (!nodes.length) this.error('A script needs a base');
        this.index += 1;
        var script = this.atom();
        var base = nodes.pop();
        if (marker === '^' && base.kind === 'sub') base = { kind:'subsup', base:base.base, sub:base.script, sup:script };
        else if (marker === '_' && base.kind === 'sup') base = { kind:'subsup', base:base.base, sub:script, sup:base.script };
        else base = { kind:marker === '^' ? 'sup' : 'sub', base:base, script:script };
        nodes.push(base);
        continue;
      }
      if (marker === '/') {
        if (!nodes.length) this.error('A fraction needs a numerator');
        this.index += 1;
        var top = nodes.pop();
        var bottom = this.atom();
        nodes.push({ kind:'frac', top:top.kind === 'fenced' ? top.body : top, bottom:bottom.kind === 'fenced' ? bottom.body : bottom });
        continue;
      }
      nodes.push(this.peek() === '{' ? this.group('expression') : this.primary());
    }
    return { kind:'row', children:nodes };
  };
  Parser.prototype.parse = function () {
    if (!this.source.trim()) this.error('Formula source is empty');
    var ast = this.sequence('');
    if (!this.done()) this.error('Unexpected trailing input');
    return ast;
  };

  function mathNode(node) {
    if (!node) return '';
    if (node.kind === 'row') return '<mrow>' + node.children.map(mathNode).join('') + '</mrow>';
    if (node.kind === 'number') return '<mn>' + escapeXml(node.value) + '</mn>';
    if (node.kind === 'id') return '<mi>' + escapeXml(node.value) + '</mi>';
    if (node.kind === 'text') return '<mtext>' + escapeXml(node.value) + '</mtext>';
    if (node.kind === 'op' || node.kind === 'largeop') return '<mo>' + escapeXml(node.value) + '</mo>';
    if (node.kind === 'fenced') return '<mrow><mo stretchy="true">' + escapeXml(node.open) + '</mo>' + mathNode(node.body) + '<mo stretchy="true">' + escapeXml(node.close) + '</mo></mrow>';
    if (node.kind === 'frac') return '<mfrac>' + mathNode(node.top) + mathNode(node.bottom) + '</mfrac>';
    if (node.kind === 'sqrt') return '<msqrt>' + mathNode(node.body) + '</msqrt>';
    if (node.kind === 'sub') return '<msub>' + mathNode(node.base) + mathNode(node.script) + '</msub>';
    if (node.kind === 'sup') return '<msup>' + mathNode(node.base) + mathNode(node.script) + '</msup>';
    if (node.kind === 'subsup') return '<msubsup>' + mathNode(node.base) + mathNode(node.sub) + mathNode(node.sup) + '</msubsup>';
    return '';
  }

  function plainText(node) {
    if (!node) return '';
    if (node.kind === 'row') return node.children.map(plainText).join(' ');
    if (node.kind === 'fenced') return node.open + plainText(node.body) + node.close;
    if (node.kind === 'frac') return '(' + plainText(node.top) + ')/(' + plainText(node.bottom) + ')';
    if (node.kind === 'sqrt') return '√(' + plainText(node.body) + ')';
    if (node.kind === 'sub') return plainText(node.base) + '_(' + plainText(node.script) + ')';
    if (node.kind === 'sup') return plainText(node.base) + '^(' + plainText(node.script) + ')';
    if (node.kind === 'subsup') return plainText(node.base) + '_(' + plainText(node.sub) + ')^(' + plainText(node.sup) + ')';
    return String(node.value == null ? '' : node.value);
  }

  function renderExpression(source) {
    try {
      var ast = new Parser(source).parse();
      return {
        ok:true,
        error:'',
        ast:ast,
        plain:plainText(ast).replace(/\s+/g, ' ').trim(),
        mathml:'<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">' + mathNode(ast) + '</math>'
      };
    } catch (error) {
      return { ok:false, error:String(error && error.message ? error.message : error), ast:null, plain:'', mathml:'' };
    }
  }

  function updateSource(payload, source) {
    payload = payload && typeof payload === 'object' ? payload : {};
    var result = renderExpression(source);
    payload.source = String(source == null ? '' : source);
    payload.renderedMathML = result.mathml;
    payload.plainText = result.plain;
    payload.error = result.error;
    payload.renderedAt = new Date().toISOString();
    return payload;
  }

  function createPayload(seed) {
    seed = seed && typeof seed === 'object' ? seed : {};
    return updateSource({}, seed.source || 'E = mc^2');
  }

  function normalizePayload(payload) {
    payload = payload && typeof payload === 'object' ? payload : {};
    return updateSource({}, payload.source || 'E = mc^2');
  }

  function buildSvg(object, locale) {
    var payload = normalizePayload(object && object.payload);
    var title = object && object.title ? object.title : (locale === 'ru' ? 'Формула' : 'Formula');
    var output = payload.error ? (locale === 'ru' ? 'Ошибка: ' : 'Error: ') + payload.error : payload.plainText;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="280" viewBox="0 0 1200 280" role="img" aria-label="' + escapeXml(title) + '"><rect width="1200" height="280" rx="24" fill="#f7fbff"/><text x="52" y="62" fill="#507094" font-family="Inter,system-ui,sans-serif" font-size="22">' + escapeXml(title) + '</text><text x="52" y="165" fill="#10243d" font-family="STIX Two Math,Times New Roman,serif" font-size="44">' + escapeXml(output) + '</text></svg>';
  }

  function render(object, locale) {
    var ru = locale === 'ru';
    var payload = normalizePayload(object && object.payload);
    function t(ruText, enText) { return ru ? ruText : enText; }
    return [
      '<section class="ns-office-formula" data-office-formula data-office-id="' + escapeXml(object.id) + '">',
      '<div class="ns-office-formula__toolbar"><input class="ns-office-formula__object-title" data-formula-title value="' + escapeXml(object.title || '') + '" aria-label="' + escapeXml(t('Название формулы', 'Formula title')) + '" placeholder="' + escapeXml(t('Название формулы', 'Formula title')) + '"><button type="button" data-formula-action="render">' + escapeXml(t('Отобразить', 'Render')) + '</button><button type="button" data-formula-action="copy">' + escapeXml(t('Копировать MathML', 'Copy MathML')) + '</button><button type="button" data-formula-action="export-mathml">' + escapeXml(t('Экспорт MathML', 'Export MathML')) + '</button><button type="button" data-formula-action="export-svg">' + escapeXml(t('Экспорт SVG', 'Export SVG')) + '</button></div>',
      '<div class="ns-office-formula__layout"><label class="ns-office-formula__source"><strong>' + escapeXml(t('Исходный код', 'Source')) + '</strong><textarea data-formula-source spellcheck="false">' + escapeXml(payload.source) + '</textarea><small>' + escapeXml(t('Поддерживаются дроби, корни, индексы, степени, суммы и греческие символы.', 'Fractions, roots, scripts, sums, and Greek symbols are supported.')) + '</small></label>',
      '<div class="ns-office-formula__preview"><strong>' + escapeXml(t('Результат', 'Preview')) + '</strong>' + (payload.error ? '<div class="ns-office-formula__error" role="alert">' + escapeXml(t('Ошибка выражения: ', 'Expression error: ') + payload.error) + '</div>' : '<div class="ns-office-formula__math">' + payload.renderedMathML + '</div><code>' + escapeXml(payload.plainText) + '</code>') + '</div></div>',
      '</section>'
    ].join('');
  }

  function bind(container, object, api) {
    if (!container || !object || !api) return;
    var host = container.querySelector('[data-office-formula]');
    if (!host || host.dataset.bound) return;
    host.dataset.bound = 'true';
    host.addEventListener('change', function (event) {
      if (event.target.matches('[data-formula-title]')) api.updateTitle(event.target.value);
    });
    host.addEventListener('click', function (event) {
      var button = event.target.closest('[data-formula-action]');
      if (!button) return;
      var action = button.getAttribute('data-formula-action');
      var source = host.querySelector('[data-formula-source]');
      var payload = updateSource({}, source ? source.value : '');
      if (action === 'render') {
        api.save(payload, payload.error ? api.t('Формула содержит ошибку.', 'Formula contains an error.') : api.t('Формула сохранена.', 'Formula saved.'));
        return;
      }
      if (payload.error) { api.notice(api.t('Сначала исправьте формулу.', 'Fix the formula first.')); return; }
      if (action === 'copy') api.copyText(payload.renderedMathML, api.t('MathML скопирован.', 'MathML copied.'));
      if (action === 'export-mathml') api.download((object.title || 'formula') + '.html', 'text/html;charset=utf-8', '<!doctype html><html><meta charset="utf-8"><title>' + escapeXml(object.title || 'Formula') + '</title><body>' + payload.renderedMathML + '</body></html>');
      if (action === 'export-svg') api.download((object.title || 'formula') + '.svg', 'image/svg+xml;charset=utf-8', buildSvg({ title:object.title, payload:payload }, api.locale));
    });
  }

  root.NSOfficeFormulaV1 = Object.freeze({
    renderExpression:renderExpression,
    createPayload:createPayload,
    normalizePayload:normalizePayload,
    updateSource:updateSource,
    buildSvg:buildSvg,
    render:render,
    bind:bind
  });
})(window);
