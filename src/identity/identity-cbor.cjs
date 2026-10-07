'use strict';

// IRGEZTNE Identity deterministic CBOR subset.
// Profile: RFC 8949 core deterministic encoding requirements.
// This encoder deliberately accepts only the data types used by Identity v0.1:
// null, booleans, safe integers/BigInt, byte strings, UTF-8 strings, arrays,
// and plain objects with string keys. No floats, tags, indefinite lengths,
// undefined values, Dates, Maps or class instances are accepted.

function fail(message) {
  const error = new TypeError(message);
  error.code = 'IDENTITY_CBOR_UNSUPPORTED';
  throw error;
}

function uintArgument(major, value) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) fail('CBOR unsigned argument must be non-negative.');
  const prefix = major << 5;
  if (n <= 23n) return Buffer.from([prefix | Number(n)]);
  if (n <= 0xffn) return Buffer.from([prefix | 24, Number(n)]);
  if (n <= 0xffffn) {
    const out = Buffer.alloc(3);
    out[0] = prefix | 25;
    out.writeUInt16BE(Number(n), 1);
    return out;
  }
  if (n <= 0xffffffffn) {
    const out = Buffer.alloc(5);
    out[0] = prefix | 26;
    out.writeUInt32BE(Number(n), 1);
    return out;
  }
  if (n <= 0xffffffffffffffffn) {
    const out = Buffer.alloc(9);
    out[0] = prefix | 27;
    out.writeBigUInt64BE(n, 1);
    return out;
  }
  fail('CBOR integer is outside uint64 range.');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.isBuffer(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function encodeDeterministic(value) {
  if (value === null) return Buffer.from([0xf6]);
  if (value === false) return Buffer.from([0xf4]);
  if (value === true) return Buffer.from([0xf5]);

  if (typeof value === 'bigint') {
    return value >= 0n ? uintArgument(0, value) : uintArgument(1, -1n - value);
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('Identity deterministic CBOR forbids floats and unsafe integers.');
    return value >= 0 ? uintArgument(0, value) : uintArgument(1, BigInt(-1 - value));
  }

  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([uintArgument(3, bytes.length), bytes]);
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const bytes = Buffer.from(value);
    return Buffer.concat([uintArgument(2, bytes.length), bytes]);
  }

  if (Array.isArray(value)) {
    const parts = [uintArgument(4, value.length)];
    for (const item of value) {
      if (item === undefined) fail('Identity deterministic CBOR forbids undefined array items.');
      parts.push(encodeDeterministic(item));
    }
    return Buffer.concat(parts);
  }

  if (isPlainObject(value)) {
    const entries = [];
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (item === undefined) fail('Identity deterministic CBOR forbids undefined object values.');
      const encodedKey = encodeDeterministic(String(key));
      const encodedValue = encodeDeterministic(item);
      entries.push({ encodedKey, encodedValue });
    }
    entries.sort((a, b) => Buffer.compare(a.encodedKey, b.encodedKey));
    const parts = [uintArgument(5, entries.length)];
    for (const entry of entries) parts.push(entry.encodedKey, entry.encodedValue);
    return Buffer.concat(parts);
  }

  fail(`Unsupported Identity CBOR value: ${typeof value}`);
}

module.exports = {
  encodeDeterministic
};
