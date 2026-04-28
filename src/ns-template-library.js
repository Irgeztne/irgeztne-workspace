(function (root) {
  const TEMPLATE_DEFS = [
    {
      itemId: 'template-website-starter',
      templateId: 'website-starter',
      name: 'Website Starter',
      description: 'Чистый one-page сайт: Главная, О проекте, Работа, Контакт — все ссылки работают как якоря.',
      version: '0.3.0',
      installed: true,
      trust: 'built-in',
      template: {
        id: 'website-starter',
        name: 'Website Starter',
        category: 'website',
        description: 'Одностраничный стартовый сайт с рабочими якорями: Главная, О проекте, Работа и Контакт.',
        defaults: {
          kicker: 'One-page Website Starter',
          title: 'Веб-сайт без названия',
          author: 'IRGEZTNE Studio',
          summary: 'Чистый одностраничный сайт для v1: верхнее меню ведёт к реальным секциям, а не к пустым страницам.',
          excerpt: 'Одностраничный стартовый сайт, подготовленный в IRGEZTNE Workspace.',
          seoTitle: 'Веб-сайт без названия',
          seoDescription: 'Одностраничный стартовый сайт, подготовленный в IRGEZTNE Workspace.',
          keywords: ['website', 'starter', 'one-page', 'landing', 'portfolio', 'irgeztne workspace'],
          visualHtml: `<section class="ns-page-section ns-page-hero ns-page-hero--split" id="home">
  <div class="ns-page-hero__content">
    <div class="ns-page-kicker">One-page Website Starter</div>
    <h1>Соберите ясный одностраничный сайт</h1>
    <p class="ns-page-lead">Простой стартовый сайт для проекта, автора, студии или небольшой публикации. Верхнее меню ведёт к реальным секциям: Главная, О проекте, Работа и Контакт.</p>
    <div class="ns-page-actions">
      <a class="ns-page-button ns-page-button--primary" href="#contact">Связаться</a>
      <a class="ns-page-button" href="#work">Посмотреть работу</a>
    </div>
  </div>
  <aside class="ns-page-panel ns-page-panel--feature">
    <div class="ns-page-panel__eyebrow">Структура v1</div>
    <strong>Одна страница, рабочие якоря</strong>
    <p>Для первого релиза шаблон специально оставлен простым. Multi-page website-шаблоны можно добавить позже.</p>
  </aside>
</section>
<section class="ns-page-section" id="about">
  <div class="ns-page-section__head">
    <h2>О проекте</h2>
    <p>Объясните, кто вы, что делает проект и почему это важно.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--two">
    <div class="ns-page-card">
      <span>Задача</span>
      <strong>Понятное первое впечатление</strong>
      <p>Дайте посетителю короткое и прямое объяснение проекта или услуги.</p>
    </div>
    <div class="ns-page-card">
      <span>Формат</span>
      <strong>Простая публичная страница</strong>
      <p>Сохраните страницу читаемой и лёгкой для адаптации до появления сложной публикации.</p>
    </div>
  </div>
</section>
<section class="ns-page-section" id="work">
  <div class="ns-page-section__head">
    <h2>Работа</h2>
    <p>Покажите самые важные направления, услуги, проекты или материалы.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--three">
    <div class="ns-page-card">
      <span>01</span>
      <strong>Направление</strong>
      <p>Опишите основную работу или услугу одним коротким абзацем.</p>
    </div>
    <div class="ns-page-card">
      <span>02</span>
      <strong>Проект</strong>
      <p>Добавьте пример, публикацию, кейс или продуктовую ветку.</p>
    </div>
    <div class="ns-page-card">
      <span>03</span>
      <strong>Следующий шаг</strong>
      <p>Скажите посетителю, что делать дальше: написать, скачать, следить или открыть проект.</p>
    </div>
  </div>
</section>
<section class="ns-page-section" id="contact">
  <div class="ns-page-callout">
    <div>
      <div class="ns-page-callout__eyebrow">Контакт</div>
      <h2>Добавьте реальный путь связи</h2>
      <p>Замените этот placeholder на настоящий email, ссылку или короткое контактное сообщение.</p>
    </div>
    <a class="ns-page-button ns-page-button--primary" href="mailto:hello@example.com">Написать</a>
  </div>
</section>`,
          markdown: `# Соберите ясный одностраничный сайт

Простой стартовый сайт для проекта, автора, студии или небольшой публикации.

## О проекте

Объясните, кто вы, что делает проект и почему это важно.

## Работа

Покажите самые важные направления, услуги, проекты или материалы.

## Контакт

Добавьте реальный путь связи.`,
          blocks: [
            { type: 'heading-1', text: 'Соберите ясный одностраничный сайт' },
            { type: 'paragraph', text: 'Простой стартовый сайт для проекта, автора, студии или небольшой публикации.' },
            { type: 'heading-2', text: 'О проекте' },
            { type: 'paragraph', text: 'Объясните, кто вы, что делает проект и почему это важно.' },
            { type: 'heading-2', text: 'Работа' },
            { type: 'paragraph', text: 'Покажите самые важные направления, услуги, проекты или материалы.' },
            { type: 'heading-2', text: 'Контакт' },
            { type: 'paragraph', text: 'Добавьте реальный путь связи.' }
          ],
          tags: ['website', 'starter', 'landing', 'light-dark', 'friendly']
        }
      }
    },
    {
      itemId: 'template-blog-post',
      templateId: 'blog-post',
      name: 'Medium-style Article',
      description: 'Чистый длинный article-шаблон: headline, lead, body, quote, conclusion.',
      version: '0.1.0',
      installed: true,
      trust: 'built-in',
      template: {
        id: 'blog-post',
        name: 'Medium-style Article',
        category: 'article',
        description: 'Чистый длинный article-шаблон в духе longform/Medium: lead, sections, quote, conclusion.',
        defaults: {
          kicker: 'Medium-style Article',
          title: 'Статья без названия',
          author: 'IRGEZTNE Author',
          summary: 'Чистая длинная статья с сильным заголовком, лидом, основной мыслью, цитатой и выводом.',
          excerpt: 'Более сильный шаблон длинной публикации, подготовленный в IRGEZTNE Workspace.',
          seoTitle: 'Статья без названия',
          seoDescription: 'A stronger blog post starter prepared in IRGEZTNE Workspace.',
          keywords: ['article', 'medium-style', 'longform', 'post'],
          visualHtml: `<article class="ns-page-section ns-post">
  <div class="ns-page-prose ns-page-prose--medium">
    <div class="ns-page-kicker">Medium-style Article</div>
    <h1>Заголовок вашей длинной статьи</h1>
    <p class="ns-page-lead">Начните с сильного лида: одна ясная мысль, которая объясняет, почему читателю стоит продолжить.</p>
    <div class="ns-page-meta-strip">
      <span>7 мин чтения</span>
      <span>Автор</span>
      <span>Дата</span>
    </div>
    <p>Первый абзац должен сразу дать контекст. Не перегружайте его деталями: объясните проблему, ситуацию или наблюдение, вокруг которого строится материал.</p>
    <h2>Главная мысль</h2>
    <p>Разверните тезис спокойным ритмом. Используйте короткие абзацы, чтобы текст было удобно читать как в редакторе, так и в публичном preview.</p>
    <blockquote>Выделите одну важную мысль или цитату, чтобы добавить паузу и акцент внутри длинного текста.</blockquote>
    <h2>Почему это важно</h2>
    <p>Добавьте последствия, примеры, детали или личный опыт. Этот блок помогает статье стать не просто заметкой, а полноценным материалом.</p>
    <h2>Вывод</h2>
    <p>Завершите текст ясным выводом или следующим шагом. Хорошая статья оставляет читателю не только информацию, но и направление.</p>
  </div>
</article>`,
          markdown: `# Заголовок вашей длинной статьи

Начните с сильного лида: одна ясная мысль, которая объясняет, почему читателю стоит продолжить.

Первый абзац должен сразу дать контекст. Не перегружайте его деталями: объясните проблему, ситуацию или наблюдение, вокруг которого строится материал.

## Главная мысль

Разверните тезис спокойным ритмом. Используйте короткие абзацы.

> Выделите одну важную мысль или цитату, чтобы добавить паузу и акцент.

## Почему это важно

Добавьте последствия, примеры, детали или личный опыт.

## Вывод

Завершите текст ясным выводом или следующим шагом.`,
          blocks: [
            { type: 'heading-1', text: 'Заголовок вашей длинной статьи' },
            { type: 'paragraph', text: 'Начните с сильного лида: одна ясная мысль, которая объясняет, почему читателю стоит продолжить.' },
            { type: 'paragraph', text: 'Первый абзац должен сразу дать контекст.' },
            { type: 'heading-2', text: 'Главная мысль' },
            { type: 'paragraph', text: 'Разверните тезис спокойным ритмом.' },
            { type: 'quote', text: 'Выделите одну важную мысль или цитату, чтобы добавить паузу и акцент.' },
            { type: 'heading-2', text: 'Почему это важно' },
            { type: 'paragraph', text: 'Добавьте последствия, примеры, детали или личный опыт.' },
            { type: 'heading-2', text: 'Вывод' },
            { type: 'paragraph', text: 'Завершите текст ясным выводом или следующим шагом.' }
          ],
          tags: ['blog', 'post']
        }
      }
    },
    {
      itemId: 'vitrina-template-editorial-brief',
      templateId: 'vitrina-editorial-brief',
      name: 'Editorial Brief',
      description: 'Более сильный newsroom-шаблон с лидом, ключевыми фактами, таймлайном и следующими углами освещения.',
      version: '0.2.0',
      installed: true,
      trust: 'built-in',
      template: {
        id: 'vitrina-editorial-brief',
        name: 'Editorial Brief',
        category: 'article',
        description: 'Редакционный шаблон статьи с лидом, ключевыми фактами, таймлайном и следующим освещением.',
        defaults: {
          kicker: 'Editorial Brief',
          title: 'Редакционный бриф без названия',
          author: 'IRGEZTNE Desk',
          summary: 'Более сильная редакционная сводка с ключевыми фактами, таймлайном и структурой «почему это важно».',
          excerpt: 'Более сильный редакционный шаблон, подготовленный в IRGEZTNE Workspace.',
          seoTitle: 'Редакционный бриф без названия',
          seoDescription: 'Более сильный редакционный шаблон, подготовленный в IRGEZTNE Workspace.',
          keywords: ['editorial', 'brief', 'article', 'newsroom'],
          visualHtml: `<article class="ns-page-section ns-post">
  <div class="ns-page-kicker">Editorial Brief</div>
  <h1>Главный заголовок материала</h1>
  <p class="ns-page-lead"><strong>Лид:</strong> Start with the strongest confirmed fact, then tell the reader why this story matters now.</p>
  <div class="ns-page-meta-strip">
    <span>Лид</span>
    <span>Ключевые факты</span>
    <span>Следующее освещение</span>
  </div>
</article>
<section class="ns-page-section">
  <div class="ns-page-grid ns-page-grid--article">
    <div class="ns-page-prose">
      <h2>Что произошло</h2>
      <p>Разложите основное событие в ясный хронологический блок, чтобы читатель быстро схватил главную линию.</p>
      <h2>Ключевые факты</h2>
      <p>Выделите три-пять подтверждённых пунктов, которые важнее всего для брифа.</p>
      <blockquote>Используйте одну короткую редакторскую заметку, цитату или формулировку, чтобы зафиксировать угол материала.</blockquote>
      <h2>Почему это важно</h2>
      <p>Объясните, что изменилось, кого это затрагивает и за чем редакции следить дальше.</p>
    </div>
    <aside class="ns-page-panel ns-page-panel--sidebar">
      <div class="ns-page-panel__eyebrow">Покрытие map</div>
      <strong>Перед публикацией</strong>
      <ul class="ns-page-list">
        <li>Проверьте главный факт лида</li>
        <li>Проверьте имена и даты</li>
        <li>Добавьте следующий угол освещения</li>
      </ul>
    </aside>
  </div>
</section>
<section class="ns-page-section">
  <div class="ns-page-grid ns-page-grid--two">
    <div class="ns-page-card"><strong>Timeline</strong><p>Add a short sequence of the important updates, decisions, or developments.</p></div>
    <div class="ns-page-card"><strong>Next angle</strong><p>Note the follow-up question, missing evidence, or next reporting target.</p></div>
  </div>
</section>`,
          markdown: `# Главный заголовок материала

**Лид:** Start with the strongest confirmed fact, then tell the reader why this story matters now.

## Что произошло

Разложите основное событие в ясный хронологический блок, чтобы читатель быстро схватил главную линию.

## Ключевые факты

Выделите три-пять подтверждённых пунктов, которые важнее всего для брифа.

## Почему это важно

Объясните, что изменилось, кого это затрагивает и за чем редакции следить дальше.

## Next angle

Note the follow-up question, missing evidence, or next reporting target.`,
          blocks: [
            { type: 'heading-1', text: 'Главный заголовок материала' },
            { type: 'paragraph', text: 'Лид: Start with the strongest confirmed fact, then tell the reader why this story matters now.' },
            { type: 'heading-2', text: 'Что произошло' },
            { type: 'paragraph', text: 'Разложите основное событие в ясный хронологический блок, чтобы читатель быстро схватил главную линию.' },
            { type: 'heading-2', text: 'Ключевые факты' },
            { type: 'paragraph', text: 'Выделите три-пять подтверждённых пунктов, которые важнее всего для брифа.' },
            { type: 'heading-2', text: 'Почему это важно' },
            { type: 'paragraph', text: 'Объясните, что изменилось, кого это затрагивает и за чем редакции следить дальше.' },
            { type: 'heading-2', text: 'Next angle' },
            { type: 'paragraph', text: 'Note the follow-up question, missing evidence, or next reporting target.' }
          ],
          tags: ['editorial', 'brief', 'newsroom']
        }
      }
    },
    {
      itemId: 'vitrina-template-news-analysis',
      templateId: 'vitrina-news-analysis',
      name: 'News Анализ',
      description: 'Более длинный шаблон разбора для контекста, фактов и спокойного вывода.',
      version: '0.1.0',
      installed: false,
      trust: 'built-in',
      template: {
        id: 'vitrina-news-analysis',
        name: 'News Анализ',
        category: 'analysis',
        description: 'Контекст-first analysis template for explainers and long reads.',
        defaults: {
          kicker: 'News Анализ',
          title: 'Новостной разбор без названия',
          author: 'NS Analyst',
          summary: 'Short analysis summary for cards and previews.',
          excerpt: 'Стартовый шаблон анализа с упором на контекст, подготовленный в IRGEZTNE Workspace.',
          seoTitle: 'Новостной разбор без названия',
          seoDescription: 'Стартовый шаблон анализа с упором на контекст, подготовленный в IRGEZTNE Workspace.',
          keywords: ['analysis', 'news', 'context'],
          visualHtml: `<article class="ns-page-section ns-post">
  <div class="ns-page-kicker">News Анализ</div>
  <h1>Контекстный заголовок</h1>
  <p><strong>Лид:</strong> Frame the issue and explain why readers should care.</p>
  <h2>Background</h2>
  <p>Add history, context, and the relevant timeline.</p>
  <h2>Signals</h2>
  <p>Pull out the strongest facts, patterns, or contradictions.</p>
  <h2>Вывод</h2>
  <p>Close with a calm conclusion and the next thing to watch.</p>
</article>`,
          markdown: `# Контекстный заголовок

**Лид:** Frame the issue and explain why readers should care.

## Background

Add history, context, and the relevant timeline.

## Signals

Pull out the strongest facts, patterns, or contradictions.

## Вывод

Close with a calm conclusion and the next thing to watch.`,
          blocks: [
            { type: 'heading-1', text: 'Контекстный заголовок' },
            { type: 'paragraph', text: 'Лид: Frame the issue and explain why readers should care.' },
            { type: 'heading-2', text: 'Background' },
            { type: 'paragraph', text: 'Add history, context, and the relevant timeline.' },
            { type: 'heading-2', text: 'Signals' },
            { type: 'paragraph', text: 'Pull out the strongest facts, patterns, or contradictions.' },
            { type: 'heading-2', text: 'Вывод' },
            { type: 'paragraph', text: 'Close with a calm conclusion and the next thing to watch.' }
          ],
          tags: ['analysis', 'context']
        }
      }
    },
    {
      itemId: 'vitrina-template-landing-press',
      templateId: 'vitrina-press-landing',
      name: 'Press Landing',
      description: 'Более сильный стартовый лендинг для newsroom, студии, профиля или главной страницы проекта.',
      version: '0.2.0',
      installed: false,
      trust: 'built-in',
      template: {
        id: 'vitrina-press-landing',
        name: 'Press Landing',
        category: 'website',
        description: 'Более сильный стартовый лендинг для newsroom, студии или профиля.',
        defaults: {
          kicker: 'Press Landing',
          title: 'Пресс-лендинг без названия',
          author: 'IRGEZTNE Studio',
          summary: 'A stronger landing summary with headline, coverage, highlights, and contact path.',
          excerpt: 'A stronger landing page starter prepared in IRGEZTNE Workspace.',
          seoTitle: 'Пресс-лендинг без названия',
          seoDescription: 'A stronger landing page starter prepared in IRGEZTNE Workspace.',
          keywords: ['landing', 'press', 'site', 'newsroom'],
          visualHtml: `<section class="ns-page-section ns-page-hero ns-page-hero--split" id="overview">
  <div class="ns-page-hero__content">
    <div class="ns-page-kicker">Press Landing</div>
    <h1>Название проекта или редакции</h1>
    <p>Используйте эту страницу как вход для небольшой редакции, студии, кампании или издания, которому нужен один чистый публичный лендинг.</p>
    <div class="ns-page-actions">
      <a class="ns-page-button ns-page-button--primary" href="#contact">Контакт</a>
      <a class="ns-page-button" href="#coverage">Покрытие</a>
    </div>
  </div>
  <aside class="ns-page-panel ns-page-panel--feature">
    <div class="ns-page-panel__eyebrow">Front page</div>
    <strong>Ready public landing</strong>
    <p>Headline, coverage, highlights, publication links, and final contact are already prepared so the page feels like a real public-facing site.</p>
    <ul class="ns-page-list">
      <li>Headline with actions</li>
      <li>Покрытие and highlights</li>
      <li>Контакт and public links</li>
    </ul>
  </aside>
</section>
<section class="ns-page-section" id="coverage">
  <div class="ns-page-section__head">
    <h2>Покрытие</h2>
    <p>Describe the beat, publication focus, campaign direction, or product coverage in three clear cards.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--three">
    <div class="ns-page-card"><span>Beat</span><strong>Главная тема</strong><p>Explain the main topic, focus area, or reporting direction.</p></div>
    <div class="ns-page-card"><span>Format</span><strong>Что вы публикуете</strong><p>Say whether this is articles, releases, explainers, interviews, or project updates.</p></div>
    <div class="ns-page-card"><span>Audience</span><strong>Для кого это</strong><p>Show who should read, contact, or follow this work.</p></div>
  </div>
</section>
<section class="ns-page-section" id="highlights">
  <div class="ns-page-section__head">
    <h2>Главное</h2>
    <p>Use this section for featured releases, recent stories, key links, or press materials.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--two">
    <div class="ns-page-card"><strong>Recent release or story</strong><p>Add the latest important update or featured publication here.</p></div>
    <div class="ns-page-card"><strong>Press kit or key link</strong><p>Use this card for media contacts, download links, or a core project document.</p></div>
  </div>
</section>
<section class="ns-page-section" id="contact">
  <div class="ns-page-callout">
    <div>
      <div class="ns-page-callout__eyebrow">Контакт</div>
      <h2>Ready to point people to the right place?</h2>
      <p>Добавьте здесь почту редакции, пресс-контакт, канал проекта или путь записи.</p>
    </div>
    <a class="ns-page-button ns-page-button--primary" href="mailto:hello@example.com">Контакт</a>
  </div>
</section>`,
          markdown: `# Название проекта или редакции

Используйте эту страницу как вход для небольшой редакции, студии, кампании или издания, которому нужен один чистый публичный лендинг.

## Покрытие

- Главная тема
- Что вы публикуете
- Для кого это

## Главное

Добавьте главные релизы, недавние материалы или пресс-материалы.

## Контакт

Добавьте здесь почту редакции, пресс-контакт, канал проекта или путь записи.`,
          blocks: [
            { type: 'heading-1', text: 'Название проекта или редакции' },
            { type: 'paragraph', text: 'Используйте эту страницу как вход для небольшой редакции, студии, кампании или издания, которому нужен один чистый публичный лендинг.' },
            { type: 'heading-2', text: 'Покрытие' },
            { type: 'list', text: `Главная тема
Что вы публикуете
Для кого это` },
            { type: 'heading-2', text: 'Главное' },
            { type: 'paragraph', text: 'Добавьте главные релизы, недавние материалы или пресс-материалы.' },
            { type: 'heading-2', text: 'Контакт' },
            { type: 'paragraph', text: 'Добавьте здесь почту редакции, пресс-контакт, канал проекта или путь записи.' }
          ],
          tags: ['landing', 'press', 'website']
        }
      }
    }
  ];

  const NON_TEMPLATE_BUILTINS = [
    {
      id: 'vitrina-theme-light-editorial',
      type: 'theme',
      category: 'Themes',
      name: 'Светлая Editorial',
      version: '0.1.0',
      description: 'Светлая редакционная тема, подготовленная для статейного вывода.',
      trust: 'built-in',
      installed: true
    },
    {
      id: 'vitrina-theme-dark-desk',
      type: 'theme',
      category: 'Themes',
      name: 'Тёмная Desk',
      version: '0.1.0',
      description: 'Тёмная редакционная тема с более сильным контрастом для поздних рабочих сессий.',
      trust: 'built-in',
      installed: false
    },
    {
      id: 'vitrina-pack-seo-helper',
      type: 'pack',
      category: 'Packs',
      name: 'SEO Helper Pack',
      version: '0.1.0',
      description: 'Небольшой вспомогательный пак для заголовка, описания, ключевых слов и аккуратной подготовки публикации.',
      trust: 'built-in',
      installed: true
    },
    {
      id: 'vitrina-plugin-quote-callout',
      type: 'plugin',
      category: 'Plugins',
      name: 'Quote Callout',
      version: '0.1.0',
      description: 'Безопасный блок контента для врезок и выделенных ссылок.',
      trust: 'built-in',
      installed: false
    }
  ];

  const EXTERNAL_STORAGE_KEY = 'ns.browser.v8.template-library.external';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeTemplateDef(def) {
    const source = def || {};
    const template = source.template || {};
    const defaults = template.defaults || {};

    return {
      itemId: String(source.itemId || ('template-' + String(template.id || source.templateId || 'untitled'))),
      templateId: String(source.templateId || template.id || ''),
      name: String(source.name || template.name || 'Untitled Template'),
      category: String(template.category || 'website'),
      description: String(source.description || template.description || ''),
      version: String(source.version || '0.1.0'),
      installed: source.installed !== false,
      trust: String(source.trust || 'built-in'),
      defaults: clone({
        kicker: String(defaults.kicker || source.name || template.name || 'Template'),
        title: String(defaults.title || ('Untitled ' + (template.name || source.name || 'Template'))),
        author: String(defaults.author || 'IRGEZTNE Desk'),
        summary: String(defaults.summary || source.description || ''),
        excerpt: String(defaults.excerpt || defaults.summary || source.description || ''),
        seoTitle: String(defaults.seoTitle || defaults.title || ('Untitled ' + (template.name || source.name || 'Template'))),
        seoDescription: String(defaults.seoDescription || defaults.summary || source.description || ''),
        keywords: Array.isArray(defaults.keywords) ? defaults.keywords.slice() : [],
        visualHtml: String(defaults.visualHtml || ''),
        markdown: String(defaults.markdown || ''),
        blocks: Array.isArray(defaults.blocks) ? defaults.blocks.slice() : [],
        tags: Array.isArray(defaults.tags) ? defaults.tags.slice() : []
      })
    };
  }

  function normalizeExternalTemplate(raw, fallbackTrust) {
    const source = raw || {};
    const template = source.template && source.template.defaults ? source.template : source;
    if (!template || !template.id || !template.defaults) return null;

    const defaults = template.defaults || {};
    return {
      itemId: String(source.catalogItemId || source.itemId || ('catalog-template-' + template.id)),
      templateId: String(source.templateId || template.id),
      name: String(source.name || template.name || template.id),
      category: String(template.category || 'website'),
      description: String(source.description || template.description || ''),
      version: String(source.version || '0.1.0'),
      installed: source.installed !== false,
      trust: String(source.trust || fallbackTrust || 'local'),
      defaults: clone({
        kicker: String(defaults.kicker || template.name || source.name || 'Template'),
        title: String(defaults.title || ('Untitled ' + (template.name || source.name || 'Template'))),
        author: String(defaults.author || 'IRGEZTNE Desk'),
        summary: String(defaults.summary || source.description || ''),
        excerpt: String(defaults.excerpt || defaults.summary || source.description || ''),
        seoTitle: String(defaults.seoTitle || defaults.title || ('Untitled ' + (template.name || source.name || 'Template'))),
        seoDescription: String(defaults.seoDescription || defaults.summary || source.description || ''),
        keywords: Array.isArray(defaults.keywords) ? defaults.keywords.slice() : [],
        visualHtml: String(defaults.visualHtml || ''),
        markdown: String(defaults.markdown || ''),
        blocks: Array.isArray(defaults.blocks) ? defaults.blocks.slice() : [],
        tags: Array.isArray(defaults.tags) ? defaults.tags.slice() : []
      })
    };
  }

  function toEditorTemplate(def) {
    return {
      id: def.templateId,
      name: def.name,
      category: def.category,
      description: def.description,
      defaults: clone(def.defaults)
    };
  }

  function toCatalogTemplateItem(def) {
    return {
      id: def.itemId,
      type: 'template',
      category: 'Templates',
      name: def.name,
      version: def.version,
      description: def.description,
      trust: def.trust,
      installed: def.installed,
      template: {
        id: def.templateId,
        name: def.name,
        category: def.category,
        description: def.description,
        defaults: clone(def.defaults)
      },
      preview: {
        cover: '',
        gallery: [],
        note: def.description,
        surface: 'editor'
      },
      author: { name: def.defaults.author || 'IRGEZTNE Desk', id: '', source: def.trust || 'built-in' },
      compatibility: {
        nsBrowser: '8.x',
        moduleTarget: ['editor', 'catalog'],
        surface: ['workspace', 'cabinet'],
        minAppVersion: '8.0.0'
      },
      tags: Array.isArray(def.defaults.tags) ? def.defaults.tags.slice(0, 6) : [],
      status: 'ready',
      source: def.trust === 'built-in' ? 'built-in' : 'local'
    };
  }

  function safeReadExternalTemplates() {
    try {
      const raw = root.localStorage.getItem(EXTERNAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function safeWriteExternalTemplates(value) {
    try {
      root.localStorage.setItem(EXTERNAL_STORAGE_KEY, JSON.stringify(Array.isArray(value) ? value : []));
    } catch (error) {
      console.warn('[NSTemplateLibrary] external template write failed:', error);
    }
  }

  function safeReadFolderTemplates() {
    // v1 public release guard:
    // keep folder-based experimental templates out of the public template registry.
    // The files can stay in /templates for future v1.1 work, but Catalog/Editor v1
    // should expose only the stable core templates.
    return [];
  }

  function mergeTemplateDefs() {
    const byTemplateId = new Map();

    TEMPLATE_DEFS.map(normalizeTemplateDef).forEach(function (item) {
      byTemplateId.set(String(item.templateId), item);
    });

    safeReadFolderTemplates()
      .map(function (item) { return normalizeExternalTemplate(item, 'local-file'); })
      .filter(Boolean)
      .forEach(function (item) {
        byTemplateId.set(String(item.templateId), item);
      });

    safeReadExternalTemplates()
      .map(function (item) { return normalizeExternalTemplate(item, 'local'); })
      .filter(Boolean)
      .forEach(function (item) {
        byTemplateId.set(String(item.templateId), item);
      });

    return Array.from(byTemplateId.values());
  }

  function getTemplateDefs() {
    return mergeTemplateDefs();
  }

  function getTemplates() {
    return getTemplateDefs().map(toEditorTemplate);
  }

  function getTemplate(templateId) {
    const found = getTemplateDefs().find(function (entry) {
      return entry.templateId === String(templateId || '');
    });
    return found ? toEditorTemplate(found) : null;
  }

  function getDefaultTemplateId() {
    const all = getTemplateDefs();
    return all[0] ? all[0].templateId : '';
  }

  function listCatalogBuiltins() {
    const templates = getTemplateDefs().map(toCatalogTemplateItem);
    const extra = clone(NON_TEMPLATE_BUILTINS).map(function (item) {
      const next = clone(item);
      next.preview = next.preview || { cover: '', gallery: [], note: next.description || '', surface: 'editor' };
      next.tags = Array.isArray(next.tags) ? next.tags.slice(0, 6) : [];
      next.source = next.trust === 'built-in' ? 'built-in' : 'local';
      return next;
    });

    const byId = new Map();
    templates.concat(extra).forEach(function (item) {
      if (item && item.id) {
        byId.set(String(item.id), item);
      }
    });
    return Array.from(byId.values());
  }

  function getCatalogItem(itemId) {
    const found = listCatalogBuiltins().find(function (item) {
      return String(item.id) === String(itemId || '');
    });
    return found ? clone(found) : null;
  }

  function getTemplateByCatalogItemId(itemId) {
    const found = getTemplateDefs().find(function (entry) {
      return entry.itemId === String(itemId || '');
    });
    return found ? toEditorTemplate(found) : null;
  }

  function upsertInstalledTemplates(incoming) {
    const baseIds = new Set(TEMPLATE_DEFS.map(normalizeTemplateDef).map(function (item) { return String(item.templateId); }));
    const folderIds = new Set(
      safeReadFolderTemplates()
        .map(function (item) { return normalizeExternalTemplate(item, 'local-file'); })
        .filter(Boolean)
        .map(function (item) { return String(item.templateId); })
    );

    const existing = safeReadExternalTemplates()
      .map(function (item) { return normalizeExternalTemplate(item, 'local'); })
      .filter(Boolean);

    const byId = new Map(existing.map(function (item) {
      return [String(item.templateId), {
        itemId: item.itemId,
        templateId: item.templateId,
        name: item.name,
        description: item.description,
        version: item.version,
        installed: item.installed,
        trust: item.trust,
        template: {
          id: item.templateId,
          name: item.name,
          category: item.category,
          description: item.description,
          defaults: clone(item.defaults)
        }
      }];
    }));

    (Array.isArray(incoming) ? incoming : []).forEach(function (item) {
      const normalized = normalizeExternalTemplate(item, 'local');
      if (!normalized) return;
      if (baseIds.has(String(normalized.templateId))) return;
      if (folderIds.has(String(normalized.templateId))) return;

      byId.set(String(normalized.templateId), {
        itemId: normalized.itemId,
        templateId: normalized.templateId,
        name: normalized.name,
        description: normalized.description,
        version: normalized.version,
        installed: normalized.installed,
        trust: normalized.trust,
        template: {
          id: normalized.templateId,
          name: normalized.name,
          category: normalized.category,
          description: normalized.description,
          defaults: clone(normalized.defaults)
        }
      });
    });

    safeWriteExternalTemplates(Array.from(byId.values()));
    root.dispatchEvent(new CustomEvent('ns-template-library:changed'));
  }

  root.NSTemplateLibrary = {
    getTemplates: getTemplates,
    getTemplate: getTemplate,
    getDefaultTemplateId: getDefaultTemplateId,
    listCatalogBuiltins: listCatalogBuiltins,
    getCatalogItem: getCatalogItem,
    getTemplateByCatalogItemId: getTemplateByCatalogItemId,
    upsertInstalledTemplates: upsertInstalledTemplates,
    refreshFromFiles: function () {
      root.dispatchEvent(new CustomEvent('ns-template-library:changed'));
      return getTemplates();
    }
  };
})(window);
