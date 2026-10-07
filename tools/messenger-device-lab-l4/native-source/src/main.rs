use hkdf::Hkdf;
use keyring::v1::{Entry, Error as KeyringError};
use openmls::prelude::*;
use openmls::prelude::tls_codec::{
    Deserialize as TlsDeserialize,
    Serialize as TlsSerialize,
};
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::RustCrypto;
use openmls_sqlite_storage::{Codec, Connection, SqliteStorageProvider};
use openmls_traits::OpenMlsProvider;
use rusqlite::{params, types::ValueRef};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::collections::BTreeMap;
use std::error::Error;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use std::panic::{catch_unwind, AssertUnwindSafe};
use zeroize::{Zeroize, Zeroizing};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const SERVICE_VERSION: &str = "0.4N-LAB-L4";
const PROTOCOL_VERSION: u32 = 1;

const ACCOUNT: &str = "device-storage-master-key-v1";
const MASTER_KEY_BYTES: usize = 32;
const KDF_SALT_BYTES: usize = 32;

const MLS_INFO: &[u8] =
    b"IRGEZTNE/Green-Lightning/mls-state-sqlcipher/v1";
const MESSAGE_INFO: &[u8] =
    b"IRGEZTNE/Green-Lightning/message-history-sqlcipher/v1";

const MAX_REQUEST_LINE_BYTES: usize = 4_194_304;
const MAX_TEXT_BYTES: usize = 65_536;
const MAX_WIRE_HEX_CHARS: usize = 4_194_304;

const CIPHERSUITE: Ciphersuite =
    Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;

#[derive(Default, Debug)]
struct JsonCodec;

impl Codec for JsonCodec {
    type Error = serde_json::Error;

    fn to_vec<T: Serialize>(value: &T) -> Result<Vec<u8>, Self::Error> {
        serde_json::to_vec(value)
    }

    fn from_slice<T: DeserializeOwned>(slice: &[u8]) -> Result<T, Self::Error> {
        serde_json::from_slice(slice)
    }
}

type SqliteStore = SqliteStorageProvider<JsonCodec, Connection>;

struct PersistentOpenMlsProvider {
    crypto: RustCrypto,
    storage: SqliteStore,
}

impl PersistentOpenMlsProvider {
    fn from_keyed_connection(
        connection: Connection,
    ) -> Result<Self, Box<dyn Error>> {
        let mut storage =
            SqliteStorageProvider::<JsonCodec, Connection>::new(connection);
        storage.run_migrations()?;

        Ok(Self {
            crypto: RustCrypto::default(),
            storage,
        })
    }
}

impl OpenMlsProvider for PersistentOpenMlsProvider {
    type CryptoProvider = RustCrypto;
    type RandProvider = RustCrypto;
    type StorageProvider = SqliteStore;

    fn storage(&self) -> &Self::StorageProvider {
        &self.storage
    }

    fn crypto(&self) -> &Self::CryptoProvider {
        &self.crypto
    }

