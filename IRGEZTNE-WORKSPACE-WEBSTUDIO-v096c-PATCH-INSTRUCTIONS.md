# IRGEZTNE Workspace / Web Studio v096c

## Назначение

Точечный correction pass поверх установленного `v096b`:

- убрать белую вспышку при загрузке и переключении тёмной темы;
- применить сохранённую тему до первого отображения страницы;
- сохранить тему при переходе между локальными HTML-страницами;
- не менять широкоформатную сетку, поиск, навигацию и содержание шаблонов.

## Изменяемые файлы

- `src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js`
- `scripts/test-webstudio-theme-prepaint-v096c.js`

## Установка

Закрыть Workspace, затем выполнить:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

cp -a \
  ~/Загрузки/irgeztne-workspace-main \
  ~/Загрузки/irgeztne-workspace-main-backup-before-v096c-$(date +%Y%m%d-%H%M%S)

unzip -o \
  ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v096c-theme-prepaint.zip \
  -d ~/Загрузки/irgeztne-workspace-main

node scripts/test-webstudio-theme-prepaint-v096c.js
node scripts/test-webstudio-landing-documentation-v096a.js
node scripts/test-webstudio-documentation-dark-interaction-v096b.js
node scripts/test-webstudio-public-page-contract.js

npm start
```

## Визуальная проверка

1. Открыть новый тестовый Landing и Documentation.
2. Включить тёмную тему.
3. Обновить страницу и убедиться, что белого первого кадра нет.
4. В Documentation перейти на `Начало`, `Гайды`, `Справка` и обратно.
5. Убедиться, что страницы сразу открываются в тёмной теме.
6. Несколько раз переключить светлую и тёмную темы.
7. Проверить, что ширина, поиск, hover-состояния и меню остались прежними.

## Не входит в v096c

Демо-содержание Documentation (`Быстрый старт`, пример API, FAQ), правое
оглавление и карточка версии `0.1.0` в этом проходе не изменялись. Их
пользовательская модель требует отдельного решения.
