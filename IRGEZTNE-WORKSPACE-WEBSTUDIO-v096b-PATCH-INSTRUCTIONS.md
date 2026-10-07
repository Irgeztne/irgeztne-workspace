# IRGEZTNE Workspace — Web Studio v096b

## Documentation: тёмные состояния и поиск

Это точечный correction pass поверх установленного `v096a`. Он изменяет только
активный рендерер официального шаблона `documentation-wide`.

Landing, широкая сетка Documentation, маршруты, меню, RU/EN, пользовательские
сайты, медиа, Atlas и остальные пять официальных шаблонов не перестраиваются.

## Что исправлено

- В тёмной теме добавлен локальный читаемый акцент Documentation. Он сохраняет
  пользовательский цвет сайта, но осветляет его только там, где иначе теряются
  мелкие надписи и интерактивные состояния.
- Активный пункт и hover в левой навигации больше не становятся почти чёрными.
- Надписи `Обзор`, `Быстрый старт`, `API / Справочник`, `Частые вопросы` и
  аналогичные служебные метки остаются читаемыми в обеих темах.
- Hover/focus поиска, результаты поиска, ссылки правого оглавления и нижняя
  навигация используют тот же читаемый акцент.
- Тонкий Unicode-символ `⌕` заменён нормальной SVG-лупой `20×20`. В коде поиска
  нет пульсирующей анимации; замена убирает нестабильное мерцание тонкого глифа.

## Установка

Сначала остановить Workspace, затем выполнить:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

cp -a \
  ~/Загрузки/irgeztne-workspace-main \
  ~/Загрузки/irgeztne-workspace-main-backup-before-v096b-$(date +%Y%m%d-%H%M%S)

unzip -o \
  ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v096b-documentation-dark-interaction.zip \
  -d ~/Загрузки/irgeztne-workspace-main

node scripts/test-webstudio-documentation-dark-interaction-v096b.js
node scripts/test-webstudio-public-page-contract.js

npm start
```

Ожидаемый результат тестов:

```text
PASS: Documentation V096B dark interaction correction verified
PASS: normalized public/fallback contract verified for 6 official templates
```

После запуска достаточно открыть существующий тестовый сайт Documentation,
включить тёмную тему и проверить активный пункт слева, маленькие метки разделов,
лупу, hover/focus поиска и результаты поиска.

Git-коммит делать только после визуального принятия в живом Workspace.