    fn rand(&self) -> &Self::RandProvider {
        &self.crypto
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct RootMetadata {
    version: u32,
    salt_hex: String,
    mls_info: String,
    message_info: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeviceMeta {
    version: u32,
    identity: String,
    signing_public_key: Vec<u8>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct ConversationMap {
    version: u32,
    groups: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct Request {
    id: u64,
    op: String,

    #[serde(default)]
    conversation_id: Option<String>,
    #[serde(default)]
    key_package_hex: Option<String>,
    #[serde(default)]
    welcome_hex: Option<String>,
    #[serde(default)]
    commit_hex: Option<String>,
    #[serde(default)]
    plaintext: Option<String>,
    #[serde(default)]
    message_hex: Option<String>,
    #[serde(default)]
    member_identity: Option<String>,

    #[serde(default)]
    message_id: Option<String>,
    #[serde(default)]
    record: Option<Value>,
    #[serde(default)]
    patch: Option<Value>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    read_at: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
struct ProcessHardeningStatus {
    platform: String,
    core_soft: u64,
    core_hard: u64,
    dumpable: i32,
}

#[derive(Debug, Clone, Serialize)]
struct DbHardeningStatus {
    cipher_version: String,
    cipher_memory_security: i64,
    temp_store: i64,
    secure_delete: i64,
}

struct SecureLocalService {
    provider: PersistentOpenMlsProvider,
    message_db: Connection,
    device_meta: DeviceMeta,
    signer: SignatureKeyPair,
    conversations: ConversationMap,
    process_hardening: ProcessHardeningStatus,
    mls_hardening: DbHardeningStatus,
    message_hardening: DbHardeningStatus,
}

impl SecureLocalService {
    fn open(
        data_dir: PathBuf,
        identity: String,
        keyring_service: String,
        process_hardening: ProcessHardeningStatus,
    ) -> Result<Self, Box<dyn Error>> {
        fs::create_dir_all(&data_dir)?;
        restrict_dir(&data_dir)?;

        let ready_path = data_dir.join("STORAGE-READY");
        let mls_path = data_dir.join("mls-state.sqlite");
        let message_path = data_dir.join("message-history.sqlite");

        if ready_path.exists() && (!mls_path.exists() || !message_path.exists()) {
            return Err(
                "secure storage marked ready but an encrypted database is missing; refusing silent recreation"
                    .into(),
            );
        }

        let metadata = ensure_root_metadata(
            &data_dir,
            &keyring_service,
            &mls_path,
            &message_path,
        )?;

        let master = load_master_key(&keyring_service)?;
        let salt = hex_decode(&metadata.salt_hex)?;

        let (mls_key, message_key) =
            derive_database_keys(&master, &salt)?;

        let (message_db, message_hardening) =
            open_sqlcipher(&message_path, &message_key[..])?;
        init_message_schema(&message_db)?;

        let (mls_connection, mls_hardening) =
            open_sqlcipher(&mls_path, &mls_key[..])?;
        let provider =
            PersistentOpenMlsProvider::from_keyed_connection(mls_connection)?;

        let existing_meta: Option<DeviceMeta> =
            local_meta_get(&message_db, "device_meta")?;

        let (device_meta, signer) = if let Some(meta) = existing_meta {
            if meta.identity != identity {
                return Err(
                    "existing secure state belongs to another device identity"
                        .into(),
                );
            }

            let signer = SignatureKeyPair::read(
                provider.storage(),
                &meta.signing_public_key,
                CIPHERSUITE.signature_algorithm(),
            )
            .ok_or(
                "encrypted signing key state missing; refusing silent regeneration",
            )?;

            (meta, signer)
        } else {
            if ready_path.exists() {
                return Err(
                    "secure storage is ready but encrypted device metadata is missing; refusing regeneration"
                        .into(),
                );
            }

            let signer =
                SignatureKeyPair::new(CIPHERSUITE.signature_algorithm())?;
            signer.store(provider.storage())?;

            let meta = DeviceMeta {
                version: 1,
                identity,
                signing_public_key: signer.to_public_vec(),
            };

            local_meta_set(&message_db, "device_meta", &meta)?;
            (meta, signer)
        };

        let conversations: ConversationMap =
            local_meta_get(&message_db, "conversations")?
                .unwrap_or(ConversationMap {
                    version: 1,
                    groups: BTreeMap::new(),
                });

        if !ready_path.exists() {
            local_meta_set(
                &message_db,
                "conversations",
                &conversations,
            )?;
            fs::write(&ready_path, b"v0.4M\n")?;
            restrict_file_if_exists(&ready_path)?;
        }

        Ok(Self {
            provider,
            message_db,
            device_meta,
            signer,
            conversations,
            process_hardening,
            mls_hardening,
            message_hardening,
        })
    }

    fn credential(&self) -> CredentialWithKey {
        CredentialWithKey {
            credential: BasicCredential::new(
                self.device_meta.identity.as_bytes().to_vec(),
            )
            .into(),
            signature_key: self.signer.to_public_vec().into(),
        }
    }

    fn group_config() -> MlsGroupCreateConfig {
        MlsGroupCreateConfig::builder()
            .ciphersuite(CIPHERSUITE)
            .use_ratchet_tree_extension(true)
            .build()
    }

    fn persist_conversations(&self) -> Result<(), String> {
        local_meta_set(
            &self.message_db,
            "conversations",
            &self.conversations,
        )
        .map_err(|e| {
            format!("encrypted conversation metadata write failed: {e}")
        })
    }

    fn group_id_for(
        &self,
        conversation_id: &str,
    ) -> Result<GroupId, String> {
        validate_conversation_id(conversation_id)?;

        let hex = self
            .conversations
            .groups
            .get(conversation_id)
            .ok_or_else(|| {
                "conversation is not joined on this device".to_string()
            })?;

        let bytes = hex_decode(hex)?;
        Ok(GroupId::from_slice(&bytes))
    }

    fn load_group(
        &self,
        conversation_id: &str,
    ) -> Result<MlsGroup, String> {
        let group_id = self.group_id_for(conversation_id)?;

        MlsGroup::load(self.provider.storage(), &group_id)
            .map_err(|e| format!("MLS group load failed: {e:?}"))?
            .ok_or_else(|| {
                "encrypted MLS group missing; refusing silent recreation"
                    .to_string()
            })
    }

    fn store_group_mapping(
        &mut self,
        conversation_id: &str,
        group_id: &GroupId,
    ) -> Result<(), String> {
        validate_conversation_id(conversation_id)?;

        let group_hex = hex_encode(group_id.as_slice());

        if let Some(existing) =
            self.conversations.groups.get(conversation_id)
        {
            if existing != &group_hex {
                return Err(
                    "conversation already maps to a different MLS group"
                        .to_string(),
                );
            }
            return Ok(());
        }

        self.conversations
            .groups
            .insert(conversation_id.to_string(), group_hex);

        self.persist_conversations()
    }

    fn handle(
        &mut self,
        req: Request,
    ) -> Result<Value, ServiceError> {
        match req.op.as_str() {
            "ping" => Ok(json!({
                "service_version": SERVICE_VERSION,
                "protocol_version": PROTOCOL_VERSION,
                "identity": self.device_meta.identity,
                "crypto": "OpenMLS",
                "mls_storage": "SQLCipher",
                "message_storage": "SQLCipher",
                "key_root": "OS Keyring",
                "hardening": "v0.4N"
            })),

            "security_status" => Ok(json!({
                "process": self.process_hardening,
                "mls_database": self.mls_hardening,
                "message_database": self.message_hardening,
                "raw_key_export": false,
                "plaintext_fallback": false
            })),

            // ----- OpenMLS operations -----
            "key_package" => {
                let bundle = KeyPackage::builder()
                    .build(
                        CIPHERSUITE,
                        &self.provider,
                        &self.signer,
                        self.credential(),
                    )
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "KeyPackage build failed: {e:?}"
                        ))
                    })?;

                let bytes = bundle
                    .key_package()
                    .tls_serialize_detached()
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "KeyPackage serialization failed: {e:?}"
                        ))
                    })?;

                Ok(json!({
                    "key_package_hex": hex_encode(&bytes)
                }))
            }

