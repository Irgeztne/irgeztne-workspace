(function (root) {
  'use strict';

  var templates = [];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function pick(value, locale) { return value && typeof value === 'object' ? String(value[locale === 'ru' ? 'ru' : 'en'] || value.en || value.ru || '') : String(value || ''); }
  function add(id, type, titleRu, titleEn, descriptionRu, descriptionEn, factory) {
    templates.push(Object.freeze({ id:id, type:type, title:{ ru:titleRu, en:titleEn }, description:{ ru:descriptionRu, en:descriptionEn }, factory:factory }));
  }
  function richSeed(locale, title, documentType, html, plain) {
    return { title:pick(title, locale), locale:locale, documentType:documentType, status:'draft', richBody:pick(html, locale), body:pick(plain, locale), tags:['office','template',documentType] };
  }
  function sheetSeed(locale, title, columns, rows, name) {
    var api = root.NSOfficeSpreadsheetV1;
    var payload = api.createPayload({ locale:locale, rows:Math.max(20, rows.length + 2), columns:columns.length, sheetName:pick(name, locale) });
    var sheet = payload.sheets[0];
    columns.forEach(function (column, index) {
      api.setColumn(payload, sheet.id, index, { name:pick(column.name, locale), type:column.type || 'text' });
      api.setCell(payload, sheet.id, String.fromCharCode(65 + index) + '1', pick(column.name, locale));
    });
    rows.forEach(function (row, rowIndex) { row.forEach(function (value, columnIndex) { api.setCell(payload, sheet.id, String.fromCharCode(65 + columnIndex) + (rowIndex + 2), pick(value, locale)); }); });
    return { title:pick(title, locale), payload:payload };
  }
  function presentationSeed(locale, title, slides) {
    function block(text, style, x, y, width, height) { return { type:'text', text:pick(text, locale), style:style || 'body', x:x, y:y, width:width, height:height }; }
    var normalized = slides.map(function (slide, index) {
      return { title:pick(slide.title, locale), layout:slide.layout || 'content', background:slide.background || '#f8fbff', blocks:(slide.blocks || []).map(function (item) { return block(item.text, item.style, item.x, item.y, item.width, item.height); }) };
    });
    return { title:pick(title, locale), payload:{ locale:locale, slides:normalized, activeSlideId:'' } };
  }
  function slide(title, body) {
    return { title:title, blocks:[
      { text:title, style:'heading', x:7, y:8, width:86, height:18 },
      { text:body, style:'body', x:9, y:31, width:82, height:54 }
    ] };
  }
  function diagramNode(id, type, x, y, width, height, text, primary) {
    return { id:id, type:type, x:x, y:y, width:width, height:height, text:text, fill:primary ? '#cfe3ff' : '#e8f2ff', stroke:'#2f7be6', strokeWidth:3 };
  }
  function diagramEdge(id, type, x, y, x2, y2) {
    return { id:id, type:type || 'line', x:x, y:y, x2:x2, y2:y2, stroke:'#2f7be6', strokeWidth:3 };
  }
  function diagramSeed(locale, title, labels, layout) {
    var text = labels.map(function (label) { return pick(label, locale); });
    var connectors = [];
    var nodes = [];
    if (layout === 'process') {
      [40,280,520,760,1000].forEach(function (x, index) {
        nodes.push(diagramNode('node-' + index, index === 0 || index === 4 ? 'ellipse' : 'rectangle', x, 300, 160, 100, text[index], index === 0));
        if (index) connectors.push(diagramEdge('edge-' + index, 'arrow', x - 80, 350, x, 350));
      });
    } else if (layout === 'flow') {
      connectors.push(
        diagramEdge('edge-start', 'arrow', 600, 140, 600, 200),
        diagramEdge('edge-yes-a', 'line', 480, 255, 270, 255),
        diagramEdge('edge-yes-b', 'arrow', 270, 255, 270, 400),
        diagramEdge('edge-no-a', 'line', 720, 255, 930, 255),
        diagramEdge('edge-no-b', 'arrow', 930, 255, 930, 400),
        diagramEdge('edge-merge-left-a', 'line', 270, 500, 270, 550),
        diagramEdge('edge-merge-left-b', 'line', 270, 550, 590, 550),
        diagramEdge('edge-merge-right-a', 'line', 930, 500, 930, 550),
        diagramEdge('edge-merge-right-b', 'line', 930, 550, 610, 550),
        diagramEdge('edge-done', 'arrow', 600, 550, 600, 600)
      );
      nodes.push(
        diagramNode('node-0', 'ellipse', 480, 40, 240, 100, text[0], true),
        diagramNode('node-1', 'rectangle', 480, 200, 240, 110, text[1], false),
        diagramNode('node-2', 'rectangle', 150, 400, 240, 100, text[2], false),
        diagramNode('node-3', 'rectangle', 810, 400, 240, 100, text[3], false),
        diagramNode('node-4', 'ellipse', 480, 600, 240, 90, text[4], false)
      );
    } else if (layout === 'hierarchy') {
      var centers = [165,455,745,1035];
      connectors.push(diagramEdge('edge-trunk', 'line', 600, 160, 600, 280), diagramEdge('edge-bus', 'line', centers[0], 280, centers[3], 280));
      centers.forEach(function (center, index) {
        connectors.push(diagramEdge('edge-' + index, 'arrow', center, 280, center, 430));
        nodes.push(diagramNode('node-' + (index + 1), 'rectangle', center - 105, 430, 210, 110, text[index + 1], false));
      });
      nodes.unshift(diagramNode('node-0', 'ellipse', 480, 60, 240, 100, text[0], true));
    } else {
      connectors.push(
        diagramEdge('edge-top', 'arrow', 600, 300, 600, 160),
        diagramEdge('edge-left', 'arrow', 480, 360, 320, 360),
        diagramEdge('edge-right', 'arrow', 720, 360, 880, 360),
        diagramEdge('edge-bottom', 'arrow', 600, 420, 600, 560)
      );
      nodes.push(
        diagramNode('node-0', 'ellipse', 480, 300, 240, 120, text[0], true),
        diagramNode('node-1', 'rectangle', 480, 60, 240, 100, text[1], false),
        diagramNode('node-2', 'rectangle', 80, 310, 240, 100, text[2], false),
        diagramNode('node-3', 'rectangle', 880, 310, 240, 100, text[3], false),
        diagramNode('node-4', 'rectangle', 480, 560, 240, 100, text[4], false)
      );
    }
    return { title:pick(title, locale), payload:{ locale:locale, width:1200, height:720, zoom:1, selectedId:'', elements:connectors.concat(nodes) } };
  }
  function formSeed(locale, title, description, fields) {
    var api = root.NSOfficeFormV1;
    return { title:pick(title, locale), payload:api.createPayload({ locale:locale, description:pick(description, locale), status:'draft', fields:fields.map(function (field) { return Object.assign({}, field, { label:pick(field.label, locale), help:pick(field.help || '', locale), placeholder:pick(field.placeholder || '', locale), options:(field.options || []).map(function (option) { return pick(option, locale); }) }); }) }) };
  }

  add('document-report','document','Рабочий отчёт','Working report','Структура итогов, показателей, рисков и следующих шагов.','A structured report for outcomes, metrics, risks, and next steps.',function (locale) { return richSeed(locale,{ru:'Рабочий отчёт',en:'Working report'},'report',{ru:'<h1>Рабочий отчёт</h1><p><strong>Период:</strong> …</p><h2>Краткое резюме</h2><p>Главный результат и контекст.</p><h2>Показатели</h2><ul><li>Показатель 1</li><li>Показатель 2</li></ul><h2>Риски и решения</h2><p>Риск → действие → владелец.</p><h2>Следующие шаги</h2><ol><li>Шаг, срок, ответственный</li></ol>',en:'<h1>Working report</h1><p><strong>Period:</strong> …</p><h2>Executive summary</h2><p>Primary outcome and context.</p><h2>Metrics</h2><ul><li>Metric 1</li><li>Metric 2</li></ul><h2>Risks and decisions</h2><p>Risk → action → owner.</p><h2>Next steps</h2><ol><li>Step, due date, owner</li></ol>'},{ru:'Рабочий отчёт\nПериод: …\n\nКраткое резюме\nГлавный результат и контекст.\n\nПоказатели\n• Показатель 1\n• Показатель 2\n\nРиски и решения\nРиск → действие → владелец.\n\nСледующие шаги\n1. Шаг, срок, ответственный',en:'Working report\nPeriod: …\n\nExecutive summary\nPrimary outcome and context.\n\nMetrics\n• Metric 1\n• Metric 2\n\nRisks and decisions\nRisk → action → owner.\n\nNext steps\n1. Step, due date, owner'}); });
  add('document-technical','document','Техническая документация','Technical documentation','Спецификация с контекстом, архитектурой, контрактами и проверкой.','A specification with context, architecture, contracts, and verification.',function (locale) { return richSeed(locale,{ru:'Техническая документация',en:'Technical documentation'},'technical',{ru:'<h1>Название системы</h1><p>Версия · владелец · статус</p><h2>Назначение</h2><p>Проблема, пользователи и границы.</p><h2>Архитектура</h2><p>Компоненты и поток данных.</p><h2>Контракты</h2><ul><li>Входы</li><li>Выходы</li><li>Ошибки</li></ul><h2>Проверка</h2><p>Сценарии и критерии приёмки.</p>',en:'<h1>System name</h1><p>Version · owner · status</p><h2>Purpose</h2><p>Problem, users, and boundaries.</p><h2>Architecture</h2><p>Components and data flow.</p><h2>Contracts</h2><ul><li>Inputs</li><li>Outputs</li><li>Errors</li></ul><h2>Verification</h2><p>Scenarios and acceptance criteria.</p>'},{ru:'Название системы\nВерсия · владелец · статус\n\nНазначение\nПроблема, пользователи и границы.\n\nАрхитектура\nКомпоненты и поток данных.\n\nКонтракты\n• Входы\n• Выходы\n• Ошибки\n\nПроверка\nСценарии и критерии приёмки.',en:'System name\nVersion · owner · status\n\nPurpose\nProblem, users, and boundaries.\n\nArchitecture\nComponents and data flow.\n\nContracts\n• Inputs\n• Outputs\n• Errors\n\nVerification\nScenarios and acceptance criteria.'}); });
  add('document-article','document','Статья / материал','Article / feature','Редакционная структура: идея, лид, аргументы, факты и вывод.','An editorial structure for the idea, lead, evidence, and conclusion.',function (locale) { return richSeed(locale,{ru:'Новый материал',en:'New feature'},'article',{ru:'<h1>Заголовок материала</h1><p><em>Лид: почему эта тема важна сейчас.</em></p><h2>Контекст</h2><p>Что должен знать читатель.</p><h2>Главная идея</h2><p>Аргумент, пример и подтверждение.</p><blockquote>Ключевая цитата или факт.</blockquote><h2>Вывод</h2><p>Что меняется для читателя.</p>',en:'<h1>Feature headline</h1><p><em>Lead: why this matters now.</em></p><h2>Context</h2><p>What the reader needs to know.</p><h2>Core idea</h2><p>Argument, example, and evidence.</p><blockquote>A key quote or fact.</blockquote><h2>Conclusion</h2><p>What changes for the reader.</p>'},{ru:'Заголовок материала\nЛид: почему эта тема важна сейчас.\n\nКонтекст\nЧто должен знать читатель.\n\nГлавная идея\nАргумент, пример и подтверждение.\n\nКлючевая цитата или факт.\n\nВывод\nЧто меняется для читателя.',en:'Feature headline\nLead: why this matters now.\n\nContext\nWhat the reader needs to know.\n\nCore idea\nArgument, example, and evidence.\n\nA key quote or fact.\n\nConclusion\nWhat changes for the reader.'}); });
  add('document-letter','document','Деловое письмо','Business letter','Спокойный шаблон письма с темой, просьбой и следующим действием.','A professional letter with context, request, and next action.',function (locale) { return richSeed(locale,{ru:'Деловое письмо',en:'Business letter'},'letter',{ru:'<p>Кому: …<br>Тема: …</p><p>Здравствуйте, …</p><p>Краткий контекст и причина обращения.</p><p><strong>Просьба / предложение:</strong> сформулируйте ожидаемое действие.</p><p>Предлагаемый срок и следующий шаг.</p><p>С уважением,<br>Имя · роль · контакты</p>',en:'<p>To: …<br>Subject: …</p><p>Hello …,</p><p>Brief context and reason for writing.</p><p><strong>Request / proposal:</strong> state the expected action.</p><p>Suggested timing and next step.</p><p>Best regards,<br>Name · role · contact</p>'},{ru:'Кому: …\nТема: …\n\nЗдравствуйте, …\n\nКраткий контекст и причина обращения.\n\nПросьба / предложение: сформулируйте ожидаемое действие.\n\nПредлагаемый срок и следующий шаг.\n\nС уважением,\nИмя · роль · контакты',en:'To: …\nSubject: …\n\nHello …,\n\nBrief context and reason for writing.\n\nRequest / proposal: state the expected action.\n\nSuggested timing and next step.\n\nBest regards,\nName · role · contact'}); });
  add('document-project-note','document','Проектная записка','Project brief','Цель, объём, решения, риски, владельцы и контрольные точки.','Goals, scope, decisions, risks, owners, and milestones.',function (locale) { return richSeed(locale,{ru:'Проектная записка',en:'Project brief'},'brief',{ru:'<h1>Проект</h1><h2>Цель</h2><p>Измеримый результат.</p><h2>Объём</h2><ul><li>Входит</li><li>Не входит</li></ul><h2>Ключевые решения</h2><p>Решение · причина · владелец.</p><h2>Риски</h2><p>Риск · вероятность · ответ.</p><h2>Контрольные точки</h2><ol><li>Этап · дата · ответственный</li></ol>',en:'<h1>Project</h1><h2>Goal</h2><p>Measurable outcome.</p><h2>Scope</h2><ul><li>Included</li><li>Not included</li></ul><h2>Key decisions</h2><p>Decision · rationale · owner.</p><h2>Risks</h2><p>Risk · likelihood · response.</p><h2>Milestones</h2><ol><li>Stage · date · owner</li></ol>'},{ru:'Проект\n\nЦель\nИзмеримый результат.\n\nОбъём\n• Входит\n• Не входит\n\nКлючевые решения\nРешение · причина · владелец.\n\nРиски\nРиск · вероятность · ответ.\n\nКонтрольные точки\n1. Этап · дата · ответственный',en:'Project\n\nGoal\nMeasurable outcome.\n\nScope\n• Included\n• Not included\n\nKey decisions\nDecision · rationale · owner.\n\nRisks\nRisk · likelihood · response.\n\nMilestones\n1. Stage · date · owner'}); });

  add('sheet-budget','spreadsheet','Бюджет и учёт','Budget & ledger','Категории, план, факт, отклонение и заметки.','Categories, planned, actual, variance, and notes.',function (l) { return sheetSeed(l,{ru:'Бюджет',en:'Budget'},[{name:{ru:'Категория',en:'Category'}},{name:{ru:'План',en:'Planned'},type:'currency'},{name:{ru:'Факт',en:'Actual'},type:'currency'},{name:{ru:'Отклонение',en:'Variance'},type:'currency'},{name:{ru:'Комментарий',en:'Notes'}}],[[{ru:'Доход',en:'Income'},'0','0','=C2-B2',''],[{ru:'Операции',en:'Operations'},'0','0','=C3-B3',''],[{ru:'Маркетинг',en:'Marketing'},'0','0','=C4-B4',''],[{ru:'Итого',en:'Total'},'=SUM(B2:B4)','=SUM(C2:C4)','=C5-B5','']],{ru:'Бюджет',en:'Budget'}); });
  add('sheet-plan','spreadsheet','Рабочий план','Work plan','Этапы, владельцы, сроки, состояние и результат.','Stages, owners, dates, status, and outcome.',function (l) { return sheetSeed(l,{ru:'Рабочий план',en:'Work plan'},[{name:{ru:'Этап',en:'Stage'}},{name:{ru:'Владелец',en:'Owner'}},{name:{ru:'Начало',en:'Start'},type:'date'},{name:{ru:'Срок',en:'Due'},type:'date'},{name:{ru:'Статус',en:'Status'}},{name:{ru:'Результат',en:'Outcome'}}],[[{ru:'Подготовка',en:'Preparation'},'', '', '',{ru:'Не начато',en:'Not started'},''],[{ru:'Исполнение',en:'Delivery'},'', '', '',{ru:'Не начато',en:'Not started'},''],[{ru:'Проверка',en:'Review'},'', '', '',{ru:'Не начато',en:'Not started'},'']],{ru:'План',en:'Plan'}); });
  add('sheet-tracker','spreadsheet','Трекер задач','Task tracker','Приоритет, статус, ответственный, срок и блокеры.','Priority, status, owner, due date, and blockers.',function (l) { return sheetSeed(l,{ru:'Трекер задач',en:'Task tracker'},[{name:{ru:'Задача',en:'Task'}},{name:{ru:'Приоритет',en:'Priority'}},{name:{ru:'Статус',en:'Status'}},{name:{ru:'Ответственный',en:'Owner'}},{name:{ru:'Срок',en:'Due'},type:'date'},{name:{ru:'Блокер',en:'Blocker'}}],[[{ru:'Первая задача',en:'First task'},{ru:'Высокий',en:'High'},{ru:'В работе',en:'In progress'},'','',''],[{ru:'Вторая задача',en:'Second task'},{ru:'Средний',en:'Medium'},{ru:'Очередь',en:'Backlog'},'','','']],{ru:'Трекер',en:'Tracker'}); });
  add('sheet-analytics','spreadsheet','Аналитическая таблица','Analytics table','Период, канал, объём, результат, стоимость и эффективность.','Period, channel, volume, outcome, cost, and efficiency.',function (l) { return sheetSeed(l,{ru:'Аналитика',en:'Analytics'},[{name:{ru:'Период',en:'Period'}},{name:{ru:'Канал',en:'Channel'}},{name:{ru:'Объём',en:'Volume'},type:'number'},{name:{ru:'Результат',en:'Outcome'},type:'number'},{name:{ru:'Стоимость',en:'Cost'},type:'currency'},{name:{ru:'Эффективность',en:'Efficiency'},type:'percent'}],[[{ru:'Неделя 1',en:'Week 1'},{ru:'Канал A',en:'Channel A'},'0','0','0','=D2/C2'],[{ru:'Неделя 2',en:'Week 2'},{ru:'Канал B',en:'Channel B'},'0','0','0','=D3/C3']],{ru:'Аналитика',en:'Analytics'}); });

  add('presentation-project','presentation','Проектная презентация','Project presentation','Проблема, решение, план, риски и запрос.','Problem, solution, plan, risks, and ask.',function(l){return presentationSeed(l,{ru:'Проектная презентация',en:'Project presentation'},[slide({ru:'Название проекта',en:'Project name'},{ru:'Короткое обещание результата',en:'A concise outcome promise'}),slide({ru:'Проблема',en:'Problem'},{ru:'Контекст · пользователи · масштаб',en:'Context · users · scale'}),slide({ru:'Решение',en:'Solution'},{ru:'Подход · ценность · отличие',en:'Approach · value · differentiation'}),slide({ru:'План',en:'Plan'},{ru:'Этапы · сроки · владельцы',en:'Stages · dates · owners'}),slide({ru:'Риски и запрос',en:'Risks & ask'},{ru:'Что может помешать и какое решение требуется',en:'What may block progress and what decision is needed'})]);});
  add('presentation-report','presentation','Отчётная презентация','Report presentation','Итоги периода, показатели, выводы и следующие шаги.','Period results, metrics, insights, and next steps.',function(l){return presentationSeed(l,{ru:'Отчётная презентация',en:'Report presentation'},[slide({ru:'Итоги периода',en:'Period review'},{ru:'Период · команда · главный результат',en:'Period · team · primary outcome'}),slide({ru:'Ключевые показатели',en:'Key metrics'},{ru:'Показатель 1\nПоказатель 2\nПоказатель 3',en:'Metric 1\nMetric 2\nMetric 3'}),slide({ru:'Что сработало',en:'What worked'},{ru:'Наблюдения и подтверждения',en:'Insights and evidence'}),slide({ru:'Следующие шаги',en:'Next steps'},{ru:'Действие · срок · владелец',en:'Action · due date · owner'})]);});
  add('presentation-learning','presentation','Образовательная презентация','Learning presentation','Цель урока, основные идеи, пример и закрепление.','Learning goal, key ideas, example, and recap.',function(l){return presentationSeed(l,{ru:'Учебная презентация',en:'Learning presentation'},[slide({ru:'Тема занятия',en:'Lesson topic'},{ru:'Чему научится аудитория',en:'What the audience will learn'}),slide({ru:'Ключевая идея',en:'Key concept'},{ru:'Определение и объяснение',en:'Definition and explanation'}),slide({ru:'Пример',en:'Example'},{ru:'Разбор шага за шагом',en:'Step-by-step walkthrough'}),slide({ru:'Закрепление',en:'Recap'},{ru:'Три вывода и вопрос для проверки',en:'Three takeaways and a check question'})]);});
  add('presentation-brief','presentation','Краткая презентация','Brief presentation','Четыре слайда для ясного короткого выступления.','Four slides for a clear short briefing.',function(l){return presentationSeed(l,{ru:'Краткая презентация',en:'Brief presentation'},[slide({ru:'Главная мысль',en:'Core message'},{ru:'Одно предложение, которое должны запомнить',en:'The one sentence people should remember'}),slide({ru:'Почему сейчас',en:'Why now'},{ru:'Контекст и возможность',en:'Context and opportunity'}),slide({ru:'Что предлагаем',en:'The proposal'},{ru:'Решение и ожидаемый эффект',en:'Solution and expected effect'}),slide({ru:'Следующий шаг',en:'Next step'},{ru:'Конкретное действие и срок',en:'Concrete action and date'})]);});

  add('diagram-process','diagram','Процесс','Process map','Последовательность этапов от входа до результата.','A sequence of stages from input to outcome.',function(l){return diagramSeed(l,{ru:'Процесс',en:'Process'},[{ru:'Вход',en:'Input'},{ru:'Подготовка',en:'Prepare'},{ru:'Исполнение',en:'Deliver'},{ru:'Проверка',en:'Review'},{ru:'Результат',en:'Outcome'}],'process');});
  add('diagram-flow','diagram','Блок-схема решения','Decision flowchart','Старт, условие, два пути и завершение.','Start, decision, two paths, and completion.',function(l){return diagramSeed(l,{ru:'Блок-схема',en:'Flowchart'},[{ru:'Старт',en:'Start'},{ru:'Условие',en:'Decision'},{ru:'Да: действие',en:'Yes: action'},{ru:'Нет: исправить',en:'No: revise'},{ru:'Готово',en:'Done'}],'flow');});
  add('diagram-hierarchy','diagram','Иерархия','Hierarchy','Центральный владелец и четыре направления.','One central owner and four workstreams.',function(l){return diagramSeed(l,{ru:'Иерархия',en:'Hierarchy'},[{ru:'Руководитель',en:'Lead'},{ru:'Направление A',en:'Workstream A'},{ru:'Направление B',en:'Workstream B'},{ru:'Направление C',en:'Workstream C'},{ru:'Направление D',en:'Workstream D'}],'hierarchy');});
  add('diagram-relations','diagram','Карта связей','Relationship map','Ключевой объект, люди, материалы, события и результат.','A focal object with people, materials, events, and outcome.',function(l){return diagramSeed(l,{ru:'Карта связей',en:'Relationship map'},[{ru:'Проект',en:'Project'},{ru:'Люди',en:'People'},{ru:'Материалы',en:'Materials'},{ru:'События',en:'Events'},{ru:'Результаты',en:'Outcomes'}],'relations');});

  add('formula-math','formula','Математика: квадратное уравнение','Math: quadratic formula','Готовая формула корней квадратного уравнения.','A ready quadratic formula.',function(l){return{title:pick({ru:'Квадратное уравнение',en:'Quadratic formula'},l),payload:{source:'x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4 a c}}{2 a}'}};});
  add('formula-physics','formula','Физика: энергия','Physics: energy','Базовая связь массы и энергии.','The basic mass-energy relation.',function(l){return{title:pick({ru:'Энергия массы',en:'Mass-energy relation'},l),payload:{source:'E = m c^2'}};});
  add('formula-statistics','formula','Статистика: среднее','Statistics: mean','Среднее арифметическое выборки.','Arithmetic mean of a sample.',function(l){return{title:pick({ru:'Среднее выборки',en:'Sample mean'},l),payload:{source:'x_{mean} = \\frac{\\sum_{i=1}^{n} x_i}{n}'}};});
  add('formula-economics','formula','Экономика: рентабельность','Economics: ROI','Отношение прибыли к затратам.','Profit relative to cost.',function(l){return{title:pick({ru:'Рентабельность инвестиций',en:'Return on investment'},l),payload:{source:'ROI = \\frac{profit - cost}{cost} \\times 100%'}};});

  add('form-application','form','Заявка','Application form','Контакты, тема обращения, описание и приоритет.','Contact details, request, description, and priority.',function(l){return formSeed(l,{ru:'Новая заявка',en:'New application'},{ru:'Заполните данные — команда рассмотрит заявку и свяжется с вами.',en:'Provide the details and the team will review your request.'},[{type:'short',label:{ru:'Имя',en:'Name'},required:true},{type:'email',label:{ru:'Email',en:'Email'},required:true},{type:'select',label:{ru:'Тема',en:'Topic'},options:[{ru:'Проект',en:'Project'},{ru:'Поддержка',en:'Support'},{ru:'Другое',en:'Other'}],required:true},{type:'long',label:{ru:'Описание',en:'Description'},required:true},{type:'select',label:{ru:'Приоритет',en:'Priority'},options:[{ru:'Обычный',en:'Normal'},{ru:'Высокий',en:'High'}]}]);});
  add('form-survey','form','Опрос','Survey','Короткий качественный опрос с оценкой и открытым ответом.','A concise survey with a rating and open feedback.',function(l){return formSeed(l,{ru:'Опрос',en:'Survey'},{ru:'Ваши ответы помогут принять следующее решение.',en:'Your answers will help inform the next decision.'},[{type:'radio',label:{ru:'Насколько полезен результат?',en:'How useful is the outcome?'},options:['1','2','3','4','5'],required:true},{type:'select',label:{ru:'Что было самым ценным?',en:'What was most valuable?'},options:[{ru:'Скорость',en:'Speed'},{ru:'Качество',en:'Quality'},{ru:'Удобство',en:'Usability'}]},{type:'long',label:{ru:'Что улучшить?',en:'What should improve?'}}]);});
  add('form-registration','form','Регистрация','Registration form','Имя, контакты, организация, роль и согласие.','Name, contact details, organization, role, and consent.',function(l){return formSeed(l,{ru:'Регистрация',en:'Registration'},{ru:'Зарегистрируйтесь для участия.',en:'Register to attend.'},[{type:'short',label:{ru:'Имя и фамилия',en:'Full name'},required:true},{type:'email',label:'Email',required:true},{type:'short',label:{ru:'Организация',en:'Organization'}},{type:'short',label:{ru:'Роль',en:'Role'}},{type:'checkbox',label:{ru:'Согласен с условиями участия',en:'I agree to the participation terms'},required:true}]);});
  add('form-feedback','form','Обратная связь','Feedback form','Оценка опыта, сильная сторона, проблема и контакт.','Experience rating, strength, issue, and contact.',function(l){return formSeed(l,{ru:'Обратная связь',en:'Feedback'},{ru:'Расскажите, что сработало и что стоит исправить.',en:'Tell us what worked and what should be fixed.'},[{type:'radio',label:{ru:'Оценка опыта',en:'Experience rating'},options:['1','2','3','4','5'],required:true},{type:'long',label:{ru:'Что понравилось?',en:'What worked well?'}},{type:'long',label:{ru:'Что нужно исправить?',en:'What should be fixed?'}},{type:'email',label:{ru:'Email для ответа',en:'Email for follow-up'}}]);});

  function getAll(type, locale) {
    return templates.filter(function (entry) { return !type || entry.type === type; }).map(function (entry) {
      return { id:entry.id, type:entry.type, title:pick(entry.title, locale), description:pick(entry.description, locale) };
    });
  }
  function getById(id) { return templates.find(function (entry) { return entry.id === String(id || ''); }) || null; }
  function createSeed(id, locale) { var entry = getById(id); return entry ? clone(entry.factory(locale === 'ru' ? 'ru' : 'en')) : null; }

  root.NSOfficeTemplatesV1 = Object.freeze({ getAll:getAll, getById:getById, createSeed:createSeed, count:templates.length });
})(window);
