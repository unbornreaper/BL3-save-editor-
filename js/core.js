/*
 * BL3 Save Editor - core codecs
 *   - Protobuf (schema driven, proto3)
 *   - GVAS container + PC / PS4 save & profile obfuscation
 *   - Item serial numbers (BL3(...) codes)
 *
 * Crypto keys and serial format: credit to Gibbed, apocalyptech (bl3-cli-saveedit)
 * and FromDarkHell (BL3SaveEditor). See README for licenses.
 */
(function (root) {
  'use strict';
  const BL3 = root.BL3 = root.BL3 || {};
  const D = () => root.BL3_DATA;

  // ======================================================================
  // Small helpers
  // ======================================================================
  const te = new TextEncoder();
  const td = new TextDecoder('utf-8');

  function concat(chunks) {
    let len = 0;
    for (const c of chunks) len += c.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function b64encode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64decode(str) {
    const s = atob(str.replace(/\s+/g, ''));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function hex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  BL3.util = { concat, crc32, b64encode, b64decode, bytesEqual, hex, te, td };

  // ======================================================================
  // Protobuf
  // ======================================================================
  const VARINT_TYPES = new Set(['int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'bool', 'enum']);
  const F32_TYPES = new Set(['float', 'fixed32', 'sfixed32']);
  const F64_TYPES = new Set(['double', 'fixed64', 'sfixed64']);
  const LEN_SCALARS = new Set(['string', 'bytes']);

  class PBReader {
    constructor(buf, start, end) { this.buf = buf; this.pos = start || 0; this.end = end === undefined ? buf.length : end; }
    eof() { return this.pos >= this.end; }
    varint() {
      // fast path for values < 2^49, BigInt path for long ones
      let result = 0, mul = 1, b, i = 0;
      const start = this.pos;
      do {
        if (this.pos >= this.end) throw new Error('Truncated varint');
        b = this.buf[this.pos++];
        if (i >= 7) { this.pos = start; return this.bigVarint(); }
        result += (b & 0x7F) * mul;
        mul *= 128; i++;
      } while (b & 0x80);
      return result;
    }
    bigVarint() {
      let result = 0n, shift = 0n, b;
      do {
        if (this.pos >= this.end) throw new Error('Truncated varint');
        b = this.buf[this.pos++];
        result |= BigInt(b & 0x7F) << shift;
        shift += 7n;
        if (shift > 70n) throw new Error('Varint too long');
      } while (b & 0x80);
      return result;
    }
    bytes(n) {
      if (this.pos + n > this.end) throw new Error('Truncated field');
      const out = this.buf.subarray(this.pos, this.pos + n);
      this.pos += n;
      return out;
    }
  }

  function toInt(v, type) {
    // v is Number or BigInt (raw unsigned varint)
    const big = typeof v === 'bigint' ? v : BigInt(v);
    switch (type) {
      case 'int32': case 'enum': return Number(BigInt.asIntN(32, big));
      case 'uint32': return Number(BigInt.asUintN(32, big));
      case 'bool': return big !== 0n;
      case 'sint32': { const n = Number(BigInt.asUintN(32, big)); return (n >>> 1) ^ -(n & 1); }
      case 'int64': { const r = BigInt.asIntN(64, big); return (r <= 9007199254740991n && r >= -9007199254740991n) ? Number(r) : r; }
      case 'uint64': { const r = BigInt.asUintN(64, big); return r <= 9007199254740991n ? Number(r) : r; }
      case 'sint64': { const r = (big >> 1n) ^ -(big & 1n); return Number(r); }
    }
    throw new Error('bad int type ' + type);
  }

  function decodeScalarFrom(r, type, wt) {
    if (VARINT_TYPES.has(type)) {
      if (wt !== 0) throw new Error('wire type mismatch');
      return toInt(r.varint(), type);
    }
    if (F32_TYPES.has(type)) {
      if (wt !== 5) throw new Error('wire type mismatch');
      const b = r.bytes(4);
      const dv = new DataView(b.buffer, b.byteOffset, 4);
      return type === 'float' ? dv.getFloat32(0, true) : type === 'fixed32' ? dv.getUint32(0, true) : dv.getInt32(0, true);
    }
    if (F64_TYPES.has(type)) {
      if (wt !== 1) throw new Error('wire type mismatch');
      const b = r.bytes(8);
      const dv = new DataView(b.buffer, b.byteOffset, 8);
      return type === 'double' ? dv.getFloat64(0, true) : type === 'fixed64' ? dv.getBigUint64(0, true) : dv.getBigInt64(0, true);
    }
    throw new Error('unknown scalar ' + type);
  }

  function skipField(r, wt) {
    const start = r.pos;
    switch (wt) {
      case 0: r.varint(); break;
      case 1: r.bytes(8); break;
      case 2: { const n = Number(r.varint()); r.bytes(n); break; }
      case 5: r.bytes(4); break;
      default: throw new Error('bad wire type ' + wt);
    }
    return r.buf.subarray(start, r.pos);
  }

  function pbDecode(buf, typeName, start, end, stats) {
    const schema = D().schema;
    const fields = schema[typeName];
    if (!fields) throw new Error('No schema for ' + typeName);
    const obj = {};
    // initialise repeated fields
    for (const num in fields) if (fields[num][2]) obj[fields[num][0]] = [];
    const r = new PBReader(buf, start, end);
    while (!r.eof()) {
      const tag = Number(r.varint());
      const num = Math.floor(tag / 8), wt = tag & 7;
      if (num === 0) throw new Error('Field number 0');
      const f = fields[num];
      if (!f) {
        const raw = skipField(r, wt);
        (obj.__unk = obj.__unk || []).push({ num, wt, raw: raw.slice() });
        if (stats) stats.unknown++;
        continue;
      }
      const [name, type, rep] = f;
      let val;
      if (type === 'string' || type === 'bytes') {
        if (wt !== 2) throw new Error('wire type mismatch on ' + typeName + '.' + name);
        const n = Number(r.varint());
        const b = r.bytes(n);
        if (type === 'string') {
          val = td.decode(b);
          if (stats && /[\u0000-\u0008�]/.test(val)) stats.badStrings++;
        } else val = b.slice();
      } else if (schema[type]) {
        if (wt !== 2) throw new Error('wire type mismatch on ' + typeName + '.' + name);
        const n = Number(r.varint());
        const s = r.pos;
        r.bytes(n);
        val = pbDecode(buf, type, s, s + n, stats);
      } else if (rep && wt === 2) {
        // packed
        const n = Number(r.varint());
        const s = r.pos;
        r.bytes(n);
        const pr = new PBReader(buf, s, s + n);
        const ewt = VARINT_TYPES.has(type) ? 0 : F32_TYPES.has(type) ? 5 : 1;
        while (!pr.eof()) obj[name].push(decodeScalarFrom(pr, type, ewt));
        obj.__packed = obj.__packed || {};
        obj.__packed[name] = true;
        continue;
      } else {
        try { val = decodeScalarFrom(r, type, wt); }
        catch (e) { throw new Error(e.message + ' on ' + typeName + '.' + name); }
      }
      if (rep) obj[name].push(val); else obj[name] = val;
    }
    // proto3: absent scalar fields mean their default value
    for (const num in fields) {
      const [name, type, rep] = fields[num];
      if (rep || obj[name] !== undefined || schema[type]) continue;
      obj[name] = type === 'string' ? '' : type === 'bytes' ? new Uint8Array(0) : type === 'bool' ? false : 0;
    }
    return obj;
  }

  class PBWriter {
    constructor() { this.chunks = []; this.cur = []; }
    byte(b) { this.cur.push(b); }
    flushCur() { if (this.cur.length) { this.chunks.push(Uint8Array.from(this.cur)); this.cur = []; } }
    raw(bytes) { this.flushCur(); this.chunks.push(bytes); }
    varint(v) {
      if (typeof v === 'bigint') {
        let x = BigInt.asUintN(64, v);
        while (x > 127n) { this.byte(Number(x & 127n) | 128); x >>= 7n; }
        this.byte(Number(x));
        return;
      }
      if (v < 0) { this.varint(BigInt(v)); return; }
      while (v > 127) { this.byte((v % 128) | 128); v = Math.floor(v / 128); }
      this.byte(v);
    }
    tag(num, wt) { this.varint(num * 8 + wt); }
    finish() { this.flushCur(); return concat(this.chunks); }
  }

  function encodeScalarValue(w, type, v) {
    if (VARINT_TYPES.has(type)) {
      if (type === 'bool') { w.varint(v ? 1 : 0); return; }
      if (type === 'sint32') { w.varint(((v << 1) ^ (v >> 31)) >>> 0); return; }
      if (type === 'sint64') { const b = BigInt(v); w.varint((b << 1n) ^ (b >> 63n)); return; }
      if (type === 'uint32') { w.varint(Number(v) >>> 0); return; }
      w.varint(typeof v === 'bigint' ? v : Math.trunc(Number(v)));
      return;
    }
    if (F32_TYPES.has(type)) {
      const b = new Uint8Array(4); const dv = new DataView(b.buffer);
      if (type === 'float') dv.setFloat32(0, v, true); else if (type === 'fixed32') dv.setUint32(0, v, true); else dv.setInt32(0, v, true);
      w.raw(b); return;
    }
    if (F64_TYPES.has(type)) {
      const b = new Uint8Array(8); const dv = new DataView(b.buffer);
      if (type === 'double') dv.setFloat64(0, v, true); else if (type === 'fixed64') dv.setBigUint64(0, BigInt(v), true); else dv.setBigInt64(0, BigInt(v), true);
      w.raw(b); return;
    }
    throw new Error('unknown scalar ' + type);
  }
  function wireType(type) {
    if (VARINT_TYPES.has(type)) return 0;
    if (F32_TYPES.has(type)) return 5;
    if (F64_TYPES.has(type)) return 1;
    return 2;
  }
  function isDefault(type, v) {
    if (v === undefined || v === null) return true;
    if (type === 'string') return v === '';
    if (type === 'bytes') return v.length === 0;
    if (type === 'bool') return !v;
    if (typeof v === 'bigint') return v === 0n;
    if (typeof v === 'number') return v === 0 && !Object.is(v, -0);
    return false;
  }

  function pbEncode(obj, typeName) {
    const schema = D().schema;
    const fields = schema[typeName];
    const w = new PBWriter();
    const nums = Object.keys(fields).map(Number).sort((a, b) => a - b);
    for (const num of nums) {
      const [name, type, rep] = fields[num];
      const v = obj[name];
      if (v === undefined || v === null) continue;
      const isMsg = !!schema[type];
      if (rep) {
        if (!v.length) continue;
        if (isMsg) {
          for (const item of v) { const b = pbEncode(item, type); w.tag(num, 2); w.varint(b.length); w.raw(b); }
        } else if (LEN_SCALARS.has(type)) {
          for (const item of v) { const b = type === 'string' ? te.encode(item) : item; w.tag(num, 2); w.varint(b.length); w.raw(b); }
        } else {
          // proto3 packs repeated numerics by default
          const inner = new PBWriter();
          for (const item of v) encodeScalarValue(inner, type, item);
          const b = inner.finish();
          w.tag(num, 2); w.varint(b.length); w.raw(b);
        }
        continue;
      }
      if (isMsg) {
        const b = pbEncode(v, type); w.tag(num, 2); w.varint(b.length); w.raw(b);
        continue;
      }
      if (isDefault(type, v)) continue;
      if (LEN_SCALARS.has(type)) {
        const b = type === 'string' ? te.encode(v) : v;
        w.tag(num, 2); w.varint(b.length); w.raw(b);
      } else {
        w.tag(num, wireType(type)); encodeScalarValue(w, type, v);
      }
    }
    if (obj.__unk) for (const u of obj.__unk) { w.tag(u.num, u.wt); w.raw(u.raw); }
    return w.finish();
  }

  /** Create an empty message object with repeated fields initialised. */
  function pbNew(typeName, values) {
    const fields = D().schema[typeName];
    const obj = {};
    for (const num in fields) if (fields[num][2]) obj[fields[num][0]] = [];
    return Object.assign(obj, values || {});
  }

  BL3.pb = { decode: (buf, type, stats) => pbDecode(buf, type, 0, buf.length, stats), encode: pbEncode, create: pbNew };

  // ======================================================================
  // Save / profile obfuscation
  // ======================================================================
  const KEYS = {
    save: {
      PC: {
        prefix: [0x71, 0x34, 0x36, 0xB3, 0x56, 0x63, 0x25, 0x5F, 0xEA, 0xE2, 0x83, 0x73, 0xF4, 0x98, 0xB8, 0x18,
          0x2E, 0xE5, 0x42, 0x2E, 0x50, 0xA2, 0x0F, 0x49, 0x87, 0x24, 0xE6, 0x65, 0x9A, 0xF0, 0x7C, 0xD7],
        xor: [0x7C, 0x07, 0x69, 0x83, 0x31, 0x7E, 0x0C, 0x82, 0x5F, 0x2E, 0x36, 0x7F, 0x76, 0xB4, 0xA2, 0x71,
          0x38, 0x2B, 0x6E, 0x87, 0x39, 0x05, 0x02, 0xC6, 0xCD, 0xD8, 0xB1, 0xCC, 0xA1, 0x33, 0xF9, 0xB6],
      },
      PS4: {
        prefix: [0xD1, 0x7B, 0xBF, 0x75, 0x4C, 0xC1, 0x80, 0x30, 0x37, 0x92, 0xBD, 0xD0, 0x18, 0x3E, 0x4A, 0x5F,
          0x43, 0xA2, 0x46, 0xA0, 0xED, 0xDB, 0x2D, 0x9F, 0x56, 0x5F, 0x8B, 0x3D, 0x6E, 0x73, 0xE6, 0xB8],
        xor: [0xFB, 0xFD, 0xFD, 0x51, 0x3A, 0x5C, 0xDB, 0x20, 0xBB, 0x5E, 0xC7, 0xAF, 0x66, 0x6F, 0xB6, 0x9A,
          0x9A, 0x52, 0x67, 0x0F, 0x19, 0x5D, 0xD3, 0x84, 0x15, 0x19, 0xC9, 0x4A, 0x79, 0x67, 0xDA, 0x6D],
      },
    },
    profile: {
      PC: {
        prefix: [0xD8, 0x04, 0xB9, 0x08, 0x5C, 0x4E, 0x2B, 0xC0, 0x61, 0x9F, 0x7C, 0x8D, 0x5D, 0x34, 0x00, 0x56,
          0xE7, 0x7B, 0x4E, 0xC0, 0xA4, 0xD6, 0xA7, 0x01, 0x14, 0x15, 0xA9, 0x93, 0x1F, 0x27, 0x2C, 0x8F],
        xor: [0xE8, 0xDC, 0x3A, 0x66, 0xF7, 0xEF, 0x85, 0xE0, 0xBD, 0x4A, 0xA9, 0x73, 0x57, 0x99, 0x30, 0x8C,
          0x94, 0x63, 0x59, 0xA8, 0xC9, 0xAE, 0xD9, 0x58, 0x7D, 0x51, 0xB0, 0x1E, 0xBE, 0xD0, 0x77, 0x43],
      },
      PS4: {
        prefix: [0xAD, 0x1E, 0x60, 0x4E, 0x42, 0x9E, 0xA9, 0x33, 0xB2, 0xF5, 0x01, 0xE1, 0x02, 0x4D, 0x08, 0x75,
          0xB1, 0xAD, 0x1A, 0x3D, 0xA1, 0x03, 0x6B, 0x1A, 0x17, 0xE6, 0xEC, 0x0F, 0x60, 0x8D, 0xB4, 0xF9],
        xor: [0xBA, 0x0E, 0x86, 0x1D, 0x58, 0xE1, 0x92, 0x21, 0x30, 0xD6, 0xCB, 0xF0, 0xD0, 0x82, 0xD5, 0x58,
          0x36, 0x12, 0xE1, 0xF6, 0x39, 0x44, 0x88, 0xEA, 0x4E, 0xFB, 0x04, 0x74, 0x07, 0x95, 0x3A, 0xA2],
      },
    },
  };

  function decryptPayload(data, key) {
    const out = data.slice();
    for (let i = out.length - 1; i >= 0; i--) {
      let b = i < 32 ? key.prefix[i] : out[i - 32];
      b ^= key.xor[i % 32];
      out[i] ^= b;
    }
    return out;
  }
  function encryptPayload(data, key) {
    const out = data.slice();
    for (let i = 0; i < out.length; i++) {
      let b = i < 32 ? key.prefix[i] : out[i - 32];
      b ^= key.xor[i % 32];
      out[i] ^= b;
    }
    return out;
  }

  // ======================================================================
  // GVAS container
  // ======================================================================
  class BinReader {
    constructor(buf) { this.buf = buf; this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); this.pos = 0; }
    u32() { const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
    u16() { const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
    bytes(n) { if (this.pos + n > this.buf.length) throw new Error('Unexpected end of file'); const b = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return b; }
    str() {
      const len = this.dv.getInt32(this.pos, true); this.pos += 4;
      if (len === 0) return null;
      if (len < 0) { // UTF-16
        const n = -len * 2; const b = this.bytes(n);
        let s = ''; for (let i = 0; i < n - 2; i += 2) s += String.fromCharCode(b[i] | (b[i + 1] << 8));
        return { utf16: true, value: s };
      }
      if (len > 4096) throw new Error('Not a BL3 save (bad header string)');
      const b = this.bytes(len);
      return td.decode(b.subarray(0, len - 1));
    }
  }
  class BinWriter {
    constructor() { this.chunks = []; }
    u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.chunks.push(b); }
    u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.chunks.push(b); }
    bytes(b) { this.chunks.push(b); }
    str(s) {
      if (s === null || s === undefined) { this.u32(0); return; }
      if (typeof s === 'object' && s.utf16) {
        const v = s.value; const b = new Uint8Array((v.length + 1) * 2);
        for (let i = 0; i < v.length; i++) { b[i * 2] = v.charCodeAt(i) & 0xFF; b[i * 2 + 1] = v.charCodeAt(i) >> 8; }
        const dv = new Uint8Array(4); new DataView(dv.buffer).setInt32(0, -(v.length + 1), true);
        this.chunks.push(dv); this.chunks.push(b); return;
      }
      const e = te.encode(s);
      this.u32(e.length + 1); this.chunks.push(e); this.chunks.push(new Uint8Array([0]));
    }
    finish() { return concat(this.chunks); }
  }

  function readGvas(buf) {
    const r = new BinReader(buf);
    const magic = td.decode(r.bytes(4));
    if (magic !== 'GVAS') throw new Error('This is not a decrypted BL3 file (missing GVAS header). On PS4/PS5, decrypt it with Save Wizard first.');
    const h = {};
    h.sgVersion = r.u32();
    h.pkgVersion = r.u32();
    h.engMajor = r.u16(); h.engMinor = r.u16(); h.engPatch = r.u16();
    h.engBuild = r.u32();
    h.buildId = r.str();
    h.fmtVersion = r.u32();
    const n = r.u32();
    if (n > 10000) throw new Error('Corrupt GVAS header');
    h.custom = [];
    for (let i = 0; i < n; i++) h.custom.push([r.bytes(16).slice(), r.u32()]);
    h.sgType = r.str();
    const len = r.u32();
    const payload = r.bytes(len).slice();
    const trailing = buf.length - r.pos;
    return { header: h, payload, trailing: trailing > 0 ? buf.slice(r.pos) : null };
  }
  function writeGvas(header, payload, trailing) {
    const w = new BinWriter();
    w.bytes(te.encode('GVAS'));
    w.u32(header.sgVersion); w.u32(header.pkgVersion);
    w.u16(header.engMajor); w.u16(header.engMinor); w.u16(header.engPatch);
    w.u32(header.engBuild);
    w.str(header.buildId);
    w.u32(header.fmtVersion);
    w.u32(header.custom.length);
    for (const [guid, v] of header.custom) { w.bytes(guid); w.u32(v); }
    w.str(header.sgType);
    w.u32(payload.length);
    w.bytes(payload);
    if (trailing) w.bytes(trailing);
    return w.finish();
  }

  /**
   * Load a decrypted (Save Wizard) PS4 or a PC .sav file.
   * Returns { kind: 'save'|'profile', platform: 'PS4'|'PC', header, data, trailing }
   */
  function loadFile(buf, forcePlatform) {
    const g = readGvas(buf);
    const sgType = typeof g.header.sgType === 'string' ? g.header.sgType : '';
    const isProfile = /profile/i.test(sgType);
    const kind = isProfile ? 'profile' : 'save';
    const typeName = isProfile ? 'Profile' : 'Character';
    const platforms = forcePlatform ? [forcePlatform] : ['PS4', 'PC'];
    const attempts = [];
    for (const p of platforms) {
      try {
        const plain = decryptPayload(g.payload, KEYS[kind][p]);
        const stats = { unknown: 0, badStrings: 0 };
        const data = BL3.pb.decode(plain, typeName, stats);
        let score = stats.unknown * 10 + stats.badStrings * 10;
        if (!isProfile) {
          const cls = data.player_class_data && data.player_class_data.player_class_path;
          if (!cls || !cls.startsWith('/Game/')) score += 1000;
        }
        attempts.push({ p, data, score, plain });
      } catch (e) {
        attempts.push({ p, error: e.message, score: Infinity });
      }
    }
    attempts.sort((a, b) => a.score - b.score);
    const best = attempts[0];
    if (!best || best.score >= 1000) {
      throw new Error('Could not decode this file as a BL3 ' + kind + ' for PS4 or PC. Make sure it was decrypted with Save Wizard (PS4) and is a BL3 save/profile.');
    }
    return { kind, platform: best.p, header: g.header, data: best.data, trailing: g.trailing, plain: best.plain };
  }

  function saveFile(file, platformOverride) {
    const typeName = file.kind === 'profile' ? 'Profile' : 'Character';
    const plain = BL3.pb.encode(file.data, typeName);
    const enc = encryptPayload(plain, KEYS[file.kind][platformOverride || file.platform]);
    return writeGvas(file.header, enc, file.trailing);
  }

  BL3.file = { load: loadFile, save: saveFile, readGvas, writeGvas, decryptPayload, encryptPayload, KEYS };

  // ======================================================================
  // Item serials
  // ======================================================================
  class BitReader {
    constructor(bytes) { this.b = bytes; this.pos = 0; this.len = bytes.length * 8; }
    remaining() { return this.len - this.pos; }
    read(n) {
      if (n > this.remaining()) throw new Error('Serial too short');
      let v = 0;
      for (let k = 0; k < n; k++) {
        const bit = (this.b[this.pos >> 3] >> (this.pos & 7)) & 1;
        v += bit * Math.pow(2, k);
        this.pos++;
      }
      return v;
    }
    restBits() { const out = []; while (this.pos < this.len) out.push(this.read(1)); return out; }
  }
  class BitWriter {
    constructor() { this.bits = []; }
    write(v, n) {
      if (v < 0 || v >= Math.pow(2, n)) throw new Error('Value ' + v + ' does not fit in ' + n + ' bits');
      for (let k = 0; k < n; k++) { this.bits.push(v % 2); v = Math.floor(v / 2); }
    }
    writeBits(arr) { for (const b of arr) this.bits.push(b); }
    bytes() {
      const out = new Uint8Array(Math.ceil(this.bits.length / 8));
      this.bits.forEach((b, i) => { if (b) out[i >> 3] |= 1 << (i & 7); });
      return out;
    }
  }

  function xorData(data, seed) {
    if (seed === 0) return Array.from(data);
    let x = BigInt((seed >> 5) >>> 0);
    const out = [];
    for (let i = 0; i < data.length; i++) {
      x = (x * 0x10A860C1n) % 0xFFFFFFFBn;
      out.push((data[i] ^ Number(x & 0xFFn)) & 0xFF);
    }
    return out;
  }
  function bogoDecrypt(data, seed) {
    const t = xorData(data, seed);
    const steps = (seed & 0x1F) % t.length;
    return Uint8Array.from(steps ? t.slice(-steps).concat(t.slice(0, -steps)) : t);
  }
  function bogoEncrypt(data, seed) {
    const a = Array.from(data);
    const steps = (seed & 0x1F) % a.length;
    const rot = a.slice(steps).concat(a.slice(0, steps));
    return Uint8Array.from(xorData(rot, seed));
  }
  function serialChecksum(header5, body) {
    const c = crc32(concat([header5, new Uint8Array([0xFF, 0xFF]), body]));
    const v = ((c >>> 16) ^ c) & 0xFFFF;
    return new Uint8Array([v >> 8, v & 0xFF]);
  }

  // Serial DB helpers
  const DB = {
    _idx: {},
    get db() { return D().serialdb; },
    get maxVersion() {
      if (this._max === undefined) {
        let m = 0;
        for (const k in this.db) for (const v of this.db[k].versions) m = Math.max(m, v.version);
        this._max = m;
      }
      return this._max;
    },
    bits(cat, version) {
      const c = this.db[cat];
      if (!c) throw new Error('Unknown part category ' + cat);
      let cur = c.versions[0].bits;
      for (const v of c.versions) { if (v.version > version) return cur; cur = v.bits; }
      return cur;
    },
    part(cat, idx) {
      const c = this.db[cat];
      if (!c || idx < 1 || idx > c.assets.length) return null;
      return c.assets[idx - 1];
    },
    index(cat, name) {
      if (!this._idx[cat]) {
        const m = this._idx[cat] = new Map();
        this.db[cat].assets.forEach((a, i) => { m.set(a.toLowerCase(), i + 1); const s = a.split('.').pop().toLowerCase(); if (!m.has('#' + s)) m.set('#' + s, i + 1); });
      }
      const m = this._idx[cat];
      const low = name.toLowerCase();
      return m.get(low) || m.get('#' + low.split('.').pop()) || null;
    },
    assets(cat) { return this.db[cat] ? this.db[cat].assets : []; },
  };
  BL3.serialDB = DB;

  function invKeyFor(balance) {
    let b = balance;
    if (!b.includes('.')) b = b + '.' + b.split('/').pop();
    return D().invkeys[b.toLowerCase()] || null;
  }
  function nameFor(balance) {
    let b = balance.toLowerCase();
    if (b.includes('.')) b = b.slice(0, b.lastIndexOf('.'));
    return D().names[b] || null;
  }

  /**
   * Parsed item. Fields:
   *   serialVersion (3|4), seed, version (db version),
   *   balance, invdata, manufacturer, level,
   *   parts[], generics[], additional[], numCustoms, rerolled,
   *   canParseParts, invKey
   */
  class Item {
    constructor(serialBytes) {
      this.setSerial(serialBytes);
    }
    static fromCode(code) {
      const m = String(code).trim().match(/^bl3\(([^)]*)\)$/i);
      const b64 = m ? m[1] : String(code).trim();
      return new Item(b64decode(b64));
    }
    setSerial(serial) {
      serial = serial instanceof Uint8Array ? serial : Uint8Array.from(serial);
      if (serial.length < 8) throw new Error('Item serial too short');
      if (serial[0] !== 3 && serial[0] !== 4) throw new Error('Unknown item serial version ' + serial[0]);
      this.original = serial.slice();
      this.serialVersion = serial[0];
      this.seed = new DataView(serial.buffer, serial.byteOffset + 1, 4).getInt32(0, false);
      const dec = bogoDecrypt(serial.subarray(5), this.seed);
      const want = serialChecksum(serial.subarray(0, 5), dec.subarray(2));
      if (dec[0] !== want[0] || dec[1] !== want[1]) throw new Error('Item serial checksum mismatch (bad code?)');
      this.parse(dec.subarray(2));
      this.dirty = false;
    }
    parse(data) {
      const r = new BitReader(data);
      if (r.read(8) !== 128) throw new Error('Bad item serial header');
      this.version = r.read(7);
      this.canParse = this.version <= DB.maxVersion;
      if (!this.canParse) { this.canParseParts = false; return; }
      const head = (cat) => { const idx = r.read(DB.bits(cat, this.version)); return DB.part(cat, idx) || ('unknown#' + idx); };
      this.balance = head('InventoryBalanceData');
      this.invdata = head('InventoryData');
      this.manufacturer = head('ManufacturerData');
      this.level = r.read(7);
      this.headerBitsEnd = r.pos;
      this.invKey = invKeyFor(this.balance);
      this.canParseParts = false;
      this.parts = []; this.generics = []; this.additional = []; this.numCustoms = 0; this.rerolled = 0;
      const restStart = r.pos;
      this.restBits = r.restBits();
      if (!this.invKey) return;
      r.pos = restStart;
      try {
        const pb = DB.bits(this.invKey, this.version);
        const np = r.read(6);
        for (let i = 0; i < np; i++) { const idx = r.read(pb); this.parts.push(DB.part(this.invKey, idx) || ('unknown#' + idx)); }
        const gb = DB.bits('InventoryGenericPartData', this.version);
        const ng = r.read(4);
        for (let i = 0; i < ng; i++) { const idx = r.read(gb); this.generics.push(DB.part('InventoryGenericPartData', idx) || ('unknown#' + idx)); }
        const na = r.read(8);
        for (let i = 0; i < na; i++) this.additional.push(r.read(8));
        this.numCustoms = r.read(4);
        if (this.numCustoms !== 0) return;
        if (this.serialVersion >= 4) this.rerolled = r.read(8);
        const rest = r.restBits();
        if (rest.length > 7 || rest.includes(1)) return;
        if (this.parts.some(p => p.startsWith('unknown#')) || this.generics.some(p => p.startsWith('unknown#'))) return;
        this.canParseParts = true;
      } catch (e) {
        this.canParseParts = false;
      }
    }
    /** Re-encode item into serial bytes. Unchanged items keep their original bytes. */
    serialize() {
      if (!this.dirty) return this.original.slice();
      if (!this.canParse) throw new Error('Cannot modify this item (unknown serial version)');
      const w = new BitWriter();
      const v = this.canParseParts ? DB.maxVersion : this.version;
      const idx = (cat, name) => {
        if (name.startsWith('unknown#')) return Number(name.slice(8));
        const i = DB.index(cat, name);
        if (!i) throw new Error('Unknown ' + cat + ' value: ' + name);
        return i;
      };
      w.write(128, 8);
      w.write(v, 7);
      w.write(idx('InventoryBalanceData', this.balance), DB.bits('InventoryBalanceData', v));
      w.write(idx('InventoryData', this.invdata), DB.bits('InventoryData', v));
      w.write(idx('ManufacturerData', this.manufacturer), DB.bits('ManufacturerData', v));
      w.write(Math.max(0, Math.min(127, this.level | 0)), 7);
      if (this.canParseParts) {
        if (this.parts.length > 63) throw new Error('Too many parts (max 63)');
        if (this.generics.length > 15) throw new Error('Too many anointments/generic parts (max 15)');
        w.write(this.parts.length, 6);
        const pb = DB.bits(this.invKey, v);
        for (const p of this.parts) w.write(idx(this.invKey, p), pb);
        w.write(this.generics.length, 4);
        const gb = DB.bits('InventoryGenericPartData', v);
        for (const g of this.generics) w.write(idx('InventoryGenericPartData', g), gb);
        w.write(this.additional.length, 8);
        for (const a of this.additional) w.write(a, 8);
        w.write(0, 4);
        if (this.serialVersion >= 4) w.write(this.rerolled & 0xFF, 8);
      } else {
        w.writeBits(this.restBits);
      }
      const body = w.bytes();
      const header = new Uint8Array(5);
      header[0] = this.serialVersion;
      new DataView(header.buffer).setInt32(1, 0, false); // seed 0 = unobfuscated (game accepts it)
      const sum = serialChecksum(header, body);
      return concat([header, bogoEncrypt(concat([sum, body]), 0)]);
    }
    code() { return 'BL3(' + b64encode(this.serialize()) + ')'; }
    clone() { const it = new Item(this.serialize()); return it; }
    touch() { this.dirty = true; }

    // --- convenience info -------------------------------------------------
    get name() { return (this.balance && nameFor(this.balance)) || (this.balance ? this.balance.split('.').pop() : 'Unknown item'); }
    get kind() {
      const inv = (this.invdata || '').toLowerCase();
      const k = (this.invKey || '').toLowerCase();
      if (k.includes('shield') || inv.includes('/shields/')) return 'shield';
      if (k.includes('grenade') || inv.includes('grenademod')) return 'grenade';
      if (k.includes('artifact') || inv.includes('artifact')) return 'relic';
      if (k.includes('classmod') || inv.includes('classmod')) return 'com';
      if (k.startsWith('bpinvpart_') || inv.includes('/weapons/')) return 'weapon';
      return 'other';
    }
    get rarity() {
      const D_ = D();
      if (!D_._rarityByBal) { D_._rarityByBal = {}; for (const c of D_.catalog) D_._rarityByBal[c.b.toLowerCase()] = c.r; }
      const known = this.balance && D_._rarityByBal[this.balance.toLowerCase()];
      if (known) return known;
      const s = ((this.balance || '') + ' ' + this.name).toLowerCase();
      const p = this.parts.join(' ').toLowerCase();
      if (/legendary|_05_/.test(s) || /rarity_.*legendary|_05_legendary/.test(p)) return 5;
      if (/veryrare|very_rare|purple|_04_/.test(s) || /rarity_.*veryrare|_04_veryrare/.test(p)) return 4;
      if (/_rare|blue|_03_/.test(s) || /rarity_.*_rare|_03_rare/.test(p)) return 3;
      if (/uncommon|green|_02_/.test(s)) return 2;
      if (/common|white|_01_/.test(s)) return 1;
      return 5;
    }
    get mayhem() {
      const m = D().consts.mayhem_part_to_lvl;
      for (const g of this.generics) for (const k in m) if (k.toLowerCase() === g.toLowerCase()) return m[k];
      return 0;
    }
    get anoints() {
      return this.generics.filter(g => !/WeaponMayhemLevel/i.test(g));
    }
  }

  BL3.Item = Item;
  BL3.items = { invKeyFor, nameFor, bogoDecrypt, bogoEncrypt, serialChecksum };
})(typeof window !== 'undefined' ? window : globalThis);