            "create_group" => {
                let conversation_id = required_conversation(&req)?;

                if self
                    .conversations
                    .groups
                    .contains_key(conversation_id)
                {
                    return Err(ServiceError::bad(
                        "conversation already exists on this device",
                    ));
                }

                let group = MlsGroup::new(
                    &self.provider,
                    &self.signer,
                    &Self::group_config(),
                    self.credential(),
                )
                .map_err(|e| {
                    ServiceError::op(format!(
                        "MLS group creation failed: {e:?}"
                    ))
                })?;

                let group_id = group.group_id().clone();
                let epoch = group.epoch().as_u64();
                let members = group.members().count();

                self.store_group_mapping(
                    conversation_id,
                    &group_id,
                )
                .map_err(ServiceError::op)?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "group_id_hex": hex_encode(group_id.as_slice()),
                    "epoch": epoch,
                    "members": members
                }))
            }

            "add_member" => {
                let conversation_id = required_conversation(&req)?;

                let key_package_hex = req
                    .key_package_hex
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad(
                            "key_package_hex is required",
                        )
                    })?;

                validate_wire_hex(key_package_hex)?;

                let key_package_bytes =
                    hex_decode(key_package_hex)
                        .map_err(ServiceError::bad)?;

                let key_package_in =
                    KeyPackageIn::tls_deserialize_exact(
                        &key_package_bytes,
                    )
                    .map_err(|e| {
                        ServiceError::bad(format!(
                            "KeyPackage parse failed: {e:?}"
                        ))
                    })?;

                let key_package = key_package_in
                    .validate(
                        self.provider.crypto(),
                        ProtocolVersion::Mls10,
                    )
                    .map_err(|e| {
                        ServiceError::bad(format!(
                            "KeyPackage validation failed: {e:?}"
                        ))
                    })?;

                let mut group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                let (commit_out, welcome_out, _group_info) =
                    group
                        .add_members(
                            &self.provider,
                            &self.signer,
                            core::slice::from_ref(&key_package),
                        )
                        .map_err(|e| {
                            ServiceError::op(format!(
                                "add member failed: {e:?}"
                            ))
                        })?;

                let commit_bytes = commit_out
                    .tls_serialize_detached()
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "commit serialization failed: {e:?}"
                        ))
                    })?;

                let welcome_bytes = welcome_out
                    .tls_serialize_detached()
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "Welcome serialization failed: {e:?}"
                        ))
                    })?;

                group
                    .merge_pending_commit(&self.provider)
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "merge add commit failed: {e:?}"
                        ))
                    })?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "commit_hex": hex_encode(&commit_bytes),
                    "welcome_hex": hex_encode(&welcome_bytes),
                    "epoch": group.epoch().as_u64(),
                    "members": group.members().count()
                }))
            }

            "remove_member" => {
                let conversation_id = required_conversation(&req)?;

                let member_identity = req
                    .member_identity
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad(
                            "member_identity is required",
                        )
                    })?;

                if member_identity.is_empty() {
                    return Err(ServiceError::bad(
                        "member_identity must not be empty",
                    ));
                }

                if member_identity.as_bytes().len() > MAX_TEXT_BYTES {
                    return Err(ServiceError::bad(
                        "member_identity exceeds limit",
                    ));
                }

                if member_identity == self.device_meta.identity {
                    return Err(ServiceError::bad(
                        "self removal is not allowed by this service operation",
                    ));
                }

                let mut group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                if !group.is_active() {
                    return Err(ServiceError::op(
                        "MLS group is inactive on this device",
                    ));
                }

                // The current secure core uses BasicCredential(identity bytes)
                // for every device. Resolve the target by that exact credential.
                let target_credential: Credential =
                    BasicCredential::new(
                        member_identity.as_bytes().to_vec(),
                    )
                    .into();

                let target_leaf = match group
                    .member_leaf_index(&target_credential)
                {
                    Some(value) => value,
                    None => {
                        // Stable idempotent group-level result. The caller can
                        // combine this with its Device Registry knowledge to
                        // distinguish a retry from an unknown logical device.
                        return Ok(json!({
                            "result": "NOT_PRESENT",
                            "conversation_id": conversation_id,
                            "removed_member_identity": member_identity,
                            "commit_hex": null,
                            "epoch": group.epoch().as_u64(),
                            "members": group.members().count(),
                            "active": group.is_active()
                        }));
                    }
                };

                let (commit_out, welcome_option, _group_info) = group
                    .remove_members(
                        &self.provider,
                        &self.signer,
                        &[target_leaf],
                    )
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "remove member failed: {e:?}"
                        ))
                    })?;

                if welcome_option.is_some() {
                    return Err(ServiceError::op(
                        "pure MLS removal unexpectedly produced Welcome",
                    ));
                }

                let commit_bytes = commit_out
                    .tls_serialize_detached()
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "remove commit serialization failed: {e:?}"
                        ))
                    })?;

                group
                    .merge_pending_commit(&self.provider)
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "merge pending remove commit failed: {e:?}"
                        ))
                    })?;

                Ok(json!({
                    "result": "REMOVED",
                    "conversation_id": conversation_id,
                    "removed_member_identity": member_identity,
                    "commit_hex": hex_encode(&commit_bytes),
                    "epoch": group.epoch().as_u64(),
                    "members": group.members().count(),
                    "active": group.is_active()
                }))
            }

            "join_group" => {
                let conversation_id = required_conversation(&req)?;

                let welcome_hex = req
                    .welcome_hex
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("welcome_hex is required")
                    })?;

                if self
                    .conversations
                    .groups
                    .contains_key(conversation_id)
                {
                    return Err(ServiceError::bad(
                        "conversation already exists on this device",
                    ));
                }

                validate_wire_hex(welcome_hex)?;
                let welcome_bytes =
                    hex_decode(welcome_hex)
                        .map_err(ServiceError::bad)?;

                let incoming =
                    MlsMessageIn::tls_deserialize_exact(
                        &welcome_bytes,
                    )
                    .map_err(|e| {
                        ServiceError::bad(format!(
                            "Welcome parse failed: {e:?}"
                        ))
                    })?;

                let welcome = match incoming.extract() {
                    MlsMessageBodyIn::Welcome(welcome) => welcome,
                    _ => {
                        return Err(ServiceError::bad(
                            "expected MLS Welcome",
                        ))
                    }
                };

                let staged = catch_unwind(AssertUnwindSafe(|| {
                    StagedWelcome::new_from_welcome(
                        &self.provider,
                        Self::group_config().join_config(),
                        welcome,
                        None,
                    )
                }));

                let staged = match staged {
                    Ok(Ok(value)) => value,
                    Ok(Err(error)) => {
                        return Err(ServiceError::op(format!(
                            "Welcome processing rejected: {error:?}"
                        )))
                    }
                    Err(_) => {
                        return Err(ServiceError::crypto_fault(
                            "crypto engine fault while processing Welcome",
                        ))
                    }
                };

                let group = staged
                    .into_group(&self.provider)
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "join group failed: {e:?}"
                        ))
                    })?;

                let group_id = group.group_id().clone();
                let epoch = group.epoch().as_u64();
                let members = group.members().count();

                self.store_group_mapping(
                    conversation_id,
                    &group_id,
                )
                .map_err(ServiceError::op)?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "group_id_hex": hex_encode(group_id.as_slice()),
                    "epoch": epoch,
                    "members": members
                }))
            }

            "apply_commit" => {
                let conversation_id = required_conversation(&req)?;

                let commit_hex = req
                    .commit_hex
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("commit_hex is required")
                    })?;

                validate_wire_hex(commit_hex)?;
                let commit_bytes =
                    hex_decode(commit_hex)
                        .map_err(ServiceError::bad)?;

                let mut group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                let processed = process_protocol_boundary(
                    &mut group,
                    &self.provider,
                    &commit_bytes,
                )?;

                let staged = match processed.into_content() {
                    ProcessedMessageContent::StagedCommitMessage(
                        staged,
                    ) => *staged,
                    _ => {
                        return Err(ServiceError::bad(
                            "expected staged MLS commit",
                        ))
                    }
                };

                group
                    .merge_staged_commit(
                        &self.provider,
                        staged,
                    )
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "merge staged commit failed: {e:?}"
                        ))
                    })?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "epoch": group.epoch().as_u64(),
                    "members": group.members().count(),
                    "active": group.is_active()
                }))
            }

            "encrypt" => {
                let conversation_id = required_conversation(&req)?;

                let plaintext = req
                    .plaintext
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("plaintext is required")
                    })?;

                if plaintext.as_bytes().len() > MAX_TEXT_BYTES {
                    return Err(ServiceError::bad(
                        "plaintext exceeds Messenger text limit",
                    ));
                }

                let mut group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                if !group.is_active() {
                    return Err(ServiceError::op(
                        "MLS group is inactive on this device",
                    ));
                }

                let out = group
                    .create_message(
                        &self.provider,
                        &self.signer,
                        plaintext.as_bytes(),
                    )
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "encrypt failed: {e:?}"
                        ))
                    })?;

                let bytes = out
                    .tls_serialize_detached()
                    .map_err(|e| {
                        ServiceError::op(format!(
                            "message serialization failed: {e:?}"
                        ))
                    })?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "message_hex": hex_encode(&bytes)
                }))
            }

            "decrypt" => {
                let conversation_id = required_conversation(&req)?;

                let message_hex = req
                    .message_hex
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("message_hex is required")
                    })?;

                validate_wire_hex(message_hex)?;
                let bytes =
                    hex_decode(message_hex)
                        .map_err(ServiceError::bad)?;

                let mut group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                let processed = process_protocol_boundary(
                    &mut group,
                    &self.provider,
                    &bytes,
                )?;

                match processed.into_content() {
                    ProcessedMessageContent::ApplicationMessage(app) => {
                        let plaintext = app.into_bytes();
                        let text = String::from_utf8(plaintext)
                            .map_err(|_| {
                                ServiceError::bad(
                                    "decrypted payload is not UTF-8 text",
                                )
                            })?;

                        Ok(json!({
                            "conversation_id": conversation_id,
                            "plaintext": text
                        }))
                    }
                    _ => Err(ServiceError::bad(
                        "expected MLS application message",
                    )),
                }
            }

            "group_status" => {
                let conversation_id = required_conversation(&req)?;

                let group = self
                    .load_group(conversation_id)
                    .map_err(ServiceError::op)?;

                Ok(json!({
                    "conversation_id": conversation_id,
                    "group_id_hex": hex_encode(group.group_id().as_slice()),
                    "epoch": group.epoch().as_u64(),
                    "members": group.members().count(),
                    "active": group.is_active()
                }))
            }

            // ----- Encrypted local message-store operations -----
            "store_stage_outgoing" => {
                let record = required_record(&req)?;
                let message_id = record_message_id(record)?;

                if db_get_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .is_some()
                {
                    return Err(ServiceError::bad(
                        "outgoing message_id already exists",
                    ));
                }

                db_put_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                    record,
                    false,
                )
                .map_err(ServiceError::store)?;

                Ok(json!({ "stored": true }))
            }

            "store_update_outgoing" => {
                let message_id = required_message_id(&req)?;
                let patch = required_patch(&req)?;

                let current = db_get_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .ok_or_else(|| {
                    ServiceError::bad("outgoing message not found")
                })?;

                let updated = merge_json_objects(current, patch.clone())
                    .map_err(ServiceError::bad)?;

                db_put_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                    &updated,
                    true,
                )
                .map_err(ServiceError::store)?;

                Ok(updated)
            }

            "store_advance_outgoing_status" => {
                let message_id = required_message_id(&req)?;
                let status = req
                    .status
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("status is required")
                    })?;

                let patch = req
                    .patch
                    .clone()
                    .unwrap_or_else(|| json!({}));

                let current = db_get_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .ok_or_else(|| {
                    ServiceError::bad("outgoing message not found")
                })?;

                let current_status = current
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();

                let chosen_status =
                    if status_rank(status) >= status_rank(&current_status) {
                        status.to_string()
                    } else {
                        current_status
                    };

                let mut updated = merge_json_objects(current, patch)
                    .map_err(ServiceError::bad)?;

                let object = updated
                    .as_object_mut()
                    .ok_or_else(|| {
                        ServiceError::bad(
                            "outgoing record is not an object",
                        )
                    })?;

                object.insert(
                    "status".to_string(),
                    Value::String(chosen_status),
                );

                db_put_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                    &updated,
                    true,
                )
                .map_err(ServiceError::store)?;

                Ok(updated)
            }

            "store_get_outgoing" => {
                let message_id = required_message_id(&req)?;

                Ok(db_get_json(
                    &self.message_db,
                    "outgoing",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .unwrap_or(Value::Null))
            }

            "store_list_outgoing" => {
                Ok(Value::Array(
                    db_list_json(
                        &self.message_db,
                        "outgoing",
                    )
                    .map_err(ServiceError::store)?,
                ))
            }

            "store_list_outbox" => {
                let all = db_list_json(
                    &self.message_db,
                    "outgoing",
                )
                .map_err(ServiceError::store)?;

                let filtered = all
                    .into_iter()
                    .filter(|item| {
                        matches!(
                            item.get("status").and_then(Value::as_str),
                            Some("encrypt_pending") | Some("queued")
                        )
                    })
                    .collect::<Vec<_>>();

                Ok(Value::Array(filtered))
            }

            "store_has_inbox" => {
                let message_id = required_message_id(&req)?;

                let found = db_get_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .is_some();

                Ok(json!({ "found": found }))
            }

            "store_add_inbox" => {
                let record = required_record(&req)?;
                let message_id = record_message_id(record)?;

                let existing = db_get_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .is_some();

                if existing {
                    return Ok(json!({ "inserted": false }));
                }

                db_put_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                    record,
                    false,
                )
                .map_err(ServiceError::store)?;

                Ok(json!({ "inserted": true }))
            }

            "store_get_inbox" => {
                let message_id = required_message_id(&req)?;

                Ok(db_get_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .unwrap_or(Value::Null))
            }

            "store_list_inbox" => {
                Ok(Value::Array(
                    db_list_json(
                        &self.message_db,
                        "inbox",
                    )
                    .map_err(ServiceError::store)?,
                ))
            }

            "store_mark_inbox_read" => {
                let message_id = required_message_id(&req)?;
                let read_at = req
                    .read_at
                    .as_deref()
                    .ok_or_else(|| {
                        ServiceError::bad("read_at is required")
                    })?;

                let current = db_get_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                )
                .map_err(ServiceError::store)?
                .ok_or_else(|| {
                    ServiceError::bad("inbox message not found")
                })?;

                let mut updated = current;
                let object = updated
                    .as_object_mut()
                    .ok_or_else(|| {
                        ServiceError::bad(
                            "inbox record is not an object",
                        )
                    })?;

                let existing = object
                    .get("read_at")
                    .and_then(Value::as_str)
                    .filter(|value| !value.is_empty());

                if existing.is_none() {
                    object.insert(
                        "read_at".to_string(),
                        Value::String(read_at.to_string()),
                    );
                }

                db_put_json(
                    &self.message_db,
                    "inbox",
                    message_id,
                    &updated,
                    true,
                )
                .map_err(ServiceError::store)?;

                Ok(updated)
            }

            "store_add_error" => {
                let record = required_record(&req)?;

                self.message_db
                    .execute(
                        "INSERT INTO errors(record_json) VALUES (?1);",
                        params![serde_json::to_string(record)
                            .map_err(|e| ServiceError::store(e.to_string()))?],
                    )
                    .map_err(|e| {
                        ServiceError::store(format!(
                            "insert encrypted error record failed: {e}"
                        ))
                    })?;

                Ok(json!({ "stored": true }))
            }

            "store_list_errors" => {
                let mut statement = self
                    .message_db
                    .prepare(
                        "SELECT record_json FROM errors ORDER BY seq ASC;",
                    )
                    .map_err(|e| {
                        ServiceError::store(format!(
                            "prepare error list failed: {e}"
                        ))
                    })?;

                let rows = statement
                    .query_map([], |row| row.get::<_, String>(0))
                    .map_err(|e| {
                        ServiceError::store(format!(
                            "query errors failed: {e}"
                        ))
                    })?;

                let mut values = Vec::new();

                for row in rows {
                    let text = row.map_err(|e| {
                        ServiceError::store(format!(
                            "read error row failed: {e}"
                        ))
                    })?;

                    values.push(
                        serde_json::from_str(&text).map_err(|e| {
                            ServiceError::store(format!(
                                "parse encrypted error JSON failed: {e}"
                            ))
                        })?,
                    );
                }

                Ok(Value::Array(values))
            }

            "store_snapshot" => Ok(json!({
                "outgoing": db_list_json(
                    &self.message_db,
                    "outgoing"
                ).map_err(ServiceError::store)?,
                "inbox": db_list_json(
                    &self.message_db,
                    "inbox"
                ).map_err(ServiceError::store)?,
            })),

            "shutdown" => Ok(json!({ "shutdown": true })),

            _ => Err(ServiceError::unknown(
                "operation is not in secure-local-service allowlist",
            )),
        }
    }
}

