'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { createRemoteChatController } = require('../src/messenger/remote-chat-main.cjs');
const { __test: messageCodec } = require('../src/messenger/messenger-main.cjs');

const ACCOUNT_SECRET = 'remote-chat-test-internal-secret-0123456789';
const GRANT_A = 'grant-remote-account-a-abcdefghijklmnopqrstuvwxyz';
const GRANT_B = 'grant-remote-account-b-abcdefghijklmnopqrstuvwxyz';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

class FakeSecureService {
  constructor(options, durable) {
    this.options = options;
    this.durable = durable;
  }
  async start() { return this; }
  async close() {}
  async ping() { return { service_version:'fake-v1',protocol_version:'v1',crypto:'OpenMLS',mls_storage:'SQLCipher',message_storage:'SQLCipher',key_root:'OS Keyring',hardening:'test' }; }
  async securityStatus() { return { raw_key_export:false,plaintext_fallback:false,process:'isolated',mls_database:'encrypted',message_database:'encrypted' }; }
  async keyPackage() { return { key_package_hex:Buffer.from(JSON.stringify({identity:this.options.identity})).toString('hex') }; }
  async createGroup(conversationId) {
    if (this.durable.groups[conversationId]) throw new Error('conversation already exists');
    this.durable.groups[conversationId]={secret:`secret-${conversationId}`,members:1,epoch:0,active:true};
    return this.groupStatus(conversationId);
  }
  async groupStatus(conversationId) {
    const group=this.durable.groups[conversationId];
    if (!group) throw new Error('group missing');
    return {group_id_hex:Buffer.from(conversationId).toString('hex'),...clone(group)};
  }
  async addMember(conversationId,keyPackageHex) {
    const group=this.durable.groups[conversationId];
    if (!group) throw new Error('group missing');
    const member=JSON.parse(Buffer.from(keyPackageHex,'hex').toString('utf8'));
    group.members=2; group.epoch+=1;
    const welcome={conversationId,secret:group.secret,members:2,epoch:group.epoch,member:member.identity};
    return {welcome_hex:Buffer.from(JSON.stringify(welcome)).toString('hex'),commit_hex:Buffer.from('commit').toString('hex')};
  }
  async joinGroup(conversationId,welcomeHex) {
    const welcome=JSON.parse(Buffer.from(welcomeHex,'hex').toString('utf8'));
    assert.equal(welcome.conversationId,conversationId);
    this.durable.groups[conversationId]={secret:welcome.secret,members:2,epoch:welcome.epoch,active:true};
    return this.groupStatus(conversationId);
  }
  async encrypt(conversationId,plaintext) {
    const group=this.durable.groups[conversationId];
    if (!group) throw new Error('group missing');
    return {message_hex:Buffer.from(JSON.stringify({secret:group.secret,plaintext})).toString('hex')};
  }
  async decrypt(conversationId,messageHex) {
    const group=this.durable.groups[conversationId];
    const packet=JSON.parse(Buffer.from(messageHex,'hex').toString('utf8'));
    if (!group || packet.secret!==group.secret) throw new Error('decrypt failed');
    return {plaintext:packet.plaintext};
  }
  async stageOutgoing(record) { this.durable.outgoing[record.message_id]=clone(record); }
  async updateOutgoing(messageId,patch) { Object.assign(this.durable.outgoing[messageId],clone(patch)); }
  async advanceOutgoingStatus(messageId,status,patch={}) { Object.assign(this.durable.outgoing[messageId],clone(patch),{status}); }
  async getOutgoing(messageId) { return this.durable.outgoing[messageId] ? clone(this.durable.outgoing[messageId]) : null; }
  async listOutgoing() { return Object.values(this.durable.outgoing).map(clone); }
  async listOutbox() { return Object.values(this.durable.outgoing).filter((x)=>!['delivered','read'].includes(x.status)).map(clone); }
  async hasInbox(messageId) { return Boolean(this.durable.inbox[messageId]); }
  async addInbox(messageId,record) { if (this.durable.inbox[messageId]) return false; this.durable.inbox[messageId]=clone(record); return true; }
  async listInbox() { return Object.values(this.durable.inbox).map(clone); }
}

function serviceFactoryFor(store) {
  return async (options) => {
    let durable=store.get(options.dataDir);
    if (!durable) { durable={groups:{},outgoing:{},inbox:{}}; store.set(options.dataDir,durable); }
    return new FakeSecureService(options,durable);
  };
}

function appAt(userData) { return { getPath(name) { assert.equal(name,'userData'); return userData; } }; }

