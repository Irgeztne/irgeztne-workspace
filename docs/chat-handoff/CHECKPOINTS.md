# IRGEZTNE Workspace — Checkpoints

## Медиа-карантин

`~/Загрузки/IRGEZTNE-WORKSPACE-MEDIA-QUARANTINE-20260805-172116`

Не удалён. Содержит previews и видео, вынесенные из активного проекта.

## Office Copy Isolation v031f2

`~/Загрузки/_CHECKPOINTS/workspace/20260805-193939-before-office-copy-isolation-v031f2`

## Unified Navigation v031h2

`~/Загрузки/_CHECKPOINTS/workspace/20260805-200451-before-unified-navigation-v031h2`

Проход оказался визуально неэффективным и был откачен.

## Real Navigation Owner v031i

Проход был откачен после того, как выяснилось, что runtime-поверхности имеют последующих владельцев.

## Navigation Owner v031j

Python-правка прошла STATIC PASS, но `node --check` завершился сегментацией.

Автоматический trap восстановил исходные файлы.

## Navigation v031k

Текущий checkpoint:

`~/Загрузки/_CHECKPOINTS/workspace/20260805-205828-before-navigation-v031k`

`v031k` установлен.

Результат частичный:

- верхнее внутреннее меню исправлено;
- левое меню не исправлено;
- карточки главной не исправлены.

Restore:

`bash ~/Загрузки/_CHECKPOINTS/workspace/20260805-205828-before-navigation-v031k/RESTORE.sh`

Без отдельного решения пользователя `v031k` не откатывать.

## Handoff refresh

Перед каждым обновлением `docs/chat-handoff` предыдущая версия копируется в новый checkpoint и во внутренний каталог `archive/`.

<!-- WORKSHOP-RESTORE-V031L-ACCEPTED:START -->
## Workshop Restore v031l — ACCEPTED

Контрольный снимок принятого состояния:

`/home/acer/Загрузки/_CHECKPOINTS/workspace/20260806-132657-workshop-restore-v031l-accepted`

Содержит:

- `src/v88-codehub-v1.js`
- `src/v88-codehub-v1.css`
- `src/ns-codehub-store.js`
- `ACCEPTED.md`
- `CHECKSUMS.sha256`

Полноценная Мастерская восстановлена и визуально
проверена.

Старый release-cover не является активной поверхностью.
<!-- WORKSHOP-RESTORE-V031L-ACCEPTED:END -->

<!-- NAVIGATION-V031M-ACCEPTED:START -->
## Start Page Navigation v031m — ACCEPTED

Контрольный снимок:

`/home/acer/Загрузки/_CHECKPOINTS/workspace/20260806-140217-navigation-v031m-accepted`

Содержит:

- `src/browser/tabs.js`
- `ACCEPTED.md`
- `CHECKSUMS.sha256`

Подтверждены правильный порядок стартовой навигации,
правильный порядок карточек и `Задачи / Tasks`.
<!-- NAVIGATION-V031M-ACCEPTED:END -->
