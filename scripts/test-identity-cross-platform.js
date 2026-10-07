'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {protectedStorageStatus}=require('../src/identity/identity-secure-store.cjs');
function safe(backend='gnome_libsecret'){return{isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=>backend,encryptString:()=>Buffer.from('x'),decryptString:()=>''}}
test('Windows uses Electron safeStorage DPAPI profile',()=>{const s=protectedStorageStatus(safe(),'win32');assert.equal(s.available,true);assert.equal(s.backend,'windows-dpapi')});
test('macOS uses Electron safeStorage Keychain profile and exposes signing release gate',()=>{const s=protectedStorageStatus(safe(),'darwin');assert.equal(s.available,true);assert.equal(s.backend,'macos-keychain');assert.equal(s.release_requirement,'CONSISTENT_CODE_SIGNING_REQUIRED')});
test('Linux accepts approved secret stores and rejects basic_text/unknown',()=>{assert.equal(protectedStorageStatus(safe('gnome_libsecret'),'linux').available,true);assert.equal(protectedStorageStatus(safe('kwallet6'),'linux').available,true);assert.equal(protectedStorageStatus(safe('basic_text'),'linux').available,false);assert.equal(protectedStorageStatus(safe('unknown'),'linux').available,false)});
test('unsupported desktop OS fails closed',()=>{assert.equal(protectedStorageStatus(safe(),'freebsd').reason,'UNSUPPORTED_IDENTITY_PLATFORM')});