fn ensure_root_metadata(
    data_dir: &Path,
    keyring_service: &str,
    mls_path: &Path,
    message_path: &Path,
) -> Result<RootMetadata, Box<dyn Error>> {
    let root_path = data_dir.join("storage-root.json");

    if root_path.exists() {
        return load_root_metadata(&root_path);
    }

    if mls_path.exists() || message_path.exists() {
        return Err(
            "encrypted database exists without storage-root metadata; refusing recovery guess"
                .into(),
        );
    }

    create_master_key(keyring_service)?;

    let mut salt = [0u8; KDF_SALT_BYTES];
    getrandom::fill(&mut salt)
        .map_err(|e| format!("OS CSPRNG failed for storage salt: {e}"))?;

    let metadata = RootMetadata {
        version: 1,
        salt_hex: hex_encode(&salt),
        mls_info: String::from_utf8_lossy(MLS_INFO).to_string(),
        message_info: String::from_utf8_lossy(MESSAGE_INFO).to_string(),
    };

    salt.zeroize();

    atomic_write_json(&root_path, &metadata)?;
    restrict_file_if_exists(&root_path)?;

    Ok(metadata)
}

fn load_root_metadata(
    path: &Path,
) -> Result<RootMetadata, Box<dyn Error>> {
    let metadata: RootMetadata =
        serde_json::from_slice(&fs::read(path)?)?;

    if metadata.version != 1
        || metadata.mls_info.as_bytes() != MLS_INFO
        || metadata.message_info.as_bytes() != MESSAGE_INFO
    {
        return Err(
            "storage-root metadata mismatch; refusing silent migration"
                .into(),
        );
    }

    Ok(metadata)
}

