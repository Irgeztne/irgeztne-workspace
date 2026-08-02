# IRGEZTNE Workspace — следующая сессия

**Дата фиксации:** 2026-08-02<br>
**Активная папка:** `~/Загрузки/irgeztne-workspace-main`<br>
**Текущий фокус:** Web Studio → шесть официальных шаблонов<br>
**Главный блокер:** белая вспышка при первом кадре, переходах страниц и части theme-flow
**Не принимать как решение:** `v096c`

---

## 1. С чего начинать

Следующую сессию начинать не с нового патча и не с переделки шаблонов.

Сначала в живой папке выполнить:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1
git status --short
git rev-parse --short HEAD
git log -1 --oneline
```

Причина: присланный снимок был без `.git`, поэтому текущий HEAD и чистота дерева в документации не выдумываются.

Затем убедиться, что установлены:

```text
WORKSPACE-FULL-PROJECT-CONTEXT-2026-08-02.md
WORKSPACE-NEXT-SESSION-2026-08-02.md
```

Старый `WORKSPACE-FULL-PROJECT-CONTEXT-2026-07-14.md` не удалять.

---

## 2. Что уже установлено точно

- Активный проект: `~/Загрузки/irgeztne-workspace-main`.
- Workspace и Atlas — разные продукты; Atlas не трогать.
- Все шесть официальных шаблонов присутствуют.
- Они проходят через один production-owner:

```text
src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js
```

- Один package flow обслуживает Preview, browser, ZIP и publish.
- В Storage Core сейчас три локальных сайта:
  - Landing — 1;
  - Documentation — 2.
- Business, Blog, Portfolio и Agency не потеряны; из них просто не создавались локальные сайты в текущем Storage Core.

---

## 3. Шесть шаблонов

| ID | Страницы | Packaged images | Следующее действие |
|---|---:|---:|---|
| `project-landing` | 1 | 0 | сохранить широкое направление, проверить тему |
| `business-product` | 4 | 3 | визуальная приёмка после theme pass |
| `blog-news` | 4 | 6 | визуальная приёмка после theme pass |
| `documentation-wide` | 4 | 0 | тема сейчас; content model позже |
| `studio-portfolio` | 4 | 0 | визуальная приёмка после theme pass |
| `agency-studio` | 4 | 0 | визуальная приёмка после theme pass |

Принятые контракты:

- шаблоны широкоформатные;
- новый сайт одноязычный;
- RU/EN наследуется от интерфейса Web Studio;
- runtime language switch не добавлять;
- новая страница — отдельный HTML;
- появление в header/sidebar/footer управляется явно;
- страницу не внедрять автоматически в home content.

---

## 4. Статус `v096c`

`v096c` установлен в активном коде, но результат ручной проверки отрицательный.

Статус:

> **Не принят. Дефект не закрыт.**

Автотест `test-webstudio-theme-prepaint-v096c.js` проходит, но не видит реальный первый кадр.

Не собирать `v096d` только на основании строкового теста.

---

## 5. Подтверждённая причина вспышки

В active production code одновременно существуют:

- `<html data-theme="light">`;
- `<body data-theme="light">`;
- prepaint script, который позже меняет тему;
- обычный Preview iframe с `src="about:blank"`;
- белый фон Preview iframe;
- белый фон `about:blank`;
- белый фон Premium/template iframe;
- отдельная загрузка HTML и CSS materialized package.

Это общий дефект первого кадра, а не отдельная ошибка Documentation.

---

## 6. Единственная разрешённая задача следующего code pass

Сделать один общий correction pass темы без изменения дизайна и содержания.

Границы:

1. убрать принудительный светлый первый кадр generated document;
2. применить критический фон и `color-scheme` до внешнего CSS;
3. убрать белый `about:blank` у обычного Preview;
4. убрать белый фон Premium iframe;
5. отделить initial theme boot от ручного переключения;
6. не менять ширину, сетку, поиск, навигацию и тексты;
7. не менять Documentation demo content;
8. не трогать Atlas, Office, Chat, Account и Analytics.

Сначала рентген точных строк и затрагиваемых файлов. Затем минимальный patch.

---

## 7. Обязательная матрица проверки

Проверить каждый из шести шаблонов:

- карточка шаблона;
- Premium / большое Preview;
- обычный Preview созданного сайта;
- `Открыть сайт в браузере`;
- экспортированный и распакованный ZIP.

В каждом сценарии:

- первый кадр в тёмной теме;
- ручное переключение light/dark;
- переход со страницы на страницу;
- возврат на главную;
- RU output;
- EN output;
- отсутствие runtime RU/EN switch.

Для многостраничной проверки использовать по крайней мере Documentation и по одному сайту из Business/Blog/Portfolio/Agency.

---

## 8. Автотесты после минимального изменения

Запустить:

```bash
node scripts/test-webstudio-public-page-contract.js
node scripts/test-webstudio-landing-documentation-v096a.js
node scripts/test-webstudio-documentation-dark-interaction-v096b.js
node scripts/test-webstudio-theme-prepaint-v096c.js
```

Добавить новый тест, который проверяет владельцев первого кадра:

- отсутствие принудительного `data-theme="light"` в initial document;
- наличие критического background до внешнего CSS;
- отсутствие белого `about:blank` у обоих активных iframe;
- синхронизацию theme для page navigation.

Но даже новый тест не заменяет ручную визуальную проверку.

---

## 9. Когда собирать ZIP и коммит

Только после ручной приёмки:

```bash
git diff --check
git status --short
```

Затем отдельный commit только для theme/first-frame correction.

Не смешивать в этот коммит:

- Documentation content model;
- визуальную переделку Business/Blog/Portfolio/Agency;
- topbar/RU/EN Web Studio;
- Site Settings;
- Editor Workbench;
- Office/Chat/Account/Analytics.

---

## 10. Что делать после принятого theme pass

1. Визуально принять Business.
2. Визуально принять Blog.
3. Визуально принять Portfolio.
4. Визуально принять Agency.
5. Отдельно исправить Documentation:
   - автоматическое оглавление;
   - необязательная версия;
   - честный demo/API слой;
   - управление из редактора.
6. Вернуться к общей очереди Web Studio:
   - topbar и RU/EN owners;
   - один маршрут `Настройки сайта`;
   - logo/favicon;
   - Editor Workbench.
7. После Web Studio:
   - вернуть компактный Office;
   - подключить существующий Chat;
   - довести Account;
   - подключить Web Analytics;
   - провести релизный прогон 1.0.0.

---

## 11. Запреты следующей сессии

Не делать:

- новый седьмой шаблон;
- второй template renderer;
- второй каталог Templates;
- runtime RU/EN switch;
- перенос Template Lab;
- удаление старых template layers;
- очистку пользовательских media;
- очистку `data/previews/` в том же проходе;
- изменение Documentation content вместе с темой;
- новый Office или Chat;
- интеграцию с Atlas;
- новый ZIP до реальной визуальной проверки.

---

## 12. Короткая команда на продолжение

```text
Открыть активную папку → зафиксировать HEAD → сделать backup →
найти все владельцы первого кадра → один минимальный theme pass →
проверить реальные переходы на шести шаблонах → принять → commit → ZIP.
```
