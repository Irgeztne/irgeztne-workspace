(function (global) {
  'use strict';

  if (global.NSToolRegistryV1) return;

  const definitions = new Map();
  let requestCounter = 0;

  function cleanString(value) {
    return String(value == null ? '' : value).trim();
  }

  function uniqueStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map(cleanString)
      .filter(Boolean)));
  }

  function localizedText(value, fieldName) {
    const source = value && typeof value === 'object' ? value : {};
    const ru = cleanString(source.ru);
    const en = cleanString(source.en);

    if (!ru || !en) {
      throw new Error('Tool ' + fieldName + ' must contain non-empty ru/en values.');
    }

    return Object.freeze({ ru: ru, en: en });
  }

  function freezeArray(values) {
    return Object.freeze(values.slice());
  }

  function normalizeLocale(value) {
    const explicit = cleanString(value).toLowerCase();
    if (explicit === 'ru' || explicit === 'en') return explicit;

    const htmlLang = global.document && global.document.documentElement
      ? cleanString(global.document.documentElement.getAttribute('lang')).toLowerCase()
      : '';
    if (htmlLang.startsWith('ru')) return 'ru';
    if (htmlLang.startsWith('en')) return 'en';

    try {
      const stored = global.localStorage && global.localStorage.getItem('nsbrowser.v8.language');
      if (stored === 'ru' || stored === 'en') return stored;
    } catch (error) {
      // Local storage is optional for the contract.
    }

    return 'ru';
  }

  function normalizeTheme(value) {
    const explicit = cleanString(value).toLowerCase();
    if (explicit === 'light' || explicit === 'dark') return explicit;

    const html = global.document && global.document.documentElement;
    const body = global.document && global.document.body;
    const datasetTheme = cleanString(
      (html && html.dataset && html.dataset.theme) ||
      (body && body.dataset && body.dataset.theme)
    ).toLowerCase();
    if (datasetTheme === 'light' || datasetTheme === 'dark') return datasetTheme;

    const className = cleanString(
      (html && html.className) + ' ' + (body && body.className)
    ).toLowerCase();
    if (/\b(light|theme-light|is-light)\b/.test(className)) return 'light';
    if (/\b(dark|theme-dark|is-dark)\b/.test(className)) return 'dark';

    return 'dark';
  }

  function normalizeReference(value, fallbackOwner) {
    if (!value || typeof value !== 'object') return null;

    const id = cleanString(value.id || value.objectId || value.fileId);
    if (!id) return null;

    const reference = {
      owner: cleanString(value.owner || fallbackOwner || 'workspace'),
      id: id,
      type: cleanString(value.type || value.kind),
      mime: cleanString(value.mime || value.mimeType),
      name: cleanString(value.name || value.title)
    };

    return Object.freeze(reference);
  }

  function createContext(input) {
    const source = input && typeof input === 'object' ? input : {};
    const selection = (Array.isArray(source.selection) ? source.selection : [])
      .map(function (item) { return normalizeReference(item, source.host); })
      .filter(Boolean);

    requestCounter += 1;

    return {
      requestId: cleanString(source.requestId) || ('tool-' + Date.now() + '-' + requestCounter),
      host: cleanString(source.host) || 'tools',
      surface: cleanString(source.surface) || 'workspace',
      mode: cleanString(source.mode) === 'embedded' ? 'embedded' : 'full',
      locale: normalizeLocale(source.locale),
      theme: normalizeTheme(source.theme),
      sourceRef: normalizeReference(source.sourceRef || source.source, source.host),
      projectRef: normalizeReference(source.projectRef || source.project, 'projects'),
      taskRef: normalizeReference(source.taskRef || source.task, 'tasks'),
      selection: freezeArray(selection),
      action: cleanString(source.action),
      params: source.params && typeof source.params === 'object' ? Object.assign({}, source.params) : {},
      mount: source.mount || null,
      returnResult: typeof source.returnResult === 'function' ? source.returnResult : null
    };
  }

  function dispatch(name, detail) {
    if (!global.document || typeof global.document.dispatchEvent !== 'function') return;

    try {
      global.document.dispatchEvent(new global.CustomEvent(name, { detail: detail }));
    } catch (error) {
      // Events are an integration convenience; the registry remains usable without them.
    }
  }

  function normalizeResult(tool, context, value) {
    const source = value && typeof value === 'object' ? value : { value: value };
    const outputs = Array.isArray(source.outputs) ? source.outputs.slice() : [];

    return {
      toolId: tool.id,
      requestId: context.requestId,
      status: cleanString(source.status) || 'success',
      outputTypes: freezeArray(uniqueStrings(source.outputTypes || tool.outputTypes)),
      outputs: outputs,
      sourceRef: context.sourceRef,
      projectRef: context.projectRef,
      taskRef: context.taskRef,
      host: context.host,
      payload: Object.prototype.hasOwnProperty.call(source, 'payload') ? source.payload : null
    };
  }

  function publicMetadata(entry) {
    return entry && entry.metadata ? entry.metadata : null;
  }

  function register(definition) {
    const source = definition && typeof definition === 'object' ? definition : {};
    const id = cleanString(source.id).toLowerCase();

    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)) {
      throw new Error('Tool id must be a stable lowercase identifier.');
    }
    if (definitions.has(id)) {
      throw new Error('Tool already registered: ' + id);
    }
    if (!source.implementation || typeof source.implementation.open !== 'function') {
      throw new Error('Tool implementation.open is required: ' + id);
    }

    const inputTypes = uniqueStrings(source.inputTypes);
    const outputTypes = uniqueStrings(source.outputTypes);
    const supportedHosts = uniqueStrings(source.supportedHosts);
    if (!supportedHosts.length) {
      throw new Error('Tool supportedHosts is required: ' + id);
    }

    const capabilities = source.capabilities && typeof source.capabilities === 'object'
      ? source.capabilities
      : {};

    const metadata = Object.freeze({
      id: id,
      version: cleanString(source.version) || '1.0.0',
      title: localizedText(source.title, 'title'),
      description: localizedText(source.description, 'description'),
      category: cleanString(source.category) || 'utility',
      icon: cleanString(source.icon) || 'tool',
      inputTypes: freezeArray(inputTypes),
      outputTypes: freezeArray(outputTypes),
      supportedHosts: freezeArray(supportedHosts),
      modes: freezeArray(uniqueStrings(source.modes).length ? uniqueStrings(source.modes) : ['full']),
      capabilities: Object.freeze({
        network: Boolean(capabilities.network),
        auth: Boolean(capabilities.auth)
      })
    });

    definitions.set(id, {
      metadata: metadata,
      implementation: source.implementation
    });

    dispatch('ns-tool:registered', { tool: metadata });
    return metadata;
  }

  function get(id) {
    return publicMetadata(definitions.get(cleanString(id).toLowerCase()));
  }

  function list(filters) {
    const query = filters && typeof filters === 'object' ? filters : {};
    const host = cleanString(query.host);
    const category = cleanString(query.category);

    return Array.from(definitions.values())
      .map(publicMetadata)
      .filter(function (tool) {
        if (host && !tool.supportedHosts.includes(host)) return false;
        if (category && tool.category !== category) return false;
        return true;
      });
  }

  function emitResult(tool, context, value) {
    const result = normalizeResult(tool, context, value);

    if (context.returnResult) context.returnResult(result);
    dispatch('ns-tool:result', result);
    return result;
  }

  async function open(id, inputContext) {
    const key = cleanString(id).toLowerCase();
    const entry = definitions.get(key);
    if (!entry) throw new Error('Unknown tool: ' + key);

    const tool = entry.metadata;
    const context = createContext(inputContext);

    if (!tool.supportedHosts.includes(context.host)) {
      throw new Error('Tool ' + key + ' does not support host ' + context.host + '.');
    }
    if (!tool.modes.includes(context.mode)) {
      throw new Error('Tool ' + key + ' does not support mode ' + context.mode + '.');
    }

    const runtimeContext = Object.assign({}, context, {
      tool: tool,
      emitResult: function (value) { return emitResult(tool, context, value); }
    });

    dispatch('ns-tool:open', { tool: tool, context: context });

    try {
      const value = await entry.implementation.open(runtimeContext);
      return {
        tool: tool,
        context: context,
        result: value === undefined ? null : emitResult(tool, context, value)
      };
    } catch (error) {
      dispatch('ns-tool:error', {
        toolId: tool.id,
        requestId: context.requestId,
        host: context.host,
        message: error && error.message ? error.message : String(error)
      });
      throw error;
    }
  }

  global.NSToolRegistryV1 = Object.freeze({
    register: register,
    get: get,
    list: list,
    open: open,
    createContext: createContext,
    resolveLocale: normalizeLocale,
    resolveTheme: normalizeTheme
  });
})(window);
