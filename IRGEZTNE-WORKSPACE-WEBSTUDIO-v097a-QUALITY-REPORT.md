# IRGEZTNE Workspace Web Studio v097a — quality report

**Дата:** 2026-08-02<br>
**Исходная документальная точка:** `df930b4 Add Workspace project context checkpoint`<br>
**Область:** общий первый кадр шести официальных шаблонов<br>
**Результат:** автоматический correction pass пройден; требуется визуальная приёмка в живом Electron-приложении

## Подтверждённый исходный дефект

`v096c` правильно восстанавливал тему в раннем `<script>`, но не закрывал весь визуальный маршрут первого кадра:

- Editor Preview создавал iframe с `src="about:blank"`;
- общий iframe имел фон `#fff`;
- большое Preview шаблона также имело фон `#fff`;
- сгенерированный документ не назначал критический фон корневому элементу до появления полного stylesheet;
- Landing записывал начально восстановленную тему как новый пользовательский выбор.

Поэтому строковый тест `v096c` мог пройти, хотя пользователь всё ещё видел белый кадр.

## Реализованный correction pass

### Сгенерированный документ

- `generatedThemeBootV097A(lightBackground, darkBackground)` синхронно определяет тему.
- До первого CSS-кадра выставляются `data-theme`, `colorScheme` и `documentElement.style.backgroundColor`.
- Landing использует собственную пару `#f4efe8 / #0b1013`.
- Остальные official renderers используют пользовательский HEX-фон светлой темы и `#07111f` для тёмной.
- Runtime theme toggle синхронизирует корневой фон при ручном переключении.
- Начальная загрузка Landing вызывает `applyTheme(initialTheme, false)`; запись в storage выполняет только ручной toggle.

### Оболочки Preview

- Активный Editor Preview больше не содержит буквальный `src="about:blank"`.
- Пустой iframe скрыт атрибутом `data-v5-preview-loading="1"` и открывается после `load` выбранной страницы.
- Большое Preview шаблона использует такой же loading contract.
- Жёсткие белые фоны активных iframe заменены на прозрачные; во время сборки виден фон browser shell, а не браузерный белый canvas.
- Fallback `data:` / `srcdoc` проходит тот же reveal-on-load маршрут.

## Проверенный общий контракт

Новый тест проверяет:

- все шесть official template IDs;
- 21 сгенерированную HTML-страницу;
- тёмный и светлый критический фон каждой страницы;
- приоритет `?theme=` при межстраничной навигации;
- передачу темы во внутренние HTML-ссылки;
- единый core package для галереи/Premium, Editor Preview, browser/public payload и ZIP;
- отсутствие активного белого `about:blank`;
- скрытие пустого Editor/Premium iframe до `load`;
- отделение начальной загрузки Landing от ручного сохранения темы.

## Выполненные проверки

```text
PASS: normalized public/fallback contract verified for 6 official templates
PASS: Landing and Documentation V096A canonical wide pass verified
PASS: Documentation V096B dark interaction correction verified
PASS: Landing and Documentation V096C pre-paint theme verified
PASS: all six Web Studio templates share the V097A first-frame contract (21 HTML pages)
```

Дополнительно пройден `node --check` product JS.

## Границы прохода

Не изменялись:

- структура и композиция шести шаблонов;
- содержание Documentation, жёсткий TOC и версия `0.1.0`;
- изображения и slot markers;
- `main.js`, `preload.js` и IPC;
- Editor Workbench;
- Storage Core и пользовательские данные;
- RU/EN-модель шаблонов;
- экспортный/public-page contract.

Documentation content correction остаётся отдельным следующим проходом после принятия первого кадра.

## Ограничение проверки

В диагностической среде нет установленного Electron/Chromium runtime из пользовательского `node_modules`, поэтому здесь нельзя честно объявить визуальную проблему принятой по реальному кадру. Автоматические проверки доказывают кодовый контракт; окончательное доказательство — визуальный запуск на рабочем компьютере пользователя по чек-листу установки.

## Контрольные суммы

Исходные product-файлы:

```text
1f41244724aa12126a557a7195ae48594e64df61bf6ae14bdc76ae97ed222426  editor-site-studio-safe-v5.js
9eacbc830c2c0eec79b7290e8d448413e9e84125e2b7bd1114a4c6567a4c55d6  editor-site-studio-safe-v5.css
```

Product-файлы v097a:

```text
e1bb596bd1f1b569fb32232ba0554070216eefa8ff1131afe0fc04eaa4d2cb82  editor-site-studio-safe-v5.js
aec6aae94651ca7dfd19e1862533a34a16b7fb5804612ac35858ba3df8293913  editor-site-studio-safe-v5.css
```