fn keyring_entry(service: &str) -> Result<Entry, Box<dyn Error>> {
    Entry::new(service, ACCOUNT)
        .map_err(|e| format!("secure OS keyring unavailable: {e}").into())
}

fn create_master_key(service: &str) -> Result<(), Box<dyn Error>> {
    let entry = keyring_entry(service)?;

    match entry.get_secret() {
        Ok(mut existing) => {
            existing.zeroize();
            return Err(
                "OS keyring entry already exists; refusing replacement"
                    .into(),
            );
        }
        Err(KeyringError::NoEntry) => {}
        Err(e) => {
            return Err(format!(
                "OS keyring could not be queried safely; failing closed: {e}"
            )
            .into())
        }
    }

    let mut master = [0u8; MASTER_KEY_BYTES];
    getrandom::fill(&mut master)
        .map_err(|e| format!("OS CSPRNG failed: {e}"))?;

    entry
        .set_secret(&master)
        .map_err(|e| {
            format!("OS keyring refused master-key storage: {e}")
        })?;

    master.zeroize();
    Ok(())
}

fn load_master_key(
    service: &str,
) -> Result<Zeroizing<Vec<u8>>, Box<dyn Error>> {
    let entry = keyring_entry(service)?;

    let secret = entry.get_secret().map_err(|e| {
        format!(
            "device storage master key unavailable; refusing plaintext fallback/regeneration: {e}"
        )
    })?;

    if secret.len() != MASTER_KEY_BYTES {
        return Err(
            "OS keyring returned invalid master-key length".into(),
        );
    }

    Ok(Zeroizing::new(secret))
}

fn delete_master_key(service: &str) -> Result<(), Box<dyn Error>> {
    let entry = keyring_entry(service)?;

    match entry.delete_credential() {
        Ok(()) => {
            println!("MASTER KEY DELETE: OK");
            Ok(())
        }
        Err(KeyringError::NoEntry) => {
            println!("MASTER KEY DELETE: ALREADY ABSENT");
            Ok(())
        }
        Err(e) => Err(
            format!("master-key delete failed: {e}").into(),
        ),
    }
}

fn derive_database_keys(
    master: &[u8],
    salt: &[u8],
) -> Result<
    (Zeroizing<[u8; 32]>, Zeroizing<[u8; 32]>),
    Box<dyn Error>,
> {
    let hk = Hkdf::<Sha256>::new(Some(salt), master);

    let mut mls = [0u8; 32];
    hk.expand(MLS_INFO, &mut mls)
        .map_err(|_| "HKDF expand failed for MLS database")?;

    let mut messages = [0u8; 32];
    hk.expand(MESSAGE_INFO, &mut messages)
        .map_err(|_| {
            "HKDF expand failed for message database"
        })?;

    if mls == messages {
        mls.zeroize();
        messages.zeroize();
        return Err(
            "domain-separated database keys unexpectedly match".into(),
        );
    }

    Ok((Zeroizing::new(mls), Zeroizing::new(messages)))
}

fn raw_key_pragma(key: &[u8]) -> Zeroizing<String> {
    let mut hex = hex_encode(key);

    let pragma = Zeroizing::new(format!(
        "PRAGMA key = \"x'{}'\"; \
         PRAGMA cipher_memory_security = ON; \
         PRAGMA temp_store = MEMORY; \
         PRAGMA secure_delete = ON;",
        hex
    ));

    hex.zeroize();
    pragma
}

