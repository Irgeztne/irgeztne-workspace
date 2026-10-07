(function () {
  'use strict';

  const STATE_KEY = 'irgeztne.connected.identity.v1';
  const LEGACY_STATE_KEY = STATE_KEY;
  const SECRET_SCOPE = 'irgeztne-id';
  const SECRET_KEY = 'access-token';
  const ACCOUNT_URL = 'https://account.irgeztne.com/';

  let cachedDeviceContext = null;
  let cachedEnrollmentContext = null;
  let cachedEnrollmentTransport = null;
  let cachedDeviceRevocation = null;
  let cachedAccountStatus = null;
  let cachedIdentityAccountStatus = null;
  let accountStatusLoading = false;
  let identityAccountStatusLoading = false;
  let deviceContextLoading = false;
  let enrollmentContextLoading = false;
  let menuAnchor = null;
  let accountUiBusyAction = '';
  let accountUiNotice = null;
  let recoveryDraftPhrase = '';
  let recoveryPhraseVisible = false;

  function lang() {
    const raw = String(
      document.documentElement.getAttribute('lang') ||
      localStorage.getItem('irgeztne.lang') ||
      localStorage.getItem('irgLang') ||
      ''
    ).toLowerCase();

    return raw.startsWith('ru') ? 'ru' : 'en';
  }

  function t(ru, en) {
    return lang() === 'ru' ? ru : en;
  }

  function storageApi() {
    return window.nsAPI || null;
  }

  function accountBridge() {
    return window.irgeztneAccount || null;
  }

  function identityAccountBridge() {
    return window.irgeztneIdentityAccount || null;
  }

  function identityCoreBridge() {
    return window.irgeztneIdentity || null;
  }

  function identityAccountStatus() {
    return cachedIdentityAccountStatus && typeof cachedIdentityAccountStatus === 'object'
      ? cachedIdentityAccountStatus
      : null;
  }

  function identityAccountActive() {
    const status = identityAccountStatus();
    return Boolean(status && status.connected && status.account && status.account.status === 'ACTIVE');
  }

  function accountStatus() {
    return cachedAccountStatus && typeof cachedAccountStatus === 'object'
      ? cachedAccountStatus
      : null;
  }

  function readState() {
    const api = storageApi();

    if (api && typeof api.storageGetModuleStateSync === 'function') {
      const value = api.storageGetModuleStateSync(STATE_KEY, {});
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    // Compatibility fallback only for non-Electron/browser preview builds.
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || '{}') || {};
      if (legacy && typeof legacy === 'object') {
        const copy = Object.assign({}, legacy);
        delete copy.accessToken;
        return copy;
      }
    } catch (error) {}

    return {};
  }

  function writePublicState(next) {
    const api = storageApi();
    const clean = Object.assign({}, next || {});
    delete clean.accessToken;

    const state = Object.assign({}, readState(), clean, {
      updatedAt: new Date().toISOString()
    });

    if (api && typeof api.storageSetModuleStateSync === 'function') {
      api.storageSetModuleStateSync(STATE_KEY, state);
    } else {
      try {
        localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(state));
      } catch (error) {}
    }

    window.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));
    document.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));
    return state;
  }

  function hasCredential() {
    const api = storageApi();
    if (api && typeof api.storageSecretHasSync === 'function') {
      return Boolean(api.storageSecretHasSync(SECRET_SCOPE, SECRET_KEY));
    }
    return false;
  }

  async function writeState(next) {
    const patch = Object.assign({}, next || {});
    const hasTokenField = Object.prototype.hasOwnProperty.call(patch, 'accessToken');
    const token = hasTokenField ? String(patch.accessToken || '') : null;
    delete patch.accessToken;

    const state = writePublicState(patch);
    const api = storageApi();

    if (api && hasTokenField) {
      if (token && typeof api.storageSaveSecret === 'function') {
        await api.storageSaveSecret(SECRET_SCOPE, SECRET_KEY, token);
      } else if (!token && typeof api.storageClearSecret === 'function') {
        await api.storageClearSecret(SECRET_SCOPE, SECRET_KEY);
      }
    }

    updateButton();
    renderMenu();
    window.setTimeout(updateButton, 0);
    window.setTimeout(updateButton, 120);
    void refreshDeviceContext();
    return state;
  }

  function isConnected() {
    if (identityAccountActive()) return true;
    const bridge = accountBridge();
    if (bridge) return Boolean(accountStatus() && accountStatus().connected);
    const state = readState();
    return state.mode === 'connected' && Boolean(state.userId) && hasCredential();
  }

  function syncPublicIdentityFromAccountStatus() {
    const identityStatus = identityAccountStatus();
    if (identityStatus && identityStatus.connected && identityStatus.account) {
      const account = identityStatus.account;
      return writePublicState({
        mode: 'connected',
        userId: String(account.account_id || ''),
        displayName: String(account.profile && account.profile.display_name || ''),
        email: '',
        accountTransport: 'identity-capability-v1',
        accountDeviceId: identityStatus.identity ? String(identityStatus.identity.device_id || '') : ''
      });
    }
    const status = accountStatus();
    if (!status) return readState();
    const account = status.account || null;
    return writePublicState({
      mode: status.connected ? 'connected' : 'local',
      userId: status.connected && account ? String(account.account_id || '') : '',
      displayName: status.connected && account ? String(account.profile && account.profile.display_name || '') : '',
      email: status.connected && account ? String(account.email || '') : '',
      accountTransport: status.connected ? 'desktop-grant-v1' : '',
      accountDeviceId: status.connected && status.device ? String(status.device.device_id || '') : ''
    });
  }

  function identityOperationMessage(result, fallback) {
    if (result && result.ok !== false) return '';
    const code = String(result && result.code || '');
    const messages = {
      ACCOUNT_NETWORK_NOT_CONFIGURED: t(
        'Сетевое подключение онлайн-сервисов пока не настроено. Локальные Account и Identity продолжают работать.',
        'Online service connection is not configured yet. Local Account and Identity continue to work.'
      ),
      ACCOUNT_IDENTITY_NEW_ACCOUNT_DISABLED: t(
        'Создание нового Account пока выключено для этой среды.',
        'New Account creation is disabled for this environment.'
      ),
      IDENTITY_RECOVERY_NOT_PROVISIONED: t(
        'Перед подключением Account сохраните файл и фразу восстановления.',
        'Save a Recovery file and phrase before connecting Account.'
      ),
      LEGACY_ACCOUNT_LINK_REQUIRED: t(
        'Обнаружен существующий Account. Его нужно связать с новой Identity, а не создавать второй аккаунт.',
        'An existing Account was detected. It must be linked to the new Identity instead of creating a second Account.'
      ),
      SECURE_STORAGE_REQUIRED: t(
        'ОС не предоставляет доступное защищённое хранилище для Identity.',
        'The OS does not provide available protected storage for Identity.'
      ),
      UNPROTECTED_LINUX_BASIC_TEXT: t(
        'Linux использует небезопасный basic_text. Создание Identity заблокировано.',
        'Linux is using insecure basic_text storage. Identity creation is blocked.'
      ),
      IDENTITY_NOT_CREATED: t(
        'Сначала создайте локальную Identity.',
        'Create the local Identity first.'
      ),
      IDENTITY_ALREADY_EXISTS: t(
        'На этой установке Workspace уже существует Identity. Восстановление поверх неё запрещено.',
        'This Workspace installation already has an Identity. Recovery restore will not overwrite it.'
      ),
      IDENTITY_RECOVERY_PASSPHRASE_WEAK: t(
        'Фраза восстановления не прошла проверку безопасности.',
        'The Recovery phrase did not pass the security check.'
      ),
      IDENTITY_RECOVERY_DECRYPT_FAILED: t(
        'Файл восстановления не открылся: фраза не подходит или файл был изменён.',
        'The Recovery file could not be opened: the phrase is incorrect or the file was modified.'
      ),
      IDENTITY_RECOVERY_WRONG_IDENTITY: t(
        'Выбран файл восстановления от другой Identity.',
        'The selected Recovery file belongs to another Identity.'
      ),
      IDENTITY_RECOVERY_STALE_AUTHORITY: t(
        'Этот файл восстановления устарел. Используйте последний сохранённый файл.',
        'This Recovery file is outdated. Use the most recently saved file.'
      ),
      IDENTITY_RECOVERY_SUBJECT_CONTINUITY_FAILED: t(
        'Не удалось подтвердить, что файл вернёт вас к тому же Account.',
        'The Recovery file could not be verified as belonging to the same Account.'
      ),
      IDENTITY_RECOVERY_FINGERPRINT_MISMATCH: t(
        'Целостность файла восстановления не подтверждена.',
        'The Recovery file integrity check failed.'
      ),
      IDENTITY_RECOVERY_PACKAGE_INVALID: t(
        'Файл восстановления имеет неверный формат.',
        'The Recovery file has an invalid format.'
      ),
      IDENTITY_RECOVERY_FILE_UNREADABLE: t(
        'Не удалось прочитать файл восстановления.',
        'The Recovery file could not be read.'
      ),
      HANDLE_INVALID: t(
        '@handle: 3–30 символов, только латинские буквы a-z, цифры и _.',
        '@handle must be 3–30 lowercase ASCII letters, digits or _.'
      ),
      HANDLE_UNAVAILABLE: t(
        'Этот @handle уже занят или временно зарезервирован.',
        'That @handle is already in use or temporarily reserved.'
      ),
      HANDLE_CHANGE_COOLDOWN: t(
        '@handle пока нельзя менять повторно.',
        '@handle cannot be changed again yet.'
      ),
      DISPLAY_NAME_INVALID: t(
        'Имя профиля должно быть не длиннее 80 символов.',
        'Profile display name must be 80 characters or fewer.'
      ),
      ACCOUNT_NOT_FOUND: t(
        'Сетевой Account для этой Identity не найден.',
        'No network Account is linked to this Identity.'
      ),
      ACCOUNT_NETWORK_TIMEOUT: t(
        'Сервис не ответил вовремя. Проверьте подключение и повторите попытку.',
        'The service did not respond in time. Check your connection and try again.'
      ),
      ACCOUNT_NETWORK_UNREACHABLE: t(
        'Сервис Account сейчас недоступен. Локальная работа Workspace не затронута.',
        'The Account service is currently unavailable. Local Workspace work is unaffected.'
      ),
      ACCOUNT_INACTIVE: t(
        'Изменения профиля недоступны для текущего состояния Account.',
        'Profile changes are unavailable in the current Account state.'
      )
    };
    return messages[code] || String(fallback || t('Операцию не удалось выполнить.', 'The operation could not be completed.'));
  }

  function setAccountNotice(kind, message) {
    accountUiNotice = message ? { kind: kind || 'info', message: String(message) } : null;
  }

  function clearAccountNotice() {
    accountUiNotice = null;
  }

  async function refreshIdentityAccountStatus(network) {
    const bridge = identityAccountBridge();
    if (!bridge) return null;
    if (identityAccountStatusLoading) return identityAccountStatus();
    identityAccountStatusLoading = true;
    try {
      const method = network && typeof bridge.refreshAccount === 'function' ? 'refreshAccount' : 'getStatus';
      const result = await bridge[method]();
      if (result && typeof result === 'object') {
        if (result.ok !== false) cachedIdentityAccountStatus = result;
        else if (!cachedIdentityAccountStatus) cachedIdentityAccountStatus = result;
      }
    } catch (error) {
      console.warn('[IRGEZTNE Identity Account] status unavailable:', error);
    } finally {
      identityAccountStatusLoading = false;
    }
    syncPublicIdentityFromAccountStatus();
    updateButton();
    return identityAccountStatus();
  }

  async function createIdentityNetworkAccount() {
    const bridge = identityAccountBridge();
    if (!bridge || typeof bridge.createAccount !== 'function') return null;
    const result = await bridge.createAccount();
    const message = identityOperationMessage(result, t(
      'Не удалось создать IRGEZTNE Account.',
      'Could not create IRGEZTNE Account.'
    ));
    if (message) setAccountNotice(String(result && result.code || '') === 'ACCOUNT_NETWORK_NOT_CONFIGURED' ? 'warning' : 'error', message);
    if (result && result.ok !== false) {
      cachedIdentityAccountStatus = result;
      setAccountNotice('success', t('Account подключён к этой установке Workspace.', 'Account connected to this Workspace installation.'));
    }
    await refreshIdentityAccountStatus(false);
    renderAccountSurface();
    renderMenu(menuAnchor);
    return result;
  }

  async function refreshIdentityNetworkAccount() {
    const bridge = identityAccountBridge();
    if (!bridge || typeof bridge.refreshAccount !== 'function') return null;
    const result = await bridge.refreshAccount();
    const message = identityOperationMessage(result, t(
      'Не удалось обновить состояние IRGEZTNE Account.',
      'Could not refresh IRGEZTNE Account status.'
    ));
    if (message) setAccountNotice(String(result && result.code || '') === 'ACCOUNT_NETWORK_NOT_CONFIGURED' ? 'warning' : 'error', message);
    if (result && result.ok !== false) {
      cachedIdentityAccountStatus = result;
      setAccountNotice('success', t('Состояние Account обновлено.', 'Account status updated.'));
    }
    syncPublicIdentityFromAccountStatus();
    return result;
  }

  function accountProfileInputValue(name) {
    const root = accountSurfaceRoot();
    if (!root) return '';
    const node = root.querySelector('[data-account-profile-input="' + name + '"]');
    return node ? String(node.value || '') : '';
  }

  async function updateIdentityNetworkProfile() {
    const bridge = identityAccountBridge();
    if (!bridge || typeof bridge.updateProfile !== 'function') return null;
    const displayName = accountProfileInputValue('display-name').trim();
    const handle = accountProfileInputValue('handle').trim().replace(/^@+/, '').toLowerCase();
    const result = await bridge.updateProfile({
      display_name: displayName,
      handle: handle || null
    });
    const message = identityOperationMessage(result, t(
      'Не удалось обновить профиль IRGEZTNE Account.',
      'Could not update the IRGEZTNE Account profile.'
    ));
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false) {
      cachedIdentityAccountStatus = result;
      syncPublicIdentityFromAccountStatus();
      setAccountNotice('success', t('Профиль сохранён.', 'Profile saved.'));
    }
    return result;
  }

  async function disconnectIdentityNetworkAccount() {
    const bridge = identityAccountBridge();
    if (!bridge || typeof bridge.disconnectLocal !== 'function') return null;
    const confirmed = window.confirm(t(
      'Отключить Account только от этой установки Workspace? Identity и сетевой Account не удаляются.',
      'Disconnect Account from this Workspace installation only? Identity and the network Account will not be deleted.'
    ));
    if (!confirmed) return null;
    const result = await bridge.disconnectLocal();
    const message = identityOperationMessage(result, t(
      'Не удалось локально отключить Account.',
      'Could not disconnect the Account locally.'
    ));
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false) {
      cachedIdentityAccountStatus = result;
      syncPublicIdentityFromAccountStatus();
      accountSurfaceView = 'profile';
      setAccountNotice('success', t('Account отключён только от этой установки. Identity и профиль сохранены.', 'Account disconnected from this installation only. Identity and profile are preserved.'));
    }
    return result;
  }

  function recoveryInputValue(name) {
    const root = accountSurfaceRoot();
    if (!root) return '';
    const node = root.querySelector('[data-account-recovery-input="' + name + '"]');
    return node ? String(node.value || '') : '';
  }

  function clearRecoveryInputs() {
    const root = accountSurfaceRoot();
    if (!root) return;
    root.querySelectorAll('[data-account-recovery-input]').forEach((node) => {
      try { node.value = ''; } catch (error) {}
    });
  }

  function recoveryAcknowledged() {
    const root = accountSurfaceRoot();
    const node = root && root.querySelector('[data-account-recovery-ack]');
    return Boolean(node && node.checked);
  }

  async function createLocalIdentityOnly() {
    const bridge = identityCoreBridge();
    if (!bridge || typeof bridge.create !== 'function') return null;
    const result = await bridge.create();
    const message = identityOperationMessage(result, t(
      'Не удалось создать локальную IRGEZTNE Identity.',
      'Could not create the local IRGEZTNE Identity.'
    ));
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false) setAccountNotice('success', t('Защищённая Identity создана на этом устройстве.', 'Protected Identity created on this device.'));
    await refreshIdentityAccountStatus(false);
    renderAccountSurface();
    renderMenu(menuAnchor);
    return result;
  }

  async function provisionIdentityRecovery() {
    const bridge = identityCoreBridge();
    if (!bridge || typeof bridge.provisionRecovery !== 'function') return null;
    const passphrase = recoveryDraftPhrase;
    if (!passphrase) {
      setAccountNotice('error', t('Не удалось создать безопасную фразу восстановления.', 'A secure Recovery phrase could not be generated.'));
      return null;
    }
    if (!recoveryAcknowledged()) {
      setAccountNotice('warning', t('Сначала подтвердите, что фраза сохранена отдельно.', 'Confirm that the phrase has been saved separately first.'));
      return null;
    }
    const result = await bridge.provisionRecovery(passphrase);
    const message = identityOperationMessage(result, t(
      'Не удалось сохранить Recovery package.',
      'Could not save the Recovery package.'
    ));
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false && !result.canceled) {
      setAccountNotice('success', t(
        'Файл восстановления сохранён. Теперь проверьте его с сохранённой фразой.',
        'Recovery file saved. Now verify it with the saved phrase.'
      ));
      recoveryDraftPhrase = '';
      recoveryPhraseVisible = false;
    }
    await refreshIdentityAccountStatus(false);
    renderAccountSurface();
    renderMenu(menuAnchor);
    return result;
  }

  async function testIdentityRecovery() {
    const bridge = identityCoreBridge();
    if (!bridge || typeof bridge.testRecovery !== 'function') return null;
    const passphrase = recoveryInputValue('test');
    if (!passphrase) {
      setAccountNotice('warning', t('Введите сохранённую фразу восстановления.', 'Enter the saved Recovery phrase.'));
      return null;
    }
    const result = await bridge.testRecovery(passphrase);
    const message = identityOperationMessage(result, t(
      'Проверка Recovery package не прошла.',
      'Recovery package test failed.'
    ));
    clearRecoveryInputs();
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false && !result.canceled) {
      setAccountNotice('success', t(
        'Файл восстановления и фраза проверены. Восстановление готово.',
        'The Recovery file and phrase are verified. Recovery is ready.'
      ));
    }
    await refreshIdentityAccountStatus(false);
    renderAccountSurface();
    renderMenu(menuAnchor);
    return result;
  }

  async function restoreIdentityRecovery() {
    const bridge = identityCoreBridge();
    if (!bridge || typeof bridge.restoreRecovery !== 'function') return null;
    const passphrase = recoveryInputValue('restore');
    if (!passphrase) {
      setAccountNotice('warning', t('Введите сохранённую фразу восстановления.', 'Enter the saved Recovery phrase.'));
      return null;
    }
    const result = await bridge.restoreRecovery(passphrase);
    const message = identityOperationMessage(result, t(
      'Не удалось восстановить IRGEZTNE Identity.',
      'Could not restore IRGEZTNE Identity.'
    ));
    clearRecoveryInputs();
    if (message) setAccountNotice('error', message);
    if (result && result.ok !== false && !result.canceled) {
      setAccountNotice('success', t(
        'Identity восстановлена. Вы вернулись к тому же Account; защита этого устройства обновлена.',
        'Identity restored. You returned to the same Account with renewed protection for this device.'
      ));
    }
    await refreshIdentityAccountStatus(false);
    renderAccountSurface();
    renderMenu(menuAnchor);
    return result;
  }

  async function refreshAccountStatus() {
    await refreshIdentityAccountStatus(false);
    const bridge = accountBridge();
    if (!bridge || typeof bridge.getStatus !== 'function') return null;
    if (accountStatusLoading) return accountStatus();
    accountStatusLoading = true;
    try {
      const result = await bridge.getStatus();
      if (result && typeof result === 'object') {
        cachedAccountStatus = result;
        syncPublicIdentityFromAccountStatus();
      }
    } catch (error) {
      console.warn('[IRGEZTNE Account desktop] status unavailable:', error);
    } finally {
      accountStatusLoading = false;
    }
    updateButton();
    const menu = document.getElementById('accountMenuV044');
    if (menu && !menu.classList.contains('hidden')) renderMenu(menuAnchor);
    return accountStatus();
  }

  async function migrateLegacyState() {
    const api = storageApi();
    if (!api || typeof api.storageSetModuleStateSync !== 'function') return;

    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || 'null');
    } catch (error) {
      legacy = null;
    }

    if (!legacy || typeof legacy !== 'object') return;

    const existing = api.storageGetModuleStateSync(STATE_KEY, null);
    const publicLegacy = Object.assign({}, legacy);
    const token = String(publicLegacy.accessToken || '');
    delete publicLegacy.accessToken;

    if (!existing || typeof existing !== 'object') {
      api.storageSetModuleStateSync(STATE_KEY, Object.assign({}, publicLegacy, {
        migratedFromRendererLocalStorageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }

    try {
      if (
        token &&
        typeof api.storageSecretHasSync === 'function' &&
        !api.storageSecretHasSync(SECRET_SCOPE, SECRET_KEY) &&
        typeof api.storageSaveSecret === 'function'
      ) {
        const saved = await api.storageSaveSecret(SECRET_SCOPE, SECRET_KEY, token);
        if (!saved || saved.ok === false) return;
      }

      // Remove legacy account payload only after its public state and credential
      // are safe in Storage Core. Language/local unrelated keys are untouched.
      localStorage.removeItem(LEGACY_STATE_KEY);
    } catch (error) {
      console.warn('[IRGEZTNE Account P21] legacy migration deferred:', error);
    }
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  function openExternal(url) {
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url);
        return;
      }
    } catch (error) {}

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      location.href = url;
    }
  }

  function openAccount(mode) {
    const state = readState();
    const status = accountStatus();
    const url = (status && status.api_base) || state.accountUrl || ACCOUNT_URL;
    const sep = url.includes('?') ? '&' : '?';
    openExternal(url + sep + 'mode=' + encodeURIComponent(mode || 'signin') + '&from=workspace');
  }

  function desktopOperationMessage(result, fallback) {
    if (result && result.ok !== false) return '';
    const code = String(result && result.code || '');
    const messages = {
      DESKTOP_GRANT_INVALID: t(
        'Запрос подключения истёк. Нажмите «Подключить аккаунт» и начните подключение ещё раз.',
        'The connection request expired. Choose “Connect account” and start again.'
      ),
      DESKTOP_AUTHORIZATION_NOT_PENDING: t(
        'Активного запроса подключения больше нет. Начните подключение аккаунта ещё раз.',
        'There is no active connection request. Start Account connection again.'
      ),
      DESKTOP_SECURITY_STATE_CHANGED: t(
        'Состояние безопасности аккаунта изменилось. Начните подключение ещё раз.',
        'Account security state changed. Start the connection again.'
      ),
      DESKTOP_DEVICE_UNAVAILABLE: t(
        'Это устройство больше нельзя подключить этим запросом. Начните подключение ещё раз.',
        'This device can no longer be connected with that request. Start again.'
      )
    };
    if (messages[code]) return messages[code];
    return String(
      result && (result.message || result.code)
        ? (result.message || result.code)
        : fallback
    );
  }

  async function beginDesktopConnection() {
    const bridge = accountBridge();
    if (!bridge || typeof bridge.startConnection !== 'function') {
      openAccount('signin');
      return null;
    }

    const result = await bridge.startConnection('IRGEZTNE Workspace');
    const message = desktopOperationMessage(result, t(
      'Не удалось начать подключение Account.',
      'Could not start Account connection.'
    ));
    if (message) window.alert(message);
    await refreshAccountStatus();
    return result;
  }

  async function completeDesktopConnection() {
    const bridge = accountBridge();
    if (!bridge || typeof bridge.completeConnection !== 'function') return null;
    const result = await bridge.completeConnection();
    const message = desktopOperationMessage(result, t(
      'Не удалось завершить подключение Account.',
      'Could not complete Account connection.'
    ));
    if (message) window.alert(message);
    await refreshAccountStatus();
    return result;
  }

  let desktopAutoFinishBusy = false;

  async function tryFinishDesktopConnectionOnReturn() {
    const status = accountStatus();
    if (desktopAutoFinishBusy || !status || status.connected || !status.pending) return null;
    const bridge = accountBridge();
    if (!bridge || typeof bridge.completeConnection !== 'function') return null;

    desktopAutoFinishBusy = true;
    try {
      const result = await bridge.completeConnection();
      // Before browser approval the main-process controller returns a normal
      // pending state. After approval this same call exchanges the one-time
      // grant and stores the WORKSPACE session without another user action.
      await refreshAccountStatus();
      renderAccountSurface();
      return result;
    } catch (error) {
      return null;
    } finally {
      desktopAutoFinishBusy = false;
    }
  }

  async function openDesktopAuthorization() {
    const bridge = accountBridge();
    if (!bridge || typeof bridge.openAuthorization !== 'function') return null;
    const result = await bridge.openAuthorization();
    const message = desktopOperationMessage(result, t(
      'Не удалось открыть подтверждение Account.',
      'Could not open Account approval.'
    ));
    if (message) window.alert(message);
    return result;
  }

  async function cancelDesktopConnection() {
    const bridge = accountBridge();
    if (!bridge || typeof bridge.cancelConnection !== 'function') return null;
    const result = await bridge.cancelConnection();
    const message = desktopOperationMessage(result, t(
      'Не удалось отменить подключение Account.',
      'Could not cancel Account connection.'
    ));
    if (message) window.alert(message);
    await refreshAccountStatus();
    return result;
  }

  async function logout() {
    const bridge = accountBridge();
    if (bridge && typeof bridge.logout === 'function') {
      const result = await bridge.logout();
      const message = desktopOperationMessage(result, t(
        'Не удалось завершить выход из Account.',
        'Could not complete Account sign-out.'
      ));
      if (message) window.alert(message);
      cachedAccountStatus = result && typeof result === 'object' ? result : null;
      syncPublicIdentityFromAccountStatus();
      await refreshAccountStatus();
      return;
    }

    await writeState({
      mode: 'local',
      userId: '',
      displayName: '',
      email: '',
      accessToken: ''
    });
  }

  function button() {
    return document.getElementById('accountToggle');
  }

  function accountButtons() {
    return [button()].filter(Boolean);
  }

  function defaultMenuAnchor() {
    return button() || null;
  }

  function updateButton() {
    const connected = isConnected();
    const title = connected
      ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')
      : t('Локальный режим. Войти для чата и совместной работы', 'Local mode. Sign in for Chat and collaboration');

    accountButtons().forEach((btn) => {
      btn.classList.toggle('is-connected', connected);
      btn.setAttribute('title', title);
      btn.setAttribute('aria-label', title);
    });
  }

  function productDevices() {
    const context = cachedDeviceContext;
    if (!context) return [];
    if (Array.isArray(context.productDevices)) return context.productDevices;
    return Array.isArray(context.devices)
      ? context.devices.filter((device) => !device.labPeer)
      : [];
  }

  function enrollmentHtml() {
    const enrollment = cachedEnrollmentContext;

    if (!enrollment || enrollment.status === 'idle' || enrollment.status === 'cancelled' || enrollment.status === 'expired') {
      return '<div class="account-enroll-v022">' +
        '<button type="button" class="account-enroll-v022__start" data-account-action="device-enroll">' +
          escapeHtml(t('Добавить устройство', 'Add device')) +
        '</button>' +
        '<span class="account-enroll-v022__hint">' +
          escapeHtml(t(
            'Будет создан одноразовый код подключения. Приватные ключи между устройствами не передаются.',
            'A one-time pairing code will be created. Private keys are never transferred between devices.'
          )) +
        '</span>' +
      '</div>';
    }

    if (enrollment.status === 'completed') {
      const completed = enrollment.completed || {};
      const completedDevice = productDevices().find((item) => item.deviceId === completed.deviceId) || null;
      const completedRevoked = completedDevice && completedDevice.status === 'revoked';
      const completedRevoking = completedDevice && completedDevice.status === 'revoking';

      return '<div class="account-enroll-v022 is-complete ' + (completedRevoked ? 'is-revoked' : '') + '">' +
        '<div class="account-enroll-v022__title">' +
          escapeHtml(
            completedRevoked
              ? t('Устройство отозвано', 'Device revoked')
              : completedRevoking
                ? t('Отзыв устройства', 'Device revocation')
                : t('Устройство подключено', 'Device connected')
          ) +
        '</div>' +
        '<strong>' + escapeHtml(completed.deviceLabel || completed.deviceId || t('Второе устройство', 'Second device')) + '</strong>' +
        '<span>' + escapeHtml(
          completedRevoked
            ? t(
                'Доступ к будущим MLS-эпохам отозван. Запись устройства сохранена для истории.',
                'Access to future MLS epochs is revoked. The device record is retained for history.'
              )
            : completedRevoking
              ? t(
                  'Отзыв не завершён. Нажмите «Завершить отзыв» у устройства, чтобы безопасно продолжить.',
                  'Revocation is incomplete. Use “Finish revoke” on the device to continue safely.'
                )
              : t(
                  'MLS-подключение и joined receipt подтверждены. Устройство активно в Account ↔ Device.',
                  'MLS enrollment and joined receipt are confirmed. The device is active in Account ↔ Device.'
                )
        ) + '</span>' +
        '<button type="button" class="account-enroll-v022__start" data-account-action="device-enroll">' +
          escapeHtml(t('Добавить ещё устройство', 'Add another device')) +
        '</button>' +
      '</div>';
    }

    const code = String(enrollment.code || '');
    const inviteJson = String(enrollment.inviteJson || '');
    const minutes = Math.max(1, Math.ceil(Number(enrollment.remainingSeconds || 0) / 60));

    return '<div class="account-enroll-v022 is-pending">' +
      '<div class="account-enroll-v022__row">' +
        '<div class="account-enroll-v022__title">' + escapeHtml(t('Подключение второго устройства', 'Second device enrollment')) + '</div>' +
        '<span class="account-enroll-v022__ttl">' + escapeHtml(t(
          '≈ ' + String(minutes) + ' мин.',
          '≈ ' + String(minutes) + ' min.'
        )) + '</span>' +
      '</div>' +
      '<div class="account-enroll-v022__code">' + escapeHtml(code || '••••-••••-••••-••••') + '</div>' +
      '<div class="account-enroll-v023__transport">' +
        '<span>' + escapeHtml(t('Локальный transport', 'Local transport')) + '</span>' +
        '<strong>' + escapeHtml(
          cachedEnrollmentTransport && cachedEnrollmentTransport.active
            ? (cachedEnrollmentTransport.origin || t('активен', 'active'))
            : t('не активен', 'inactive')
        ) + '</strong>' +
      '</div>' +
      '<div class="account-enroll-v022__actions">' +
        '<button type="button" data-account-action="device-copy-code">' + escapeHtml(t('Копировать код', 'Copy code')) + '</button>' +
        '<button type="button" data-account-action="device-copy-invite">' + escapeHtml(t('Копировать приглашение', 'Copy invite')) + '</button>' +
        '<button type="button" class="is-danger-soft" data-account-action="device-enroll-cancel">' + escapeHtml(t('Отменить', 'Cancel')) + '</button>' +
      '</div>' +
      '<span class="account-enroll-v022__hint">' +
        escapeHtml(t(
          'Код одноразовый. P23 принимает enrollment только через 127.0.0.1; LAN и публичная сеть выключены. Приватные ключи не передаются.',
          'The code is one-time. P23 accepts enrollment only through 127.0.0.1; LAN and public network are disabled. Private keys are never transferred.'
        )) +
      '</span>' +
      '<textarea class="account-enroll-v022__invite" tabindex="-1" aria-hidden="true">' + escapeHtml(inviteJson) + '</textarea>' +
    '</div>';
  }

  async function copyText(value) {
    const text = String(value || '');
    if (!text) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {}

    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return Boolean(ok);
    } catch (error) {
      return false;
    }
  }

  function currentDeviceHtml() {
    const context = cachedDeviceContext;
    if (!context || !context.currentDevice) {
      return '<div class="account-device-v021 is-loading">' +
        '<span class="account-device-v021__eyebrow">' + escapeHtml(t('Устройство', 'Device')) + '</span>' +
        '<strong>' + escapeHtml(t('Проверяем защищённое устройство…', 'Checking secure device…')) + '</strong>' +
      '</div>';
    }

    const device = context.currentDevice;
    const active = device.status === 'active';
    const allDevices = Array.isArray(context.devices) ? context.devices : [];
    const labPeers = allDevices.filter((item) => item.labPeer).length;
    const realDevices = productDevices();

    const activeRealDevices = realDevices.filter((item) => item.status === 'active');
    const activeHarnessDevices = allDevices.filter((item) => item.status === 'active');

    const deviceRows = realDevices.map((item) => {
      const status = item.status === 'active'
        ? t('активно', 'active')
        : item.status === 'enrolling'
          ? t('подключение', 'enrolling')
          : item.status === 'revoking'
            ? t('отзыв…', 'revoking…')
            : item.status === 'revoked'
              ? t('отозвано', 'revoked')
              : item.status;

      const canRevoke = !item.current &&
        !item.labPeer &&
        item.ownerKind === 'account-device' &&
        (item.status === 'active' || item.status === 'revoking');

      return '<div class="account-device-v022__device ' +
        (item.current ? 'is-current ' : '') +
        (item.status === 'revoked' ? 'is-revoked ' : '') +
        (item.status === 'revoking' ? 'is-revoking ' : '') +
        '">' +
        '<div class="account-device-v024__identity"><strong>' +
          escapeHtml(item.current ? t('Это устройство Workspace', 'This Workspace device') : (item.label || t('Устройство Workspace', 'Workspace device'))) +
        '</strong><code>' + escapeHtml(item.deviceId || '') + '</code></div>' +
        '<div class="account-device-v024__actions">' +
          '<span class="account-device-v021__pill ' +
            (item.status === 'active' ? 'is-active' : '') +
            (item.status === 'revoked' ? ' is-revoked' : '') +
            (item.status === 'revoking' ? ' is-revoking' : '') +
          '">' + escapeHtml(status) + '</span>' +
          (canRevoke
            ? '<button type="button" class="account-device-v024__revoke" data-account-action="device-revoke" data-device-id="' +
                escapeHtml(item.deviceId || '') + '">' +
                escapeHtml(item.status === 'revoking' ? t('Завершить отзыв', 'Finish revoke') : t('Отозвать', 'Revoke')) +
              '</button>'
            : '') +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="account-device-v021 account-device-v022">' +
      '<div class="account-device-v021__row">' +
        '<span class="account-device-v021__eyebrow">Account ↔ Device</span>' +
        '<span class="account-device-v021__pill ' + (active ? 'is-active' : '') + '">' +
          escapeHtml(active ? t('активно', 'active') : device.status) +
        '</span>' +
      '</div>' +
      '<span class="account-device-v022__summary">' + escapeHtml(
        context.account && context.account.connected
          ? t(
              'IRGEZTNE ID · устройств: ' + String(realDevices.length) + ' · активно: ' + String(activeRealDevices.length),
              'IRGEZTNE ID · devices: ' + String(realDevices.length) + ' · active: ' + String(activeRealDevices.length)
            )
          : t(
              'Локальный Account · устройств: ' + String(realDevices.length) + ' · активно: ' + String(activeRealDevices.length),
              'Local Account · devices: ' + String(realDevices.length) + ' · active: ' + String(activeRealDevices.length)
            )
      ) + '</span>' +
      '<div class="account-device-v022__list">' + deviceRows + '</div>' +
      enrollmentHtml() +
      '<span class="account-device-v022__lab">' + escapeHtml(t(
        'MLS active: ' + String(activeHarnessDevices.length) + ' · lab peers: ' + String(labPeers),
        'MLS active: ' + String(activeHarnessDevices.length) + ' · lab peers: ' + String(labPeers)
      )) + '</span>' +
    '</div>';
  }

  async function refreshDeviceContext() {
    if (deviceContextLoading || enrollmentContextLoading) return cachedDeviceContext;
    const bridge = window.irgeztneMessenger;
    if (!bridge) return cachedDeviceContext;

    deviceContextLoading = true;
    enrollmentContextLoading = true;

    try {
      const [deviceResult, enrollmentResult, transportResult, revocationResult] = await Promise.all([
        typeof bridge.getDeviceContext === 'function'
          ? bridge.getDeviceContext()
          : Promise.resolve(null),
        typeof bridge.getDeviceEnrollmentStatus === 'function'
          ? bridge.getDeviceEnrollmentStatus()
          : Promise.resolve(null),
        typeof bridge.getDeviceEnrollmentTransportStatus === 'function'
          ? bridge.getDeviceEnrollmentTransportStatus()
          : Promise.resolve(null),
        typeof bridge.getDeviceRevocationStatus === 'function'
          ? bridge.getDeviceRevocationStatus()
          : Promise.resolve(null)
      ]);

      if (deviceResult && deviceResult.ok && deviceResult.context) {
        cachedDeviceContext = deviceResult.context;
      }
      if (enrollmentResult && enrollmentResult.ok && enrollmentResult.enrollment) {
        cachedEnrollmentContext = enrollmentResult.enrollment;
      }
      if (enrollmentResult && enrollmentResult.ok && enrollmentResult.transport) {
        cachedEnrollmentTransport = enrollmentResult.transport;
      }
      if (transportResult && transportResult.ok && transportResult.transport) {
        cachedEnrollmentTransport = transportResult.transport;
      }
      if (revocationResult && revocationResult.ok && revocationResult.status) {
        cachedDeviceRevocation = revocationResult.status;
      }

      const menu = document.getElementById('accountMenuV044');
      if (menu && !menu.classList.contains('hidden')) {
        menu.innerHTML = menuHtml();
        positionMenu(menuAnchor);
      }
    } catch (error) {
      console.warn('[IRGEZTNE Account P22] Account↔Device context unavailable:', error);
    } finally {
      deviceContextLoading = false;
      enrollmentContextLoading = false;
    }

    return cachedDeviceContext;
  }

  async function beginDeviceEnrollment() {
    const bridge = window.irgeztneMessenger;
    if (!bridge || typeof bridge.beginDeviceEnrollment !== 'function') return;

    const result = await bridge.beginDeviceEnrollment();
    if (result && result.ok && result.enrollment) {
      cachedEnrollmentContext = result.enrollment;
    }
    if (result && result.ok && result.transport) {
      cachedEnrollmentTransport = result.transport;
    }
    await refreshDeviceContext();
  }

  async function cancelDeviceEnrollment() {
    const bridge = window.irgeztneMessenger;
    if (!bridge || typeof bridge.cancelDeviceEnrollment !== 'function') return;

    const result = await bridge.cancelDeviceEnrollment();
    if (result && result.ok && result.enrollment) {
      cachedEnrollmentContext = result.enrollment;
    }
    if (result && result.ok && result.transport) {
      cachedEnrollmentTransport = result.transport;
    }
    await refreshDeviceContext();
  }

  async function revokeAccountDevice(deviceId) {
    const bridge = window.irgeztneMessenger;
    if (!bridge || typeof bridge.revokeAccountDevice !== 'function') return;

    const context = cachedDeviceContext;
    const target = context && Array.isArray(context.productDevices)
      ? context.productDevices.find((item) => item.deviceId === deviceId)
      : null;

    const label = target && target.label
      ? target.label
      : deviceId;

    const alreadyRevoking = target && target.status === 'revoking';
    const confirmed = window.confirm(
      alreadyRevoking
        ? t(
            'Завершить безопасный отзыв устройства «' + label + '»?',
            'Finish secure revocation of “' + label + '”?'
          )
        : t(
            'Отозвать устройство «' + label + '»? Оно перестанет получать доступ к будущим MLS-эпохам.',
            'Revoke “' + label + '”? It will lose access to future MLS epochs.'
          )
    );

    if (!confirmed) return;

    const result = await bridge.revokeAccountDevice(deviceId);

    if (!result || !result.ok) {
      const message = result && (result.message || result.error || result.code)
        ? String(result.message || result.error || result.code)
        : t('Не удалось отозвать устройство.', 'Could not revoke the device.');
      window.alert(message);
      await refreshDeviceContext();
      return;
    }

    if (result.status) cachedDeviceRevocation = result.status;
    if (result.context) cachedDeviceContext = result.context;

    await refreshDeviceContext();
  }


  let accountSurfaceView = 'profile';

  function requestAccountSurface() {
    document.dispatchEvent(new CustomEvent('irgeztne:open-account-surface'));
  }

  function accountSurfaceRoot() {
    return document.getElementById('irgeztneAccountSurface');
  }

  let accountShellHeaderObserver = null;
  let accountShellHeaderGuardPending = false;

  function accountSurfaceOwnsExpandedShell() {
    const root = accountSurfaceRoot();
    if (!root || !root.querySelector('.account-v24, .account-page-v1')) return false;

    // The Account renderer may stay mounted while another full Workspace module is
    // active. Ownership follows the shell route, not merely the mounted DOM node.
    const panel = root.closest('.cabinet-section-panel[data-cabinet-panel="account"]');
    if (!panel || panel.hidden || !panel.classList.contains('active')) return false;
    if (String(document.body?.dataset?.workspaceFullModule || '') !== 'account') return false;

    try {
      const style = window.getComputedStyle(panel);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    } catch (_) {}
    return true;
  }

  function syncAccountShellHeader() {
    if (!accountSurfaceOwnsExpandedShell()) return;
    const title = document.getElementById('cabinetExpandedTitle');
    const subtitle = document.getElementById('cabinetExpandedSubtitle');
    const wantedSubtitle = t(
      'Аккаунт подключает только сетевые функции. Локальная работа Workspace остаётся доступной без входа.',
      'Account connects online features only. Local Workspace remains available without sign-in.'
    );
    if (title) title.textContent = t('Аккаунт', 'Account');
    if (subtitle && subtitle.textContent !== wantedSubtitle) subtitle.textContent = wantedSubtitle;
  }

  function scheduleAccountShellHeaderSync() {
    if (accountShellHeaderGuardPending) return;
    accountShellHeaderGuardPending = true;
    const run = () => {
      accountShellHeaderGuardPending = false;
      syncAccountShellHeader();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 0);
    }
  }

  function installAccountShellHeaderGuard() {
    if (accountShellHeaderObserver || typeof MutationObserver !== 'function' || !document.body) return;
    accountShellHeaderObserver = new MutationObserver(() => {
      if (accountSurfaceOwnsExpandedShell()) scheduleAccountShellHeaderSync();
    });
    accountShellHeaderObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function ensureAccountCompletionStyles() {
    if (document.getElementById('irgeztneAccountCompletionV1')) return;
    const style = document.createElement('style');
    style.id = 'irgeztneAccountCompletionV1';
    style.textContent = `
      .account-v24 button, .account-page-v1 button {
        transition: border-color .14s ease, background-color .14s ease, box-shadow .14s ease, opacity .14s ease;
      }
      .account-v24 button:not(:disabled), .account-page-v1 button:not(:disabled) { cursor: pointer; }
      .account-v24 button:focus-visible, .account-page-v1 button:focus-visible,
      .account-v24 input:focus-visible, .account-v24 textarea:focus-visible,
      .account-page-v1 input:focus-visible, .account-page-v1 textarea:focus-visible {
        outline: 2px solid rgba(96, 165, 250, .95);
        outline-offset: 2px;
      }
      .account-v24 input, .account-v24 textarea,
      .account-page-v1 input, .account-page-v1 textarea {
        width: 100%; box-sizing: border-box; margin-top: 9px; padding: 13px 14px;
        border: 1px solid rgba(121, 168, 217, .48); border-radius: 11px;
        background: rgba(4, 19, 38, .92); color: #edf7ff; caret-color: #72e6ca;
        font: inherit; font-size: 16px; line-height: 1.5;
      }
      .account-v24 input::placeholder, .account-v24 textarea::placeholder,
      .account-page-v1 input::placeholder, .account-page-v1 textarea::placeholder { color: rgba(193, 215, 236, .67); }
      .account-v24__notice { margin: 0 0 16px; padding: 14px 16px; border: 1px solid rgba(96,165,250,.42); border-radius: 12px; background: rgba(23,70,122,.28); color: #e8f4ff; font-size: 14px; line-height: 1.5; }
      .account-v24__notice.is-success { border-color: rgba(72,211,163,.48); background: rgba(16,111,82,.24); color: #cffff0; }
      .account-v24__notice.is-error { border-color: rgba(248,113,113,.52); background: rgba(127,29,29,.25); color: #ffe0e0; }
      .account-v24__notice.is-warning { border-color: rgba(251,191,36,.48); background: rgba(120,75,12,.24); color: #ffedbd; }
      .account-v24__summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:16px; }
      .account-v24__summary > div { min-width:0; padding:13px; border:1px solid rgba(118,167,211,.25); border-radius:12px; background:rgba(7,25,48,.46); }
      .account-v24__summary span, .account-v24__detail-label { display:block; color:rgba(207,225,242,.86); font-size:14px; }
      .account-v24__summary strong { display:block; margin-top:5px; color:#f2f8ff; overflow-wrap:anywhere; }
      .account-v24__field { display:block; margin-top:18px; color:#e5f2ff; font-size:15px; font-weight:700; }
      .account-v24__field-hint { display:block; margin-top:7px; color:rgba(205,223,240,.84); font-size:14px; font-weight:400; line-height:1.5; }
      .account-v24__recovery-phrase { min-height:106px; resize:none; letter-spacing:.02em; }
      .account-v24__recovery-tools { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      .account-v24__check { display:flex; gap:9px; align-items:flex-start; margin-top:14px; color:#dfedfa; font-size:15px; font-weight:500; }
      .account-v24__check input { width:auto; margin:2px 0 0; accent-color:#56d7b1; }
      .account-v24__service-state { display:block; margin-top:3px; color:rgba(205,224,242,.86); font-size:14px; }
      .account-v24__technical { display:grid; gap:9px; margin-top:14px; }
      .account-v24__technical div { padding:11px 12px; border:1px solid rgba(118,167,211,.22); border-radius:10px; background:rgba(4,18,37,.5); }
      .account-v24__technical code { display:block; margin-top:5px; color:#cce8ff; white-space:normal; overflow-wrap:anywhere; }
      .account-v24 [aria-busy="true"] { opacity:.72; cursor:wait; }
      @media (max-width: 760px) { .account-v24__summary { grid-template-columns:1fr; } }
      @media (prefers-reduced-motion: reduce) { .account-v24 button, .account-page-v1 button { transition:none; } }
    `;
    document.head.appendChild(style);
  }

  function statusPill(label, kind) {
    return '<span class="account-v24__pill ' + (kind ? 'is-' + kind : '') + '">' + escapeHtml(label) + '</span>';
  }

  function accountIcon(name) {
    const paths = {
      profile: '<circle cx="12" cy="8" r="3.2"></circle><path d="M5.5 20c.8-4.2 3-6.2 6.5-6.2s5.7 2 6.5 6.2"></path>',
      identity: '<path d="M12 2.8a6.2 6.2 0 0 0-6.2 6.2v2.3"></path><path d="M18.2 9A6.2 6.2 0 0 0 12 2.8"></path><path d="M8.1 10.2v2.2a7.7 7.7 0 0 1-2 5.2"></path><path d="M12 7.2a2.8 2.8 0 0 0-2.8 2.8v2.7a10.7 10.7 0 0 1-2.7 7"></path><path d="M14.8 10.2v3.1a12.3 12.3 0 0 1-1.8 6.4"></path><path d="M17.8 11.1v2.5a15 15 0 0 1-1.2 5.5"></path>',
      security: '<path d="M12 2.8 19 5.5v5.3c0 4.6-2.7 8-7 10.4-4.3-2.4-7-5.8-7-10.4V5.5L12 2.8Z"></path><path d="m9 12 2 2 4-4"></path>',
      recovery: '<ellipse cx="12" cy="5.3" rx="7" ry="2.8"></ellipse><path d="M5 5.3v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"></path><path d="M5 11.3v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"></path>',
      services: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"></rect><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"></rect><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"></rect><rect x="14" y="14" width="6.5" height="6.5" rx="1"></rect>',
      info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 10.5v6"></path><path d="M12 7.3h.01"></path>',
      device: '<rect x="4" y="4" width="16" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path>',
      storage: '<ellipse cx="12" cy="6" rx="7" ry="3"></ellipse><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"></path><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"></path>',
      chat: '<path d="M4 5.5h16v10H9l-5 4v-14Z"></path>',
      workshop: '<path d="m5 19 6.2-6.2"></path><path d="m14.2 9.8 4.7-4.7"></path><path d="m13 4 7 7"></path><path d="M4.5 8.5 8 5l11 11-3.5 3.5L4.5 8.5Z"></path>',
      refresh: '<path d="M20 7v5h-5"></path><path d="M19 12a7.5 7.5 0 1 1-2.1-5.2L20 10"></path>',
      collapse: '<path d="m14.5 6-6 6 6 6"></path>'
    };
    return '<svg class="account-v24__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || paths.info) + '</svg>';
  }

  function navButton(view, label, icon) {
    return '<button type="button" class="account-v24__nav-button ' + (accountSurfaceView === view ? 'is-active' : '') + '" data-account-surface-view="' + view + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '"><span class="account-v24__nav-icon">' + accountIcon(icon || view) + '</span><span class="account-v24__nav-label">' + escapeHtml(label) + '</span></button>';
  }

  function accountNavigationHtml() {
    return navButton('profile', t('Профиль', 'Profile'), 'profile') +
      navButton('identity', t('Идентификация', 'Identification'), 'identity') +
      navButton('security', t('Безопасность', 'Security'), 'security') +
      navButton('recovery', t('Восстановление', 'Recovery'), 'recovery') +
      navButton('services', t('Сервисы', 'Services'), 'services') +
      navButton('info', t('Сведения', 'Details'), 'info');
  }

  function accountSectionHeader(icon, title, description) {
    return '<header class="account-v24__section-head"><span class="account-v24__section-icon">' + accountIcon(icon) + '</span><div><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(description) + '</p></div></header>';
  }

  function accountStatusDot(label, kind) {
    return '<span class="account-v24__status-text is-' + escapeHtml(kind || 'neutral') + '"><i></i>' + escapeHtml(label) + '</span>';
  }

  // Contract note: Turnstile and browser checks do not run inside Electron.
  // Security contract: Device Key stays local. Service scopes remain separate: chat:access and workshop:access.
  // Local-first contract: Workspace работает без Account; Account подключает только сетевые функции.

  function shortId(value, left = 12, right = 8) {
    const text = String(value || '');
    if (text.length <= left + right + 3) return text || '—';
    return text.slice(0, left) + '…' + text.slice(-right);
  }

  const RECOVERY_WORDS = (
    'amber apple april arrow atlas bamboo beach berry birch bloom blue breeze brick brook cedar charm cherry cloud coral creek crown dawn delta dune eagle earth ember fern field flame flora forest frost garden glass glow grape green harbor hazel hill honey iris ivory jade juniper lake leaf lemon light lilac lime lotus maple meadow mint moon moss north ocean olive opal orchid palm peach pearl pine plum pond poppy quartz rain reed ridge river robin rose sage sand sea shell silver sky snow solar south spark spring star stone storm summer sun teal terra thyme tide topaz trail tree tulip valley violet wave west wheat willow wind winter wood zenith acorn alpine anchor aurora basil beacon blossom bronze canyon clover comet copper cosmos crystal daisy drift echo elm falcon feather galaxy grove island lagoon linden mango marble morning nectar pebble petal planet prism raven saffron shadow shore summit sunset thunder timber'
  ).split(' ');

  function generateRecoveryPhrase() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
      throw new Error('SECURE_RANDOM_UNAVAILABLE');
    }
    const random = new Uint8Array(18);
    window.crypto.getRandomValues(random);
    return Array.from(random, (value) => RECOVERY_WORDS[value & 127]).join('-');
  }

  function ensureRecoveryDraftPhrase() {
    if (!recoveryDraftPhrase) recoveryDraftPhrase = generateRecoveryPhrase();
    return recoveryDraftPhrase;
  }

  function formatAccountTime(value) {
    const numeric = Number(value || 0);
    if (!numeric) return '—';
    const millis = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    try {
      return new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en', {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(millis));
    } catch (_) {
      return new Date(millis).toLocaleString();
    }
  }

  function accountNoticeHtml() {
    if (!accountUiNotice || !accountUiNotice.message) return '';
    return '<div class="account-v24__notice is-' + escapeHtml(accountUiNotice.kind || 'info') + '" role="status" aria-live="polite">' + escapeHtml(accountUiNotice.message) + '</div>';
  }

  function applyAccountUiState(root) {
    if (!root) return;
    if (!accountUiBusyAction) return;
    root.querySelectorAll('[data-account-surface-action]').forEach((node) => {
      node.disabled = true;
      if (String(node.getAttribute('data-account-surface-action') || '') === accountUiBusyAction) {
        node.setAttribute('aria-busy', 'true');
        node.textContent = t('Выполняется…', 'Working…');
      }
    });
  }

  function recoveryPasswordField(name, placeholder, autocomplete) {
    return '<input type="password" data-account-recovery-input="' + escapeHtml(name) + '" autocomplete="' + escapeHtml(autocomplete || 'off') + '" placeholder="' + escapeHtml(placeholder) + '" />';
  }

  function recoverySetupHtml(identity, { allowProvision = true, allowTest = true } = {}) {
    const provisioned = Boolean(identity.recovery_provisioned);
    const tested = Boolean(identity.recovery_restore_tested);
    let body = '<p>' + escapeHtml(
      tested
        ? t('Пакет восстановления проверен. Его можно использовать для возвращения к тому же Account после потери устройства или переустановки системы.', 'The Recovery package is verified. It can return you to the same Account after device loss or system reinstallation.')
        : provisioned
          ? t('Пакет восстановления сохранён. Выполните безопасную проверку, чтобы убедиться, что файл и фраза подходят друг к другу.', 'The Recovery package is saved. Run the safe check to confirm that the file and phrase work together.')
          : t('Workspace создаст стойкую фразу и зашифрованный файл восстановления. Сохраните их отдельно от этого компьютера. IRGEZTNE не получает эту фразу.', 'Workspace will create a strong phrase and an encrypted Recovery file. Store them separately from this computer. IRGEZTNE never receives this phrase.')
    ) + '</p>';

    if (!provisioned && allowProvision) {
      let phrase = '';
      try { phrase = ensureRecoveryDraftPhrase(); }
      catch (_) { phrase = ''; }
      body += '<label class="account-v24__field">' + escapeHtml(t('Фраза восстановления', 'Recovery phrase')) +
        '<textarea readonly class="account-v24__recovery-phrase" data-account-recovery-input="provision" autocomplete="off" spellcheck="false" aria-label="' + escapeHtml(t('Фраза восстановления', 'Recovery phrase')) + '">' + escapeHtml(recoveryPhraseVisible ? phrase : phrase.replace(/[a-z]/g, '•')) + '</textarea>' +
        '<span class="account-v24__field-hint">' + escapeHtml(t('18 случайных слов · около 126 бит энтропии · фраза не сохраняется в Workspace', '18 random words · about 126 bits of entropy · the phrase is not stored by Workspace')) + '</span></label>' +
        '<div class="account-v24__recovery-tools"><button type="button" data-account-surface-action="recovery-toggle">' + escapeHtml(recoveryPhraseVisible ? t('Скрыть фразу', 'Hide phrase') : t('Показать фразу', 'Show phrase')) + '</button><button type="button" data-account-surface-action="recovery-copy" ' + (phrase ? '' : 'disabled') + '>' + escapeHtml(t('Копировать', 'Copy')) + '</button><button type="button" data-account-surface-action="recovery-generate">' + escapeHtml(t('Создать новую фразу', 'Generate a new phrase')) + '</button></div>' +
        '<label class="account-v24__check"><input type="checkbox" data-account-recovery-ack /><span>' + escapeHtml(t('Я сохранил(а) фразу отдельно и понимаю, что IRGEZTNE не сможет восстановить её за меня.', 'I saved the phrase separately and understand that IRGEZTNE cannot recover it for me.')) + '</span></label>' +
        '<div class="account-page-v1__actions" style="margin-top:12px;"><button type="button" class="is-primary" data-account-surface-action="identity-recovery-provision" ' + (phrase ? '' : 'disabled') + '>' + escapeHtml(t('Сохранить файл восстановления', 'Save Recovery file')) + '</button></div>';
      return body;
    }

    if (provisioned && allowTest) {
      body += '<label class="account-v24__field">' + escapeHtml(t('Фраза сохранённого файла', 'Saved file recovery phrase')) +
        recoveryPasswordField('test', t('Введите сохранённую фразу', 'Enter the saved phrase'), 'current-password') + '</label>' +
        '<div class="account-page-v1__actions" style="margin-top:12px;"><button type="button" class="is-primary" data-account-surface-action="identity-recovery-test">' + escapeHtml(t('Проверить файл восстановления', 'Test Recovery file')) + '</button></div>';
    }
    return body;
  }

  function identityAccountSurfaceHtml(status) {
    const identity = status.identity || {};
    const account = status.account || null;
    const secure = identity.protected_storage || {};
    const network = status.network || {};
    const recoveryReady = Boolean(identity.recovery_provisioned);
    const recoveryTested = Boolean(identity.recovery_restore_tested);
    const networkReady = Boolean(network.configured && network.new_account_enabled);
    const canActivate = Boolean(secure.available && networkReady && (recoveryReady || network.allow_unprovisioned_recovery));

    // Historical pre-Identity Account state may remain for audit/testing, but it is not
    // ownership authority and must not block the new Identity-first Account flow.

    if (account) {
      const profile = account.profile || {};
      const displayName = String(profile.display_name || '');
      const handle = String(profile.handle || '');
      const contactEmail = String(profile.email || account.email || '');
      const accountActive = account.status === 'ACTIVE';
      const accountStatusLabel = accountActive
        ? t('Аккаунт активен', 'Account active')
        : account.status === 'SECURITY_LOCKED'
          ? t('Аккаунт временно заблокирован', 'Account temporarily locked')
          : account.status === 'DELETION_PENDING'
            ? t('Удаление аккаунта ожидает завершения', 'Account deletion is pending')
            : account.status === 'DELETED'
              ? t('Аккаунт удалён', 'Account deleted')
              : t('Аккаунт недоступен', 'Account unavailable');
      const accountStatusKind = accountActive ? 'ok' : account.status === 'SECURITY_LOCKED' || account.status === 'DELETION_PENDING' ? 'warn' : 'danger';
      const recoveryLabel = recoveryTested
        ? t('Восстановление проверено', 'Recovery verified')
        : recoveryReady
          ? t('Файл сохранён — нужна проверка', 'File saved — verification needed')
          : t('Восстановление не настроено', 'Recovery is not set up');
      const continuityLabel = Number(identity.recovery_epoch || 0) > 0
        ? t('Сохранена после восстановления', 'Preserved after recovery')
        : t('Сохранена', 'Preserved');
      const platformLabel = String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || t('Это устройство', 'This device'));
      const initialsSource = (displayName || handle || 'IR').trim();
      const initials = initialsSource.split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join('').toUpperCase() || 'IR';
      const validViews = ['profile', 'identity', 'security', 'recovery', 'services', 'info'];
      if (!validViews.includes(accountSurfaceView)) accountSurfaceView = 'profile';
      let content = '';

      if (accountSurfaceView === 'profile') {
        content = accountSectionHeader('profile', t('Профиль', 'Profile'), t('Ваше имя, @handle и приватные данные аккаунта для сетевых функций IRGEZTNE Workspace.', 'Your name, @handle and private Account data for IRGEZTNE Workspace online features.')) +
          '<div class="account-v24__profile-grid">' +
            '<section class="account-v24__panel account-v24__profile-card">' +
              '<div class="account-v24__profile-head"><div class="account-v24__avatar" aria-hidden="true">' + escapeHtml(initials) + '</div><div><h2>' + escapeHtml(displayName || (handle ? '@' + handle : t('Профиль IRGEZTNE', 'IRGEZTNE profile'))) + '</h2><p>' + escapeHtml(t('Основная информация', 'Primary information')) + '</p></div>' + statusPill(accountStatusLabel, accountStatusKind) + '</div>' +
              '<label class="account-v24__field">' + escapeHtml(t('Отображаемое имя', 'Display name')) +
                '<input type="text" maxlength="80" data-account-profile-input="display-name" value="' + escapeHtml(displayName) + '" placeholder="' + escapeHtml(t('Необязательно', 'Optional')) + '" ' + (accountActive ? '' : 'disabled') + ' /></label>' +
              '<label class="account-v24__field">@handle' +
                '<input type="text" maxlength="30" data-account-profile-input="handle" value="' + escapeHtml(handle) + '" placeholder="example_name" autocapitalize="off" autocomplete="off" spellcheck="false" ' + (accountActive ? '' : 'disabled') + ' /></label>' +
              '<span class="account-v24__field-hint">' + escapeHtml(t('3–30 символов: латинские буквы, цифры и _. Между изменениями действует период ожидания.', '3–30 characters: letters, digits and _. A waiting period applies between changes.')) + '</span>' +
              '<div class="account-v24__actions"><button type="button" class="is-primary" data-account-surface-action="identity-profile-save" ' + (accountActive ? '' : 'disabled') + '>' + escapeHtml(t('Сохранить изменения', 'Save changes')) + '</button></div>' +
            '</section>' +
            '<section class="account-v24__panel account-v24__contact-card"><div class="account-v24__card-title">' + accountIcon('chat') + '<div><h2>' + escapeHtml(t('Контактная информация', 'Contact information')) + '</h2><p>' + escapeHtml(t('Приватные данные только для важных сообщений Account.', 'Private data used only for important Account messages.')) + '</p></div></div>' +
              '<div class="account-v24__data-row"><span>Email</span><strong>' + escapeHtml(contactEmail || t('Не добавлен', 'Not added')) + '</strong></div>' +
              '<p class="account-v24__muted">' + escapeHtml(t('Email не показывается публично. Для входа и восстановления используется Identity.', 'Email is not public. Identity is used for sign-in and recovery.')) + '</p>' +
            '</section>' +
          '</div>' +
          '<div class="account-v24__card-grid is-four">' +
            '<section class="account-v24__panel account-v24__mini-card"><div class="account-v24__card-title">' + accountIcon('profile') + '<div><h2>' + escapeHtml(t('Статус аккаунта', 'Account status')) + '</h2><p>' + escapeHtml(accountStatusLabel) + '</p></div></div>' + accountStatusDot(accountActive ? t('Активен', 'Active') : t('Ограничен', 'Limited'), accountStatusKind) + '</section>' +
            '<section class="account-v24__panel account-v24__mini-card"><div class="account-v24__card-title">' + accountIcon('services') + '<div><h2>' + escapeHtml(t('Доступ к сервисам', 'Service access')) + '</h2><p>Chat · Workshop Online</p></div></div><button type="button" class="account-v24__text-link" data-account-surface-view="services">' + escapeHtml(t('Открыть сервисы', 'Open services')) + '</button></section>' +
            '<section class="account-v24__panel account-v24__mini-card"><div class="account-v24__card-title">' + accountIcon('security') + '<div><h2>' + escapeHtml(t('Безопасность', 'Security')) + '</h2><p>' + escapeHtml(secure.available ? t('Защищённое хранилище доступно', 'Protected storage is available') : t('Защищённое хранилище недоступно', 'Protected storage is unavailable')) + '</p></div></div><button type="button" class="account-v24__text-link" data-account-surface-view="security">' + escapeHtml(t('Открыть безопасность', 'Open Security')) + '</button></section>' +
            '<section class="account-v24__panel account-v24__mini-card"><div class="account-v24__card-title">' + accountIcon('recovery') + '<div><h2>' + escapeHtml(t('Восстановление', 'Recovery')) + '</h2><p>' + escapeHtml(recoveryLabel) + '</p></div></div><button type="button" class="account-v24__text-link" data-account-surface-view="recovery">' + escapeHtml(t('Открыть восстановление', 'Open Recovery')) + '</button></section>' +
          '</div>' +
          '<section class="account-v24__privacy-note">' + accountIcon('security') + '<div><strong>' + escapeHtml(t('Профиль приватен по умолчанию', 'Profile is private by default')) + '</strong><span>' + escapeHtml(t('Файлы, Проекты, Офис, Заметки, Задачи, Инструменты и локальная Веб-студия не требуют входа. Синхронизация Account не публикует профиль и не загружает локальные файлы Workspace.', 'Files, Projects, Office, Notes, Tasks, Tools and local Web Studio do not require sign-in. Account synchronization does not publish the profile or upload local Workspace files.')) + '</span></div></section>';
      } else if (accountSurfaceView === 'identity') {
        content = accountSectionHeader('identity', t('Идентификация', 'Identification'), t('Как Workspace подтверждает ваш Account и сохраняет его непрерывность.', 'How Workspace proves your Account and preserves its continuity.')) +
          '<section class="account-v24__hero-status is-ok"><span class="account-v24__hero-icon">' + accountIcon('identity') + '</span><div><h2>' + escapeHtml(t('Идентификация активна', 'Identification is active')) + '</h2><p>' + escapeHtml(t('Ваша локальная криптографическая Identity готова к сетевым действиям.', 'Your local cryptographic Identity is ready for online actions.')) + '</p></div>' + statusPill(t('Всё в порядке', 'All good'), 'ok') + '</section>' +
          '<div class="account-v24__card-grid">' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('profile') + '<div><h2>' + escapeHtml(t('Связь с аккаунтом', 'Account link')) + '</h2><p>' + escapeHtml(t('Identity относится к этому же Account.', 'Identity belongs to this same Account.')) + '</p></div></div><div class="account-v24__data-row"><span>' + escapeHtml(t('IRGEZTNE Account', 'IRGEZTNE Account')) + '</span>' + accountStatusDot(accountActive ? t('Связан', 'Linked') : t('Ограничен', 'Limited'), accountStatusKind) + '</div><button type="button" class="account-v24__text-link" data-account-surface-view="profile">' + escapeHtml(t('Открыть профиль', 'Open profile')) + '</button></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('refresh') + '<div><h2>' + escapeHtml(t('Непрерывность идентичности', 'Identity continuity')) + '</h2><p>' + escapeHtml(t('Та же Identity сохраняется после корректного восстановления.', 'The same Identity is preserved after a valid Recovery.')) + '</p></div></div>' +
              '<ul class="account-v24__check-list"><li>' + escapeHtml(t('Непрерывность сохранена', 'Continuity preserved')) + '</li><li>' + escapeHtml(t('Привязка к тому же аккаунту сохранена', 'Same-Account linkage preserved')) + '</li><li>' + escapeHtml(continuityLabel) + '</li></ul>' +
            '</section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('security') + '<div><h2>' + escapeHtml(t('Приватность', 'Privacy')) + '</h2><p>' + escapeHtml(t('Identity работает локально и не является публичным профилем.', 'Identity works locally and is not a public profile.')) + '</p></div></div><ul class="account-v24__check-list"><li>' + escapeHtml(t('Закрытые ключи не покидают устройство', 'Private keys never leave the device')) + '</li><li>' + escapeHtml(t('Публичный профиль не создаётся автоматически', 'No public profile is created automatically')) + '</li></ul></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('info') + '<div><h2>' + escapeHtml(t('Где находятся другие настройки', 'Where other settings live')) + '</h2><p>' + escapeHtml(t('Управление устройством — в «Безопасности», восстановление — в «Восстановлении».', 'Device controls are under Security; Recovery controls are under Recovery.')) + '</p></div></div><div class="account-v24__link-row"><button type="button" class="account-v24__text-link" data-account-surface-view="security">' + escapeHtml(t('Открыть безопасность', 'Open Security')) + '</button><button type="button" class="account-v24__text-link" data-account-surface-view="info">' + escapeHtml(t('Технические сведения', 'Technical details')) + '</button></div></section>' +
          '</div>' +
          '<section class="account-v24__privacy-note">' + accountIcon('info') + '<div><strong>' + escapeHtml(t('Технические идентификаторы доступны отдельно', 'Technical identifiers are kept separately')) + '</strong><span>' + escapeHtml(t('Закрытые ключи никогда не показываются в интерфейсе. Технические идентификаторы доступны отдельно в разделе «Сведения».', 'Private keys are never shown in the interface. Technical identifiers are available separately under Details.')) + '</span></div></section>';
      } else if (accountSurfaceView === 'security') {
        content = accountSectionHeader('security', t('Безопасность', 'Security'), t('Защита аккаунта, этой установки Workspace и локального подключения.', 'Protection for your Account, this Workspace installation and its local connection.')) +
          '<section class="account-v24__hero-status ' + (secure.available && accountActive ? 'is-ok' : 'is-warn') + '"><span class="account-v24__hero-icon">' + accountIcon('security') + '</span><div><h2>' + escapeHtml(secure.available && accountActive ? t('Аккаунт защищён', 'Account is protected') : t('Требуется внимание', 'Attention required')) + '</h2><p>' + escapeHtml(t('Локальная защита и связь с Account проверяются независимо от ваших локальных файлов.', 'Local protection and the Account connection are checked independently from your local files.')) + '</p></div><button type="button" class="account-v24__icon-action" data-account-surface-action="identity-refresh">' + accountIcon('refresh') + '<span>' + escapeHtml(t('Проверить сейчас', 'Check now')) + '</span></button></section>' +
          '<div class="account-v24__card-grid">' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('device') + '<div><h2>' + escapeHtml(t('Это устройство', 'This device')) + '</h2><p>' + escapeHtml(t('Текущая установка Workspace.', 'Current Workspace installation.')) + '</p></div></div><div class="account-v24__device-line"><div><strong>IRGEZTNE Workspace</strong><span>' + escapeHtml(platformLabel) + '</span></div>' + statusPill(t('Текущее устройство', 'Current device'), 'ok') + '</div><div class="account-v24__data-row"><span>' + escapeHtml(t('Подключение', 'Connection')) + '</span><strong>' + escapeHtml(accountStatusLabel) + '</strong></div></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('storage') + '<div><h2>' + escapeHtml(t('Защищённое хранилище устройства', 'Protected device storage')) + '</h2><p>' + escapeHtml(t('Системная защита ключей и локального состояния Account.', 'System protection for keys and local Account state.')) + '</p></div></div><div class="account-v24__data-row"><span>' + escapeHtml(t('Состояние', 'Status')) + '</span>' + accountStatusDot(secure.available ? t('Доступно', 'Available') : t('Недоступно', 'Unavailable'), secure.available ? 'ok' : 'danger') + '</div><div class="account-v24__data-row"><span>' + escapeHtml(t('Используется для', 'Used for')) + '</span><strong>' + escapeHtml(t('Ключей Account и Identity', 'Account and Identity keys')) + '</strong></div></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('security') + '<div><h2>' + escapeHtml(t('Локальная защита', 'Local protection')) + '</h2><p>' + escapeHtml(t('Защита этой установки и её сетевых доказательств.', 'Protection for this installation and its online proofs.')) + '</p></div></div><ul class="account-v24__check-list"><li>' + escapeHtml(t('Закрытые ключи остаются на устройстве', 'Private keys remain on the device')) + '</li><li>' + escapeHtml(t('Account не получает локальные файлы Workspace', 'Account does not receive local Workspace files')) + '</li></ul></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('recovery') + '<div><h2>' + escapeHtml(t('Резервная защита', 'Recovery protection')) + '</h2><p>' + escapeHtml(recoveryLabel) + '</p></div></div><button type="button" class="account-v24__text-link" data-account-surface-view="recovery">' + escapeHtml(t('Открыть восстановление', 'Open Recovery')) + '</button></section>' +
          '</div>' +
          '<section class="account-v24__panel account-v24__danger-zone"><div><h2>' + escapeHtml(t('Действия с устройством', 'Device actions')) + '</h2><p>' + escapeHtml(t('Отключение удаляет только локальную связь с Account. Ваша Identity, профиль и сам Account не удаляются; повторное подключение возвращает тот же Account.', 'Disconnecting removes only the local Account link. Your Identity, profile and Account are not deleted; reconnecting returns to the same Account.')) + '</p></div><button type="button" class="is-danger-soft" data-account-surface-action="identity-disconnect-local">' + escapeHtml(t('Отключить на этом устройстве', 'Disconnect on this device')) + '</button></section>';
      } else if (accountSurfaceView === 'recovery') {
        content = accountSectionHeader('recovery', t('Восстановление', 'Recovery'), t('Инструменты для возвращения к тому же аккаунту на новом устройстве.', 'Tools for returning to the same Account on a new device.')) +
          '<section class="account-v24__hero-status ' + (recoveryTested ? 'is-ok' : 'is-warn') + '"><span class="account-v24__hero-icon">' + accountIcon('recovery') + '</span><div><h2>' + escapeHtml(recoveryLabel) + '</h2><p>' + escapeHtml(recoveryTested ? t('Файл и фраза восстановления успешно проверены.', 'The Recovery file and phrase were verified successfully.') : t('Завершите настройку и проверку восстановления.', 'Complete Recovery setup and verification.')) + '</p></div>' + statusPill(recoveryTested ? t('Готово', 'Ready') : t('Требуется действие', 'Action needed'), recoveryTested ? 'ok' : 'warn') + '</section>' +
          '<div class="account-v24__card-grid">' +
            '<section class="account-v24__panel account-v24__recovery-card"><div class="account-v24__card-title">' + accountIcon('security') + '<div><h2>' + escapeHtml(t('Фраза и файл восстановления', 'Recovery phrase and file')) + '</h2><p>' + escapeHtml(t('Сохраните их отдельно от этого компьютера.', 'Store them separately from this computer.')) + '</p></div></div>' + recoverySetupHtml(identity, { allowProvision:true, allowTest:true }) + '</section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('refresh') + '<div><h2>' + escapeHtml(t('Проверка восстановления', 'Recovery verification')) + '</h2><p>' + escapeHtml(t('Проверка подтверждает, что файл и фраза подходят друг к другу.', 'Verification confirms that the file and phrase work together.')) + '</p></div></div><div class="account-v24__data-row"><span>' + escapeHtml(t('Состояние', 'Status')) + '</span><strong>' + escapeHtml(recoveryTested ? t('Проверено', 'Verified') : t('Ожидает проверки', 'Awaiting verification')) + '</strong></div><div class="account-v24__data-row"><span>' + escapeHtml(t('Последняя успешная проверка', 'Last successful verification')) + '</span><strong>' + escapeHtml(formatAccountTime(identity.recovery_restore_tested_at)) + '</strong></div><div class="account-v24__data-row"><span>' + escapeHtml(t('После восстановления', 'After Recovery')) + '</span><strong>' + escapeHtml(Number(identity.recovery_epoch || 0) > 0 ? t('Тот же Account сохранён', 'Same Account preserved') : t('Готово сохранить тот же Account', 'Ready to preserve the same Account')) + '</strong></div></section>' +
            '<section class="account-v24__panel account-v24__wide-card"><div class="account-v24__card-title">' + accountIcon('device') + '<div><h2>' + escapeHtml(t('Восстановление на новом устройстве', 'Recovery on a new device')) + '</h2><p>' + escapeHtml(t('На новой установке Workspace выберите сохранённый файл и введите фразу восстановления. Успешное восстановление возвращает ту же Identity и тот же Account, а не создаёт дубль.', 'On a new Workspace installation, choose the saved file and enter the Recovery phrase. Successful Recovery returns the same Identity and Account instead of creating a duplicate.')) + '</p></div></div></section>' +
          '</div>' +
          '<section class="account-v24__warning-note">' + accountIcon('info') + '<div><strong>' + escapeHtml(t('Храните фразу отдельно', 'Keep the phrase separate')) + '</strong><span>' + escapeHtml(t('IRGEZTNE не получает фразу восстановления и не сможет восстановить её за вас.', 'IRGEZTNE never receives the Recovery phrase and cannot recover it for you.')) + '</span></div></section>';
      } else if (accountSurfaceView === 'services') {
        content = accountSectionHeader('services', t('Сервисы', 'Services'), t('Сетевые функции IRGEZTNE, которым можно отдельно разрешить доступ к аккаунту.', 'IRGEZTNE online features that can receive separate Account authorization.')) +
          '<section class="account-v24__info-banner"><span>' + accountIcon('info') + '</span><div><h2>' + escapeHtml(t('Доступные сервисы', 'Available services')) + '</h2><p>' + escapeHtml(t('Каждый сервис подключается отдельно и получает только своё ограниченное разрешение.', 'Each service connects separately and receives only its own limited authorization.')) + '</p></div></section>' +
          '<div class="account-v24__service-cards">' +
            '<section class="account-v24__panel account-v24__service-card"><div class="account-v24__service-head"><span class="account-v24__service-icon">' + accountIcon('chat') + '</span><div><h2>Chat</h2><p>' + escapeHtml(t('Защищённые личные разговоры внутри IRGEZTNE.', 'Secure direct conversations inside IRGEZTNE.')) + '</p></div>' + statusPill(accountActive ? t('Доступен', 'Available') : t('Нужен активный Account', 'Active Account required'), accountActive ? 'ok' : 'warn') + '</div><p>' + escapeHtml(t('При открытии Chat Main-процесс получает короткоживущее разрешение только для Chat. Master-сессия и ключи Identity в Chat не передаются.', 'When Chat opens, Main receives a short-lived Chat-only authorization. The Account master session and Identity keys are never exposed to Chat.')) + '</p><ul class="account-v24__feature-list"><li>' + escapeHtml(t('Отдельный Chat-scoped доступ', 'Separate Chat-scoped access')) + '</li><li>' + escapeHtml(t('Без доступа к Workshop', 'No Workshop access')) + '</li></ul></section>' +
            '<section class="account-v24__panel account-v24__service-card"><div class="account-v24__service-head"><span class="account-v24__service-icon">' + accountIcon('workshop') + '</span><div><h2>Workshop Online</h2><p>' + escapeHtml(t('Совместная работа и публикация проектов в Мастерской.', 'Collaboration and project publishing in Workshop.')) + '</p></div>' + statusPill(t('Не подключён', 'Not connected'), 'warn') + '</div><p>' + escapeHtml(t('Онлайн-публикация пока не включена. Workshop запросит собственное разрешение отдельно от Chat.', 'Online publishing is not enabled yet. Workshop will request its own permission separately from Chat.')) + '</p><ul class="account-v24__feature-list"><li>' + escapeHtml(t('Отдельный Workshop-scoped доступ', 'Separate Workshop-scoped access')) + '</li><li>' + escapeHtml(t('Без доступа к Chat', 'No Chat access')) + '</li></ul></section>' +
          '</div>' +
          '<section class="account-v24__privacy-note">' + accountIcon('security') + '<div><strong>' + escapeHtml(t('Изоляция сервисов', 'Service isolation')) + '</strong><span>' + escapeHtml(t('Каждый сервис получает только собственное ограниченное разрешение. Подключение одного сервиса не открывает доступ другому.', 'Each service receives only its own limited permission. Connecting one service does not grant access to another.')) + '</span></div></section>';
      } else if (accountSurfaceView === 'info') {
        content = accountSectionHeader('info', t('Сведения', 'Details'), t('Техническая информация об аккаунте, Identity, устройстве и этой установке Workspace.', 'Technical information about the Account, Identity, device and this Workspace installation.')) +
          '<div class="account-v24__details-grid">' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('profile') + '<div><h2>' + escapeHtml(t('Аккаунт', 'Account')) + '</h2><p>' + escapeHtml(t('Текущее состояние и профиль.', 'Current state and profile.')) + '</p></div></div><div class="account-v24__detail-list"><div><span>' + escapeHtml(t('Статус аккаунта', 'Account status')) + '</span>' + accountStatusDot(accountStatusLabel, accountStatusKind) + '</div><div><span>' + escapeHtml(t('Язык интерфейса', 'Interface language')) + '</span><strong>' + escapeHtml(lang() === 'ru' ? 'Русский (RU)' : 'English (EN)') + '</strong></div><div><span>AccountRecordID</span><code>' + escapeHtml(account.account_id || '—') + '</code></div><div><span>security_version</span><code>' + escapeHtml(String(account.security_version || 0)) + '</code></div></div></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('identity') + '<div><h2>' + escapeHtml(t('Идентификация', 'Identification')) + '</h2><p>' + escapeHtml(t('Технические данные Identity.', 'Technical Identity data.')) + '</p></div></div><div class="account-v24__detail-list"><div><span>IdentityID</span><code>' + escapeHtml(identity.identity_id || '—') + '</code></div><div><span>recovery_epoch</span><code>' + escapeHtml(String(identity.recovery_epoch || 0)) + '</code></div><div><span>' + escapeHtml(t('Непрерывность', 'Continuity')) + '</span><strong>' + escapeHtml(continuityLabel) + '</strong></div><div><span>' + escapeHtml(t('Связь с аккаунтом', 'Account linkage')) + '</span><strong>' + escapeHtml(accountActive ? t('Подтверждена', 'Confirmed') : t('Ограничена', 'Limited')) + '</strong></div></div></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('device') + '<div><h2>' + escapeHtml(t('Текущее устройство', 'Current device')) + '</h2><p>' + escapeHtml(t('Данные этой установки Workspace.', 'Data for this Workspace installation.')) + '</p></div></div><div class="account-v24__detail-list"><div><span>' + escapeHtml(t('Платформа', 'Platform')) + '</span><strong>' + escapeHtml(platformLabel) + '</strong></div><div><span>DeviceID</span><code>' + escapeHtml(identity.device_id || '—') + '</code></div><div><span>' + escapeHtml(t('Локальная защита', 'Local protection')) + '</span>' + accountStatusDot(secure.available ? t('Включена', 'Enabled') : t('Недоступна', 'Unavailable'), secure.available ? 'ok' : 'danger') + '</div><div><span>' + escapeHtml(t('Среда сервиса', 'Service environment')) + '</span><code>' + escapeHtml(String(network.service_environment || '—')) + '</code></div></div></section>' +
            '<section class="account-v24__panel"><div class="account-v24__card-title">' + accountIcon('storage') + '<div><h2>' + escapeHtml(t('Защищённое хранилище устройства', 'Protected device storage')) + '</h2><p>' + escapeHtml(t('Системное хранилище ключей и защищённого состояния.', 'System storage for keys and protected state.')) + '</p></div></div><div class="account-v24__detail-list"><div><span>' + escapeHtml(t('Тип защиты', 'Protection type')) + '</span><code>' + escapeHtml(secure.available ? String(secure.backend || 'available') : 'unavailable') + '</code></div><div><span>' + escapeHtml(t('Состояние', 'Status')) + '</span>' + accountStatusDot(secure.available ? t('Доступно', 'Available') : t('Недоступно', 'Unavailable'), secure.available ? 'ok' : 'danger') + '</div><div><span>' + escapeHtml(t('Используется для', 'Used for')) + '</span><strong>' + escapeHtml(t('Ключей Account и Identity', 'Account and Identity keys')) + '</strong></div>' + (identity.recovery_package_fingerprint ? '<div><span>' + escapeHtml(t('Отпечаток файла восстановления', 'Recovery file fingerprint')) + '</span><code>' + escapeHtml(identity.recovery_package_fingerprint) + '</code></div>' : '') + '</div></section>' +
          '</div>' +
          '<section class="account-v24__panel account-v24__diagnostics"><div><h2>' + escapeHtml(t('Диагностика', 'Diagnostics')) + '</h2><p>' + escapeHtml(t('Эти сведения не содержат закрытых ключей, фразы восстановления или bearer-токенов.', 'These details contain no private keys, Recovery phrase or bearer tokens.')) + '</p></div><button type="button" data-account-surface-action="identity-refresh">' + accountIcon('refresh') + '<span>' + escapeHtml(t('Проверить состояние', 'Check status')) + '</span></button></section>';
      }

      return '<div class="account-v24">' +
        '<aside class="account-v24__rail"><div class="account-v24__rail-top"><div class="account-v24__brand"><span class="account-v24__mark">IR</span><div><strong>' + escapeHtml(t('Аккаунт', 'Account')) + '</strong><span>IRGEZTNE</span></div></div></div>' +
          '<nav class="account-v24__nav" aria-label="' + escapeHtml(t('Разделы аккаунта', 'Account sections')) + '">' + accountNavigationHtml() + '</nav>' +
          '<div class="account-v24__rail-status">' + accountStatusDot(accountActive ? t('Аккаунт активен', 'Account active') : t('Доступ ограничен', 'Access limited'), accountStatusKind) + '</div></aside>' +
        '<main class="account-v24__main">' + accountNoticeHtml() + content + '</main></div>';
    }

    const identityExists = Boolean(identity.exists);

    if (!identityExists) {
      return '<div class="account-page-v1">' + accountNoticeHtml() +
        '<section class="account-page-v1__hero"><div class="account-page-v1__copy"><span class="account-page-v1__kicker">IRGEZTNE ACCOUNT</span><h2>' + escapeHtml(t('Аккаунт', 'Account')) + '</h2><p>' + escapeHtml(t('Workspace остаётся локальным без регистрации. Identity нужна только тогда, когда вы решите подключить сетевые функции IRGEZTNE.', 'Workspace remains local without registration. Identity is needed only when you choose to connect IRGEZTNE online features.')) + '</p><div class="account-page-v1__status"><i></i><span>' + escapeHtml(t('Локальный режим', 'Local mode')) + '</span></div></div></section>' +
        '<div class="account-page-v1__grid">' +
          '<section class="account-page-v1__card account-page-v1__card--primary"><span class="account-page-v1__eyebrow">IDENTITY</span><h3>' + escapeHtml(t('Создать защищённую Identity', 'Create a protected Identity')) + '</h3><p>' + escapeHtml(t('Workspace создаст ключи на этом устройстве и сохранит их в защищённом хранилище системы. Интернет для этого шага не нужен.', 'Workspace creates the keys on this device and stores them in protected system storage. This step does not require the internet.')) + '</p><div class="account-page-v1__actions"><button type="button" class="is-primary" data-account-surface-action="identity-local-create" ' + (secure.available ? '' : 'disabled') + '>' + escapeHtml(t('Создать Identity', 'Create Identity')) + '</button></div>' + (!secure.available ? '<p class="account-menu-v044__note">' + escapeHtml(t('Защищённое хранилище ОС недоступно.', 'OS-protected storage is unavailable.')) + '</p>' : '') + '</section>' +
          '<section class="account-page-v1__card"><span class="account-page-v1__eyebrow">' + escapeHtml(t('ВОССТАНОВЛЕНИЕ', 'RECOVERY')) + '</span><h3>' + escapeHtml(t('Вернуться к существующему Account', 'Return to an existing Account')) + '</h3><p>' + escapeHtml(t('Выберите ранее сохранённый файл восстановления и введите свою фразу. Identity и Account сохранят непрерывность, а защита этого устройства будет обновлена.', 'Choose a previously saved Recovery file and enter your phrase. Identity and Account continuity are preserved while protection for this device is renewed.')) + '</p>' +
            '<label class="account-v24__field">' + escapeHtml(t('Фраза восстановления', 'Recovery phrase')) + recoveryPasswordField('restore', t('Введите сохранённую фразу', 'Enter the saved phrase'), 'current-password') + '</label>' +
            '<div class="account-page-v1__actions" style="margin-top:12px;"><button type="button" data-account-surface-action="identity-recovery-restore" ' + (secure.available ? '' : 'disabled') + '>' + escapeHtml(t('Выбрать файл и восстановить', 'Choose file and restore')) + '</button></div>' +
          '</section>' +
        '</div>' +
        '<section class="account-page-v1__local-note"><strong>' + escapeHtml(t('Без Account всё локальное продолжает работать.', 'All local work continues without Account.')) + '</strong><span>' + escapeHtml(t('Файлы, Проекты, Офис, Заметки, Инструменты и локальная Web Studio не зависят от Identity/Account.', 'Files, Projects, Office, Notes, Tools and local Web Studio do not depend on Identity/Account.')) + '</span></section></div>';
    }

    if (!recoveryReady && !network.allow_unprovisioned_recovery) {
      return '<div class="account-page-v1">' + accountNoticeHtml() +
        '<section class="account-page-v1__hero"><div class="account-page-v1__copy"><span class="account-page-v1__kicker">IRGEZTNE IDENTITY</span><h2>' + escapeHtml(t('Identity создана', 'Identity created')) + '</h2><p>' + escapeHtml(t('Теперь сохраните файл и фразу восстановления. Сетевой Account на этом шаге ещё не создаётся.', 'Now save the Recovery file and phrase. The network Account is not created at this step.')) + '</p><div class="account-page-v1__status"><i></i><span>' + escapeHtml(t('Защищена на этом устройстве', 'Protected on this device')) + '</span></div></div></section>' +
        '<div class="account-page-v1__grid">' +
          '<section class="account-page-v1__card account-page-v1__card--primary"><span class="account-page-v1__eyebrow">' + escapeHtml(t('ВОССТАНОВЛЕНИЕ', 'RECOVERY')) + '</span><h3>' + escapeHtml(t('Сохранить способ восстановления', 'Save a Recovery method')) + '</h3>' + recoverySetupHtml(identity, { allowProvision:true, allowTest:false }) + '</section>' +
          '<section class="account-page-v1__card"><span class="account-page-v1__eyebrow">IDENTITY</span><h3>' + escapeHtml(t('Защищена системой', 'Protected by the system')) + '</h3><p>' + escapeHtml(t('Закрытые ключи остаются вне интерфейса. Сетевой Account появится только после вашего отдельного подтверждения.', 'Private keys stay outside the interface. A network Account is connected only after your separate confirmation.')) + '</p></section>' +
        '</div></div>';
    }

    let hold = '';
    if (!secure.available) hold = t('Защищённое хранилище ОС недоступно.', 'OS-protected storage is unavailable.');
    else if (!network.configured) hold = t('Сетевое подключение Account пока не настроено в этой сборке.', 'Online Account connection is not configured in this build yet.');
    else if (!network.new_account_enabled) hold = t('Подключение новых Account пока выключено в этой среде.', 'Connecting new Accounts is disabled in this environment.');

    return '<div class="account-page-v1">' + accountNoticeHtml() +
      '<section class="account-page-v1__hero"><div class="account-page-v1__copy"><span class="account-page-v1__kicker">IRGEZTNE ACCOUNT</span><h2>' + escapeHtml(t('Identity готова', 'Identity ready')) + '</h2><p>' + escapeHtml(t('Способ восстановления сохранён. Теперь можно подключить Account. Если он уже существует для этой Identity, Workspace вернётся к нему без создания дубля.', 'Recovery is saved. You can now connect Account. If one already exists for this Identity, Workspace returns to it without creating a duplicate.')) + '</p><div class="account-page-v1__status"><i></i><span>' + escapeHtml(recoveryTested ? t('Восстановление проверено', 'Recovery verified') : t('Файл восстановления сохранён', 'Recovery file saved')) + '</span></div></div></section>' +
      '<div class="account-page-v1__grid">' +
        '<section class="account-page-v1__card account-page-v1__card--primary"><span class="account-page-v1__eyebrow">ACCOUNT</span><h3>' + escapeHtml(t('Подключить IRGEZTNE Account', 'Connect IRGEZTNE Account')) + '</h3><p>' + escapeHtml(t('Workspace подтверждает Identity безопасной подписью. Закрытые ключи и фраза восстановления остаются на вашем устройстве.', 'Workspace proves Identity with a secure signature. Private keys and the Recovery phrase remain on your device.')) + '</p><div class="account-page-v1__actions"><button type="button" class="is-primary" data-account-surface-action="identity-create" ' + (canActivate ? '' : 'disabled') + '>' + escapeHtml(t('Подключить Account', 'Connect Account')) + '</button></div>' + (hold ? '<p class="account-menu-v044__note">' + escapeHtml(hold) + '</p>' : '') + '</section>' +
        '<section class="account-page-v1__card"><span class="account-page-v1__eyebrow">' + escapeHtml(t('ВОССТАНОВЛЕНИЕ', 'RECOVERY')) + '</span><h3>' + escapeHtml(recoveryTested ? t('Готово', 'Ready') : t('Проверьте сохранённый файл', 'Verify the saved file')) + '</h3>' + recoverySetupHtml(identity, { allowProvision:false, allowTest:true }) + '</section>' +
      '</div>' +
      '<section class="account-page-v1__local-note"><strong>' + escapeHtml(t('Account не является условием работы Workspace.', 'Account is not a condition for using Workspace.')) + '</strong><span>' + escapeHtml(t('Account открывает только сетевые сервисы IRGEZTNE.', 'Account enables only IRGEZTNE online services.')) + '</span></section></div>';
  }

  function identityAccountMenuHtml(status) {
    const identity = status.identity || {};
    const account = status.account || null;
    const network = status.network || {};
    const secure = identity.protected_storage || {};
    const connected = Boolean(account && account.status === 'ACTIVE');
    let actions = '';
    if (connected) {
      actions = '<div class="account-menu-v050__actions"><button type="button" class="is-primary" data-account-action="account">' + escapeHtml(t('Открыть Account', 'Open Account')) + '</button><button type="button" data-account-action="identity-refresh">' + escapeHtml(t('Обновить', 'Refresh')) + '</button></div>';
    } else if (status.legacy_connected) {
      actions = '<div class="account-menu-v050__actions"><button type="button" class="is-primary" data-account-action="account">' + escapeHtml(t('Открыть Account', 'Open Account')) + '</button><button type="button" data-account-action="legacy-account">' + escapeHtml(t('Текущий Account', 'Current Account')) + '</button></div>';
    } else {
      const recoveryOk = Boolean(identity.recovery_provisioned || network.allow_unprovisioned_recovery);
      const enabled = Boolean(secure.available && network.configured && network.new_account_enabled && recoveryOk);
      actions = '<div class="account-menu-v050__actions"><button type="button" class="is-primary" data-account-action="identity-create" ' + (enabled ? '' : 'disabled') + '>' + escapeHtml(t('Подключить Account', 'Connect Account')) + '</button><button type="button" data-account-action="account">' + escapeHtml(t('Открыть раздел', 'Open section')) + '</button></div>';
    }
    const detail = connected ? t('Account подключён к Workspace', 'Account connected to Workspace') : (status.legacy_connected ? t('Для старого Account потребуется отдельное безопасное подключение', 'The older Account will need a separate secure connection') : t('Локальная работа без регистрации', 'Local work without registration'));
    return '<div class="account-menu-v050__horizontal"><section class="account-menu-v050__pane account-menu-v050__pane--account"><div class="account-menu-v050__eyebrow">IRGEZTNE Account</div><div class="account-menu-v044__head"><div class="account-menu-v044__avatar"></div><div><strong>' + escapeHtml(connected ? ((account.profile && (account.profile.display_name || (account.profile.handle && '@' + account.profile.handle))) || 'IRGEZTNE Account') : t('Локальный Workspace', 'Local Workspace')) + '</strong><span>' + escapeHtml(detail) + '</span></div></div><div class="account-menu-v044__status ' + (connected ? 'is-connected' : '') + '"><i></i>' + escapeHtml(connected ? t('Account активен', 'Account active') : t('Account не подключён', 'Account not connected')) + '</div><div class="account-menu-v050__security ' + (secure.available ? 'is-ok' : 'is-hold') + '"><span>' + escapeHtml(secure.available ? t('Защита устройства доступна', 'Device protection available') : t('Защита устройства недоступна', 'Device protection unavailable')) + '</span></div>' + actions + '</section><section class="account-menu-v050__pane account-menu-v050__pane--messenger"><div class="account-menu-v050__pane-head"><div><div class="account-menu-v050__eyebrow">Identity</div><strong>' + escapeHtml(identity.exists ? t('Защищена на этом устройстве', 'Protected on this device') : t('Ещё не создана', 'Not created yet')) + '</strong></div></div><p class="account-menu-v050__intro">' + escapeHtml(t('Identity нужна только сетевым функциям. Локальные модули Workspace работают без неё.', 'Identity is only needed for online features. Local Workspace modules work without it.')) + '</p></section></div>';
  }

  function accountSurfaceHtml() {
    const identityStatus = identityAccountStatus();
    if (identityStatus && identityAccountBridge()) return identityAccountSurfaceHtml(identityStatus);
    const status = accountStatus() || {};
    const connected = Boolean(status.connected);
    const pending = status.pending || null;
    const account = status.account || {};
    const profile = account.profile || {};
    const device = status.device || {};
    const secure = status.protected_storage || {};
    const online = status.online !== false;
    const displayName = String(profile.display_name || '').trim();
    const handle = String(profile.handle || '').trim();
    const email = String(account.email || readState().email || '').trim();

    if (!connected) {
      const secureOk = secure.available !== false;
      const pendingHtml = pending ? (
        '<section class="account-page-v1__card account-page-v1__card--primary">' +
          '<span class="account-page-v1__eyebrow">' + escapeHtml(t('ПОДКЛЮЧЕНИЕ', 'CONNECTION')) + '</span>' +
          '<h3>' + escapeHtml(t('Завершите подключение аккаунта', 'Finish Account connection')) + '</h3>' +
          '<p>' + escapeHtml(t(
            'В браузере войдите в IRGEZTNE Account и разрешите подключение этой установки Workspace. После подтверждения вернитесь сюда — Workspace попробует завершить подключение автоматически.',
            'Sign in to IRGEZTNE Account in your browser and approve this Workspace installation. Then return here — Workspace will try to finish the connection automatically.'
          )) + '</p>' +
          '<div class="account-page-v1__actions">' +
            '<button type="button" class="is-primary" data-account-surface-action="desktop-complete">' + escapeHtml(t('Завершить подключение', 'Finish connection')) + '</button>' +
            '<button type="button" data-account-surface-action="desktop-open-auth">' + escapeHtml(t('Открыть страницу подтверждения', 'Open approval page')) + '</button>' +
            '<button type="button" data-account-surface-action="desktop-cancel">' + escapeHtml(t('Отменить', 'Cancel')) + '</button>' +
          '</div>' +
        '</section>'
      ) : (
        '<section class="account-page-v1__card account-page-v1__card--primary">' +
          '<span class="account-page-v1__eyebrow">' + escapeHtml(t('ПОДКЛЮЧЕНИЕ', 'CONNECTION')) + '</span>' +
          '<h3>' + escapeHtml(t('Подключить IRGEZTNE Account', 'Connect IRGEZTNE Account')) + '</h3>' +
          '<p>' + escapeHtml(t(
            'Аккаунт нужен для Чата, Мастерской и других сетевых функций. Файлы и локальная работа Workspace доступны без входа.',
            'Account is used for Chat, Workshop and other online features. Files and local Workspace work remain available without sign-in.'
          )) + '</p>' +
          '<div class="account-page-v1__actions">' +
            '<button type="button" class="is-primary" data-account-surface-action="desktop-connect" ' + (secureOk ? '' : 'disabled') + '>' + escapeHtml(t('Подключить аккаунт', 'Connect account')) + '</button>' +
          '</div>' +
        '</section>'
      );

      return '<div class="account-page-v1">' +
        '<section class="account-page-v1__hero">' +
          '<div class="account-page-v1__copy">' +
            '<span class="account-page-v1__kicker">IRGEZTNE ACCOUNT</span>' +
            '<h2>' + escapeHtml(t('Аккаунт', 'Account')) + '</h2>' +
            '<p>' + escapeHtml(t(
              'Workspace остаётся локальным по умолчанию. Аккаунт подключает только те функции, которым действительно нужен интернет.',
              'Workspace stays local by default. Account connects only the features that actually need online access.'
            )) + '</p>' +
            '<div class="account-page-v1__status"><i></i><span>' + escapeHtml(t('Локальный режим', 'Local mode')) + '</span></div>' +
          '</div>' +
          '<div class="account-page-v1__identity is-local"><div class="account-page-v1__avatar" aria-hidden="true"></div><strong>IRGEZTNE</strong><span>' + escapeHtml(t('Вход не выполнен', 'Not signed in')) + '</span></div>' +
        '</section>' +
        '<div class="account-page-v1__grid">' + pendingHtml +
          '<section class="account-page-v1__card">' +
            '<span class="account-page-v1__eyebrow">' + escapeHtml(t('ЗАЩИТА УСТРОЙСТВА', 'DEVICE PROTECTION')) + '</span>' +
            '<h3>' + escapeHtml(secureOk ? t('Ключ устройства хранится локально', 'Device key stays local') : t('Защищённое хранилище недоступно', 'Protected storage unavailable')) + '</h3>' +
            '<p>' + escapeHtml(secureOk ? t(
              'Приватный ключ остаётся на этом компьютере и не передаётся браузеру.',
              'The private key stays on this computer and is never sent to the browser.'
            ) : t(
              'Постоянное подключение аккаунта будет доступно после восстановления защищённого хранилища системы.',
              'Persistent Account connection will be available after protected system storage is restored.'
            )) + '</p>' +
          '</section>' +
        '</div>' +
        '<section class="account-page-v1__local-note"><strong>' + escapeHtml(t('Локально по умолчанию.', 'Local by default.')) + '</strong><span>' + escapeHtml(t('Файлы, проекты, Офис, заметки, задачи, инструменты и локальная работа Веб-студии не требуют аккаунта.', 'Files, Projects, Office, Notes, Tasks, Tools and local Web Studio work do not require an Account.')) + '</span></section>' +
      '</div>';
    }

    let content = '';
    if (accountSurfaceView === 'profile') {
      content = '<section class="account-v24__panel">' +
        '<span class="account-v24__eyebrow">' + escapeHtml(t('ПРОФИЛЬ', 'PROFILE')) + '</span>' +
        '<h2>' + escapeHtml(displayName || t('Профиль IRGEZTNE', 'IRGEZTNE profile')) + '</h2>' +
        '<div class="account-v24__facts">' +
          '<div><span>Email</span><strong>' + escapeHtml(email || '—') + '</strong></div>' +
          '<div><span>@handle</span><strong>' + escapeHtml(handle ? '@' + handle : '—') + '</strong></div>' +
                  '</div>' +
        '<p>' + escapeHtml(t('Публичный профиль и Account security меняются только через браузерную Account-поверхность, а не через общий Renderer Workspace.', 'Public profile and Account security are changed only through the browser Account surface, not through the shared Workspace Renderer.')) + '</p>' +
        '<div class="account-v24__actions"><button type="button" data-account-surface-action="browser-account">' + escapeHtml(t('Открыть Account в браузере', 'Open Account in browser')) + '</button></div>' +
      '</section>';
    } else if (accountSurfaceView === 'device') {
      content = '<section class="account-v24__panel">' +
        '<span class="account-v24__eyebrow">' + escapeHtml(t('ЭТО УСТРОЙСТВО', 'THIS DEVICE')) + '</span>' +
        '<h2>' + escapeHtml(device.label || 'IRGEZTNE Workspace') + '</h2>' +
        '<div class="account-v24__facts">' +
          '<div><span>' + escapeHtml(t('Платформа', 'Platform')) + '</span><strong>' + escapeHtml(device.platform || '—') + '</strong></div>' +
          '<div><span>' + escapeHtml(t('Статус', 'Status')) + '</span><strong>' + escapeHtml(device.status || '—') + '</strong></div>' +
                            '</div>' +
        '<p>' + escapeHtml(t('Приватный ключ не передаётся Renderer или браузеру. Он используется локальным Main-процессом только для доказательства владения устройством.', 'The private key is not exposed to the Renderer or browser. The Main process uses it locally only to prove device possession.')) + '</p>' +
      '</section>';
    } else if (accountSurfaceView === 'services') {
      content = '<section class="account-v24__panel">' +
        '<span class="account-v24__eyebrow">' + escapeHtml(t('СЕРВИСЫ', 'SERVICES')) + '</span>' +
        '<h2>' + escapeHtml(t('Раздельные права для Chat и Workshop', 'Separate access for Chat and Workshop')) + '</h2>' +
        '<div class="account-v24__service-list">' +
          '<div><div><strong>Chat</strong><span>' + escapeHtml(t('Доступ только к Чату', 'Chat-only access')) + '</span></div>' + statusPill(t('по запросу', 'on demand'), 'ok') + '</div>' +
          '<div><div><strong>Workshop</strong><span>' + escapeHtml(t('Доступ только к Мастерской', 'Workshop-only access')) + '</span></div>' + statusPill(t('по запросу', 'on demand'), 'ok') + '</div>' +
        '</div>' +
        '<p>' + escapeHtml(t('Chat и Workshop не получают master-сессию Account. Main выдаёт каждому сервису только его короткоживущий scoped grant.', 'Chat and Workshop never receive the Account master session. Main issues only a short-lived scoped grant for each service.')) + '</p>' +
      '</section>';
    } else if (accountSurfaceView === 'security') {
      content = '<section class="account-v24__panel">' +
        '<span class="account-v24__eyebrow">' + escapeHtml(t('БЕЗОПАСНОСТЬ', 'SECURITY')) + '</span>' +
        '<h2>' + escapeHtml(t('Browser Account — для чувствительных действий', 'Browser Account for sensitive actions')) + '</h2>' +
        '<p>' + escapeHtml(t('Обычный вход подтверждается кодом из email. Ключ доступа (Passkey) остаётся дополнительной усиленной защитой для важных изменений и восстановления.', 'Normal sign-in may use an email code. Passkey remains optional stronger protection for sensitive changes and recovery.')) + '</p>' +
        '<div class="account-v24__actions"><button type="button" data-account-surface-action="browser-account">' + escapeHtml(t('Открыть безопасность Account', 'Open Account security')) + '</button><button type="button" class="is-danger-soft" data-account-surface-action="logout">' + escapeHtml(t('Отключить Account от Workspace', 'Disconnect Account from Workspace')) + '</button></div>' +
      '</section>';
    } else {
      content = '<section class="account-v24__panel account-v24__panel--accent">' +
        '<div class="account-v24__row"><div><span class="account-v24__eyebrow">' + escapeHtml(t('ПОДКЛЮЧЕНО', 'CONNECTED')) + '</span><h2>' + escapeHtml(displayName || email || 'IRGEZTNE Account') + '</h2></div>' + statusPill(online ? t('ОНЛАЙН', 'ONLINE') : t('ОФЛАЙН', 'OFFLINE'), online ? 'ok' : 'warn') + '</div>' +
        '<p>' + escapeHtml(t('Аккаунт подключён к этой установке Workspace через отдельный ключ устройства и защищённую сессию.', 'Account is connected to this Workspace installation through a separate device key and protected session.')) + '</p>' +
        '<div class="account-v24__facts">' +
          '<div><span>Email</span><strong>' + escapeHtml(email || '—') + '</strong></div>' +
          '<div><span>@handle</span><strong>' + escapeHtml(handle ? '@' + handle : '—') + '</strong></div>' +
          '<div><span>' + escapeHtml(t('Устройство', 'Device')) + '</span><strong>' + escapeHtml(device.label || 'IRGEZTNE Workspace') + '</strong></div>' +
          '<div><span>' + escapeHtml(t('Хранилище ключа', 'Key storage')) + '</span><strong>' + escapeHtml(secure.available === false ? t('Недоступно', 'Unavailable') : t('Защищено ОС', 'OS protected')) + '</strong></div>' +
        '</div>' +
        '<div class="account-v24__actions"><button type="button" data-account-surface-action="refresh">' + escapeHtml(t('Обновить состояние', 'Refresh status')) + '</button></div>' +
      '</section>';
    }

    return '<div class="account-v24">' +
      '<aside class="account-v24__rail">' +
        '<div class="account-v24__brand"><span>IRGEZTNE</span><strong>Account</strong></div>' +
        '<nav class="account-v24__nav" aria-label="Account">' +
          accountNavigationHtml() +
        '</nav>' +
        '<div class="account-v24__rail-status">' + statusPill(t('Account подключён', 'Account connected'), 'ok') + '</div>' +
      '</aside>' +
      '<main class="account-v24__main">' + content + '</main>' +
    '</div>';
  }

  function renderAccountSurface() {
    const root = accountSurfaceRoot();
    if (!root) return;
    syncAccountShellHeader();
    root.innerHTML = accountSurfaceHtml();
    applyAccountUiState(root);
  }

  function bindAccountSurface() {
    const root = accountSurfaceRoot();
    if (!root || root.dataset.accountV24Bound === '1') return;
    root.dataset.accountV24Bound = '1';
    root.addEventListener('click', async (event) => {
      const viewNode = event.target.closest('[data-account-surface-view]');
      if (viewNode) {
        accountSurfaceView = String(viewNode.getAttribute('data-account-surface-view') || 'profile');
        clearAccountNotice();
        renderAccountSurface();
        return;
      }

      const actionNode = event.target.closest('[data-account-surface-action]');
      if (!actionNode) return;
      const action = String(actionNode.getAttribute('data-account-surface-action') || '');

      if (action === 'recovery-toggle') {
        recoveryPhraseVisible = !recoveryPhraseVisible;
        renderAccountSurface();
        return;
      }
      if (action === 'recovery-generate') {
        try {
          recoveryDraftPhrase = generateRecoveryPhrase();
          recoveryPhraseVisible = true;
          setAccountNotice('success', t('Создана новая фраза. Сохраните её отдельно.', 'A new phrase was generated. Save it separately.'));
        } catch (_) {
          setAccountNotice('error', t('Безопасный генератор системы недоступен. Фраза не создана.', 'The system secure random generator is unavailable. No phrase was created.'));
        }
        renderAccountSurface();
        return;
      }
      if (action === 'recovery-copy') {
        if (recoveryDraftPhrase) {
          await copyText(recoveryDraftPhrase);
          setAccountNotice('success', t('Фраза скопирована. Не сохраняйте её в общедоступном месте.', 'Phrase copied. Do not store it in a public location.'));
        }
        renderAccountSurface();
        return;
      }

      accountUiBusyAction = action;
      clearAccountNotice();
      applyAccountUiState(root);
      try {
        if (action === 'identity-local-create') await createLocalIdentityOnly();
        if (action === 'identity-recovery-provision') await provisionIdentityRecovery();
        if (action === 'identity-recovery-test') await testIdentityRecovery();
        if (action === 'identity-recovery-restore') await restoreIdentityRecovery();
        if (action === 'identity-create') await createIdentityNetworkAccount();
        if (action === 'identity-refresh') await refreshIdentityNetworkAccount();
        if (action === 'identity-profile-save') await updateIdentityNetworkProfile();
        if (action === 'identity-disconnect-local') await disconnectIdentityNetworkAccount();
        if (action === 'legacy-account') openAccount('account');
        if (action === 'desktop-connect') await beginDesktopConnection();
        if (action === 'desktop-complete') await completeDesktopConnection();
        if (action === 'desktop-open-auth') await openDesktopAuthorization();
        if (action === 'desktop-cancel') await cancelDesktopConnection();
        if (action === 'browser-account') openAccount('account');
        if (action === 'logout') await logout();
        if (action === 'refresh') await refreshAccountStatus();
      } finally {
        accountUiBusyAction = '';
        renderAccountSurface();
      }
    });
  }

  function openAccountSurface() {
    requestAccountSurface();
    window.setTimeout(() => {
      bindAccountSurface();
      installAccountShellHeaderGuard();
      ensureAccountCompletionStyles();
      renderAccountSurface();
      scheduleAccountShellHeaderSync();
      void refreshAccountStatus().then(() => {
        renderAccountSurface();
        scheduleAccountShellHeaderSync();
      });
    }, 0);
  }

  function ensureMenu() {
    let menu = document.getElementById('accountMenuV044');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = 'accountMenuV044';
    menu.className = 'account-menu-v044 hidden';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'IRGEZTNE ID');
    document.body.appendChild(menu);

    menu.addEventListener('click', async (event) => {
      const actionNode = event.target.closest('[data-account-action]');
      if (!actionNode) return;

      const action = actionNode.getAttribute('data-account-action');

      if (action === 'device-enroll') {
        await beginDeviceEnrollment();
        renderMenu(menuAnchor);
        return;
      }

      if (action === 'device-revoke') {
        const deviceId = actionNode.getAttribute('data-device-id') || '';
        await revokeAccountDevice(deviceId);
        renderMenu(menuAnchor);
        return;
      }

      if (action === 'device-enroll-cancel') {
        await cancelDeviceEnrollment();
        renderMenu(menuAnchor);
        return;
      }

      if (action === 'device-copy-code') {
        await copyText(cachedEnrollmentContext && cachedEnrollmentContext.code);
        actionNode.classList.add('is-copied');
        window.setTimeout(() => actionNode.classList.remove('is-copied'), 900);
        return;
      }

      if (action === 'device-copy-invite') {
        await copyText(cachedEnrollmentContext && cachedEnrollmentContext.inviteJson);
        actionNode.classList.add('is-copied');
        window.setTimeout(() => actionNode.classList.remove('is-copied'), 900);
        return;
      }

      if (action === 'identity-create') {
        await createIdentityNetworkAccount();
        renderMenu(menuAnchor);
        return;
      }
      if (action === 'identity-refresh') {
        await refreshIdentityNetworkAccount();
        renderMenu(menuAnchor);
        return;
      }
      if (action === 'legacy-account') {
        openAccount('account');
        return;
      }
      if (action === 'desktop-connect') {
        await beginDesktopConnection();
        renderMenu(menuAnchor);
        return;
      }
      if (action === 'desktop-complete') {
        await completeDesktopConnection();
        renderMenu(menuAnchor);
        return;
      }
      if (action === 'desktop-open-auth') {
        await openDesktopAuthorization();
        return;
      }
      if (action === 'desktop-cancel') {
        await cancelDesktopConnection();
        renderMenu(menuAnchor);
        return;
      }
      if (action === 'signin') openAccount('signin');
      if (action === 'signup') openAccount('signup');
      if (action === 'account') openAccount('account');
      if (action === 'logout') await logout();
      if (action === 'dev') await connectDev();

      closeMenu();
    });

    return menu;
  }

  function menuHtml() {
    const identityStatus = identityAccountStatus();
    if (identityStatus && identityAccountBridge()) return identityAccountMenuHtml(identityStatus);
    const state = readState();
    const status = accountStatus();
    const secure = status && status.protected_storage ? status.protected_storage : null;
    const pending = status && status.pending ? status.pending : null;
    const connected = isConnected();
    const protectedAvailable = !secure || Boolean(secure.available);
    const secureText = secure
      ? (secure.available
          ? t('Защищённое хранилище ОС', 'OS-protected storage')
          : t('Защищённое хранилище недоступно', 'Protected storage unavailable'))
      : t('Проверяем защищённое хранилище…', 'Checking protected storage…');

    let accountActions = '';
    if (connected) {
      accountActions = '' +
        '<div class="account-menu-v050__actions">' +
          '<button type="button" class="is-primary" data-account-action="account">' + escapeHtml(t('Управление Account', 'Manage Account')) + '</button>' +
          '<button type="button" data-account-action="logout">' + escapeHtml(t('Выйти', 'Sign out')) + '</button>' +
        '</div>';
    } else if (pending) {
      accountActions = '' +
        '<div class="account-menu-v050__pending">' +
          '<strong>' + escapeHtml(t('Ожидается подтверждение в браузере', 'Waiting for browser approval')) + '</strong>' +
          '<span>' + escapeHtml(t(
            'Подтвердите Account в защищённом браузере, затем завершите подключение здесь.',
            'Approve the Account in the secure browser, then finish the connection here.'
          )) + '</span>' +
        '</div>' +
        '<div class="account-menu-v050__actions is-three">' +
          '<button type="button" class="is-primary" data-account-action="desktop-complete">' + escapeHtml(t('Завершить подключение', 'Finish connection')) + '</button>' +
          '<button type="button" data-account-action="desktop-open-auth">' + escapeHtml(t('Открыть страницу подтверждения', 'Open approval page')) + '</button>' +
          '<button type="button" class="is-danger-soft" data-account-action="desktop-cancel">' + escapeHtml(t('Отменить', 'Cancel')) + '</button>' +
        '</div>';
    } else if (accountBridge()) {
      accountActions = '' +
        '<div class="account-menu-v050__actions">' +
          '<button type="button" class="is-primary" data-account-action="desktop-connect" ' + (protectedAvailable ? '' : 'disabled') + '>' +
            escapeHtml(t('Подключить Account', 'Connect Account')) +
          '</button>' +
          '<button type="button" data-account-action="signup">' + escapeHtml(t('Создать аккаунт', 'Create account')) + '</button>' +
        '</div>' +
        (!protectedAvailable
          ? '<p class="account-menu-v044__note">' + escapeHtml(t(
              'Локальный Workspace продолжает работать. Постоянное подключение Account отключено, пока ОС не предоставляет защищённое хранилище.',
              'Local Workspace still works. Persistent Account connection stays disabled until the OS provides protected storage.'
            )) + '</p>'
          : '');
    } else {
      accountActions = '' +
        '<div class="account-menu-v050__actions">' +
          '<button type="button" class="is-primary" data-account-action="signin">' + escapeHtml(t('Войти', 'Sign in')) + '</button>' +
          '<button type="button" data-account-action="signup">' + escapeHtml(t('Создать аккаунт', 'Create account')) + '</button>' +
        '</div>';
    }

    const identityName = connected
      ? (state.displayName || (status && status.account && status.account.profile && status.account.profile.display_name) || 'IRGEZTNE Account')
      : t('Локальный Workspace', 'Local Workspace');
    const identityDetail = connected
      ? (state.email || (status && status.account && status.account.email) || t('Account подключён', 'Account connected'))
      : t('Файлы и проекты остаются локальными без Account.', 'Files and projects remain local without Account.');
    const trustedDevice = status && status.device ? status.device : null;

    return '' +
      '<div class="account-menu-v050__horizontal">' +
        '<section class="account-menu-v050__pane account-menu-v050__pane--account">' +
          '<div class="account-menu-v050__eyebrow">IRGEZTNE Account</div>' +
          '<div class="account-menu-v044__head">' +
            '<div class="account-menu-v044__avatar"></div>' +
            '<div><strong>' + escapeHtml(identityName) + '</strong><span>' + escapeHtml(identityDetail) + '</span></div>' +
          '</div>' +
          '<div class="account-menu-v044__status ' + (connected ? 'is-connected' : '') + '"><i></i>' +
            escapeHtml(connected ? t('Подключено к Account', 'Connected to Account') : t('Локальный режим', 'Local mode')) +
          '</div>' +
          '<div class="account-menu-v050__security ' + (protectedAvailable ? 'is-ok' : 'is-hold') + '">' +
            '<span>' + escapeHtml(secureText) + '</span>' +
            (secure && secure.backend ? '<code>' + escapeHtml(secure.backend) + '</code>' : '') +
          '</div>' +
          (trustedDevice
            ? '<div class="account-menu-v050__trusted"><span>' + escapeHtml(t('Trusted device', 'Trusted device')) + '</span><strong>' +
                escapeHtml(trustedDevice.label || t('Это устройство Workspace', 'This Workspace device')) +
              '</strong><small>' + escapeHtml([trustedDevice.platform, trustedDevice.status].filter(Boolean).join(' · ')) + '</small></div>'
            : '') +
          accountActions +
          '<p class="account-menu-v044__note">' + escapeHtml(t(
            'Passkey подтверждает человека. Отдельный Device Key подтверждает эту установку Workspace.',
            'A Passkey authenticates the person. A separate Device Key identifies this Workspace installation.'
          )) + '</p>' +
        '</section>' +
        '<section class="account-menu-v050__pane account-menu-v050__pane--messenger">' +
          '<div class="account-menu-v050__pane-head"><div><div class="account-menu-v050__eyebrow">Chat / MLS</div><strong>' +
            escapeHtml(t('Устройства сообщений', 'Messaging devices')) +
          '</strong></div><span>' + escapeHtml(t('отдельный криптослой', 'separate crypto layer')) + '</span></div>' +
          '<p class="account-menu-v050__intro">' + escapeHtml(t(
            'Messenger enrollment остаётся отдельным от Trusted Device Account. Ключи между этими ролями не переиспользуются.',
            'Messenger enrollment remains separate from the Account Trusted Device. Keys are never reused across these roles.'
          )) + '</p>' +
          currentDeviceHtml() +
        '</section>' +
      '</div>';
  }

  function positionMenu(anchor) {
    const btn = anchor || menuAnchor || defaultMenuAnchor();
    const menu = ensureMenu();
    if (!btn || !menu) return;

    const rect = btn.getBoundingClientRect();
    const width = Math.min(760, Math.max(320, window.innerWidth - 20));
    const estimatedHeight = Math.min(620, Math.max(300, menu.scrollHeight || 470));
    const belowTop = rect.bottom + 8;
    const aboveTop = Math.max(10, rect.top - estimatedHeight - 8);
    const top = belowTop + estimatedHeight <= window.innerHeight - 10
      ? belowTop
      : aboveTop;

    menu.style.width = width + 'px';
    menu.style.left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width)) + 'px';
    menu.style.top = Math.max(10, Math.min(window.innerHeight - 20, top)) + 'px';
    menu.style.maxHeight = Math.max(220, window.innerHeight - 20) + 'px';
    menu.style.overflowY = 'auto';
  }

  function renderMenu(anchor) {
    const menu = ensureMenu();
    menu.innerHTML = menuHtml();
    positionMenu(anchor);
  }

  function openMenuFrom(anchor) {
    menuAnchor = anchor || defaultMenuAnchor();
    renderMenu(menuAnchor);
    const menu = ensureMenu();
    menu.classList.remove('hidden');

    accountButtons().forEach((btn) => {
      btn.setAttribute('aria-expanded', String(btn === menuAnchor));
    });

    void refreshAccountStatus();
    void refreshDeviceContext();
  }

  function openMenu() {
    openMenuFrom(defaultMenuAnchor());
  }

  function closeMenu() {
    const menu = ensureMenu();
    menu.classList.add('hidden');
    accountButtons().forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    menuAnchor = null;
  }

  function toggleMenu(anchor) {
    const menu = ensureMenu();
    if (menu.classList.contains('hidden')) openMenuFrom(anchor || defaultMenuAnchor());
    else closeMenu();
  }

  function renderGate(kind) {
    void kind;
    return '<section class="ir-connected-gate">' +
      '<div class="ir-connected-gate-icon"></div>' +
      '<h3>' + escapeHtml(t('Чат требует IRGEZTNE ID', 'Chat requires IRGEZTNE ID')) + '</h3>' +
      '<p>' + escapeHtml(t('Локальные модули работают без аккаунта. Для чата нужны участники, приглашения, лимиты и защита.', 'Local modules work without an account. Chat needs participants, invites, limits, and protection.')) + '</p>' +
    '</section>';
  }

  async function boot() {
    const btn = button();
    if (!btn) return;

    await migrateLegacyState();
    await refreshAccountStatus();
    installAccountShellHeaderGuard();

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAccountSurface();
    });

    document.addEventListener('click', (event) => {
      const menu = ensureMenu();
      if (menu.classList.contains('hidden')) return;
      if (
        menu.contains(event.target) ||
        accountButtons().some((btnNow) => btnNow && btnNow.contains(event.target))
      ) return;
      closeMenu();
    });

    window.addEventListener('resize', () => positionMenu());
    document.addEventListener('irg:language-changed', () => {
      updateButton();
      renderMenu();
      renderAccountSurface();
      scheduleAccountShellHeaderSync();
      // v0.5.1a: global i18n performs a delayed MutationObserver pass.
      // Account owns this expanded surface, so reclaim its title afterwards.
      window.setTimeout(scheduleAccountShellHeaderSync, 90);
    });
    window.addEventListener('irg:language-changed', () => {
      updateButton();
      renderMenu();
      renderAccountSurface();
      scheduleAccountShellHeaderSync();
      // v0.5.1a: keep Account title/subtitle stable after delayed i18n.
      window.setTimeout(scheduleAccountShellHeaderSync, 90);
    });
    window.addEventListener('focus', () => {
      window.setTimeout(() => { void tryFinishDesktopConnectionOnReturn(); }, 300);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) window.setTimeout(() => { void tryFinishDesktopConnectionOnReturn(); }, 300);
    });

    window.IRGEZTNEConnected = Object.assign({}, window.IRGEZTNEConnected || {}, {
      getState: readState,
      saveState: writeState,
      isConnected,
      signIn: beginDesktopConnection,
      logout,
      refreshAccountStatus,
      refreshIdentityAccountStatus,
      createIdentityNetworkAccount,
      refreshIdentityNetworkAccount,
      beginDesktopConnection,
      completeDesktopConnection,
      openDesktopAuthorization,
      cancelDesktopConnection,
      openMenu,
      openMenuFrom,
      openAccountSurface,
      closeMenu,
      renderGate,
      getDeviceContext: () => cachedDeviceContext,
      getDeviceEnrollment: () => cachedEnrollmentContext,
      getDeviceEnrollmentTransport: () => cachedEnrollmentTransport,
      refreshDeviceContext,
      beginDeviceEnrollment,
      cancelDeviceEnrollment,
      revokeAccountDevice,
      getDeviceRevocation: () => cachedDeviceRevocation
    });

    updateButton();
    renderMenu();
    bindAccountSurface();
    renderAccountSurface();
    void refreshDeviceContext();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void boot(); });
  } else {
    void boot();
  }
})();
