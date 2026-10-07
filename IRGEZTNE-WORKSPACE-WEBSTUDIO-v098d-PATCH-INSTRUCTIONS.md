# Web Studio theme runtime correction v098d

Исправляет ошибку упаковки v098c и исходный дефект темы.

Причина исходного дефекта: `site.js` встраивался в `<head>` без `defer` и
выполнялся до появления кнопки темы. Теперь runtime переносится непосредственно
перед `</body>`.

Границы:
- только общий генератор Business, Blog, Portfolio и Agency;
- без замены HTML/CSS/изображений шаблонов;
- без изменений Landing, Documentation, main.js, preload.js и Editor Workbench;
- без перезаписи пользовательских данных.