fn open_sqlcipher(
    path: &Path,
    key: &[u8],
) -> Result<(Connection, DbHardeningStatus), Box<dyn Error>> {
    let connection = Connection::open(path)?;

    let pragma = raw_key_pragma(key);
    connection.execute_batch(&pragma)?;

    let cipher_version: String = connection
        .query_row(
            "PRAGMA cipher_version;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            format!(
                "SQLCipher cipher_version unavailable; build is not using SQLCipher: {e}"
            )
        })?;

    if cipher_version.trim().is_empty() {
        return Err(
            "SQLCipher reported an empty cipher version".into(),
        );
    }

    let _: i64 = connection
        .query_row(
            "SELECT count(*) FROM sqlite_master;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            format!("SQLCipher key verification failed: {e}")
        })?;

    let cipher_memory_security =
        query_pragma_flag(
            &connection,
            "PRAGMA cipher_memory_security;",
            "cipher_memory_security",
        )?;

    let temp_store =
        query_pragma_integer(
            &connection,
            "PRAGMA temp_store;",
            "temp_store",
        )?;

    let secure_delete =
        query_pragma_flag(
            &connection,
            "PRAGMA secure_delete;",
            "secure_delete",
        )?;

    let status = DbHardeningStatus {
        cipher_version,
        cipher_memory_security,
        temp_store,
        secure_delete,
    };

    Ok((connection, status))
}


fn query_pragma_flag(
    connection: &Connection,
    sql: &str,
    name: &str,
) -> Result<i64, Box<dyn Error>> {
    connection
        .query_row(sql, [], |row| {
            let value = row.get_ref(0)?;

            match value {
                ValueRef::Integer(number) => Ok(if number == 0 { 0 } else { 1 }),

                ValueRef::Text(bytes) => {
                    let text = std::str::from_utf8(bytes)
                        .map_err(|error| {
                            rusqlite::Error::FromSqlConversionFailure(
                                bytes.len(),
                                rusqlite::types::Type::Text,
                                Box::new(error),
                            )
                        })?
                        .trim()
                        .to_ascii_lowercase();

                    match text.as_str() {
                        "1" | "on" | "true" | "yes" => Ok(1),
                        "0" | "off" | "false" | "no" => Ok(0),
                        _ => Err(
                            rusqlite::Error::InvalidQuery
                        ),
                    }
                }

                other => Err(
                    rusqlite::Error::InvalidColumnType(
                        0,
                        name.to_string(),
                        match other {
                            ValueRef::Null => rusqlite::types::Type::Null,
                            ValueRef::Integer(_) => rusqlite::types::Type::Integer,
                            ValueRef::Real(_) => rusqlite::types::Type::Real,
                            ValueRef::Text(_) => rusqlite::types::Type::Text,
                            ValueRef::Blob(_) => rusqlite::types::Type::Blob,
                        },
                    )
                ),
            }
        })
        .map_err(|error| {
            format!(
                "could not verify PRAGMA {name}: {error}"
            )
            .into()
        })
}

fn query_pragma_integer(
    connection: &Connection,
    sql: &str,
    name: &str,
) -> Result<i64, Box<dyn Error>> {
    connection
        .query_row(sql, [], |row| {
            let value = row.get_ref(0)?;

            match value {
                ValueRef::Integer(number) => Ok(number),

                ValueRef::Text(bytes) => {
                    let text = std::str::from_utf8(bytes)
                        .map_err(|error| {
                            rusqlite::Error::FromSqlConversionFailure(
                                bytes.len(),
                                rusqlite::types::Type::Text,
                                Box::new(error),
                            )
                        })?;

                    text.trim()
                        .parse::<i64>()
                        .map_err(|error| {
                            rusqlite::Error::FromSqlConversionFailure(
                                bytes.len(),
                                rusqlite::types::Type::Text,
                                Box::new(error),
                            )
                        })
                }

                other => Err(
                    rusqlite::Error::InvalidColumnType(
                        0,
                        name.to_string(),
                        match other {
                            ValueRef::Null => rusqlite::types::Type::Null,
                            ValueRef::Integer(_) => rusqlite::types::Type::Integer,
                            ValueRef::Real(_) => rusqlite::types::Type::Real,
                            ValueRef::Text(_) => rusqlite::types::Type::Text,
                            ValueRef::Blob(_) => rusqlite::types::Type::Blob,
                        },
                    )
                ),
            }
        })
        .map_err(|error| {
            format!(
                "could not verify PRAGMA {name}: {error}"
            )
            .into()
        })
}

fn init_message_schema(
    connection: &Connection,
) -> Result<(), Box<dyn Error>> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS outgoing (
            message_id TEXT PRIMARY KEY,
            record_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inbox (
            message_id TEXT PRIMARY KEY,
            record_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS errors (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            record_json TEXT NOT NULL
        );
        ",
    )?;

    Ok(())
}

fn local_meta_get<T: DeserializeOwned>(
    connection: &Connection,
    key: &str,
) -> Result<Option<T>, Box<dyn Error>> {
    let mut statement = connection.prepare(
        "SELECT value_json FROM local_meta WHERE key = ?1;",
    )?;

    let mut rows = statement.query(params![key])?;

    if let Some(row) = rows.next()? {
        let text: String = row.get(0)?;
        Ok(Some(serde_json::from_str(&text)?))
    } else {
        Ok(None)
    }
}

fn local_meta_set<T: Serialize>(
    connection: &Connection,
    key: &str,
    value: &T,
) -> Result<(), Box<dyn Error>> {
    let text = serde_json::to_string(value)?;

    connection.execute(
        "
        INSERT INTO local_meta(key, value_json)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json;
        ",
        params![key, text],
    )?;

    Ok(())
}

fn db_get_json(
    connection: &Connection,
    table: &str,
    message_id: &str,
) -> Result<Option<Value>, String> {
    validate_store_table(table)?;

    let sql = format!(
        "SELECT record_json FROM {table} WHERE message_id = ?1;"
    );

    let mut statement =
        connection.prepare(&sql).map_err(|e| e.to_string())?;

    let mut rows =
        statement.query(params![message_id])
            .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let text: String =
            row.get(0).map_err(|e| e.to_string())?;

        Ok(Some(
            serde_json::from_str(&text)
                .map_err(|e| e.to_string())?,
        ))
    } else {
        Ok(None)
    }
}

fn db_list_json(
    connection: &Connection,
    table: &str,
) -> Result<Vec<Value>, String> {
    validate_store_table(table)?;

    let sql = format!(
        "SELECT record_json FROM {table} ORDER BY rowid ASC;"
    );

    let mut statement =
        connection.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut values = Vec::new();

    for row in rows {
        let text = row.map_err(|e| e.to_string())?;
        values.push(
            serde_json::from_str(&text)
                .map_err(|e| e.to_string())?,
        );
    }

    Ok(values)
}

