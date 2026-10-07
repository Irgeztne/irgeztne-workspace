# IRGEZTNE Workspace — Web Studio v096a

## Эталонные Landing и Documentation

Это точечный correction pass двух существующих официальных шаблонов Web
Studio: `project-landing` и `documentation-wide`. Патч не создаёт второй
рендерер, не заменяет шаблоны автономными копиями, не изменяет Atlas и не
перестраивает остальные четыре официальных шаблона.

Устанавливать после принятой цепочки Web Studio до `v095a` включительно.

Пакет не содержит базу пользователя, профиль, созданные сайты, загруженные
медиа, секреты публикации или настройки Workspace. Git-коммит автоматически
не создаётся.

## Что исправлено

### Landing / Product

- Сохранён канонический широкий каркас почти на всю ширину окна.
- RU/EN по-прежнему наследуется от языка Web Studio; переключатель языка в
  готовый сайт не добавлен.
- Стартовый контент сразу выводится на выбранном языке, ещё до выполнения
  JavaScript.
- Английские служебные подписи в русской версии локализованы.
- Светлая и тёмная темы сохранены.

### Documentation

- Сохранён характер существующего шаблона, но рабочая сетка расширена до
  `1920px` с небольшими адаптивными полями.
- Верхнее меню разделов удалено: страницы документации больше не дублируются
  одновременно в шапке и слева.
- В шапке добавлен настоящий локальный поиск по опубликованным страницам,
  заголовкам, описаниям и тексту. Удалён прежний неподвижный макет поиска в
  боковой панели.
- Поиск работает без внешнего сервиса и поддерживает клавиатуру:
  `Arrow Up`, `Arrow Down`, `Enter`, `Escape`.
- Исправлен владелец прокрутки, поэтому sticky-шапка и боковая навигация не
  запираются общим `overflow` страницы.
- Боковая навигация уважает настройку показа страницы в меню и отображает
  вложенные страницы с иерархией.
- Опубликованная страница, скрытая из меню или показанная только в подвале,
  остаётся доступной по своему маршруту и находится через поиск.
- Светлая и тёмная темы сохранены.

## Устанавливаемые файлы

```text
src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js
scripts/test-webstudio-public-page-contract.js
scripts/test-webstudio-landing-documentation-v096a.js
IRGEZTNE-WORKSPACE-WEBSTUDIO-v096a-PATCH-INSTRUCTIONS.md
IRGEZTNE-WORKSPACE-WEBSTUDIO-v096a-QUALITY-REPORT.md
```

## Установка

Сначала остановить Workspace.

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

cp -a \
  ~/Загрузки/irgeztne-workspace-main \
  ~/Загрузки/irgeztne-workspace-main-backup-before-v096a-$(date +%Y%m%d-%H%M%S)

unzip -o \
  ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v096a-landing-documentation-canon.zip \
  -d ~/Загрузки/irgeztne-workspace-main
```

Запустить оба теста:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1
node scripts/test-webstudio-landing-documentation-v096a.js
node scripts/test-webstudio-public-page-contract.js
```

Ожидаемый результат:

```text
PASS: Landing and Documentation V096A canonical wide pass verified
PASS: normalized public/fallback contract verified for 6 official templates
```

Затем запустить Workspace:

```bash
npm start
```

## Визуальное принятие

1. В RU и EN создать новые сайты из `Landing / Product` и `Documentation`.
2. Для каждого сравнить `Templates Preview`, сайт в редакторе, `Editor
   Preview`, `Open in browser` и экспортированный ZIP.
3. У Landing проверить широкую композицию, обе темы и отсутствие английских
   служебных подписей в RU.
4. У Documentation проверить широкую трёхколоночную сетку, прокрутку со
   sticky-шапкой, отсутствие верхнего дубля меню и обе темы.
5. В поиске Documentation найти страницу по заголовку и слову из её текста;
   проверить навигацию стрелками и `Enter`.
6. Создать опубликованную страницу без показа в меню: она не должна появиться
   слева, но должна открываться по маршруту и находиться поиском.
7. Создать дочернюю страницу с показом в меню и проверить её отступ в боковой
   иерархии.

Git-коммит делать только после визуального принятия в живом Workspace.
