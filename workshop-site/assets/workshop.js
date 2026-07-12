(function () {
  'use strict';

  const packages = [
    {
      id: 'clean-landing',
      title: 'Clean Landing Pack',
      type: 'template',
      typeLabel: 'Шаблон',
      author: 'WebCraft',
      price: 'Бесплатно',
      rating: 4.8,
      downloads: '1.2K',
      updated: '2 дня назад',
      token: 'TPL',
      description: 'Набор блоков для лендинга: hero, features, pricing, FAQ и CTA.',
      tags: ['landing', 'web studio', 'blocks', 'free']
    },
    {
      id: 'portfolio-minimal',
      title: 'Portfolio Minimal',
      type: 'template',
      typeLabel: 'Шаблон',
      author: 'DesignLab',
      price: 'Бесплатно',
      rating: 4.7,
      downloads: '892',
      updated: '5 дней назад',
      token: 'TPL',
      description: 'Минималистичный шаблон портфолио для дизайнера, автора или студии.',
      tags: ['portfolio', 'minimal', 'free']
    },
    {
      id: 'form-builder-pro',
      title: 'Form Builder Pro',
      type: 'widget',
      typeLabel: 'Виджет',
      author: 'FormSoft',
      price: '$9.90',
      rating: 4.9,
      downloads: '642',
      updated: '1 неделя назад',
      token: 'WGT',
      description: 'Конструктор форм с полями, валидацией и подготовкой к интеграциям.',
      tags: ['forms', 'widget', 'pro']
    },
    {
      id: 'atlas-minerals',
      title: 'Atlas Minerals Pack',
      type: 'asset-pack',
      typeLabel: 'Ассеты',
      author: 'GeoData',
      price: 'Бесплатно',
      rating: 4.8,
      downloads: '1.1K',
      updated: '3 дня назад',
      token: 'IMG',
      description: 'Набор изображений, карточек и заметок для минералов и камней.',
      tags: ['atlas', 'minerals', 'images', 'free']
    },
    {
      id: 'seo-toolkit',
      title: 'SEO Toolkit',
      type: 'pack',
      typeLabel: 'Пакет',
      author: 'SiteBoost',
      price: '$19.00',
      rating: 4.6,
      downloads: '513',
      updated: '8 дней назад',
      token: 'PKG',
      description: 'Пакет блоков и подсказок для SEO: title, description, OpenGraph и sitemap.',
      tags: ['seo', 'metadata', 'publishing']
    },
    {
      id: 'violet-theme',
      title: 'Violet Calm Theme',
      type: 'theme',
      typeLabel: 'Тема',
      author: 'SoftUI',
      price: 'Бесплатно',
      rating: 4.9,
      downloads: '744',
      updated: 'сегодня',
      token: 'THM',
      description: 'Спокойная фиолетовая тема для мастерской, кабинетов и витрин.',
      tags: ['theme', 'violet', 'dark', 'free']
    },
    {
      id: 'static-starter',
      title: 'Static Publish Starter',
      type: 'starter',
      typeLabel: 'Стартер',
      author: 'BuildKit',
      price: 'Бесплатно',
      rating: 4.5,
      downloads: '318',
      updated: '11 дней назад',
      token: 'STR',
      description: 'Стартовый набор для статической публикации: структура, favicon, meta.json.',
      tags: ['starter', 'static', 'publish']
    },
    {
      id: 'icons-pack',
      title: 'Crystal Icons Pack',
      type: 'asset-pack',
      typeLabel: 'Ассеты',
      author: 'IconForge',
      price: '$4.00',
      rating: 4.7,
      downloads: '689',
      updated: '4 дня назад',
      token: 'ICO',
      description: 'Набор иконок для карточек, модулей, кнопок и каталогов.',
      tags: ['icons', 'assets', 'ui']
    }
  ];

  let activeFilter = 'all';

  const grid = document.getElementById('wsPackageGrid');
  const search = document.getElementById('wsSearch');
  const sort = document.getElementById('wsSort');
  const modal = document.getElementById('wsModal');
  const modalBody = document.getElementById('wsModalBody');
  const modalClose = document.getElementById('wsModalClose');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function visiblePackages() {
    const query = String(search && search.value || '').trim().toLowerCase();

    let items = packages.filter(function (item) {
      const filterOk = activeFilter === 'all' || item.type === activeFilter;
      const haystack = [
        item.title,
        item.typeLabel,
        item.author,
        item.description,
        item.tags.join(' ')
      ].join(' ').toLowerCase();

      return filterOk && (!query || haystack.includes(query));
    });

    const mode = sort && sort.value || 'popular';

    if (mode === 'free') {
      items = items.slice().sort(function (a, b) {
        return Number(b.price === 'Бесплатно') - Number(a.price === 'Бесплатно');
      });
    }

    if (mode === 'rating') {
      items = items.slice().sort(function (a, b) {
        return b.rating - a.rating;
      });
    }

    if (mode === 'new') {
      items = items.slice().reverse();
    }

    return items;
  }

  function renderCard(item) {
    const paid = item.price !== 'Бесплатно';

    return `
      <article class="ws-card" tabindex="0" role="button" data-package-id="${escapeHtml(item.id)}">
        <div class="ws-thumb">${escapeHtml(item.token)}</div>
        <div class="ws-card-body">
          <div class="ws-meta">
            <span>${escapeHtml(item.typeLabel)}</span>
            <span class="ws-price ${paid ? 'paid' : ''}">${escapeHtml(item.price)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>by ${escapeHtml(item.author)}</p>
          <p>${escapeHtml(item.description)}</p>
          <div class="ws-meta">
            <span>↓ ${escapeHtml(item.downloads)}</span>
            <span>★ ${escapeHtml(item.rating)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderPackages() {
    const items = visiblePackages();

    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<div class="ws-panel"><h3>Ничего не найдено</h3><p>Попробуйте другой фильтр или запрос.</p></div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');
  }

  function packageById(id) {
    return packages.find(function (item) { return item.id === id; });
  }

  function openPackage(item) {
    if (!item || !modal || !modalBody) return;

    modalBody.innerHTML = `
      <div class="ws-package-detail">
        <div class="ws-detail-preview">${escapeHtml(item.token)}</div>
        <div class="ws-detail-info">
          <p class="ws-kicker">${escapeHtml(item.typeLabel)} · ${escapeHtml(item.price)}</p>
          <h2 id="wsModalTitle">${escapeHtml(item.title)}</h2>
          <p>Автор: <strong>${escapeHtml(item.author)}</strong></p>
          <p>${escapeHtml(item.description)}</p>

          <div class="ws-tags">
            ${item.tags.map(function (tag) { return '<span>' + escapeHtml(tag) + '</span>'; }).join('')}
          </div>

          <div class="ws-rule-list">
            <div><strong>Загрузки</strong><span>${escapeHtml(item.downloads)}</span></div>
            <div><strong>Оценка</strong><span>${escapeHtml(item.rating)} / 5</span></div>
            <div><strong>Обновлено</strong><span>${escapeHtml(item.updated)}</span></div>
            <div><strong>Совместимость</strong><span>Web Studio 1.0+</span></div>
          </div>

          <div class="ws-hero-actions" style="margin-top:18px">
            <button class="ws-btn ws-btn-primary" type="button">Скачать пакет</button>
            <button class="ws-btn ws-btn-soft" type="button">В избранное</button>
            <button class="ws-btn ws-btn-ghost" type="button">Страница автора</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', function (event) {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      activeFilter = filter.getAttribute('data-filter') || 'all';
      document.querySelectorAll('[data-filter]').forEach(function (button) {
        button.classList.toggle('active', button === filter);
      });
      renderPackages();
      return;
    }

    const card = event.target.closest('[data-package-id]');
    if (card) {
      openPackage(packageById(card.getAttribute('data-package-id')));
      return;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();

    if (event.key === 'Enter') {
      const card = event.target.closest && event.target.closest('[data-package-id]');
      if (card) openPackage(packageById(card.getAttribute('data-package-id')));
    }
  });

  if (search) search.addEventListener('input', renderPackages);
  if (sort) sort.addEventListener('change', renderPackages);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
  }

  const submitForm = document.getElementById('wsSubmitForm');
  const submitNote = document.getElementById('wsSubmitNote');

  if (submitForm) {
    submitForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = new FormData(submitForm);
      const title = String(data.get('title') || '').trim() || 'Пакет без названия';

      if (submitNote) {
        submitNote.textContent = 'Черновик «' + title + '» создан в демо-режиме. Позже здесь будет отправка на проверку.';
      }
    });
  }

  renderPackages();
})();
