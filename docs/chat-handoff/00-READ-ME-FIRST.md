# IRGEZTNE Workspace — Read Me First

> **Historical handoff:** this directory is retained as dated implementation
> evidence. It is not canonical release documentation and its `NEXT-SESSION`
> instructions must not restart or override completed work. Use
> [`../release/00-READ-ME-FIRST.md`](../release/00-READ-ME-FIRST.md) for the
> current documentation index.

**Актуальность:** 2026-08-06T12:40:21+04:00  
**Активный проект:** `/home/acer/Загрузки/irgeztne-workspace-main`  
**Назначение:** передача полного рабочего контекста в новый чат без загрузки всей папки Workspace.

## Что читать

Читать в таком порядке:

1. `PROJECT-CONTEXT.md`
2. `CURRENT-STATE.md`
3. `NEXT-SESSION.md`
4. `FILE-OWNERS.md`
5. `CHECKPOINTS.md`
6. `WORKFLOW-RULES.md`
7. `WIDGETS-AND-TOOL-STUDIO.md`

Каталог `evidence/` содержит небольшие копии ключевых файлов и диагностических отчётов.

## Самая важная граница

Сейчас нельзя сразу писать новый патч.

Первая следующая задача — **read-only поиск последней полноценной версии старого CodeHub до его замены заглушкой**.

Видимое название возвращённого модуля:

- RU: `Мастерская`
- EN: `Workshop`

Технический route и внутреннее имя сохраняются:

- `codehub`

## Что не смешивать

Восстановление CodeHub нельзя объединять с исправлением навигации.

Навигация сейчас исправлена только частично:

- верхнее внутреннее меню показывает правильный порядок и `Задачи`;
- левое боковое меню сохраняет старый порядок и `Аналитика`;
- карточки главной сохраняют старый порядок и `Аналитика`.

Это разные runtime-поверхности с разными владельцами.

## Лёгкая передача в новый чат

Загружать весь проект размером около 800 МБ не требуется.

Для нового чата используется файл:

`IRGEZTNE-WORKSPACE-CHAT-HANDOFF-CURRENT.zip`

<!-- WORKSHOP-RESTORE-V031L-ACCEPTED:START -->
## Важное обновление

`Workshop Restore v031l` принят.

Старый полноценный CodeHub уже восстановлен.

Не повторять поиск и не устанавливать старые версии
CodeHub из audit ZIP.

Актуальный видимый модуль:

`Мастерская / Workshop`

Технический route:

`codehub`

Подробности:

`WORKSHOP-RESTORE-ACCEPTANCE.md`
<!-- WORKSHOP-RESTORE-V031L-ACCEPTED:END -->

<!-- NAVIGATION-V031M-ACCEPTED:START -->
## Важное обновление

`Start Page Navigation v031m` принят.

Не искать повторно владельца левого меню и карточек
главной.

Подтверждённый владелец:

`src/browser/tabs.js`

Подробности:

`NAVIGATION-V031M-ACCEPTANCE.md`
<!-- NAVIGATION-V031M-ACCEPTED:END -->

<!-- WORKSPACE-V1-PRODUCT-DOCS:START -->

## Новые продуктовые документы

В handoff включён каталог:

`workspace-v1/`

Он содержит решения обсуждения 6 августа 2026 года.

Реализация не начиналась.

Следующая сессия начинается с чтения и принятия этих
документов.

    <!-- WORKSPACE-V1-PRODUCT-DOCS:END -->