(async()=>{
  const serviceRoot=path.resolve(__dirname,'../../irgeztne-services/chat-service');
  const worker=(await import(pathToFileURL(path.join(serviceRoot,'src/index.js')).href)).default;
  const {createChatD1}=await import(pathToFileURL(path.join(serviceRoot,'test/sqlite-d1.mjs')).href);
  const db=createChatD1();
  const accountIds=new Map([[GRANT_A,'acct-A'],[GRANT_B,'acct-B']]);
  const env={
    CHAT_DB:db,
    CHAT_V0_ENABLED:'true',
    ACCOUNT_INTERNAL_SERVICE_VERIFY_TOKEN:ACCOUNT_SECRET,
    __TEST_NOW_SECONDS:1_800_000_000,
    ACCOUNT_VERIFIER:{
      async fetch(request){
        if(request.headers.get('IRGEZTNE-Internal-Service-Verify')!==ACCOUNT_SECRET) return new Response('{}',{status:403});
        const match=/^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization')||'');
        const accountId=match&&accountIds.get(match[1]);
        return accountId
          ? new Response(JSON.stringify({ok:true,grant:{account_id:accountId,service:'CHAT',scopes:['chat:access'],expires_at:1_800_000_900}}),{status:200,headers:{'Content-Type':'application/json'}})
          : new Response('{}',{status:401});
      }
    }
  };
  const fetchImpl=(url,init)=>worker.fetch(new Request(url,init),env);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-chat-remote-'));
  const appA=appAt(path.join(root,'a'));
  const appB=appAt(path.join(root,'b'));
  const durableServices=new Map();
  const common={
    runtimeDir:path.join(path.resolve(__dirname,'..'),'src/messenger/native-runtime'),
    fetchImpl,
    chatServiceBaseUrl:'https://chat.test',
    keyringServicePrefix:'com.irgeztne.test',
    serviceFactory:serviceFactoryFor(durableServices),
    encodeTextPayload:messageCodec.encodeApplicationPayload,
    projectMessage:messageCodec.safeMessage
  };
  const makeA=()=>createRemoteChatController({...common,app:appA,accountServiceGrantProvider:async()=>({token:GRANT_A,service:'CHAT'})});
  const makeB=()=>createRemoteChatController({...common,app:appB,accountServiceGrantProvider:async()=>({token:GRANT_B,service:'CHAT'})});

  let a=makeA();
  let b=makeB();
  try {
    const created=await a.createDirectInvite();
    assert.equal(created.ok,true); assert.match(created.invite.token,/^[A-Za-z0-9_-]{32,256}$/);
    const joined=await b.joinDirectInvite(created.invite.token);
    assert.equal(joined.ok,true); assert.equal(joined.conversation.ready,false);
    const aReady=await a.refreshRemoteTransport();
    assert.equal(aReady.ok,true); assert.equal(aReady.conversation.ready,true);
    const bReady=await b.refreshRemoteTransport();
    assert.equal(bReady.ok,true); assert.equal(bReady.conversation.ready,true);

    const sentA=await a.sendLocalText('hello from A');
    assert.equal(sentA.ok,true,JSON.stringify(sentA));
    let receivedB=await b.refreshRemoteTransport();
    assert.equal(receivedB.conversation.messages.some((m)=>m.direction==='incoming'&&m.text==='hello from A'),true);
    const incoming=receivedB.conversation.messages.find((m)=>m.text==='hello from A');
    const sentB=await b.sendLocalText('reply from B',{replyToId:incoming.id});
    assert.equal(sentB.ok,true);
    let receivedA=await a.refreshRemoteTransport();
    assert.equal(receivedA.conversation.messages.some((m)=>m.direction==='incoming'&&m.text==='reply from B'),true);

    await a.close(); await b.close();
    a=makeA(); b=makeB();
    const [restartA,restartB]=await Promise.all([a.getConversation(),b.getConversation()]);
    assert.equal(restartA.ok,true); assert.equal(restartB.ok,true);
    assert.equal(restartA.conversation.messages.length,2);
    assert.equal(restartB.conversation.messages.length,2);
    assert.equal((await a.status()).mode,'remote-online');
    assert.equal((await b.status()).mode,'remote-online');

    const columns=db.raw.prepare('PRAGMA table_info(message_envelopes)').all().map((x)=>x.name);
    assert.equal(columns.includes('plaintext'),false);
    assert.equal(columns.includes('text'),false);
    console.log('CHAT REMOTE CLOSURE v1 PASS — invite, MLS handshake, ciphertext roundtrip, decrypt, polling, restart');
  } finally {
    try { await a.close(); } catch (_) {}
    try { await b.close(); } catch (_) {}
    db.close();
    fs.rmSync(root,{recursive:true,force:true});
  }
})().catch((error)=>{ console.error(error); process.exitCode=1; });
