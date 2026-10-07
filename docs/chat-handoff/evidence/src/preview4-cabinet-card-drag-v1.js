(function () {
  if (window.__IRGEZTNE_PREVIEW4_CARD_DRAG_V1__) return;
  window.__IRGEZTNE_PREVIEW4_CARD_DRAG_V1__ = true;

  const STORAGE_KEY = 'irgeztne.preview4.cabinet.cardOrder.v2';
  const DEFAULT_ORDER = [
    'workspace',
    'files',
    'projects',
    'documents',
    'notes',
    'marketplace',
    'codehub',
    'rooms',
    'analytics',
    'tools',
    'map',
    'editor',
    'fili-store',
    'fili-safe',
    'site-pages'
  ];

  function storageApi() {
    return window.nsAPI || null;
  }

  function readLegacyOrder() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readOrder() {
    const api = storageApi();

    if (
      api &&
      typeof api.storageGetLayoutSync === 'function'
    ) {
      const saved = api.storageGetLayoutSync(
        STORAGE_KEY,
        null
      );

      if (Array.isArray(saved) && saved.length) {
        return saved;
      }

      return DEFAULT_ORDER.slice();
    }

    const saved = readLegacyOrder();

    return saved.length
      ? saved
      : DEFAULT_ORDER.slice();
  }

  function saveOrder() {
    const order = getCards()
      .map((card) => card.getAttribute('data-open-section'))
      .filter(Boolean);

    const api = storageApi();
    if (api && typeof api.storageSetLayout === 'function') {
      api.storageSetLayout(STORAGE_KEY, order).catch((error) => console.warn('[IRGEZTNE Card Drag] storage save failed', error));
      return;
    }

    // Fallback only for builds without Storage Core API.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  function getGrid() {
    return document.querySelector('.cabinet-group--primary');
  }

  function getCards() {
    const grid = getGrid();
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.cabinet-tile[data-open-section]'));
  }

  function applyOrder() {
    const grid = getGrid();
    const order = readOrder();
    if (!grid || !order.length) return;

    const cards = getCards();
    const bySection = new Map(
      cards.map((card) => [card.getAttribute('data-open-section'), card])
    );

    order.forEach((section) => {
      const card = bySection.get(section);
      if (card) grid.appendChild(card);
    });

    cards.forEach((card) => {
      if (!grid.contains(card)) grid.appendChild(card);
    });
  }

  function getDragAfterElement(container, x, y) {
    const cards = Array.from(container.querySelectorAll('.cabinet-tile[data-open-section]:not(.is-dragging)'));

    return cards.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offsetY = y - box.top - box.height / 2;
      const offsetX = x - box.left - box.width / 2;
      const distance = Math.hypot(offsetX, offsetY);

      const isBefore =
        y < box.top + box.height / 2 ||
        (Math.abs(offsetY) < box.height / 2 && x < box.left + box.width / 2);

      if (isBefore && distance < closest.distance) {
        return { distance, element: child };
      }

      return closest;
    }, { distance: Number.POSITIVE_INFINITY, element: null }).element;
  }

  function enableDrag() {
    const grid = getGrid();
    if (!grid) return;

    getCards().forEach((card) => {
      if (card.dataset.dragReady === 'true') return;

      card.dataset.dragReady = 'true';
      card.setAttribute('draggable', 'true');
      card.title = card.title || 'Drag to reorder';

      card.addEventListener('dragstart', () => {
        card.classList.add('is-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        saveOrder();
      });
    });

    if (grid.dataset.dragDropReady === 'true') return;
    grid.dataset.dragDropReady = 'true';

    grid.addEventListener('dragover', (event) => {
      event.preventDefault();

      const dragging = grid.querySelector('.cabinet-tile.is-dragging');
      if (!dragging) return;

      const afterElement = getDragAfterElement(grid, event.clientX, event.clientY);

      if (!afterElement) {
        grid.appendChild(dragging);
      } else {
        grid.insertBefore(dragging, afterElement);
      }
    });
  }

  function boot() {
    applyOrder();
    enableDrag();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 900);
})();
