'use strict';
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const file = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const src = fs.readFileSync(file, 'utf8');
function ok(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }
ok(src.includes("selected === 'ftp' || selected === 'ftps' || selected === 'sftp'"), 'FTP/FTPS/SFTP provider-specific password status missing');
ok(src.includes("t('Password: saved', 'Пароль: сохранён')"), 'saved password status missing');
ok(src.includes("t('Password: not saved', 'Пароль: не сохранён')"), 'unsaved password status missing');
ok(src.includes("t('Clear password', 'Очистить пароль')"), 'FTP/FTPS/SFTP clear-password action missing');
ok(src.includes("required: ['host', 'username', 'password']"), 'remote password requirement missing');
console.log('PASS: FTP + FTPS + SFTP password status labels R1S verified');
