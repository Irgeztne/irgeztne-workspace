(function () {
  if (window.__IRGEZTNE_PREVIEW4_NAV_DRAG_V1__) return;
  window.__IRGEZTNE_PREVIEW4_NAV_DRAG_V1__ = true;

  const STORAGE_KEY = 'irgeztne.preview4.cabinet.navOrder.v1';

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
    if (api && typeof api.storageGetLayoutSync === 'function') {
      const saved = api.storageGetLayoutSync(STORAGE_KEY, null);
      if (Array.isArray(saved)) return saved;

      // One-time migration from old LocalStorage value if present.
      const legacy = readLegacyOrder();
      if (legacy.length && typeof api.storageSetLayout === 'function') {
        try { api.storageSetLayout(STORAGE_KEY, legacy); } catch (error) { console.warn('[IRGEZTNE Nav Drag] migration failed', error); }
        return legacy;
      }
      return [];
    }
    return readLegacyOrder();
  }

  function saveOrder() {
    const order = getButtons()
      .map((button) => button.getAttribute('data-open-section'))
      .filter(Boolean);

    const api = storageApi();
    if (api && typeof api.storageSetLayout === 'function') {
      api.storageSetLayout(STORAGE_KEY, order).catch((error) => console.warn('[IRGEZTNE Nav Drag] storage save failed', error));
      return;
    }

    // Fallback only for builds without Storage Core API.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  function getNav() {
    return document.querySelector('[data-preview4-grid-nav="true"]');
  }

  function getButtons() {
    const nav = getNav();
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('button[data-open-section]'));
  }

  function applyOrder() {
    const nav = getNav();
    const order = readOrder();
    if (!nav || !order.length) return;

    const buttons = getButtons();
    const bySection = new Map(
      buttons.map((button) => [button.getAttribute('data-open-section'), button])
    );

    order.forEach((section) => {
      const button = bySection.get(section);
      if (button) nav.appendChild(button);
    });
  }

  function getAfterButton(container, x) {
    const buttons = Array.from(container.querySelectorAll('button[data-open-section]:not(.is-nav-dragging)'));

    return buttons.reduce((closest, button) => {
      const box = button.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: button };
      }

      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function enableDrag() {
    const nav = getNav();
    if (!nav) return;

    getButtons().forEach((button) => {
      if (button.dataset.navDragReady === 'true') return;

      button.dataset.navDragReady = 'true';
      button.setAttribute('draggable', 'true');
      button.title = button.title || 'Drag to reorder menu';

      button.addEventListener('dragstart', () => {
        button.classList.add('is-nav-dragging');
      });

      button.addEventListener('dragend', () => {
        button.classList.remove('is-nav-dragging');
        saveOrder();
      });
    });

    if (nav.dataset.navDropReady === 'true') return;
    nav.dataset.navDropReady = 'true';

    nav.addEventListener('dragover', (event) => {
      event.preventDefault();

      const dragging = nav.querySelector('.is-nav-dragging');
      if (!dragging) return;

      const after = getAfterButton(nav, event.clientX);

      if (!after) {
        nav.appendChild(dragging);
      } else {
        nav.insertBefore(dragging, after);
      }
    });
  }

  function boot() {
    applyOrder();
    enableDrag();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 250);
  setTimeout(boot, 900);
})();