fn db_put_json(
    connection: &Connection,
    table: &str,
    message_id: &str,
    value: &Value,
    replace: bool,
) -> Result<(), String> {
    validate_store_table(table)?;

    let text =
        serde_json::to_string(value).map_err(|e| e.to_string())?;

    let sql = if replace {
        format!(
            "
            INSERT INTO {table}(message_id, record_json)
            VALUES (?1, ?2)
            ON CONFLICT(message_id)
            DO UPDATE SET record_json = excluded.record_json;
            "
        )
    } else {
        format!(
            "INSERT INTO {table}(message_id, record_json) VALUES (?1, ?2);"
        )
    };

    connection
        .execute(&sql, params![message_id, text])
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn validate_store_table(table: &str) -> Result<(), String> {
    match table {
        "outgoing" | "inbox" => Ok(()),
        _ => Err("invalid secure-store table".to_string()),
    }
}

fn merge_json_objects(
    mut base: Value,
    patch: Value,
) -> Result<Value, String> {
    let base_map = base
        .as_object_mut()
        .ok_or_else(|| "stored record is not an object".to_string())?;

    let patch_map = patch
        .as_object()
        .ok_or_else(|| "patch is not an object".to_string())?;

    for (key, value) in patch_map {
        base_map.insert(key.clone(), value.clone());
    }

    Ok(base)
}

fn status_rank(status: &str) -> i32 {
    match status {
        "encrypt_pending" => 10,
        "queued" => 20,
        "server_accepted" => 30,
        "delivered" => 40,
        "read" => 50,
        "failed" => 90,
        _ => 0,
    }
}

fn process_protocol_boundary(
    group: &mut MlsGroup,
    provider: &PersistentOpenMlsProvider,
    bytes: &[u8],
) -> Result<ProcessedMessage, ServiceError> {
    let incoming =
        MlsMessageIn::tls_deserialize_exact(bytes)
            .map_err(|e| {
                ServiceError::bad(format!(
                    "MLS wire parse failed: {e:?}"
                ))
            })?;

    let protocol = incoming
        .try_into_protocol_message()
        .map_err(|e| {
            ServiceError::bad(format!(
                "not an MLS protocol message: {e:?}"
            ))
        })?;

    let result = catch_unwind(AssertUnwindSafe(|| {
        group.process_message(provider, protocol)
    }));

    match result {
        Ok(Ok(message)) => Ok(message),
        Ok(Err(error)) => Err(ServiceError::op(format!(
            "OpenMLS rejected incoming message: {error:?}"
        ))),
        Err(_) => Err(ServiceError::crypto_fault(
            "crypto engine fault while processing untrusted MLS input",
        )),
    }
}

#[derive(Debug)]
struct ServiceError {
    code: &'static str,
    message: String,
}

impl ServiceError {
    fn bad(message: impl Into<String>) -> Self {
        Self {
            code: "BAD_REQUEST",
            message: message.into(),
        }
    }

    fn op(message: impl Into<String>) -> Self {
        Self {
            code: "OP_FAILED",
            message: message.into(),
        }
    }

    fn store(message: impl Into<String>) -> Self {
        Self {
            code: "SECURE_STORE_FAILED",
            message: message.into(),
        }
    }

    fn unknown(message: impl Into<String>) -> Self {
        Self {
            code: "UNKNOWN_OP",
            message: message.into(),
        }
    }

    fn crypto_fault(message: impl Into<String>) -> Self {
        Self {
            code: "CRYPTO_ENGINE_FAULT",
            message: message.into(),
        }
    }
}

fn required_conversation(
    req: &Request,
) -> Result<&str, ServiceError> {
    let value = req
        .conversation_id
        .as_deref()
        .ok_or_else(|| {
            ServiceError::bad("conversation_id is required")
        })?;

    validate_conversation_id(value)
        .map_err(ServiceError::bad)?;

    Ok(value)
}

fn required_message_id(
    req: &Request,
) -> Result<&str, ServiceError> {
    let value = req
        .message_id
        .as_deref()
        .ok_or_else(|| ServiceError::bad("message_id is required"))?;

    validate_message_id(value)
        .map_err(ServiceError::bad)?;

    Ok(value)
}

fn required_record(
    req: &Request,
) -> Result<&Value, ServiceError> {
    req.record
        .as_ref()
        .ok_or_else(|| ServiceError::bad("record is required"))
}

fn required_patch(
    req: &Request,
) -> Result<&Value, ServiceError> {
    req.patch
        .as_ref()
        .ok_or_else(|| ServiceError::bad("patch is required"))
}

fn record_message_id(
    record: &Value,
) -> Result<&str, ServiceError> {
    let value = record
        .get("message_id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ServiceError::bad(
                "record.message_id is required",
            )
        })?;

    validate_message_id(value)
        .map_err(ServiceError::bad)?;

    Ok(value)
}

fn validate_conversation_id(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 128 {
        return Err("invalid conversation_id length".to_string());
    }

    if !value.bytes().all(|b| {
        b.is_ascii_alphanumeric()
            || matches!(b, b'-' | b'_' | b'.' | b':' | b'/')
    }) {
        return Err(
            "conversation_id contains unsupported characters"
                .to_string(),
        );
    }

    Ok(())
}

fn validate_message_id(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 128 {
        return Err("invalid message_id length".to_string());
    }

    if !value.bytes().all(|b| {
        b.is_ascii_alphanumeric()
            || matches!(b, b'-' | b'_' | b'.' | b':')
    }) {
        return Err(
            "message_id contains unsupported characters".to_string(),
        );
    }

    Ok(())
}

fn validate_wire_hex(value: &str) -> Result<(), ServiceError> {
    if value.len() > MAX_WIRE_HEX_CHARS {
        return Err(ServiceError::bad(
            "MLS wire value exceeds IPC limit",
        ));
    }

    if value.len() % 2 != 0 {
        return Err(ServiceError::bad(
            "hex value has odd length",
        ));
    }

    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";

    let mut out =
        String::with_capacity(bytes.len() * 2);

    for &byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }

    out
}

fn hex_decode(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 {
        return Err("hex value has odd length".to_string());
    }

    fn nibble(b: u8) -> Option<u8> {
        match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'a'..=b'f' => Some(b - b'a' + 10),
            b'A'..=b'F' => Some(b - b'A' + 10),
            _ => None,
        }
    }

    let raw = value.as_bytes();
    let mut out = Vec::with_capacity(raw.len() / 2);

    let mut i = 0;

    while i < raw.len() {
        let hi = nibble(raw[i])
            .ok_or_else(|| "invalid hex".to_string())?;
        let lo = nibble(raw[i + 1])
            .ok_or_else(|| "invalid hex".to_string())?;

        out.push((hi << 4) | lo);
        i += 2;
    }

    Ok(out)
}

