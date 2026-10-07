# Tasks v1 — Design Baseline

## 1. Роль

Tasks является диспетчером рабочего процесса Workspace.

Это не изолированный список галочек.

## 2. Основная цепочка

`Project → Task → Source → Action/Tool → Result`

## 3. Вопросы задачи

Каждая задача должна отвечать:

- что нужно сделать;
- к какому проекту относится работа;
- где находится исходный материал;
- какое действие требуется;
- какой результат должен появиться.

## 4. Предварительная модель

- id;
- title;
- description;
- status;
- priority;
- due_date;
- project_id;
- source_ref;
- result_refs;
- checklist;
- tags;
- created_at;
- updated_at;
- completed_at;
- archived_at.

## 5. Source ref

Возможные источники:

- Project;
- File;
- Document;
- Note;
- Site;
- Page;
- Package.

## 6. Result refs

Возможные результаты:

- Document;
- File;
- Table;
- Dataset;
- Diagram;
- Formula;
- обновлённая Page;
- отчёт проверки.

## 7. Действия задачи

- открыть источник;
- открыть проект;
- начать работу;
- открыть нужный инструмент;
- создать результат;
- привязать существующий результат;
- открыть результат;
- завершить;
- вернуть в работу;
- архивировать;
- восстановить;
- удалить.

## 8. Поверхности

### Compact Tasks

- быстрое создание;
- просроченные;
- сегодня;
- в работе;
- ближайшие;
- открыть полный модуль.

### Full Tasks

- обзор;
- все задачи;
- проекты;
- завершённые;
- архив.

## 9. Local-first

Tasks v1 работает:

- без обязательного аккаунта;
- без сети;
- без скрытой телеметрии;
- независимо от Chat.

Compact и Full используют один store.

## 10. Импорт и экспорт

Обязательно предусмотреть:

- Export Tasks JSON;
- Import Tasks JSON;
- объединение без молчаливого уничтожения данных;
- проверку конфликтов id.

## 11. Техническая совместимость

На первом этапе сохраняется route:

`analytics`

Видимый интерфейс:

`Задачи / Tasks`

Старые аналитические данные нельзя молча уничтожать или
перезаписывать.

## 12. Сквозные сценарии приёмки

### Документ

`Task → create Document → edit → save → restart
→ open same Document → export → complete Task`

### Web Studio

`Page → create Task → open Page from Task
→ change Page → Preview → complete Task`

### Изображение

`Task → source image → Image Converter
→ WebP result in Files → use in Web Studio`

### Проверка

`Task with RU/EN/Light/Dark checklist
→ save progress → attach report → complete`

## 13. Отдельные документы перед кодом

После принятия общей продуктовой карты подготовить:

- `TASKS-V1-PRODUCT-SPEC.md`;
- `TASKS-V1-DATA-CONTRACT.md`;
- `TASKS-V1-INTEGRATION-MAP.md`;
- `TASKS-V1-UX-FLOWS.md`;
- `TASKS-V1-ACCEPTANCE-MATRIX.md`.

## 14. Не входит автоматически

- командные исполнители;
- облачная синхронизация;
- комментарии;
- чат внутри задачи;
- зависимости;
- повторяющиеся задачи;
- системные уведомления;
- сложный Kanban;
- аналитика продуктивности.

Эти функции могут появиться только после принятия
базового рабочего маршрута.
