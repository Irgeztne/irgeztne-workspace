function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export class DeviceRevocationCoordinatorL4 {
  constructor({ registry }) {
    if (!registry) throw typedError('INVALID_REGISTRY', 'Device Registry is required')
    this.registry = registry
  }

  async revokeDevice({
    initiatorClient,
    initiatorIdentity,
    conversationId,
    deviceId,
  }) {
    if (!initiatorClient || typeof initiatorClient.removeMember !== 'function') {
      throw typedError('INVALID_INITIATOR_CLIENT', 'initiatorClient.removeMember is required')
    }

    const target = this.registry.getDevice(deviceId)
    if (!target) {
      throw typedError('DEVICE_UNKNOWN', `Unknown device ${deviceId}`)
    }

    if (target.identity === initiatorIdentity) {
      throw typedError('SELF_REVOKE_DENIED', 'Current initiating device cannot revoke itself')
    }

    if (target.status === 'revoked' && target.mlsRemoval?.status === 'removed') {
      return Object.freeze({
        result: 'ALREADY_REVOKED',
        deviceId,
        memberIdentity: target.identity,
        commitHex: null,
        epoch: Number(target.mlsRemoval.epoch),
        members: Number(target.mlsRemoval.members),
      })
    }

    const previous = this.registry.beginRevoke(deviceId, conversationId)

    try {
      const nativeResult = await initiatorClient.removeMember(
        conversationId,
        target.identity
      )

      // NOT_PRESENT is a valid recovery path only because the Registry already
      // knows this concrete device was a member of this concrete conversation.
      if (nativeResult.result === 'NOT_PRESENT') {
        if (!previous.memberships?.includes(conversationId)) {
          throw typedError(
            'MEMBERSHIP_NOT_PROVEN',
            'Native group does not contain the identity and Registry has no membership record'
          )
        }

        this.registry.completeRevoke(deviceId, conversationId, {
          nativeResult: 'NOT_PRESENT',
          epoch: nativeResult.epoch,
          members: nativeResult.members,
        })

        return Object.freeze({
          result: 'RECOVERED_ALREADY_REMOVED',
          deviceId,
          memberIdentity: target.identity,
          commitHex: null,
          epoch: nativeResult.epoch,
          members: nativeResult.members,
        })
      }

      this.registry.completeRevoke(deviceId, conversationId, {
        nativeResult: 'REMOVED',
        epoch: nativeResult.epoch,
        members: nativeResult.members,
      })

      return Object.freeze({
        result: 'REVOKED',
        deviceId,
        memberIdentity: target.identity,
        commitHex: nativeResult.commitHex,
        epoch: nativeResult.epoch,
        members: nativeResult.members,
      })
    } catch (error) {
      this.registry.failRevoke(deviceId, conversationId, error)
      throw error
    }
  }
}
