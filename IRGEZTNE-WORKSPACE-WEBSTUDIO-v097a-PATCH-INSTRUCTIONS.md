# IRGEZTNE Workspace Web Studio v097a — установка correction pass

**Дата:** 2026-08-02<br>
**Проект:** IRGEZTNE Workspace<br>
**Область:** общий первый кадр Preview / Premium / браузера / ZIP<br>
**Статус:** кандидат на визуальную приёмку, не принятый релизный результат

## Что меняется

Correction pass не перестраивает шаблоны и не изменяет их содержание. Он исправляет общий production-механизм, которым пользуются все шесть официальных шаблонов:

- критический фон документа назначается синхронно вместе с темой до загрузки полного CSS;
- светлый и тёмный фон принадлежат конкретному renderer family;
- пустой iframe больше не показывает белый `about:blank`;
- Editor Preview и большое Preview шаблона открываются только после события загрузки документа;
- начальное восстановление темы Landing больше не перезаписывает сохранённое значение;
- ручной переключатель темы продолжает сохранять выбор и передавать его между HTML-страницами.

## Файлы correction pass

- `src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js`
- `src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css`
- `scripts/test-webstudio-first-frame-v097a.js`

Этим пакетом не изменяются `main.js`, `preload.js`, Editor Workbench, Storage Core, `data`, Template Lab, изображения и проектные MD от 2 августа.

## 1. Проверка исходной точки

До установки в действующей папке должны совпасть контрольные суммы двух product-файлов:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

sha256sum \
  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js \
  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css
```

Ожидается:

```text
1f41244724aa12126a557a7195ae48594e64df61bf6ae14bdc76ae97ed222426  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js
9eacbc830c2c0eec79b7290e8d448413e9e84125e2b7bd1114a4c6567a4c55d6  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css
```

Если хотя бы одна сумма отличается, пакет не устанавливать: сначала показать результат в чате.

## 2. Локальная резервная копия двух файлов

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

backup_dir="$HOME/Загрузки/_CHECKPOINTS/workspace/v097a-preinstall-$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  "$backup_dir/src/modules/editor-site-studio-safe"

cp \
  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js \
  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css \
  "$backup_dir/src/modules/editor-site-studio-safe/"

printf '%s\n' "$backup_dir"
```

Полный development snapshot от 2 августа уже остаётся отдельной контрольной поставкой; эта копия нужна только для быстрого отката двух файлов.

## 3. Установка ZIP

ZIP должен быть фактически скачан в `~/Загрузки`.

```bash
cd ~/Загрузки || exit 1

unzip -o \
  IRGEZTNE-WORKSPACE-WEBSTUDIO-v097a-FIRST-FRAME-CORRECTION.zip \
  -d ~/Загрузки
```

Пакет содержит корень `irgeztne-workspace-main`, поэтому устанавливается прямо в действующую папку, а не создаёт второй проект.

## 4. Автоматические проверки

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

node --check \
  src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js &&
node scripts/test-webstudio-public-page-contract.js &&
node scripts/test-webstudio-landing-documentation-v096a.js &&
node scripts/test-webstudio-documentation-dark-interaction-v096b.js &&
node scripts/test-webstudio-theme-prepaint-v096c.js &&
node scripts/test-webstudio-first-frame-v097a.js &&
git diff --check

git status --short
```

Последний тест должен сообщить:

```text
PASS: all six Web Studio templates share the V097A first-frame contract (21 HTML pages)
```

## 5. Обязательная визуальная приёмка

Запустить Workspace обычным способом:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1
npm start
```

Проверить в тёмной теме:

1. Галерея шаблонов → большое Preview каждого из шести шаблонов.
2. Web Studio → Preview существующего Landing-сайта и Documentation-сайта.
3. Переходы между всеми доступными страницами внутри Preview.
4. Закрытие и повторное открытие большого Preview.
5. Кнопка «Открыть сайт» и переходы в отдельном браузерном окне.
6. Переключение `dark → light → dark`, затем переход на следующую страницу.
7. Экспорт ZIP одного сайта, открытие его `index.html` и переход на соседнюю страницу.

Критерий принятия: нигде не появляется белый пустой кадр до оформления страницы; тема не сбрасывается при переходе.

## 6. Git после приёмки

До визуальной приёмки ничего не коммитить. После подтверждения отдельно проверить staged/unstaged состав и только затем формировать correction commit. Существующие изменения `v092c–v096c` остаются частью текущего незавершённого Web Studio-прохода.