fn atomic_write_json<T: Serialize>(
    path: &Path,
    value: &T,
) -> Result<(), Box<dyn Error>> {
    let tmp = path.with_extension("json.tmp");
    fs::write(
        &tmp,
        serde_json::to_vec_pretty(value)?,
    )?;
    restrict_file_if_exists(&tmp)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn restrict_dir(path: &Path) -> Result<(), Box<dyn Error>> {
    #[cfg(unix)]
    {
        let mut permissions =
            fs::metadata(path)?.permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(path, permissions)?;
    }

    Ok(())
}

fn restrict_file_if_exists(
    path: &Path,
) -> Result<(), Box<dyn Error>> {
    if !path.exists() {
        return Ok(());
    }

    #[cfg(unix)]
    {
        let mut permissions =
            fs::metadata(path)?.permissions();
        permissions.set_mode(0o600);
        fs::set_permissions(path, permissions)?;
    }

    Ok(())
}

fn write_response(
    stdout: &mut io::StdoutLock<'_>,
    value: &Value,
) -> io::Result<()> {
    serde_json::to_writer(&mut *stdout, value)?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}


fn harden_process() -> Result<ProcessHardeningStatus, Box<dyn Error>> {
    #[cfg(target_os = "linux")]
    {
        let limit = libc::rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };

        let set_limit = unsafe {
            libc::setrlimit(libc::RLIMIT_CORE, &limit)
        };

        if set_limit != 0 {
            return Err(
                format!(
                    "failed to disable core dumps with RLIMIT_CORE: {}",
                    std::io::Error::last_os_error()
                )
                .into(),
            );
        }

        let set_dumpable = unsafe {
            libc::prctl(
                libc::PR_SET_DUMPABLE,
                0,
                0,
                0,
                0,
            )
        };

        if set_dumpable != 0 {
            return Err(
                format!(
                    "failed to disable Linux dumpable flag: {}",
                    std::io::Error::last_os_error()
                )
                .into(),
            );
        }

        let mut current = libc::rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };

        let get_limit = unsafe {
            libc::getrlimit(
                libc::RLIMIT_CORE,
                &mut current,
            )
        };

        if get_limit != 0 {
            return Err(
                format!(
                    "failed to verify RLIMIT_CORE: {}",
                    std::io::Error::last_os_error()
                )
                .into(),
            );
        }

        let dumpable = unsafe {
            libc::prctl(
                libc::PR_GET_DUMPABLE,
                0,
                0,
                0,
                0,
            )
        };

        if dumpable < 0 {
            return Err(
                format!(
                    "failed to verify Linux dumpable flag: {}",
                    std::io::Error::last_os_error()
                )
                .into(),
            );
        }

        return Ok(ProcessHardeningStatus {
            platform: "linux".to_string(),
            core_soft: current.rlim_cur as u64,
            core_hard: current.rlim_max as u64,
            dumpable,
        });
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(ProcessHardeningStatus {
            platform: std::env::consts::OS.to_string(),
            core_soft: u64::MAX,
            core_hard: u64::MAX,
            dumpable: -1,
        })
    }
}

fn parse_service_args(
    args: &[String],
) -> Result<(PathBuf, String, String), Box<dyn Error>> {
    let mut data_dir: Option<PathBuf> = None;
    let mut identity: Option<String> = None;
    let mut keyring_service: Option<String> = None;

    let mut i = 1;

    while i < args.len() {
        match args[i].as_str() {
            "--data-dir" => {
                i += 1;
                data_dir = args.get(i).map(PathBuf::from);
            }

            "--identity" => {
                i += 1;
                identity = args.get(i).cloned();
            }

            "--keyring-service" => {
                i += 1;
                keyring_service = args.get(i).cloned();
            }

            other => {
                return Err(
                    format!("unknown argument: {other}").into(),
                )
            }
        }

        i += 1;
    }

    let data_dir =
        data_dir.ok_or("--data-dir is required")?;
    let identity =
        identity.ok_or("--identity is required")?;
    let keyring_service =
        keyring_service.ok_or("--keyring-service is required")?;

    if identity.is_empty() || identity.len() > 256 {
        return Err("invalid identity".into());
    }

    if keyring_service.is_empty()
        || keyring_service.len() > 256
    {
        return Err("invalid keyring service id".into());
    }

    Ok((data_dir, identity, keyring_service))
}

fn main() -> Result<(), Box<dyn Error>> {
    std::panic::set_hook(Box::new(|_| {
        eprintln!(
            "IRGEZTNE Green Lightning secure-local-service: internal processing fault"
        );
    }));

    let process_hardening = harden_process()?;

    let args: Vec<String> = std::env::args().collect();

    if args.get(1).map(String::as_str) == Some("delete-root") {
        let service =
            args.get(2).ok_or("missing keyring service id")?;
        delete_master_key(service)?;
        return Ok(());
    }

    let (data_dir, identity, keyring_service) =
        parse_service_args(&args)?;

    let mut service = SecureLocalService::open(
        data_dir,
        identity,
        keyring_service,
        process_hardening,
    )?;

    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(value) => value,
            Err(error) => {
                eprintln!(
                    "IRGEZTNE secure-local-service stdin error: {error}"
                );
                break;
            }
        };

        if line.is_empty() {
            continue;
        }

        if line.len() > MAX_REQUEST_LINE_BYTES {
            let response = json!({
                "id": 0,
                "ok": false,
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "IPC request exceeds line limit"
                }
            });

            write_response(
                &mut stdout,
                &response,
            )?;

            continue;
        }

        let request: Request =
            match serde_json::from_str(&line) {
                Ok(request) => request,
                Err(_) => {
                    let response = json!({
                        "id": 0,
                        "ok": false,
                        "error": {
                            "code": "BAD_REQUEST",
                            "message": "invalid JSON request"
                        }
                    });

                    write_response(
                        &mut stdout,
                        &response,
                    )?;

                    continue;
                }
            };

        let request_id = request.id;
        let shutdown_requested =
            request.op == "shutdown";

        let response = match service.handle(request) {
            Ok(result) => json!({
                "id": request_id,
                "ok": true,
                "result": result
            }),

            Err(error) => json!({
                "id": request_id,
                "ok": false,
                "error": {
                    "code": error.code,
                    "message": error.message
                }
            }),
        };

        write_response(
            &mut stdout,
            &response,
        )?;

        if shutdown_requested {
            break;
        }
    }

    Ok(())
}
