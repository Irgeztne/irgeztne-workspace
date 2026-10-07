# IRGEZTNE — Tool Studio, Workshop and Widgets

## Tool Visual Testbench

Пользователь создал автономный локальный HTML-стенд:

`IRGEZTNE-TOOL-VISUAL-TESTBENCH-v2.html`

Это не основной Tool Studio, а acceptance/demo harness для проверки встраивания Tool Packages.

Полный проект Tool Studio хранится отдельно в ZIP.

## Восемь существующих инструментов

1. Живая карточка Atlas
2. Капсула релиза
3. API Data Lens
4. Generic Data Table
5. Metric and Chart
6. Record Form
7. Media Gallery
8. Universal Data Mapper

Стенд умеет:

- добавлять пакеты;
- размещать их в 1–3 колонки;
- менять порядок;
- дублировать экземпляры;
- удалять экземпляры;
- сохранять состояние страницы локально;
- проверять несколько одинаковых пакетов одновременно.

Перед созданием новых пакетов нужно проверить независимость состояния нескольких экземпляров одного инструмента.

## Роль @Sites

Новые вставляемые приложения планируется собирать через @Sites.

@Sites:

- сборка;
- визуальная разработка;
- демонстрация;
- подготовка встраиваемого пакета.

## Роль Мастерской

Мастерская Workspace является постоянным домом пакетов:

- manifest;
- версии;
- описание;
- категории;
- совместимость;
- обновления;
- установка;
- удаление;
- история изменений.

Atlas и Workspace подключают экземпляры пакетов через adapters, но сами пакеты остаются в Мастерской.

## Планируемые пакеты

### Weather Widget

- Weather Core;
- Weather UI;
- provider adapters;
- Workspace adapter;
- Atlas adapter;
- RU/EN;
- light/dark;
- без скрытого запроса геолокации.

### Compass Widget

- азимут;
- стороны света;
- направление на выбранный объект;
- север карты;
- маршрут;
- sensor adapter;
- ручной fallback без датчиков;
- Atlas adapter;
- возможный Workspace adapter.

### Market & Indicators

- валюты;
- индексы;
- компании;
- сырьевые товары;
- статистические показатели;
- source/period/method/version/status;
- Atlas Statistics / Analytics / Pulse как источники;
- внешний live provider только через adapter.

Виджет не должен создавать отдельную базу данных.

## Возможное переиспользование существующих инструментов

Market & Indicators может собираться из:

`API Data Lens → Universal Data Mapper → Metric and Chart + Generic Data Table`

`Record Form` может использоваться для настроек.

## Общий пакетный контракт

Каждый будущий пакет должен иметь:

- стабильный package id;
- `manifest.json`;
- version;
- permissions;
- data contract;
- host adapters;
- RU/EN;
- light/dark;
- compact/full;
- changelog;
- совместимость с Atlas и/или Workspace.
