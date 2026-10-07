function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function validateConversationId(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw typedError('INVALID_CONVERSATION_ID', 'conversationId must be a non-empty string up to 128 characters')
  }

  if (!/^[A-Za-z0-9_.:/-]+$/.test(value)) {
    throw typedError('INVALID_CONVERSATION_ID', 'conversationId contains unsupported characters')
  }
}

function validateMemberIdentity(value) {
  if (typeof value !== 'string' || value.length < 1) {
    throw typedError('INVALID_MEMBER_IDENTITY', 'memberIdentity must be a non-empty string')
  }

  if (Buffer.byteLength(value, 'utf8') > 64 * 1024) {
    throw typedError('INVALID_MEMBER_IDENTITY', 'memberIdentity exceeds IPC text limit')
  }
}

export function createSecureLocalServiceClientL4(BaseClient) {
  if (typeof BaseClient !== 'function') {
    throw typedError('INVALID_BASE_CLIENT', 'Base SecureLocalServiceClient class is required')
  }

  return class SecureLocalServiceClientL4 extends BaseClient {
    async removeMember(conversationId, memberIdentity) {
      validateConversationId(conversationId)
      validateMemberIdentity(memberIdentity)

      const result = await this.request('remove_member', {
        conversation_id: conversationId,
        member_identity: memberIdentity,
      })

      if (!result || (result.result !== 'REMOVED' && result.result !== 'NOT_PRESENT')) {
        throw typedError(
          'REMOVE_MEMBER_CONTRACT_ERROR',
          'native remove_member returned an unexpected result'
        )
      }

      if (result.conversation_id !== conversationId) {
        throw typedError(
          'REMOVE_MEMBER_CONTRACT_ERROR',
          'native remove_member returned a mismatched conversation_id'
        )
      }

      if (result.removed_member_identity !== memberIdentity) {
        throw typedError(
          'REMOVE_MEMBER_CONTRACT_ERROR',
          'native remove_member returned a mismatched member identity'
        )
      }

      if (result.result === 'REMOVED') {
        if (typeof result.commit_hex !== 'string' || result.commit_hex.length < 2) {
          throw typedError(
            'REMOVE_MEMBER_CONTRACT_ERROR',
            'REMOVED result must contain commit_hex'
          )
        }
      } else if (result.commit_hex !== null) {
        throw typedError(
          'REMOVE_MEMBER_CONTRACT_ERROR',
          'NOT_PRESENT result must not contain a commit'
        )
      }

      return Object.freeze({
        result: result.result,
        conversationId: result.conversation_id,
        memberIdentity: result.removed_member_identity,
        commitHex: result.commit_hex,
        epoch: Number(result.epoch),
        members: Number(result.members),
        active: Boolean(result.active),
      })
    }
  }
}
