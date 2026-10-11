Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
let _noble_hashes_sha3 = require("@noble/hashes/sha3");
let _noble_curves_secp256k1 = require("@noble/curves/secp256k1");
//#region src/ethereUtils.ts
/**
* ethereUtils — copying related code from ethers v6 with some modification,
* covering exactly the surface area used by `abstractionkit`.
*
* Sources (ethers v6.13.x):
*   src.ts/utils/{data,maths,utf8,rlp-encode}.ts
*   src.ts/crypto/{keccak,signing-key,signature}.ts
*   src.ts/hash/{id,message,solidity,typed-data}.ts
*   src.ts/address/{address,checks}.ts
*   src.ts/abi/{abi-coder, coders/*}.ts
*   src.ts/transaction/address.ts
*/
function redactArgumentValue(name, value) {
	if (value === null || value === void 0) return String(value);
	if (typeof value === "string") {
		const n = name.toLowerCase();
		if (n.includes("key") || n.includes("secret") || n.includes("token") || n.includes("password") || n.includes("mnemonic")) return "[REDACTED]";
		if (/^0x[0-9a-f]+$/i.test(value) && value.length > 18) return `${value.slice(0, 10)}…${value.slice(-6)}`;
		if (value.length > 64) return `[REDACTED string length=${value.length}]`;
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
	if (value instanceof Uint8Array) return `[REDACTED Uint8Array length=${value.length}]`;
	return `[REDACTED ${typeof value}]`;
}
function assertArgument(check, message, name, value) {
	if (!check) throw new Error(`invalid argument (${name}=${redactArgumentValue(name, value)}, message=${message})`);
}
function assertCheck(check, message) {
	if (!check) throw new Error(message);
}
const HexCharacters = "0123456789abcdef";
function _getBytes(value, name, copy) {
	if (value instanceof Uint8Array) return copy ? new Uint8Array(value) : value;
	if (typeof value === "string" && value.length % 2 === 0 && value.match(/^0x[0-9a-f]*$/i)) {
		const result = new Uint8Array((value.length - 2) / 2);
		let offset = 2;
		for (let i = 0; i < result.length; i++) {
			result[i] = parseInt(value.substring(offset, offset + 2), 16);
			offset += 2;
		}
		return result;
	}
	assertArgument(false, "invalid BytesLike value", name || "value", value);
}
function getBytes(value, name) {
	return _getBytes(value, name, false);
}
function getBytesCopy(value, name) {
	return _getBytes(value, name, true);
}
function isHexString(value, length) {
	if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) return false;
	if (typeof length === "number" && value.length !== 2 + 2 * length) return false;
	if (length === true && value.length % 2 !== 0) return false;
	return true;
}
function hexlify(data) {
	const bytes = getBytes(data);
	let result = "0x";
	for (let i = 0; i < bytes.length; i++) {
		const v = bytes[i];
		result += HexCharacters[(v & 240) >> 4] + HexCharacters[v & 15];
	}
	return result;
}
function concat(datas) {
	return "0x" + datas.map((d) => hexlify(d).substring(2)).join("");
}
function dataLength(data) {
	if (isHexString(data, true)) return (data.length - 2) / 2;
	return getBytes(data).length;
}
function zeroPad(data, length, left) {
	const bytes = getBytes(data);
	assertCheck(length >= bytes.length, "padding exceeds data length");
	const result = new Uint8Array(length);
	result.fill(0);
	if (left) result.set(bytes, length - bytes.length);
	else result.set(bytes, 0);
	return hexlify(result);
}
function zeroPadValue(data, length) {
	return zeroPad(data, length, true);
}
function zeroPadBytes(data, length) {
	return zeroPad(data, length, false);
}
const BN_0 = 0n;
const BN_1 = 1n;
const maxValue = 9007199254740991;
function getBigInt(value, name) {
	switch (typeof value) {
		case "bigint": return value;
		case "number":
			assertArgument(Number.isInteger(value), "underflow", name || "value", value);
			assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
			return BigInt(value);
		case "string": try {
			if (value === "") throw new Error("empty string");
			if (value[0] === "-" && value[1] !== "-") return -BigInt(value.substring(1));
			return BigInt(value);
		} catch (e) {
			assertArgument(false, `invalid BigNumberish string: ${e.message}`, name || "value", value);
		}
	}
	assertArgument(false, "invalid BigNumberish value", name || "value", value);
}
function getUint(value, name) {
	const result = getBigInt(value, name);
	assertCheck(result >= BN_0, "unsigned value cannot be negative");
	return result;
}
function getNumber(value, name) {
	switch (typeof value) {
		case "bigint":
			assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
			return Number(value);
		case "number":
			assertArgument(Number.isInteger(value), "underflow", name || "value", value);
			assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
			return value;
		case "string": try {
			if (value === "") throw new Error("empty string");
			return getNumber(BigInt(value), name);
		} catch (e) {
			assertArgument(false, `invalid numeric string: ${e.message}`, name || "value", value);
		}
	}
	assertArgument(false, "invalid numeric value", name || "value", value);
}
const Nibbles = "0123456789abcdef";
function toBigInt(value) {
	if (value instanceof Uint8Array) {
		let result = "0x0";
		for (const v of value) {
			result += Nibbles[v >> 4];
			result += Nibbles[v & 15];
		}
		return BigInt(result);
	}
	return getBigInt(value);
}
function toNumber(value) {
	return getNumber(toBigInt(value));
}
function mask(_value, _bits) {
	return getUint(_value, "value") & (BN_1 << BigInt(getNumber(_bits, "bits"))) - BN_1;
}
function toTwos(_value, _width) {
	let value = getBigInt(_value, "value");
	const width = BigInt(getNumber(_width, "width"));
	const limit = BN_1 << width - BN_1;
	if (value < BN_0) {
		value = -value;
		assertCheck(value <= limit, "toTwos: too low");
		const m = (BN_1 << width) - BN_1;
		return (~value & m) + BN_1;
	}
	assertCheck(value < limit, "toTwos: too high");
	return value;
}
function fromTwos(_value, _width) {
	const value = getUint(_value, "value");
	const width = BigInt(getNumber(_width, "width"));
	assertCheck(value >> width === BN_0, "fromTwos: overflow");
	if (value >> width - BN_1) {
		const m = (BN_1 << width) - BN_1;
		return -((~value & m) + BN_1);
	}
	return value;
}
function toBeHex(_value, _width) {
	const value = getUint(_value, "value");
	let result = value.toString(16);
	if (_width == null) {
		if (result.length % 2) result = "0" + result;
	} else {
		const width = getNumber(_width, "width");
		if (width === 0 && value === BN_0) return "0x";
		assertCheck(width * 2 >= result.length, `value exceeds width (${width} bytes)`);
		while (result.length < width * 2) result = "0" + result;
	}
	return "0x" + result;
}
function toBeArray(_value, _width) {
	const value = getUint(_value, "value");
	if (value === BN_0) {
		const width = _width != null ? getNumber(_width, "width") : 0;
		return new Uint8Array(width);
	}
	let hex = value.toString(16);
	if (hex.length % 2) hex = "0" + hex;
	if (_width != null) {
		const width = getNumber(_width, "width");
		while (hex.length < width * 2) hex = "00" + hex;
		assertCheck(width * 2 === hex.length, `value exceeds width (${width} bytes)`);
	}
	const result = new Uint8Array(hex.length / 2);
	for (let i = 0; i < result.length; i++) {
		const offset = i * 2;
		result[i] = parseInt(hex.substring(offset, offset + 2), 16);
	}
	return result;
}
function toUtf8Bytes(str) {
	assertArgument(typeof str === "string", "invalid string value", "str", str);
	const result = [];
	for (let i = 0; i < str.length; i++) {
		const c = str.charCodeAt(i);
		if (c < 128) result.push(c);
		else if (c < 2048) {
			result.push(c >> 6 | 192);
			result.push(c & 63 | 128);
		} else if ((c & 64512) === 55296) {
			i++;
			const c2 = str.charCodeAt(i);
			assertArgument(i < str.length && (c2 & 64512) === 56320, "invalid surrogate pair", "str", str);
			const pair = 65536 + ((c & 1023) << 10) + (c2 & 1023);
			result.push(pair >> 18 | 240);
			result.push(pair >> 12 & 63 | 128);
			result.push(pair >> 6 & 63 | 128);
			result.push(pair & 63 | 128);
		} else {
			result.push(c >> 12 | 224);
			result.push(c >> 6 & 63 | 128);
			result.push(c & 63 | 128);
		}
	}
	return new Uint8Array(result);
}
/**
* Decode UTF-8 bytes to a string. Pure JS so it works in every runtime,
* including React Native / Hermes where `TextDecoder` is not defined by default.
*
* Throws on bad prefix, truncated sequences, missing or unexpected continuation bytes,
* overlong encodings, surrogate code points (U+D800..U+DFFF), and code
* points above U+10FFFF. For ABI string payloads this is the right policy —
* well-formed contracts never emit broken UTF-8, so an error signals a
* real problem rather than silently corrupting the decoded value.
*
* @throws Error when `bytes` is not a valid UTF-8 sequence.
*/
function fromUtf8Bytes(bytes) {
	const codepoints = [];
	let i = 0;
	while (i < bytes.length) {
		const c = bytes[i++];
		if ((c & 128) === 0) {
			codepoints.push(c);
			continue;
		}
		let extraLength;
		let overlongMask;
		if ((c & 224) === 192) {
			extraLength = 1;
			overlongMask = 127;
		} else if ((c & 240) === 224) {
			extraLength = 2;
			overlongMask = 2047;
		} else if ((c & 248) === 240) {
			extraLength = 3;
			overlongMask = 65535;
		} else {
			const kind = (c & 192) === 128 ? "unexpected continuation" : "bad prefix";
			throw new Error(`invalid UTF-8: ${kind} byte 0x${c.toString(16)} at index ${i - 1}`);
		}
		if (i + extraLength > bytes.length) throw new Error(`invalid UTF-8: truncated sequence at index ${i - 1}`);
		let res = c & (1 << 8 - extraLength - 1) - 1;
		for (let j = 0; j < extraLength; j++) {
			const next = bytes[i++];
			if ((next & 192) !== 128) throw new Error(`invalid UTF-8: missing continuation byte 0x${next.toString(16)} at index ${i - 1}`);
			res = res << 6 | next & 63;
		}
		if (res <= overlongMask) throw new Error(`invalid UTF-8: overlong encoding of U+${res.toString(16).toUpperCase()}`);
		if (res >= 55296 && res <= 57343) throw new Error(`invalid UTF-8: surrogate code point U+${res.toString(16).toUpperCase()}`);
		if (res > 1114111) throw new Error(`invalid UTF-8: code point U+${res.toString(16).toUpperCase()} out of range`);
		codepoints.push(res);
	}
	let result = "";
	for (const cp of codepoints) result += String.fromCodePoint(cp);
	return result;
}
function keccak256(_data) {
	return hexlify((0, _noble_hashes_sha3.keccak_256)(getBytes(_data, "data")));
}
function id(value) {
	return keccak256(toUtf8Bytes(value));
}
const MessagePrefix = "Ethereum Signed Message:\n";
function hashMessage(message) {
	if (typeof message === "string") message = toUtf8Bytes(message);
	return keccak256(concat([
		toUtf8Bytes(MessagePrefix),
		toUtf8Bytes(String(message.length)),
		message
	]));
}
function getChecksumAddress(address) {
	address = address.toLowerCase();
	const chars = address.substring(2).split("");
	const expanded = new Uint8Array(40);
	for (let i = 0; i < 40; i++) expanded[i] = chars[i].charCodeAt(0);
	const hashed = getBytes(keccak256(expanded));
	for (let i = 0; i < 40; i += 2) {
		if (hashed[i >> 1] >> 4 >= 8) chars[i] = chars[i].toUpperCase();
		if ((hashed[i >> 1] & 15) >= 8) chars[i + 1] = chars[i + 1].toUpperCase();
	}
	return "0x" + chars.join("");
}
function getAddress(address) {
	assertArgument(typeof address === "string", "invalid address", "address", address);
	if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
		if (!address.startsWith("0x")) address = "0x" + address;
		const result = getChecksumAddress(address);
		assertArgument(!address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) || result === address, "bad address checksum", "address", address);
		return result;
	}
	assertArgument(false, "invalid address", "address", address);
}
function isAddress(value) {
	try {
		getAddress(value);
		return true;
	} catch {
		return false;
	}
}
const regexBytes = /^bytes([0-9]+)$/;
const regexNumber = /^(u?int)([0-9]*)$/;
const regexArray = /^(.*)\[([0-9]*)\]$/;
function _pack(type, value, isArray) {
	switch (type) {
		case "address":
			if (isArray) return getBytes(zeroPadValue(value, 32));
			return getBytes(getAddress(value));
		case "string": return toUtf8Bytes(value);
		case "bytes": return getBytes(value);
		case "bool": {
			const v = value ? "0x01" : "0x00";
			if (isArray) return getBytes(zeroPadValue(v, 32));
			return getBytes(v);
		}
	}
	let match = type.match(regexNumber);
	if (match) {
		const signed = match[1] === "int";
		let size = parseInt(match[2] || "256");
		assertArgument((!match[2] || match[2] === String(size)) && size % 8 === 0 && size !== 0 && size <= 256, "invalid number type", "type", type);
		if (isArray) size = 256;
		return getBytes(zeroPadValue(toBeArray(signed ? toTwos(value, size) : value), size / 8));
	}
	match = type.match(regexBytes);
	if (match) {
		const size = parseInt(match[1]);
		assertArgument(String(size) === match[1] && size !== 0 && size <= 32, "invalid bytes type", "type", type);
		assertArgument(dataLength(value) === size, `invalid value for ${type}`, "value", value);
		if (isArray) return getBytes(zeroPadBytes(value, 32));
		return getBytes(value);
	}
	match = type.match(regexArray);
	if (match && Array.isArray(value)) {
		const baseType = match[1];
		assertArgument(parseInt(match[2] || String(value.length)) === value.length, `invalid array length for ${type}`, "value", value);
		const result = [];
		for (const v of value) result.push(_pack(baseType, v, true));
		return getBytes(concat(result));
	}
	assertArgument(false, "invalid type", "type", type);
}
function solidityPacked(types, values) {
	assertArgument(types.length === values.length, "wrong number of values", "values", values);
	const tight = [];
	for (let i = 0; i < types.length; i++) tight.push(_pack(types[i], values[i]));
	return hexlify(concat(tight));
}
function solidityPackedKeccak256(types, values) {
	return keccak256(solidityPacked(types, values));
}
function arrayifyInteger(value) {
	const result = [];
	while (value) {
		result.unshift(value & 255);
		value >>= 8;
	}
	return result;
}
function _rlpEncode(object) {
	if (Array.isArray(object)) {
		let payload = [];
		object.forEach((child) => {
			payload = payload.concat(_rlpEncode(child));
		});
		if (payload.length <= 55) {
			payload.unshift(192 + payload.length);
			return payload;
		}
		const length = arrayifyInteger(payload.length);
		length.unshift(247 + length.length);
		return length.concat(payload);
	}
	const data = Array.prototype.slice.call(getBytes(object, "object"));
	if (data.length === 1 && data[0] <= 127) return data;
	if (data.length <= 55) {
		data.unshift(128 + data.length);
		return data;
	}
	const length = arrayifyInteger(data.length);
	length.unshift(183 + length.length);
	return length.concat(data);
}
function encodeRlp(object) {
	let result = "0x";
	for (const v of _rlpEncode(object)) {
		result += Nibbles[v >> 4];
		result += Nibbles[v & 15];
	}
	return result;
}
function splitTopLevel(s) {
	const out = [];
	let depth = 0, start = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "(" || c === "[") depth++;
		else if (c === ")" || c === "]") depth--;
		else if (c === "," && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	if (start < s.length) out.push(s.slice(start));
	return out.map((x) => x.trim()).filter((x) => x.length > 0);
}
function parseType(s) {
	s = s.trim();
	const m = s.match(/^(.+?)((?:\[\d*\])*)$/);
	assertArgument(!!m, `invalid type`, "type", s);
	const base = m[1], suffix = m[2];
	let t;
	if (base.startsWith("(")) {
		assertArgument(base.endsWith(")"), `unbalanced tuple`, "type", s);
		t = {
			kind: "tuple",
			components: splitTopLevel(base.slice(1, -1)).map(parseType)
		};
	} else if (base === "address") t = { kind: "address" };
	else if (base === "bool") t = { kind: "bool" };
	else if (base === "string") t = { kind: "string" };
	else if (base === "bytes") t = { kind: "bytes" };
	else if (base === "uint" || base === "int") t = {
		kind: "uint",
		bits: 256,
		signed: base === "int"
	};
	else {
		const um = base.match(regexNumber);
		if (um) {
			const bits = parseInt(um[2] || "256");
			assertArgument(bits !== 0 && bits <= 256 && bits % 8 === 0, "invalid number type", "type", base);
			t = {
				kind: "uint",
				bits,
				signed: um[1] === "int"
			};
		} else {
			const bm = base.match(regexBytes);
			assertArgument(!!bm, `unknown type ${base}`, "type", base);
			const size = parseInt(bm[1]);
			assertArgument(size !== 0 && size <= 32, "invalid bytes type", "type", base);
			t = {
				kind: "bytesN",
				size
			};
		}
	}
	for (const ap of suffix.matchAll(/\[(\d*)\]/g)) t = {
		kind: "array",
		child: t,
		size: ap[1] ? parseInt(ap[1]) : -1
	};
	return t;
}
function isDynamic(t) {
	switch (t.kind) {
		case "bytes":
		case "string": return true;
		case "array": return t.size === -1 || isDynamic(t.child);
		case "tuple": return t.components.some(isDynamic);
		default: return false;
	}
}
function staticSize(t) {
	switch (t.kind) {
		case "uint":
		case "address":
		case "bool":
		case "bytesN": return 32;
		case "array": return t.size * staticSize(t.child);
		case "tuple": return t.components.reduce((s, c) => s + staticSize(c), 0);
		default: throw new Error(`staticSize: dynamic type ${t.kind}`);
	}
}
const WordSize = 32;
const Padding = new Uint8Array(WordSize);
const MaxZeroFootprintArrayLen = 1 << 20;
function padLeft(b, size) {
	assertCheck(b.length <= size, "padLeft: overflow");
	const out = new Uint8Array(size);
	out.set(b, size - b.length);
	return out;
}
function padRight(b, size) {
	assertCheck(b.length <= size, "padRight: overflow");
	const out = new Uint8Array(size);
	out.set(b, 0);
	return out;
}
function padTo32(len) {
	return Math.ceil(len / WordSize) * WordSize;
}
const BN_MAX_UINT256 = (1n << 256n) - 1n;
function encodeValue(t, v) {
	switch (t.kind) {
		case "uint": {
			let value = getBigInt(v, "value");
			const maxUintValue = mask(BN_MAX_UINT256, WordSize * 8);
			if (t.signed) {
				const bounds = mask(maxUintValue, t.bits - 1);
				assertCheck(value <= bounds && value >= -(bounds + 1n), `int${t.bits}: value out-of-bounds`);
				value = toTwos(value, 8 * WordSize);
			} else assertCheck(value >= 0n && value <= mask(maxUintValue, t.bits), `uint${t.bits}: out-of-bounds`);
			return padLeft(toBeArray(value), WordSize);
		}
		case "address": return padLeft(getBytes(getAddress(v)), WordSize);
		case "bool": return padLeft(new Uint8Array([v ? 1 : 0]), WordSize);
		case "bytesN": {
			const bytes = getBytes(v);
			assertCheck(bytes.length === t.size, `bytes${t.size}: wrong length`);
			return padRight(bytes, WordSize);
		}
		case "bytes": {
			const bytes = getBytes(v);
			return concatBytes([padLeft(toBeArray(bytes.length), WordSize), padRight(bytes, padTo32(bytes.length))]);
		}
		case "string": {
			const bytes = toUtf8Bytes(v);
			return concatBytes([padLeft(toBeArray(bytes.length), WordSize), padRight(bytes, padTo32(bytes.length))]);
		}
		case "array": {
			const arr = v;
			assertCheck(t.size === -1 || arr.length === t.size, "array: length mismatch");
			const inner = encodeTuple(Array(arr.length).fill(t.child), arr);
			return t.size === -1 ? concatBytes([padLeft(toBeArray(arr.length), WordSize), inner]) : inner;
		}
		case "tuple": return encodeTuple(t.components, v);
	}
}
function concatBytes(parts) {
	const total = parts.reduce((s, p) => s + p.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const p of parts) {
		out.set(p, off);
		off += p.length;
	}
	return out;
}
function encodeTuple(types, values) {
	assertCheck(types.length === values.length, "tuple: length mismatch");
	const heads = [];
	const tails = [];
	let tailOff = types.reduce((s, t) => s + (isDynamic(t) ? WordSize : staticSize(t)), 0);
	for (let i = 0; i < types.length; i++) {
		const enc = encodeValue(types[i], values[i]);
		if (isDynamic(types[i])) {
			heads.push(padLeft(toBeArray(tailOff), WordSize));
			tails.push(enc);
			tailOff += enc.length;
		} else heads.push(enc);
	}
	return concatBytes([...heads, ...tails]);
}
function ensureRange(data, offset, len, what) {
	if (offset < 0 || len < 0 || offset + len > data.length) throw new Error(`ABI decode: out-of-bounds read for ${what} (offset=${offset}, length=${len}, data.length=${data.length})`);
}
function decodeValue(t, data, base) {
	switch (t.kind) {
		case "uint": {
			ensureRange(data, base, WordSize, `${t.signed ? "int" : "uint"}${t.bits}`);
			const masked = mask(toBigInt(data.slice(base, base + WordSize)), t.bits);
			return t.signed ? fromTwos(masked, t.bits) : masked;
		}
		case "address":
			ensureRange(data, base, WordSize, "address");
			return getAddress(hexlify(data.slice(base + 12, base + WordSize)));
		case "bool":
			ensureRange(data, base, WordSize, "bool");
			return data[base + 31] !== 0;
		case "bytesN":
			ensureRange(data, base, WordSize, `bytes${t.size}`);
			return hexlify(data.slice(base, base + t.size));
		case "bytes": {
			ensureRange(data, base, WordSize, "bytes length");
			const len = toNumber(data.slice(base, base + WordSize));
			ensureRange(data, base + WordSize, len, "bytes payload");
			return hexlify(data.slice(base + WordSize, base + WordSize + len));
		}
		case "string": {
			ensureRange(data, base, WordSize, "string length");
			const len = toNumber(data.slice(base, base + WordSize));
			ensureRange(data, base + WordSize, len, "string payload");
			return fromUtf8Bytes(data.slice(base + WordSize, base + WordSize + len));
		}
		case "array":
			if (t.size === -1) {
				ensureRange(data, base, WordSize, "array length");
				const len = toNumber(data.slice(base, base + WordSize));
				const elementHeadSize = isDynamic(t.child) ? WordSize : staticSize(t.child);
				const bodyBytes = data.length - (base + WordSize);
				const maxElements = elementHeadSize > 0 ? Math.floor(bodyBytes / elementHeadSize) : MaxZeroFootprintArrayLen;
				if (len > maxElements) throw new Error(`ABI decode: array length ${len} exceeds payload capacity (maxElements=${maxElements}, data.length=${data.length})`);
				return decodeTupleAt(Array(len).fill(t.child), data, base + WordSize);
			}
			return decodeTupleAt(Array(t.size).fill(t.child), data, base);
		case "tuple": return decodeTupleAt(t.components, data, base);
	}
}
function decodeTupleAt(types, data, base) {
	const out = [];
	let head = 0;
	for (const t of types) if (isDynamic(t)) {
		ensureRange(data, base + head, WordSize, "tuple offset slot");
		const off = toNumber(data.slice(base + head, base + head + WordSize));
		if (off < 0 || base + off > data.length) throw new Error(`ABI decode: tuple dynamic offset out-of-bounds (offset=${off}, base=${base}, data.length=${data.length})`);
		out.push(decodeValue(t, data, base + off));
		head += WordSize;
	} else {
		const size = staticSize(t);
		ensureRange(data, base + head, size, `tuple static slot (${t.kind})`);
		out.push(decodeValue(t, data, base + head));
		head += size;
	}
	return out;
}
function encodeAbiParameters(types, values) {
	assertCheck(types.length === values.length, "encodeAbiParameters: length mismatch");
	return hexlify(encodeTuple(types.map(parseType), values));
}
function decodeAbiParameters(types, data) {
	return decodeTupleAt(types.map(parseType), getBytes(data), 0);
}
const hexTrue = toBeHex(BN_1, 32);
const hexFalse = toBeHex(BN_0, 32);
function hexPadRight(value) {
	const bytes = getBytes(value);
	const padOffset = bytes.length % WordSize;
	if (padOffset) return concat([bytes, Padding.slice(padOffset)]);
	return hexlify(bytes);
}
function getBaseEncoder(type) {
	{
		const match = type.match(/^(u?)int(\d+)$/);
		if (match) {
			const signed = match[1] === "";
			const width = parseInt(match[2]);
			assertArgument(width % 8 === 0 && width !== 0 && width <= 256 && match[2] === String(width), "invalid numeric width", "type", type);
			const boundsUpper = mask(BN_MAX_UINT256, signed ? width - 1 : width);
			const boundsLower = signed ? (boundsUpper + BN_1) * -1n : BN_0;
			return (v) => {
				const value = getBigInt(v, "value");
				assertCheck(value >= boundsLower && value <= boundsUpper, `value out-of-bounds for ${type}`);
				return toBeHex(signed ? toTwos(value, 256) : value, 32);
			};
		}
	}
	{
		const match = type.match(/^bytes(\d+)$/);
		if (match) {
			const width = parseInt(match[1]);
			assertArgument(width !== 0 && width <= 32 && match[1] === String(width), "invalid bytes width", "type", type);
			return (v) => {
				assertCheck(getBytes(v).length === width, `invalid length for ${type}`);
				return hexPadRight(v);
			};
		}
	}
	switch (type) {
		case "address": return (v) => zeroPadValue(getAddress(v), 32);
		case "bool": return (v) => !v ? hexFalse : hexTrue;
		case "bytes": return (v) => keccak256(v);
		case "string": return (v) => id(v);
	}
	return null;
}
function splitArray(type) {
	const match = type.match(/^([^\x5b]*)((\x5b\d*\x5d)*)(\x5b(\d*)\x5d)$/);
	if (match) return {
		base: match[1],
		index: match[2] + match[4],
		array: {
			base: match[1],
			prefix: match[1] + match[2],
			count: match[5] ? parseInt(match[5]) : -1
		}
	};
	return { base: type };
}
function encodeType(name, fields) {
	return `${name}(${fields.map(({ name, type }) => type + " " + name).join(",")})`;
}
/**
* Build a recursive encoder for `primaryType` that produces the EIP-712
* `encodeData` for a struct value. Internal `fullTypes` map captures the
* fully-described type string for each struct (`MyStruct(...)NestedStruct(...)`).
*/
function buildTypedDataState(_types) {
	const fullTypes = /* @__PURE__ */ new Map();
	const links = /* @__PURE__ */ new Map();
	const parents = /* @__PURE__ */ new Map();
	const subtypes = /* @__PURE__ */ new Map();
	const types = {};
	for (const type of Object.keys(_types)) {
		types[type] = _types[type].map(({ name, type }) => {
			let { base, index } = splitArray(type);
			if (base === "int" && !_types["int"]) base = "int256";
			if (base === "uint" && !_types["uint"]) base = "uint256";
			return {
				name,
				type: base + (index || "")
			};
		});
		links.set(type, /* @__PURE__ */ new Set());
		parents.set(type, []);
		subtypes.set(type, /* @__PURE__ */ new Set());
	}
	for (const name in types) {
		const uniqueNames = /* @__PURE__ */ new Set();
		for (const field of types[name]) {
			assertArgument(!uniqueNames.has(field.name), `duplicate variable name ${JSON.stringify(field.name)} in ${JSON.stringify(name)}`, "types", _types);
			uniqueNames.add(field.name);
			const baseType = splitArray(field.type).base;
			assertArgument(baseType !== name, `circular type reference to ${JSON.stringify(baseType)}`, "types", _types);
			if (getBaseEncoder(baseType)) continue;
			assertArgument(parents.has(baseType), `unknown type ${JSON.stringify(baseType)}`, "types", _types);
			parents.get(baseType).push(name);
			links.get(name).add(baseType);
		}
	}
	const primaryTypes = Array.from(parents.keys()).filter((n) => parents.get(n).length === 0);
	assertArgument(primaryTypes.length !== 0, "missing primary type", "types", _types);
	assertArgument(primaryTypes.length === 1, `ambiguous primary types or unused types: ${primaryTypes.map((t) => JSON.stringify(t)).join(", ")}`, "types", _types);
	const primaryType = primaryTypes[0];
	function checkCircular(type, found) {
		assertArgument(!found.has(type), `circular type reference to ${JSON.stringify(type)}`, "types", _types);
		found.add(type);
		for (const child of links.get(type)) {
			if (!parents.has(child)) continue;
			checkCircular(child, found);
			for (const subtype of found) subtypes.get(subtype).add(child);
		}
		found.delete(type);
	}
	checkCircular(primaryType, /* @__PURE__ */ new Set());
	for (const [name, set] of subtypes) {
		const st = Array.from(set);
		st.sort();
		fullTypes.set(name, encodeType(name, types[name]) + st.map((t) => encodeType(t, types[t])).join(""));
	}
	const encoderCache = /* @__PURE__ */ new Map();
	function getEncoder(type) {
		const cached = encoderCache.get(type);
		if (cached) return cached;
		const built = buildEncoder(type);
		encoderCache.set(type, built);
		return built;
	}
	function buildEncoder(type) {
		const base = getBaseEncoder(type);
		if (base) return base;
		const arr = splitArray(type).array;
		if (arr) {
			const subtype = arr.prefix;
			const subEncoder = getEncoder(subtype);
			return (value) => {
				const arrVal = value;
				assertCheck(arr.count === -1 || arr.count === arrVal.length, `array length mismatch; expected ${arr.count}`);
				let result = arrVal.map(subEncoder);
				if (fullTypes.has(subtype)) result = result.map(keccak256);
				return keccak256(concat(result));
			};
		}
		const fields = types[type];
		if (fields) {
			const encodedType = id(fullTypes.get(type));
			return (value) => {
				const obj = value;
				const values = fields.map(({ name, type }) => {
					const r = getEncoder(type)(obj[name]);
					return fullTypes.has(type) ? keccak256(r) : r;
				});
				values.unshift(encodedType);
				return concat(values);
			};
		}
		assertArgument(false, `unknown type: ${type}`, "type", type);
	}
	function hashStruct(name, value) {
		return keccak256(getEncoder(name)(value));
	}
	return {
		primaryType,
		hashStruct
	};
}
const domainFieldTypes = {
	name: "string",
	version: "string",
	chainId: "uint256",
	verifyingContract: "address",
	salt: "bytes32"
};
const domainFieldNames = [
	"name",
	"version",
	"chainId",
	"verifyingContract",
	"salt"
];
function hashDomain(domain) {
	const domainFields = [];
	for (const name in domain) {
		if (domain[name] == null) continue;
		const type = domainFieldTypes[name];
		assertArgument(!!type, `invalid typed-data domain key: ${JSON.stringify(name)}`, "domain", domain);
		domainFields.push({
			name,
			type
		});
	}
	domainFields.sort((a, b) => domainFieldNames.indexOf(a.name) - domainFieldNames.indexOf(b.name));
	const { hashStruct } = buildTypedDataState({ EIP712Domain: domainFields });
	return hashStruct("EIP712Domain", domain);
}
function hashTypedData(domain, types, value) {
	const userTypes = {};
	for (const [k, v] of Object.entries(types)) if (k !== "EIP712Domain") userTypes[k] = v;
	const { primaryType, hashStruct } = buildTypedDataState(userTypes);
	return keccak256(concat([
		"0x1901",
		hashDomain(domain),
		hashStruct(primaryType, value)
	]));
}
function computePublicKey(privateKey) {
	const bytes = getBytes(privateKey, "key");
	assertCheck(bytes.length === 32, "invalid private key");
	return hexlify(_noble_curves_secp256k1.secp256k1.getPublicKey(bytes, false));
}
function normalizePrivateKey(key) {
	return key.startsWith("0x") ? key : "0x" + key;
}
function privateKeyToAddress(privateKey) {
	return getAddress(keccak256("0x" + computePublicKey(normalizePrivateKey(privateKey)).substring(4)).substring(26));
}
function signHash$1(privateKey, hash) {
	assertCheck(dataLength(hash) === 32, "invalid digest length");
	const sig = _noble_curves_secp256k1.secp256k1.sign(getBytesCopy(hash), getBytesCopy(normalizePrivateKey(privateKey)), { lowS: true });
	const r = toBeHex(sig.r, 32);
	const s = toBeHex(sig.s, 32);
	const yParity = sig.recovery & 1;
	const v = 27 + yParity;
	return {
		r,
		s,
		v,
		yParity,
		serialized: concat([
			r,
			s,
			new Uint8Array([v])
		])
	};
}
function signTypedData(privateKey, domain, types, message) {
	return signHash$1(privateKey, hashTypedData(domain, types, message)).serialized;
}
//#endregion
//#region src/errors.ts
/**
* Maps JSON-RPC numeric error codes to human-readable {@link BundlerErrorCode} values.
*/
const BundlerErrorCodeDict = {
	"-32602": "INVALID_FIELDS",
	"-32500": "SIMULATE_VALIDATION",
	"-32501": "SIMULATE_PAYMASTER_VALIDATION",
	"-32502": "OPCODE_VALIDATION",
	"-32503": "EXPIRE_SHORTLY",
	"-32504": "REPUTATION",
	"-32505": "INSUFFICIENT_STAKE",
	"-32506": "UNSUPPORTED_SIGNATURE_AGGREGATOR",
	"-32507": "INVALID_SIGNATURE",
	"-32508": "PAYMASTER_DEPOSIT_TOO_LOW",
	"-32521": "EXECUTION_REVERTED"
};
/**
* Maps JSON-RPC numeric error codes to human-readable {@link JsonRpcErrorCode} values.
*/
const JsonRpcErrorDict = {
	"-32700": "PARSE_ERROR",
	"-32600": "INVALID_REQUEST",
	"-32601": "METHOD_NOT_FOUND",
	"-32602": "INVALID_PARAMS",
	"-32603": "INTERNAL_ERROR"
};
/**
* Custom error class for the AbstractionKit SDK. Wraps bundler, JSON-RPC,
* and general errors with a structured code, optional numeric errno, and
* arbitrary JSON-serializable context.
*/
var AbstractionKitError = class extends Error {
	code;
	context;
	errno;
	/**
	* The EntryPoint FailedOp revert code parsed from the message (e.g. "AA21"),
	* when present. EntryPoint codes are contract-defined and stable across
	* bundlers, so they are a reliable signal for classifying a failure without
	* matching the human-readable message text.
	*/
	aaCode;
	/**
	* @param code - Error code identifying the category of failure
	* @param message - Human-readable error description
	* @param options - Optional cause, numeric errno, JSON-serializable context, and AAxx code
	*/
	constructor(code, message, options = {}) {
		const { cause, errno, context, aaCode } = options;
		super(message, { cause });
		this.name = this.constructor.name;
		this.code = code;
		this.errno = errno;
		this.context = context;
		this.aaCode = aaCode;
	}
	/**
	* Returns a JSON string representation of this error including name, code,
	* message, cause, errno, context, and aaCode. Useful in React Native where
	* the Error "cause" property is not shown in stack traces.
	* @returns JSON string of the error
	*/
	stringify() {
		return JSON.stringify(this, [
			"name",
			"code",
			"message",
			"cause",
			"errno",
			"context",
			"aaCode"
		]);
	}
};
/**
* Parse the EntryPoint FailedOp revert code (e.g. "AA21") from a bundler error
* message, if one is present. Returns the uppercased code or undefined.
*/
function parseAaCode(message) {
	return message.match(/\bAA\d{2}\b/i)?.[0].toUpperCase();
}
/**
* Coerces an unknown thrown value into an Error instance.
* If the value is already an Error it is returned as-is; otherwise it is
* stringified and wrapped in a new Error.
* @param value - The caught value to normalize
* @returns An Error instance
*/
function ensureError(value) {
	if (value instanceof Error) return value;
	let stringified = "[Unable to stringify the thrown value]";
	try {
		stringified = JSON.stringify(value);
	} catch {}
	return /* @__PURE__ */ new Error(`This value was thrown as is, not through an Error: ${stringified}`);
}
//#endregion
//#region src/transport/Transport.ts
/**
* Default {@link ProviderRpcError} implementation. {@link BaseRpcTransport}
* throws this automatically when a JSON-RPC envelope returns
* `{ error: { code, message, data } }`.
*/
var TransportRpcError = class extends Error {
	code;
	data;
	/**
	* @param code - Numeric JSON-RPC error code (e.g. -32601 for METHOD_NOT_FOUND)
	* @param message - Human-readable error description
	* @param data - Optional additional data returned by the RPC server
	*/
	constructor(code, message, data) {
		super(message);
		this.name = "TransportRpcError";
		this.code = code;
		this.data = data;
	}
};
/**
* Narrowing helper for {@link EventfulTransport}.
*
* @param transport - Any transport to test
* @returns `true` when both `on` and `removeListener` methods are present
*/
function isEventfulTransport(transport) {
	const t = transport;
	return typeof t.on === "function" && typeof t.removeListener === "function";
}
//#endregion
//#region src/transport/BaseRpcTransport.ts
/**
* Optional convenience base class for users writing new wire-level
* {@link Transport} backends (WebSocket, IPC, custom HTTP, in-process mock,
* etc.). Handles JSON-RPC framing, id assignment, bigint serialization, and
* standard error parsing so subclasses implement only the byte-level
* `send(envelope, options)` hook.
*
* Users who already have a {@link Transport} in hand (window.ethereum, viem
* `WalletClient`, ethers `Eip1193Provider`-shaped object, etc.) do NOT need
* this class — they pass their object directly.
*
* @example
* ```ts
* class WebSocketTransport extends BaseRpcTransport {
*   protected async send(envelope) {
*     // serialize envelope to JSON, send over the socket, await response
*     return JSON.parse(await this.socket.sendAndAwait(JSON.stringify(envelope)));
*   }
* }
* ```
*/
var BaseRpcTransport = class BaseRpcTransport {
	nextId = 1;
	/**
	* Build a JSON-RPC envelope, delegate the wire I/O to the subclass's
	* {@link BaseRpcTransport.send} method, and parse the response.
	*
	* @throws {@link TransportRpcError} when the response contains an `error` field
	* @throws {@link TransportRpcError} (code -32603) when the response is malformed
	*/
	async request(args, options) {
		const envelope = {
			jsonrpc: "2.0",
			id: this.nextId++,
			method: args.method,
			params: args.params
		};
		const raw = await this.send(envelope, options);
		return BaseRpcTransport.parseResponse(raw);
	}
	/**
	* Serialize a JSON-RPC envelope to a string, converting bigint values to
	* `0x`-prefixed hex strings (preserving the historical SDK behavior).
	*/
	static serializeEnvelope(envelope) {
		return JSON.stringify(envelope, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value);
	}
	/**
	* Parse a decoded JSON-RPC response. Returns the `result` field on success
	* or throws a {@link TransportRpcError} on error / malformed response.
	*/
	static parseResponse(raw) {
		if (raw == null || typeof raw !== "object") throw new TransportRpcError(-32603, "malformed JSON-RPC response", raw);
		const response = raw;
		if (response.error != null) {
			if (typeof response.error === "object") {
				const { code, message, data } = response.error;
				throw new TransportRpcError(code, message, data);
			}
			throw new TransportRpcError(-32603, "malformed JSON-RPC response", raw);
		}
		if ("result" in response) return response.result;
		throw new TransportRpcError(-32603, "malformed JSON-RPC response", raw);
	}
};
//#endregion
//#region src/transport/HttpTransport.ts
/**
* Default concrete {@link Transport}: POSTs JSON-RPC envelopes to an HTTP
* endpoint. Used by every URL-string call site once a string is normalized
* into a transport.
*
* @example
* ```ts
* const t = new HttpTransport("https://api.candide.dev/public/v3/11155111");
* const chainId = await t.request<string>({ method: "eth_chainId" });
*
* // With auth headers and a custom fetch:
* const t2 = new HttpTransport("https://...", {
*   headers: { Authorization: `Bearer ${token}` },
*   fetch: myFetchWithRetry,
* });
* ```
*/
var HttpTransport = class HttpTransport extends BaseRpcTransport {
	/** Endpoint URL this transport POSTs to. */
	url;
	/** Options passed at construction time. */
	options;
	/**
	* @param url - JSON-RPC endpoint URL (bundler, paymaster, or node)
	* @param options - Optional fetch override and static headers
	*/
	constructor(url, options = {}) {
		super();
		this.url = url;
		this.options = options;
	}
	async send(envelope, options) {
		const headers = {
			...this.options.headers ?? {},
			"Content-Type": "application/json"
		};
		const body = HttpTransport.serializeEnvelope(envelope);
		const response = await (this.options.fetch ?? globalThis.fetch)(this.url, {
			method: "POST",
			headers,
			body,
			redirect: "follow",
			signal: options?.signal
		});
		const responseText = await response.text();
		let parsed;
		try {
			parsed = JSON.parse(responseText);
		} catch {
			throw new TransportRpcError(-32603, `HTTP ${response.status} ${response.statusText}: response body is not JSON`.trim(), responseText.slice(0, 1e3));
		}
		const rpcError = typeof parsed === "object" && parsed != null && "error" in parsed ? parsed.error : null;
		const hasRpcError = typeof rpcError === "object" && rpcError != null && typeof rpcError.code === "number" && typeof rpcError.message === "string";
		if (!response.ok && !hasRpcError) throw new TransportRpcError(-32603, `HTTP ${response.status} ${response.statusText}`.trim(), parsed);
		return parsed;
	}
};
/**
* Narrowing helper for {@link HttpTransport}. Useful for code that wants to
* read the underlying URL — e.g. when serializing a configured Bundler for
* logging or diagnostics.
*
* @example
* ```ts
* if (isHttpTransport(bundler.transport)) {
*   console.log("Bundler URL:", bundler.transport.url);
* }
* ```
*/
function isHttpTransport(transport) {
	return transport instanceof HttpTransport;
}
//#endregion
//#region src/types.ts
/**
* Specifies whether a transaction is a regular call or a delegatecall.
*/
let Operation = /* @__PURE__ */ function(Operation) {
	/** Standard call to the target address */
	Operation[Operation["Call"] = 0] = "Call";
	/** Delegatecall (executes target code in caller's context) */
	Operation[Operation["Delegate"] = 1] = "Delegate";
	return Operation;
}({});
/**
* Multiplier to determine the gas price. Higher values result in faster inclusion but higher cost.
*/
let GasOption = /* @__PURE__ */ function(GasOption) {
	/** 1x multiplier -- lowest cost, slowest inclusion */
	GasOption[GasOption["Slow"] = 1] = "Slow";
	/** 1.2x multiplier -- balanced cost and speed */
	GasOption[GasOption["Medium"] = 1.2] = "Medium";
	/** 1.5x multiplier -- highest cost, fastest inclusion */
	GasOption[GasOption["Fast"] = 1.5] = "Fast";
	return GasOption;
}({});
/** Polygon network identifier used to select the correct Polygon Gas Station endpoint. */
let PolygonChain = /* @__PURE__ */ function(PolygonChain) {
	PolygonChain["Mainnet"] = "v2";
	PolygonChain["ZkMainnet"] = "zkevm";
	PolygonChain["Amoy"] = "amoy";
	PolygonChain["Cardona"] = "cardona";
	return PolygonChain;
}({});
//#endregion
//#region src/transport/normalize.ts
/**
* Recursively convert any `bigint` values inside an RPC param to `0x`-prefixed
* hex strings, descending into arrays and plain objects. Other values pass
* through unchanged.
*
* Required for user-supplied {@link Transport} implementations that don't go
* through {@link BaseRpcTransport.serializeEnvelope} (EIP-1193 providers, viem
* clients, etc.) and would otherwise see raw `bigint`s in `params`. Mirrors the
* normalization done in {@link sendJsonRpcRequest}.
*
* @internal
*/
function normalizeRpcValue(value) {
	if (typeof value === "bigint") return `0x${value.toString(16)}`;
	if (Array.isArray(value)) return value.map(normalizeRpcValue);
	if (value !== null && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) out[k] = normalizeRpcValue(v);
		return out;
	}
	return value;
}
/**
* Wrap a {@link Transport} so every outbound `request` has its `params`
* normalized (bigints → 0x-hex) before delegation. Idempotent: wrapping an
* already-normalizing transport is harmless because the second pass sees only
* strings.
*
* Applied once at each service boundary (Bundler, CandidePaymaster,
* Erc7677Paymaster, JsonRpcNode, …) so normalization is impossible to forget
* per-method. Required for user-supplied transports (EIP-1193 providers, viem
* clients, etc.) that don't route through {@link BaseRpcTransport.serializeEnvelope}.
*
* @internal
*/
function normalizingTransport(inner) {
	return { request(args, options) {
		const params = args.params == null ? args.params : normalizeRpcValue(args.params);
		return inner.request({
			method: args.method,
			params
		}, options);
	} };
}
//#endregion
//#region src/transport/JsonRpcNode.ts
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
/**
* High-level service class for the JSON-RPC node methods abstractionkit reads
* from. Intentionally NOT a general Ethereum client — only exposes the
* methods the SDK actually uses. For broader functionality, drop down to
* `.transport` and call `request({ method, params })` directly, or use a
* dedicated library like viem / ethers.
*
* Like {@link Bundler} and the paymaster classes, `JsonRpcNode` itself
* implements {@link Transport} so it can be passed back into any Transport
* position.
*
* @example
* ```ts
* const node = new JsonRpcNode("https://ethereum-sepolia.publicnode.com");
* const id = await node.chainId();
* const code = await node.getCode("0x...");
*
* // Also a Transport — can be slotted in:
* const bundler = new Bundler(node);  // bundler will speak through this node
* ```
*/
var JsonRpcNode = class JsonRpcNode {
	/**
	* The raw transport the user passed in (or {@link HttpTransport} when a URL
	* string was passed). Exposed for introspection — reading `.url`,
	* `isHttpTransport(...)` checks, passing it back into another service.
	*
	* Calls made directly on this field (`node.transport.request(...)`) go
	* to the raw transport and skip SDK-level behavior like bigint param
	* normalization. For SDK-pipeline behavior, use {@link JsonRpcNode.request}
	* or the typed methods.
	*/
	transport;
	/** Normalizing wrapper around {@link transport}, used for every SDK-outbound call. */
	outbound;
	/**
	* @param rpc - Node JSON-RPC endpoint URL, or any {@link Transport}
	*/
	constructor(rpc) {
		this.transport = typeof rpc === "string" ? new HttpTransport(rpc) : rpc;
		this.outbound = normalizingTransport(this.transport);
	}
	/**
	* Normalize any acceptable input into a {@link JsonRpcNode}. Used at every
	* public-API widening site (in account / paymaster classes). When the
	* input is already a `JsonRpcNode`, the same instance is returned by
	* reference, so a user's preconstructed `JsonRpcNode` is never re-wrapped.
	*
	* @param input - URL string, Transport, or existing JsonRpcNode
	*/
	static from(input) {
		return input instanceof JsonRpcNode ? input : new JsonRpcNode(input);
	}
	/**
	* Transport delegate. Routes through the normalizing wrapper so `bigint`
	* values in `params` are converted to `0x`-hex before reaching
	* user-supplied transports that don't go through
	* {@link BaseRpcTransport.serializeEnvelope}. Lets a `JsonRpcNode` itself
	* slot into any other transport position.
	*/
	request(args, options) {
		return this.outbound.request(args, options);
	}
	/**
	* `eth_chainId`. Returns the hex-encoded chain id (e.g. `"0xaa36a7"` for
	* Sepolia).
	*/
	async chainId(options) {
		try {
			const result = await this.outbound.request({ method: "eth_chainId" }, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_chainId returned ill formed data", { context: JSON.stringify(result) });
			return result;
		} catch (err) {
			throw translateNodeError(err, "eth_chainId");
		}
	}
	/**
	* `eth_blockNumber`. Returns the latest block number as a bigint.
	*/
	async blockNumber(options) {
		try {
			const result = await this.outbound.request({ method: "eth_blockNumber" }, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_blockNumber returned ill formed data", { context: JSON.stringify(result) });
			return BigInt(result);
		} catch (err) {
			throw translateNodeError(err, "eth_blockNumber");
		}
	}
	/**
	* `eth_getCode`. Returns the deployed bytecode at `address` at the given
	* block tag (default `"latest"`).
	*/
	async getCode(address, blockTag = "latest", options) {
		try {
			const result = await this.outbound.request({
				method: "eth_getCode",
				params: [address, blockTag]
			}, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_getCode returned ill formed data", { context: JSON.stringify(result) });
			return result;
		} catch (err) {
			throw translateNodeError(err, "eth_getCode");
		}
	}
	/**
	* `eth_getStorageAt`. Returns the 32-byte storage word at `slot` for
	* `address` at the given block tag (default `"latest"`), as a hex string.
	*/
	async getStorageAt(address, slot, blockTag = "latest", options) {
		try {
			const result = await this.outbound.request({
				method: "eth_getStorageAt",
				params: [
					address,
					slot,
					blockTag
				]
			}, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_getStorageAt returned ill formed data", { context: JSON.stringify(result) });
			return result;
		} catch (err) {
			throw translateNodeError(err, "eth_getStorageAt");
		}
	}
	/**
	* `eth_call`. Executes a read-only call against `to` and returns the raw
	* return data as a hex string. Supports state overrides via the optional
	* third parameter.
	*/
	async call(tx, blockTag = "latest", stateOverrides, options) {
		const params = stateOverrides == null ? [tx, blockTag] : [
			tx,
			blockTag,
			stateOverrides
		];
		try {
			const result = await this.outbound.request({
				method: "eth_call",
				params
			}, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_call returned ill formed data", { context: JSON.stringify(result) });
			return result;
		} catch (err) {
			throw translateNodeError(err, "eth_call");
		}
	}
	/**
	* `eth_getTransactionCount`. Returns the transaction count (account nonce
	* at the EOA level — not the EntryPoint nonce; see
	* {@link JsonRpcNode.getEntryPointNonce}) as a bigint.
	*/
	async getTransactionCount(address, blockTag = "latest", options) {
		try {
			const result = await this.outbound.request({
				method: "eth_getTransactionCount",
				params: [address, blockTag]
			}, options);
			if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_getTransactionCount returned ill formed data", { context: JSON.stringify(result) });
			return BigInt(result);
		} catch (err) {
			throw translateNodeError(err, "eth_getTransactionCount");
		}
	}
	/**
	* Fetch current gas prices and apply a level multiplier.
	*
	* Tries `eth_maxPriorityFeePerGas` + `eth_gasPrice` first (EIP-1559),
	* falling back to `eth_gasPrice` alone if the priority-fee method is
	* unsupported, and finally to a 1 gwei floor multiplied by `gasLevel`.
	*
	* @param gasLevel - {@link GasOption} multiplier (default: Medium = 1.2x)
	* @returns `[maxFeePerGas, maxPriorityFeePerGas]` as bigints
	*/
	async getFeeData(gasLevel = GasOption.Medium, options) {
		try {
			let gasPrice = null;
			let maxPriorityFeePerGas = null;
			try {
				const result = await this.outbound.request({ method: "eth_gasPrice" }, options);
				if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_gasPrice returned ill formed data", { context: JSON.stringify(result) });
				gasPrice = BigInt(result);
			} catch (err) {
				if (!isMethodNotSupportedError(err)) throw err;
			}
			try {
				const result = await this.outbound.request({ method: "eth_maxPriorityFeePerGas" }, options);
				if (typeof result !== "string") throw new AbstractionKitError("BAD_DATA", "eth_maxPriorityFeePerGas returned ill formed data", { context: JSON.stringify(result) });
				maxPriorityFeePerGas = BigInt(result);
			} catch (err) {
				if (!isMethodNotSupportedError(err)) throw err;
			}
			let maxFeePerGas;
			let priorityFee;
			if (gasPrice != null && maxPriorityFeePerGas != null) {
				maxFeePerGas = scaleBigIntByGasLevel(gasPrice, gasLevel);
				priorityFee = scaleBigIntByGasLevel(maxPriorityFeePerGas, gasLevel);
			} else if (gasPrice != null) {
				maxFeePerGas = scaleBigIntByGasLevel(gasPrice, gasLevel);
				priorityFee = maxFeePerGas;
			} else if (maxPriorityFeePerGas != null) {
				priorityFee = scaleBigIntByGasLevel(maxPriorityFeePerGas, gasLevel);
				maxFeePerGas = scaleBigIntByGasLevel(1000000000n, gasLevel);
			} else {
				maxFeePerGas = scaleBigIntByGasLevel(1000000000n, gasLevel);
				priorityFee = maxFeePerGas;
			}
			if (maxFeePerGas === 0n) maxFeePerGas = 1n;
			if (priorityFee === 0n) priorityFee = 1n;
			if (priorityFee > maxFeePerGas) maxFeePerGas = priorityFee;
			return [maxFeePerGas, priorityFee];
		} catch (err) {
			throw translateNodeError(err, "getFeeData");
		}
	}
	/**
	* Check whether an address is EIP-7702-delegated and return the delegatee
	* address. EIP-7702-delegated accounts have bytecode of the form
	* `0xef0100<20-byte-delegatee>` per the spec.
	*
	* @returns The checksummed delegatee address, or `null` if not delegated
	*/
	async getDelegatedAddress(accountAddress, options) {
		const code = (await this.getCode(accountAddress, "latest", options)).toLowerCase();
		if (code.length === 48 && code.startsWith("0xef0100")) return getAddress(`0x${code.slice(8)}`);
		return null;
	}
	/**
	* Fetch the smart account's nonce from the EntryPoint contract via
	* `eth_call`. This is the 4337 nonce (an EntryPoint-managed counter with
	* 192-bit parallel keys), not the EOA `eth_getTransactionCount`.
	*
	* @param entryPoint - EntryPoint contract address
	* @param account - Smart account address
	* @param key - Nonce key as a `bigint` (default `0n`). Different keys allow
	*   parallel nonce channels. `bigint` so the full `uint192` range is
	*   representable (a JS `number` would cap at 2^53−1).
	*/
	async getEntryPointNonce(entryPoint, account, key = 0n, options) {
		const data = "0x35567e1a" + encodeAbiParameters(["address", "uint192"], [account, key]).slice(2);
		const callResult = await this.call({
			from: ZERO_ADDRESS,
			to: entryPoint,
			data
		}, "latest", void 0, options);
		try {
			return BigInt(callResult);
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", "getNonce returned ill formed data", {
				cause: ensureError(err),
				context: callResult
			});
		}
	}
	/**
	* Get the EntryPoint deposit balance for an address.
	*
	* @returns The deposit balance in wei as a bigint
	*/
	async getEntryPointDeposit(address, entryPoint, options) {
		return (await this.getEntryPointDepositInfo(address, entryPoint, options)).deposit;
	}
	/**
	* Get the full {@link DepositInfo} for an address from the EntryPoint
	* contract.
	*/
	async getEntryPointDepositInfo(address, entryPoint, options) {
		const data = "0x5287ce12" + encodeAbiParameters(["address"], [address]).slice(2);
		const callResult = await this.call({
			from: ZERO_ADDRESS,
			to: entryPoint,
			data
		}, "latest", void 0, options);
		try {
			const decoded = decodeAbiParameters([
				"uint256",
				"bool",
				"uint112",
				"uint32",
				"uint48"
			], callResult);
			if (decoded.length !== 5) throw new AbstractionKitError("BAD_DATA", "getDepositInfo returned ill formed data", { context: JSON.stringify(decoded) });
			return {
				deposit: BigInt(decoded[0]),
				staked: Boolean(decoded[1]),
				stake: BigInt(decoded[2]),
				unstakeDelaySec: BigInt(decoded[3]),
				withdrawTime: BigInt(decoded[4])
			};
		} catch (err) {
			if (err instanceof AbstractionKitError) throw err;
			throw new AbstractionKitError("BAD_DATA", "getDepositInfo returned ill formed data", { cause: ensureError(err) });
		}
	}
};
/**
* Apply a fractional `gasLevel` multiplier (e.g. 1.2 = 120%) to a `bigint`
* gas price without going through JS number precision.
*
* The naive `BigInt(Math.ceil(Number(value) * gasLevel))` truncates any
* `value` above `Number.MAX_SAFE_INTEGER` (2^53 − 1 ≈ 9.0 × 10^15 wei),
* which is well within the range a chain can legitimately report
* (especially on testnets, fork networks, or anomalous mainnet spikes).
*
* Approach: scale the multiplier into integer space (three-decimal precision
* — sufficient for `GasOption` and any reasonable custom value), do the
* multiplication in `BigInt`, then ceiling-divide back down. Preserves the
* original `Math.ceil(...)` rounding behavior bit-for-bit on small values.
*
* @internal
*/
function scaleBigIntByGasLevel(value, gasLevel) {
	const scale = 1000n;
	return (value * BigInt(Math.round(gasLevel * Number(scale))) + scale - 1n) / scale;
}
/**
* Detect whether an error indicates the JSON-RPC method itself is not
* implemented by the node. Used by {@link JsonRpcNode.getFeeData} to fall
* back gracefully on chains that don't expose EIP-1559 fee methods, while
* still surfacing transport, auth, and parse errors to the caller.
*
* @internal
*/
function isMethodNotSupportedError(err) {
	if (err?.code === -32601) return true;
	const message = err?.message?.toLowerCase() ?? "";
	return message.includes("method not found") || message.includes("not supported") || message.includes("unsupported");
}
/**
* Translate a transport-level error (or already-wrapped {@link AbstractionKitError})
* into the `NODE_ERROR` outer / specific inner shape used by {@link JsonRpcNode}.
*
* - `AbstractionKitError` passes through unchanged (already domain-translated).
* - {@link ProviderRpcError} with a known JSON-RPC code → inner code from
*   {@link JsonRpcErrorDict}.
* - Anything else → inner `UNKNOWN_ERROR`.
*
* @internal
*/
function translateNodeError(err, method) {
	if (err instanceof AbstractionKitError) return err;
	const code = err?.code;
	const codeString = code != null ? String(code) : "";
	const innerCode = codeString in JsonRpcErrorDict ? JsonRpcErrorDict[codeString] : "UNKNOWN_ERROR";
	const error = ensureError(err);
	return new AbstractionKitError("NODE_ERROR", `node ${method} rpc call failed`, {
		cause: new AbstractionKitError(innerCode, error.message, { errno: code }),
		errno: code
	});
}
//#endregion
//#region src/Bundler.ts
/**
* JSON-RPC client for an ERC-4337 bundler.
*
* Accepts either a URL string (wrapped automatically in {@link HttpTransport})
* or any {@link Transport} — including a viem client, an EIP-1193 wallet
* provider, an in-process mock, or a user-composed fallback/retry transport.
*
* The class itself implements {@link Transport}, so a `Bundler` can be passed
* back into any other Transport position.
*
* Candide bundler endpoints:
* - `https://api.candide.dev/api/v3/{chainId}/{apiKey}` (authenticated)
* - `https://api.candide.dev/public/v3/{chainId}` (public)
*
* @example URL string (most common)
* ```ts
* const bundler = new Bundler("https://api.candide.dev/public/v3/11155111");
* const receipt = await bundler.getUserOperationReceipt(userOpHash);
* ```
*
* @example Custom transport (composed retry behavior)
* ```ts
* const retryingTransport: Transport = {
*   async request(args, options) {
*     for (let i = 0; i < 3; i++) {
*       try { return await inner.request(args, options); }
*       catch (e) { if (i === 2) throw e; await sleep(2 ** i * 100); }
*     }
*   },
* };
* const bundler = new Bundler(retryingTransport);
* ```
*/
var Bundler = class Bundler {
	/**
	* The raw transport the user passed in (or {@link HttpTransport} when a URL
	* string was passed). Exposed for introspection — reading `.url`,
	* `isHttpTransport(...)` checks, passing it back into another service.
	*
	* Calls made directly on this field (`bundler.transport.request(...)`) go
	* to the raw transport and skip SDK-level behavior like bigint param
	* normalization. For SDK-pipeline behavior, use {@link Bundler.request} or
	* the typed methods.
	*/
	transport;
	/** Normalizing wrapper around {@link transport}, used for every SDK-outbound call. */
	outbound;
	/**
	* @param rpc - Bundler JSON-RPC endpoint URL, or any {@link Transport}.
	*/
	constructor(rpc) {
		this.transport = typeof rpc === "string" ? new HttpTransport(rpc) : rpc;
		this.outbound = normalizingTransport(this.transport);
	}
	/**
	* Normalize any acceptable input into a `Bundler`. When the input is
	* already a `Bundler` instance, it is returned by reference (so a user's
	* pre-constructed Bundler is never re-wrapped and its transport is
	* reused for follow-up calls like {@link SendUseroperationResponse.included}).
	*
	* @param input - URL string, Transport, or existing Bundler
	*/
	static from(input) {
		return input instanceof Bundler ? input : new Bundler(input);
	}
	/**
	* Transport delegate. Forwards directly to the underlying
	* {@link Transport.request}. Lets a `Bundler` itself slot into any other
	* transport position.
	*/
	request(args, options) {
		return this.outbound.request(args, options);
	}
	/**
	* Get the bundler's chain ID.
	* @returns The chain ID as a hex-encoded string
	*/
	async chainId() {
		try {
			const chainId = await this.outbound.request({ method: "eth_chainId" });
			if (typeof chainId !== "string") throw new AbstractionKitError("BAD_DATA", "bundler eth_chainId rpc call failed");
			return chainId;
		} catch (err) {
			throw translateBundlerError(err, "eth_chainId");
		}
	}
	/**
	* Get EntryPoint addresses supported by this bundler.
	* @returns An array of supported EntryPoint contract addresses
	*/
	async supportedEntryPoints() {
		try {
			return await this.outbound.request({ method: "eth_supportedEntryPoints" });
		} catch (err) {
			throw translateBundlerError(err, "eth_supportedEntryPoints");
		}
	}
	/**
	* Estimate gas limits for a UserOperation.
	* @param useroperation - UserOperation to estimate gas for
	* @param entrypointAddress - Target EntryPoint address
	* @param state_override_set - Optional state overrides for estimation
	* @returns Gas estimation with callGasLimit, preVerificationGas, and verificationGasLimit
	*/
	async estimateUserOperationGas(useroperation, entrypointAddress, state_override_set) {
		try {
			const params = state_override_set == null ? [useroperation, entrypointAddress] : [
				useroperation,
				entrypointAddress,
				state_override_set
			];
			const res = await this.outbound.request({
				method: "eth_estimateUserOperationGas",
				params
			});
			const gasEstimationResult = {
				callGasLimit: BigInt(res.callGasLimit),
				preVerificationGas: BigInt(res.preVerificationGas),
				verificationGasLimit: BigInt(res.verificationGasLimit)
			};
			if (res.paymasterVerificationGasLimit != null) gasEstimationResult.paymasterVerificationGasLimit = BigInt(res.paymasterVerificationGasLimit);
			if (res.paymasterPostOpGasLimit != null) gasEstimationResult.paymasterPostOpGasLimit = BigInt(res.paymasterPostOpGasLimit);
			return gasEstimationResult;
		} catch (err) {
			throw translateBundlerError(err, "eth_estimateUserOperationGas");
		}
	}
	/**
	* Submit a signed UserOperation to the bundler for on-chain inclusion.
	* @param useroperation - The signed UserOperation to submit
	* @param entrypointAddress - Target EntryPoint address
	* @returns The UserOperation hash
	*/
	async sendUserOperation(useroperation, entrypointAddress) {
		try {
			return await this.outbound.request({
				method: "eth_sendUserOperation",
				params: [useroperation, entrypointAddress]
			});
		} catch (err) {
			throw translateBundlerError(err, "eth_sendUserOperation");
		}
	}
	/**
	* Get the receipt for a previously submitted UserOperation.
	* @param useroperationhash - The hash of the UserOperation to look up
	* @returns The receipt, or null if not yet included on-chain
	*/
	async getUserOperationReceipt(useroperationhash) {
		try {
			const jsonRpcResult = await this.outbound.request({
				method: "eth_getUserOperationReceipt",
				params: [useroperationhash]
			});
			if (jsonRpcResult == null) return null;
			const res = jsonRpcResult;
			const userOperationReceipt = {
				...res.receipt,
				blockNumber: BigInt(res.receipt.blockNumber),
				cumulativeGasUsed: BigInt(res.receipt.cumulativeGasUsed),
				gasUsed: BigInt(res.receipt.gasUsed),
				transactionIndex: BigInt(res.receipt.transactionIndex),
				effectiveGasPrice: res.receipt.effectiveGasPrice == null ? void 0 : BigInt(res.receipt.effectiveGasPrice)
			};
			return {
				...res,
				nonce: BigInt(res.nonce),
				actualGasCost: BigInt(res.actualGasCost),
				actualGasUsed: BigInt(res.actualGasUsed),
				receipt: userOperationReceipt
			};
		} catch (err) {
			throw translateBundlerError(err, "eth_getUserOperationReceipt", { useroperationhash });
		}
	}
	/**
	* Look up a UserOperation by its hash.
	* @param useroperationhash - The hash of the UserOperation to look up
	* @returns The UserOperation with metadata, or null if not found
	*/
	async getUserOperationByHash(useroperationhash) {
		try {
			const jsonRpcResult = await this.outbound.request({
				method: "eth_getUserOperationByHash",
				params: [useroperationhash]
			});
			if (jsonRpcResult == null) return null;
			const wireOp = jsonRpcResult.userOperation;
			const userOperation = { ...wireOp };
			for (const field of [
				"nonce",
				"callGasLimit",
				"verificationGasLimit",
				"preVerificationGas",
				"maxFeePerGas",
				"maxPriorityFeePerGas",
				"paymasterVerificationGasLimit",
				"paymasterPostOpGasLimit"
			]) if (wireOp[field] != null) userOperation[field] = BigInt(wireOp[field]);
			return {
				...jsonRpcResult,
				userOperation,
				blockNumber: jsonRpcResult.blockNumber == null ? null : BigInt(jsonRpcResult.blockNumber)
			};
		} catch (err) {
			throw translateBundlerError(err, "eth_getUserOperationByHash", { useroperationhash });
		}
	}
};
/**
* Translate a transport-level error (or already-wrapped
* {@link AbstractionKitError}) into the `BUNDLER_ERROR` outer / specific
* 4337-code inner shape used by {@link Bundler}.
*
* - `AbstractionKitError` passes through unchanged (already domain-translated).
* - {@link ProviderRpcError} with a known 4337 code → inner code from
*   {@link BundlerErrorCodeDict}; -32601 is the standard JSON-RPC
*   METHOD_NOT_FOUND (neither ERC-7769 nor bundler implementations assign
*   it any 4337-specific meaning — an invalid hash arrives as -32602).
* - Anything else → inner `UNKNOWN_ERROR`.
*
* @internal
*/
function translateBundlerError(err, method, context) {
	if (err instanceof AbstractionKitError) {
		if (err.code === "BUNDLER_ERROR") return err;
		const aaCode = err.aaCode ?? parseAaCode(err.message);
		return new AbstractionKitError("BUNDLER_ERROR", `bundler ${method} rpc call failed`, {
			cause: err,
			errno: err.errno,
			context,
			aaCode
		});
	}
	const code = err?.code;
	const codeString = code != null ? String(code) : "";
	let innerCode = codeString in BundlerErrorCodeDict ? BundlerErrorCodeDict[codeString] : "UNKNOWN_ERROR";
	if (codeString === "-32601") innerCode = "METHOD_NOT_FOUND";
	else if (codeString === "-32603") innerCode = "INTERNAL_ERROR";
	const error = ensureError(err);
	const aaCode = parseAaCode(error.message);
	return new AbstractionKitError("BUNDLER_ERROR", `bundler ${method} rpc call failed`, {
		cause: new AbstractionKitError(innerCode, error.message, {
			errno: code,
			aaCode
		}),
		errno: code,
		context,
		aaCode
	});
}
//#endregion
//#region src/constants.ts
/** The Ethereum zero address (0x0000...0000), used as a placeholder for empty/null addresses */
const ZeroAddress = "0x0000000000000000000000000000000000000000";
/** EntryPoint v0.9 contract address */
const ENTRYPOINT_V9 = "0x433709009B8330FDa32311DF1C2AFA402eD8D009";
/** EntryPoint v0.8 contract address */
const ENTRYPOINT_V8 = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
/** EntryPoint v0.7 contract address */
const ENTRYPOINT_V7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
/** EntryPoint v0.6 contract address */
const ENTRYPOINT_V6 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/**
* Safe fallback-handler storage slot: keccak256("fallback_manager.handler.address").
* The address of a Safe's fallback handler (which is the 4337 module) is stored
* in the lower 20 bytes of the word at this slot.
*/
const SAFE_FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
/** Safe L2 singleton v1.5.0 address and init hash */
const Safe_L2_V1_5_0 = {
	singletonAddress: "0xEdd160fEBBD92E350D4D398fb636302fccd67C7e",
	singletonInitHash: "0x1b94aebb5a7df6dff11d93589204a6bbc99b4b8c9014bf1d386d006c2c17a881"
};
/** Safe L2 singleton v1.4.1 address and init hash */
const Safe_L2_V1_4_1 = {
	singletonAddress: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
	singletonInitHash: "0xe298282cefe913ab5d282047161268a8222e4bd4ed106300c547894bbefd31ee"
};
/** Default placeholder values for gas estimation before actual values are known */
const BaseUserOperationDummyValues = {
	sender: ZeroAddress,
	nonce: 0n,
	callData: "0x",
	callGasLimit: 0n,
	verificationGasLimit: 0n,
	preVerificationGas: 0n,
	maxFeePerGas: 0n,
	maxPriorityFeePerGas: 0n,
	signature: "0x"
};
/** EIP-712 primary type string used when signing Safe UserOperations. */
const EIP712_SAFE_OPERATION_PRIMARY_TYPE = "SafeOp";
/** EIP-712 type definition for Safe UserOperation signing (EntryPoint v0.6) */
const EIP712_SAFE_OPERATION_V6_TYPE = { SafeOp: [
	{
		type: "address",
		name: "safe"
	},
	{
		type: "uint256",
		name: "nonce"
	},
	{
		type: "bytes",
		name: "initCode"
	},
	{
		type: "bytes",
		name: "callData"
	},
	{
		type: "uint256",
		name: "callGasLimit"
	},
	{
		type: "uint256",
		name: "verificationGasLimit"
	},
	{
		type: "uint256",
		name: "preVerificationGas"
	},
	{
		type: "uint256",
		name: "maxFeePerGas"
	},
	{
		type: "uint256",
		name: "maxPriorityFeePerGas"
	},
	{
		type: "bytes",
		name: "paymasterAndData"
	},
	{
		type: "uint48",
		name: "validAfter"
	},
	{
		type: "uint48",
		name: "validUntil"
	},
	{
		type: "address",
		name: "entryPoint"
	}
] };
/** EIP-712 type definition for Safe UserOperation signing (EntryPoint v0.7) */
const EIP712_SAFE_OPERATION_V7_TYPE = { SafeOp: [
	{
		type: "address",
		name: "safe"
	},
	{
		type: "uint256",
		name: "nonce"
	},
	{
		type: "bytes",
		name: "initCode"
	},
	{
		type: "bytes",
		name: "callData"
	},
	{
		type: "uint128",
		name: "verificationGasLimit"
	},
	{
		type: "uint128",
		name: "callGasLimit"
	},
	{
		type: "uint256",
		name: "preVerificationGas"
	},
	{
		type: "uint128",
		name: "maxPriorityFeePerGas"
	},
	{
		type: "uint128",
		name: "maxFeePerGas"
	},
	{
		type: "bytes",
		name: "paymasterAndData"
	},
	{
		type: "uint48",
		name: "validAfter"
	},
	{
		type: "uint48",
		name: "validUntil"
	},
	{
		type: "address",
		name: "entryPoint"
	}
] };
/** EIP-712 primary type string used when signing multi-chain Safe operations. */
const EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE = "MerkleTreeRoot";
/** EIP-712 type definition for multi-chain Safe operations using Merkle tree roots */
const EIP712_MULTI_CHAIN_OPERATIONS_TYPE = { MerkleTreeRoot: [{
	type: "bytes32",
	name: "merkleTreeRoot"
}] };
/** Default address for the secp256r1 (P-256) precompile used by WebAuthn verification */
const DEFAULT_SECP256R1_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000100";
/** Uniswap Calibur singleton v1.0.0 (EntryPoint v0.8) */
const CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS = "0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00";
//#endregion
//#region src/signer/negotiate.ts
/**
* Pick the best mutually-supported signing scheme for one signer against an
* account's accepted schemes. Later in the `accepted` array = lower preference;
* the account ranks by preference.
*
* Throws a detailed {@link AbstractionKitError} if no scheme overlaps,
* citing the signer's address, what the account accepts, and what the
* signer can do.
*/
function pickScheme(signer, accepted, context) {
	const signerCan = [];
	if (typeof signer.signTypedData === "function") signerCan.push("typedData");
	if (typeof signer.signHash === "function") signerCan.push("hash");
	for (const scheme of accepted) if (signerCan.includes(scheme)) return scheme;
	throw new AbstractionKitError("BAD_DATA", buildMismatchMessage({
		accountName: context.accountName,
		signerIndex: context.signerIndex,
		signerAddress: signer.address,
		accepted,
		signerCan
	}));
}
function buildMismatchMessage(params) {
	const { accountName, signerIndex, signerAddress, accepted, signerCan } = params;
	const canStr = signerCan.length > 0 ? signerCan.join(", ") : "none";
	return `No compatible signing scheme for signer[${signerIndex}] ${signerAddress}. ${accountName} accepts: [${accepted.join(", ")}]; signer provides: [${canStr}]. ` + (signerCan.length === 0 ? "ExternalSigner must implement at least one of `signHash` or `signTypedData`. " : "") + "Hint: `fromViem` / `fromEthersWallet` give both; `fromViemWalletClient` gives only `typedData` (use Safe for JSON-RPC wallets).";
}
/**
* Invoke a signer for one scheme. Keeps the dispatch in one place so the
* account-side code stays linear. `typedData` is optional: accounts that
* only accept the `"hash"` scheme can pass just `hash`.
*
* `context` is always forwarded to the signer so power-user implementations
* can inspect the userOp.
*/
async function invokeSigner(signer, scheme, payload) {
	if (scheme === "typedData") {
		if (typeof signer.signTypedData !== "function") throw new AbstractionKitError("BAD_DATA", `signer ${signer.address} is missing signTypedData`);
		if (!payload.typedData) throw new AbstractionKitError("BAD_DATA", `scheme "typedData" selected but no typedData payload provided`);
		return signer.signTypedData(payload.typedData, payload.context);
	}
	if (typeof signer.signHash !== "function") throw new AbstractionKitError("BAD_DATA", `signer ${signer.address} is missing signHash`);
	return signer.signHash(payload.hash, payload.context);
}
//#endregion
//#region src/utils7702.ts
const SET_CODE_TX_TYPE = "0x04";
/**
* Creates and signs a legacy (pre-EIP-1559) raw transaction using RLP encoding.
* @param chainId - The chain ID for replay protection.
* @param nonce - The sender's transaction nonce.
* @param gas_price - The gas price in wei.
* @param gas_limit - The maximum gas units for the transaction.
* @param destination - The recipient address (42-character hex string).
* @param value - The amount of ETH to send in wei.
* @param data - The transaction input data.
* @param eoaPrivateKey - The sender's private key for signing.
* @returns The RLP-encoded signed transaction as a hex string.
*/
function createAndSignLegacyRawTransaction(chainId, nonce, gas_price, gas_limit, destination, value, data, eoaPrivateKey) {
	if (chainId >= 2 ** 64) throw new RangeError("Invalid chainId.");
	if (nonce >= 2 ** 64) throw new RangeError("Invalid nonce.");
	if (destination.length !== 42) throw new RangeError("Invalid destination.");
	let payload = [
		bigintToBytes(nonce),
		bigintToBytes(gas_price),
		bigintToBytes(gas_limit),
		destination,
		bigintToBytes(value),
		data,
		bigintToBytes(chainId),
		bigintToBytes(0n),
		bigintToBytes(0n)
	];
	const signature = signHash$1(eoaPrivateKey, keccak256(encodeRlp(payload)));
	payload = [
		bigintToBytes(nonce),
		bigintToBytes(gas_price),
		bigintToBytes(gas_limit),
		destination,
		bigintToBytes(value),
		data,
		bigintToBytes(BigInt(signature.yParity) + chainId * 2n + 35n),
		bigintToBytes(BigInt(signature.r)),
		bigintToBytes(BigInt(signature.s))
	];
	return encodeRlp(payload);
}
function createAndSignEip7702DelegationAuthorization(chainId, address, nonce, signer) {
	const authHash = createEip7702DelegationAuthorizationHash(chainId, address, nonce);
	if (typeof signer === "string") {
		const signature = signHash(authHash, signer);
		return {
			chainId: bigintToHex(chainId),
			address,
			nonce: bigintToHex(nonce),
			yParity: bigintToHex(BigInt(signature.yParity)),
			r: bigintToHex(signature.r),
			s: bigintToHex(signature.s)
		};
	}
	return signer(authHash).then((rawSig) => {
		const sig = parseRawSignature(rawSig);
		return {
			chainId: bigintToHex(chainId),
			address,
			nonce: bigintToHex(nonce),
			yParity: bigintToHex(BigInt(sig.yParity)),
			r: bigintToHex(sig.r),
			s: bigintToHex(sig.s)
		};
	});
}
/**
* Creates and signs an EIP-7702 delegation revocation authorization.
* Sets the delegatee address to the zero address, which revokes the delegation
* and restores the EOA to a normal account.
*
* @param chainId - The chain ID the authorization is valid for.
* @param nonce - The EOA's authorization nonce at the time of signing.
* @param eoaPrivateKey - The EOA's private key for signing.
* @returns The signed delegation revocation authorization with hex-encoded values.
*/
function createRevokeDelegationAuthorization(chainId, nonce, eoaPrivateKey) {
	return createAndSignEip7702DelegationAuthorization(chainId, "0x0000000000000000000000000000000000000000", nonce, eoaPrivateKey);
}
/**
* Computes the keccak256 hash of an EIP-7702 delegation authorization.
* Uses the MAGIC prefix (0x05) as defined in the EIP-7702 spec.
* @param chainId - The chain ID the authorization is valid for.
* @param address - The contract address to delegate code from.
* @param nonce - The EOA's nonce at the time of signing.
* @returns The authorization hash as a hex string.
*/
function createEip7702DelegationAuthorizationHash(chainId, address, nonce) {
	return keccak256("0x05" + encodeRlp([
		bigintToBytes(chainId),
		address,
		bigintToBytes(nonce)
	]).slice(2));
}
/**
* Signs a hash using an EOA's private key.
* @param authHash - The hash to sign.
* @param eoaPrivateKey - The EOA's private key for signing.
* @returns An object containing the signature components: yParity, r, and s.
*/
function signHash(authHash, eoaPrivateKey) {
	const signature = signHash$1(eoaPrivateKey, authHash);
	return {
		yParity: signature.yParity,
		r: BigInt(signature.r),
		s: BigInt(signature.s)
	};
}
/**
* Creates and signs an EIP-7702 (set-code) raw transaction.
* Encodes the transaction with a type 0x04 prefix and includes the authorization list.
* @param chainId - The chain ID for replay protection.
* @param nonce - The sender's transaction nonce.
* @param max_priority_fee_per_gas - The maximum priority fee per gas (tip) in wei.
* @param max_fee_per_gas - The maximum total fee per gas in wei.
* @param gas_limit - The maximum gas units for the transaction.
* @param destination - The recipient address (42-character hex string).
* @param value - The amount of ETH to send in wei.
* @param data - The transaction input data.
* @param access_list - The EIP-2930 access list as [address, storageKeys] tuples.
* @param authorization_list - The list of signed EIP-7702 delegation authorizations.
* @param eoaPrivateKey - The sender's private key for signing.
* @returns The signed, RLP-encoded transaction with 0x04 type prefix.
*/
function createAndSignEip7702RawTransaction(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list, eoaPrivateKey) {
	const txHash = createEip7702TransactionHash(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list);
	const basePayload = encodeEip7702TransactionBaseList(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list);
	const signature = signHash(txHash, eoaPrivateKey);
	return SET_CODE_TX_TYPE + encodeRlp(basePayload.concat([
		bigintToBytes(BigInt(signature.yParity)),
		bigintToBytes(signature.r),
		bigintToBytes(signature.s)
	])).slice(2);
}
/**
* Computes the keccak256 hash of an EIP-7702 transaction for signing.
* @param chainId - The chain ID for replay protection.
* @param nonce - The sender's transaction nonce.
* @param max_priority_fee_per_gas - The maximum priority fee per gas (tip) in wei.
* @param max_fee_per_gas - The maximum total fee per gas in wei.
* @param gas_limit - The maximum gas units for the transaction.
* @param destination - The recipient address (42-character hex string).
* @param value - The amount of ETH to send in wei.
* @param data - The transaction input data.
* @param access_list - The EIP-2930 access list as [address, storageKeys] tuples.
* @param authorization_list - The list of signed EIP-7702 delegation authorizations.
* @returns The transaction hash as a hex string.
*/
function createEip7702TransactionHash(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list) {
	return keccak256(SET_CODE_TX_TYPE + encodeRlp(encodeEip7702TransactionBaseList(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list)).slice(2));
}
/**
* Encodes the base RLP list for an EIP-7702 transaction (without signature fields).
* Used internally to build the payload that gets hashed and signed.
*/
function encodeEip7702TransactionBaseList(chainId, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list) {
	if (chainId >= 2 ** 64) throw new RangeError("Invalid chainId.");
	if (nonce >= 2 ** 64) throw new RangeError("Invalid nonce.");
	if (destination.length !== 42) throw new RangeError("Invalid destination.");
	const encoded_auth_list = encodeAuthList(authorization_list);
	const encoded_access_list = encodeAccessList(access_list);
	return [
		bigintToBytes(chainId),
		bigintToBytes(nonce),
		bigintToBytes(max_priority_fee_per_gas),
		bigintToBytes(max_fee_per_gas),
		bigintToBytes(gas_limit),
		destination,
		bigintToBytes(value),
		data,
		encoded_access_list,
		encoded_auth_list
	];
}
/** Encodes an array of EIP-7702 authorizations into RLP-compatible nested arrays. */
function encodeAuthList(authorization_list) {
	const encoded_auth_list = [];
	for (const auth of authorization_list) {
		if (auth.address.length !== 42) throw new RangeError(`Invalid authorization list address: ${auth}`);
		const encoded_auth = [
			bigintToBytes(auth.chainId),
			auth.address,
			bigintToBytes(auth.nonce),
			bigintToBytes(BigInt(auth.yParity)),
			bigintToBytes(auth.r),
			bigintToBytes(auth.s)
		];
		encoded_auth_list.push(encoded_auth);
	}
	return encoded_auth_list;
}
/** Encodes an EIP-2930 access list into RLP-compatible nested arrays. */
function encodeAccessList(access_list) {
	const encoded_access_list = [];
	for (const [access_add, storage_arr] of access_list) {
		if (access_add.length !== 42) throw new RangeError(`Invalid access list address: ${access_add}`);
		const encoded_storage_list = [];
		for (const storage of storage_arr) {
			if (storage.length !== 66) throw new RangeError(`Invalid access list storage: ${storage}`);
			encoded_storage_list.push(getBytes(storage));
		}
		encoded_access_list.push([getBytes(access_add), encoded_storage_list]);
	}
	return encoded_access_list;
}
/** Converts a bigint to a Uint8Array of its big-endian byte representation. */
function bigintToBytes(bi) {
	return getBytes(toBeArray(bi));
}
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const SECP256K1_HALF_N = SECP256K1_N / 2n;
/**
* Parse a raw ECDSA signature into its components.
* Supports standard 65-byte (r + s + v) and EIP-2098 64-byte compact formats.
*
* High-s signatures are normalized to the complementary low-s form
* (s' = n - s, flipped yParity) rather than rejected. A high-s value is not
* a signer defect: plain ECDSA produces s uniformly across the range, so
* generic signers (AWS KMS, HSMs, WebCrypto) return high-s for ~half of all
* signatures — the low-s rule is an Ethereum canonicalization convention
* (EIP-2), not part of ECDSA. Per the EIP-2 rationale, the complementary
* signature is equally valid for the same signer and payload, so the
* conversion changes the encoding, not the authorization. Rejecting instead
* would fail nondeterministically on ~half of all signatures from such
* signers, and EIP-7702 makes the unnormalized failure mode silent: nodes
* validate s <= secp256k1n/2 per tuple and skip invalid tuples without
* error, so a high-s authorization would "succeed" without ever applying
* the delegation.
*
* @see https://eips.ethereum.org/EIPS/eip-2 - s-value bound and the
* malleability rationale (flipping s to secp256k1n - s with the v flip
* "would still be valid")
* @see https://eips.ethereum.org/EIPS/eip-7702 - Behavior steps: "Verify s
* is less than or equal to secp256k1n/2" and "If any step above fails,
* immediately stop processing the tuple and continue to the next tuple"
* @param rawSig - Hex string: 128 chars (EIP-2098 compact), or 130/132 chars (standard with 0x prefix)
* @returns An object with yParity (0 or 1), r, and s components (low-s normalized)
*/
function parseRawSignature(rawSig) {
	const sig = rawSig.startsWith("0x") ? rawSig.slice(2) : rawSig;
	if (sig.length !== 128 && sig.length !== 130) throw new RangeError(`invalid signature length: expected 128 (EIP-2098 compact) or 130 (standard) hex chars, got ${sig.length}`);
	const r = BigInt(`0x${sig.slice(0, 64)}`);
	let yParity;
	let s;
	if (sig.length === 128) {
		const yParityAndS = BigInt(`0x${sig.slice(64, 128)}`);
		yParity = Number(yParityAndS >> 255n & 1n);
		s = yParityAndS & (1n << 255n) - 1n;
	} else {
		s = BigInt(`0x${sig.slice(64, 128)}`);
		const v = parseInt(sig.slice(128, 130), 16);
		if (v !== 0 && v !== 1 && v !== 27 && v !== 28) throw new RangeError(`invalid signature v value: ${v}`);
		yParity = v >= 27 ? v - 27 : v;
	}
	if (s > SECP256K1_HALF_N) {
		s = SECP256K1_N - s;
		yParity = 1 - yParity;
	}
	return {
		yParity,
		r,
		s
	};
}
/**
* Converts a bigint to a 0x-prefixed hex string with even-length padding.
* @param value - The bigint value to convert.
* @returns The hex string representation (e.g., "0x01", "0xff").
*/
function bigintToHex(value) {
	const hex = value.toString(16);
	return hex.length % 2 ? `0x0${hex}` : `0x${hex}`;
}
//#endregion
//#region src/utils.ts
function buildDomainSeparator(chainId, entrypoint) {
	return keccak256(encodeAbiParameters(["(bytes32,bytes32,bytes32,uint256,address)"], [[
		"0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f",
		"0x364da28a5c92bcc87fe97c8813a6c6b8a3a049b0ea0a328fcb0b4f0e00337586",
		"0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6",
		chainId,
		entrypoint
	]]));
}
/**
* Compute the UserOperation hash for any supported EntryPoint version.
* This hash is what gets signed by the account owner(s).
* Automatically selects the correct packing format based on the entrypoint address.
*
* @param useroperation - UserOperation to hash
* @param entrypointAddress - EntryPoint contract address (determines hash format)
* @param chainId - Target chain ID
* @returns The UserOperation hash as a hex string
*/
function createUserOperationHash(useroperation, entrypointAddress, chainId) {
	let packedUserOperationHash;
	let userOperationHash;
	if (entrypointAddress.toLowerCase() === "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()) {
		packedUserOperationHash = keccak256(createPackedUserOperationV6(useroperation));
		userOperationHash = keccak256(encodeAbiParameters([
			"bytes32",
			"address",
			"uint256"
		], [
			packedUserOperationHash,
			entrypointAddress,
			chainId
		]));
	} else if (entrypointAddress.toLowerCase() === "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase()) {
		packedUserOperationHash = keccak256(createPackedUserOperationV7(useroperation));
		userOperationHash = keccak256(encodeAbiParameters([
			"bytes32",
			"address",
			"uint256"
		], [
			packedUserOperationHash,
			entrypointAddress,
			chainId
		]));
	} else if (entrypointAddress.toLowerCase() === "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108".toLowerCase()) {
		packedUserOperationHash = keccak256(createPackedUserOperationV8(useroperation));
		userOperationHash = keccak256(`0x1901${buildDomainSeparator(chainId, entrypointAddress).slice(2)}${packedUserOperationHash.slice(2)}`);
	} else if (entrypointAddress.toLowerCase() === "0x433709009B8330FDa32311DF1C2AFA402eD8D009".toLowerCase()) {
		packedUserOperationHash = keccak256(createPackedUserOperationV9(useroperation));
		userOperationHash = keccak256(`0x1901${buildDomainSeparator(chainId, entrypointAddress).slice(2)}${packedUserOperationHash.slice(2)}`);
	} else throw new RangeError(`unsupported entrypoint address: ${entrypointAddress}`);
	return userOperationHash;
}
/**
* @internal
* Reconstruct the packed `initCode` field for an EntryPoint v0.8/v0.9
* UserOperation. When `eip7702Auth.address` is set, the EIP-7702 delegatee
* address replaces the factory address in initCode (only `factoryData` is
* concatenated). Otherwise, behaves like v0.7 (`factory + factoryData`).
*
* Shared by {@link createPackedUserOperationV8} /
* {@link createPackedUserOperationV9} and Simple7702Account's typed-data
* builder. Not part of the public API; only `export`ed for cross-module
* use within the package and not re-exported from `src/abstractionkit.ts`.
*
* @param useroperation - V8 or V9 UserOperation to read fields from
* @returns Hex-encoded initCode
*/
function buildPackedInitCodeV8V9(useroperation) {
	if (useroperation.factory == null) return "0x";
	const eip7702Auth = useroperation.eip7702Auth;
	return (eip7702Auth != null && eip7702Auth.address != null ? eip7702Auth.address : useroperation.factory) + (useroperation.factoryData != null ? useroperation.factoryData.slice(2) : "");
}
/**
* @internal
* Pack `(verificationGasLimit, callGasLimit)` into a single `bytes32`
* (two uint128 values, big-endian). Matches the on-chain
* `PackedUserOperation.accountGasLimits` layout used by EntryPoint v0.7+.
*/
function packAccountGasLimits(verificationGasLimit, callGasLimit) {
	return "0x" + encodeAbiParameters(["uint128"], [verificationGasLimit]).slice(34) + encodeAbiParameters(["uint128"], [callGasLimit]).slice(34);
}
/**
* @internal
* Pack `(maxPriorityFeePerGas, maxFeePerGas)` into a single `bytes32`
* (two uint128 values, big-endian). Matches the on-chain
* `PackedUserOperation.gasFees` layout used by EntryPoint v0.7+.
*/
function packGasFees(maxPriorityFeePerGas, maxFeePerGas) {
	return "0x" + encodeAbiParameters(["uint128"], [maxPriorityFeePerGas]).slice(34) + encodeAbiParameters(["uint128"], [maxFeePerGas]).slice(34);
}
/**
* @internal
* Reconstruct the packed `paymasterAndData` field from a UserOperation's
* separate paymaster fields. Returns `0x` when no paymaster is set.
*
* For EntryPoint v0.9, when `paymasterData` ends with the parallel-paymaster
* signature magic suffix (`0x22e325a297439656`), the embedded signature is
* stripped so the userOpHash does not commit to the paymaster's signature
* over itself. Pass `stripV9PaymasterSig=false` to preserve the wire format.
*
* Shared by v7/v8/v9 packers and Simple7702Account's typed-data builder.
* Not part of the public API; only `export`ed for cross-module use within
* the package and not re-exported from `src/abstractionkit.ts`.
*
* @param useroperation - V7/V8/V9 UserOperation to read fields from
* @param stripV9PaymasterSig - Whether to strip the v0.9 paymaster signature suffix
* @returns Hex-encoded paymasterAndData
*/
function buildPaymasterAndData(useroperation, stripV9PaymasterSig = false) {
	if (useroperation.paymaster == null) return "0x";
	let paymasterAndData = useroperation.paymaster;
	if (useroperation.paymasterVerificationGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [useroperation.paymasterVerificationGasLimit]).slice(34);
	if (useroperation.paymasterPostOpGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [useroperation.paymasterPostOpGasLimit]).slice(34);
	if (useroperation.paymasterData != null) {
		const PAYMASTER_SIG_MAGIC = "22e325a297439656";
		if (stripV9PaymasterSig && useroperation.paymasterData.toLowerCase().endsWith(PAYMASTER_SIG_MAGIC)) {
			const sigLenHex = useroperation.paymasterData.slice(useroperation.paymasterData.length - 16 - 4, useroperation.paymasterData.length - 16);
			const sigLen = parseInt(sigLenHex, 16);
			const prefixEnd = useroperation.paymasterData.length - 16 - 4 - sigLen * 2;
			paymasterAndData += useroperation.paymasterData.slice(0, prefixEnd).replaceAll("0x", "") + PAYMASTER_SIG_MAGIC;
		} else paymasterAndData += useroperation.paymasterData.slice(2);
	}
	return paymasterAndData;
}
/**
* Build the EIP-712 typed data payload for a UserOperation under the
* EntryPoint v0.8 / v0.9 domain. The digest of the returned payload equals
* the `userOpHash` from {@link createUserOperationHash}, so signing it via
* `signTypedData` produces a signature that validates against the same hash
* as raw ECDSA over the `userOpHash`.
*
* Shared by EIP-7702 accounts (Simple7702, Calibur). Earlier EntryPoints
* define the userOpHash differently and don't fit this typed-data shape.
*
* @param userOperation - Unsigned UserOperation to wrap
* @param entrypointAddress - The EntryPoint contract address (must be v0.8 or v0.9)
* @param chainId - Target chain ID (must match the chain that will validate the signature)
* @returns EIP-712 {@link TypedData} payload ready for `signTypedData`
* @throws {AbstractionKitError} if `entrypointAddress` is not v0.8 / v0.9
*/
function getUserOperationEip712DataV8V9(userOperation, entrypointAddress, chainId) {
	const ep = entrypointAddress.toLowerCase();
	const isV9 = ep === ENTRYPOINT_V9.toLowerCase();
	if (ep !== "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108".toLowerCase() && !isV9) throw new AbstractionKitError("BAD_DATA", `getUserOperationEip712Data supports EntryPoint v0.8 / v0.9 only; got ${entrypointAddress}. Earlier EntryPoints define the userOpHash differently and require raw-hash signing.`);
	const initCode = buildPackedInitCodeV8V9(userOperation);
	const accountGasLimits = packAccountGasLimits(userOperation.verificationGasLimit, userOperation.callGasLimit);
	const gasFees = packGasFees(userOperation.maxPriorityFeePerGas, userOperation.maxFeePerGas);
	const paymasterAndData = buildPaymasterAndData(userOperation, isV9);
	return {
		domain: {
			name: "ERC4337",
			version: "1",
			chainId,
			verifyingContract: entrypointAddress
		},
		types: { PackedUserOperation: [
			{
				name: "sender",
				type: "address"
			},
			{
				name: "nonce",
				type: "uint256"
			},
			{
				name: "initCode",
				type: "bytes"
			},
			{
				name: "callData",
				type: "bytes"
			},
			{
				name: "accountGasLimits",
				type: "bytes32"
			},
			{
				name: "preVerificationGas",
				type: "uint256"
			},
			{
				name: "gasFees",
				type: "bytes32"
			},
			{
				name: "paymasterAndData",
				type: "bytes"
			}
		] },
		primaryType: "PackedUserOperation",
		message: {
			sender: userOperation.sender,
			nonce: userOperation.nonce,
			initCode,
			callData: userOperation.callData,
			accountGasLimits,
			preVerificationGas: userOperation.preVerificationGas,
			gasFees,
			paymasterAndData
		}
	};
}
/**
* Compute the EIP-712 digest of a UserOperation under the EntryPoint
* v0.8 / v0.9 domain. For these EntryPoints this digest IS the
* `userOpHash` ({@link createUserOperationHash}).
*
* @param userOperation - Unsigned UserOperation to hash
* @param entrypointAddress - The EntryPoint contract address (must be v0.8 or v0.9)
* @param chainId - Target chain ID
* @returns The EIP-712 digest as a hex string
* @throws {AbstractionKitError} if `entrypointAddress` is not v0.8 / v0.9
*/
function getUserOperationEip712HashV8V9(userOperation, entrypointAddress, chainId) {
	const data = getUserOperationEip712DataV8V9(userOperation, entrypointAddress, chainId);
	return hashTypedData(data.domain, data.types, data.message);
}
/**
* ABI-encode and pack a UserOperation for hashing (EntryPoint v0.6 format).
* Bytes fields (initCode, callData, paymasterAndData) are keccak256-hashed before packing.
*
* @param useroperation - UserOperation to pack
* @returns ABI-encoded packed UserOperation as a hex string
*/
function createPackedUserOperationV6(useroperation) {
	return encodeAbiParameters([
		"address",
		"uint256",
		"bytes32",
		"bytes32",
		"uint256",
		"uint256",
		"uint256",
		"uint256",
		"uint256",
		"bytes32"
	], [
		useroperation.sender,
		useroperation.nonce,
		keccak256(useroperation.initCode),
		keccak256(useroperation.callData),
		useroperation.callGasLimit,
		useroperation.verificationGasLimit,
		useroperation.preVerificationGas,
		useroperation.maxFeePerGas,
		useroperation.maxPriorityFeePerGas,
		keccak256(useroperation.paymasterAndData)
	]);
}
/**
* ABI-encode and pack a UserOperation for hashing (EntryPoint v0.7 format).
* Reconstructs initCode, accountGasLimits, gasFees, and paymasterAndData from separate fields.
*
* @param useroperation - UserOperation to pack
* @returns ABI-encoded packed UserOperation as a hex string
*/
function createPackedUserOperationV7(useroperation) {
	let initCode = "0x";
	if (useroperation.factory != null) {
		initCode = useroperation.factory;
		if (useroperation.factoryData != null) initCode += useroperation.factoryData.slice(2);
	}
	const accountGasLimits = packAccountGasLimits(useroperation.verificationGasLimit, useroperation.callGasLimit);
	const gasFees = packGasFees(useroperation.maxPriorityFeePerGas, useroperation.maxFeePerGas);
	const paymasterAndData = buildPaymasterAndData(useroperation);
	return encodeAbiParameters([
		"address",
		"uint256",
		"bytes32",
		"bytes32",
		"bytes32",
		"uint256",
		"bytes32",
		"bytes32"
	], [
		useroperation.sender,
		useroperation.nonce,
		keccak256(initCode),
		keccak256(useroperation.callData),
		accountGasLimits,
		useroperation.preVerificationGas,
		gasFees,
		keccak256(paymasterAndData)
	]);
}
/**
* ABI-encode and pack a UserOperation for hashing (EntryPoint v0.9 format).
*
* @param useroperation - UserOperation to pack
* @returns ABI-encoded packed UserOperation as a hex string
*/
function createPackedUserOperationV9(useroperation) {
	return baseCreatePackedUserOperationV8V9(useroperation, true);
}
/**
* ABI-encode and pack a UserOperation for hashing (EntryPoint v0.8 format).
*
* @param useroperation - UserOperation to pack
* @returns ABI-encoded packed UserOperation as a hex string
*/
function createPackedUserOperationV8(useroperation) {
	return baseCreatePackedUserOperationV8V9(useroperation, false);
}
/**
* Shared packer for EntryPoint v0.8 and v0.9 UserOperations.
* @param useroperation - UserOperation to pack
* @param is_v9 - If true, strips the paymaster signature suffix (v0.9-specific)
* @returns ABI-encoded packed UserOperation as a hex string
*/
function baseCreatePackedUserOperationV8V9(useroperation, is_v9) {
	const initCode = buildPackedInitCodeV8V9(useroperation);
	const accountGasLimits = packAccountGasLimits(useroperation.verificationGasLimit, useroperation.callGasLimit);
	const gasFees = packGasFees(useroperation.maxPriorityFeePerGas, useroperation.maxFeePerGas);
	const paymasterAndData = buildPaymasterAndData(useroperation, is_v9);
	return encodeAbiParameters([
		"bytes32",
		"address",
		"uint256",
		"bytes32",
		"bytes32",
		"bytes32",
		"uint256",
		"bytes32",
		"bytes32"
	], [
		"0x29a0bca4af4be3421398da00295e58e6d7de38cb492214754cb6a47507dd6f8e",
		useroperation.sender,
		useroperation.nonce,
		keccak256(initCode),
		keccak256(useroperation.callData),
		accountGasLimits,
		useroperation.preVerificationGas,
		gasFees,
		keccak256(paymasterAndData)
	]);
}
/**
* Encode a function call into ABI-encoded calldata.
*
* @param functionSelector - 4-byte hex function selector (e.g., "0xa9059cbb" for ERC-20 transfer)
* @param functionInputAbi - Array of ABI type strings (e.g., ["address", "uint256"])
* @param functionInputParameters - Array of parameter values matching the ABI types
* @returns ABI-encoded calldata as a hex string (selector + encoded parameters)
*
* @example
* const transferCallData = createCallData(
*   "0xa9059cbb",
*   ["address", "uint256"],
*   ["0xRecipientAddress", 1000000n],
* );
*/
function createCallData(functionSelector, functionInputAbi, functionInputParameters) {
	return functionSelector + encodeAbiParameters(functionInputAbi, functionInputParameters).slice(2);
}
/**
* Send a JSON-RPC 2.0 request to the specified endpoint.
*
* **External escape hatch.** Most SDK consumers should use one of the
* high-level service classes ({@link Bundler}, {@link CandidePaymaster},
* {@link Erc7677Paymaster}, {@link JsonRpcNode}) which translate errors into
* the SDK's domain vocabulary. This function is intentionally low-level: it
* speaks plain JSON-RPC and throws {@link TransportRpcError}
* (an EIP-1193-shaped `ProviderRpcError`) on RPC errors.
*
* Two execution modes:
* - **URL string:** issues a `fetch` POST directly. Supports custom `headers`
*   and a custom `paramsKeyName` for non-standard servers (e.g. APIs that
*   expect `"simulations"` instead of `"params"`).
* - **Transport / JsonRpcNode:** delegates to `.request({ method, params })`.
*   `headers` and `paramsKeyName` are ignored (those concerns belong to the
*   transport implementation).
*
* Automatically serializes `bigint` values in `params` as `0x`-prefixed hex.
*
* @param rpc - JSON-RPC endpoint URL, {@link Transport}, or {@link JsonRpcNode}
* @param method - The JSON-RPC method name (e.g., `"eth_call"`)
* @param params - The JSON-RPC parameters
* @param headers - Custom HTTP headers (URL inputs only; default Content-Type: application/json)
* @param paramsKeyName - Override the params key in the envelope (URL inputs only; default `"params"`)
* @returns The `result` (or non-standard equivalent) field from the JSON-RPC response
* @throws {@link TransportRpcError} when the response contains an `error` field
*/
async function sendJsonRpcRequest(rpc, method, params, headers = { "Content-Type": "application/json" }, paramsKeyName = "params") {
	const normalizedParams = JSON.parse(JSON.stringify(params, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value));
	if (typeof rpc !== "string") return JsonRpcNode.from(rpc).request({
		method,
		params: normalizedParams
	});
	const raw = JSON.stringify({
		method,
		[paramsKeyName]: normalizedParams,
		id: Date.now(),
		jsonrpc: "2.0"
	});
	const fetchResult = await fetch(rpc, {
		method: "POST",
		headers,
		body: raw,
		redirect: "follow"
	});
	const responseText = await fetchResult.text();
	let response;
	try {
		response = JSON.parse(responseText);
	} catch {
		throw new TransportRpcError(-32603, `HTTP ${fetchResult.status} ${fetchResult.statusText}: response body is not JSON`.trim(), responseText.slice(0, 1e3));
	}
	if (typeof response !== "object" || response === null) throw new TransportRpcError(-32603, `HTTP ${fetchResult.status} ${fetchResult.statusText}: malformed JSON-RPC response`.trim(), response);
	if (!fetchResult.ok) {
		const err = response.error;
		if (err != null && typeof err === "object") throw new TransportRpcError(err.code, err.message);
		throw new TransportRpcError(-32603, `HTTP ${fetchResult.status} ${fetchResult.statusText}`.trim(), response);
	}
	if ("result" in response) return response.result;
	if ("simulation_results" in response) return response.simulation_results;
	const err = response.error;
	if (err == null || typeof err !== "object") throw new TransportRpcError(-32603, `HTTP ${fetchResult.status} ${fetchResult.statusText}: malformed JSON-RPC response`.trim(), response);
	throw new TransportRpcError(err.code, err.message);
}
/**
* Get a 4-byte function selector from a Solidity-style function signature.
* Computed as the first 4 bytes of keccak256(signature).
* @param functionSignature - Solidity-style function signature, e.g. "mint(address)"
* @returns Function selector as a 0x-prefixed 10-character hex string
*
* @example
* getFunctionSelector("getNonce(address,uint192)"); // "0x35567e1a"
*/
function getFunctionSelector(functionSignature) {
	return id(functionSignature).slice(0, 10);
}
/**
* Fetch the account's nonce from the EntryPoint contract.
*
* Equivalent to `JsonRpcNode.from(rpc).getEntryPointNonce(entryPoint, account, key)`.
* Kept as a top-level export for backward compatibility with existing call
* sites; the first parameter widens from `string` to
* `string | Transport | JsonRpcNode` so users can pass a configured transport
* (with custom headers, retries, etc.) without restructuring their code.
*
* @param rpc - Ethereum JSON-RPC node URL, {@link Transport}, or {@link JsonRpcNode}
* @param entryPoint - EntryPoint contract address
* @param account - Smart account address to query
* @param key - Nonce key (default 0). Different keys allow parallel nonce
*   channels. Prefer a `bigint` — keys can be as large as `uint192`, beyond
*   what a JS `number` can represent; `number` is kept for backward
*   compatibility.
* @returns The current nonce as a bigint
*/
async function fetchAccountNonce(rpc, entryPoint, account, key = 0) {
	return JsonRpcNode.from(rpc).getEntryPointNonce(entryPoint, account, BigInt(key));
}
/**
* Fetch current gas prices from the Polygon Gas Station API.
*
* @param polygonChain - Target Polygon chain (Mainnet, Amoy, etc.)
* @param gasLevel - Gas price level (Slow, Medium, Fast)
* @returns A tuple of [maxFeePerGas, maxPriorityFeePerGas] as bigints
*/
async function fetchGasPricePolygon(polygonChain, gasLevel = GasOption.Medium) {
	const gasStationUrl = `https://gasstation.polygon.technology/${polygonChain}`;
	try {
		const response = await (await fetch(gasStationUrl)).json();
		let gasPrice;
		if (gasLevel === GasOption.Slow) gasPrice = response.safeLow;
		else if (gasLevel === GasOption.Medium) gasPrice = response.standard;
		else gasPrice = response.fast;
		let maxFeePerGas = BigInt(Math.ceil(Number(gasPrice.maxFee) * 1e9));
		let maxPriorityFeePerGas = BigInt(Math.ceil(Number(gasPrice.maxPriorityFee) * 1e9));
		if (maxFeePerGas === 0n) maxFeePerGas = 1n;
		if (maxPriorityFeePerGas === 0n) maxPriorityFeePerGas = 1n;
		return [maxFeePerGas, maxPriorityFeePerGas];
	} catch (err) {
		const error = ensureError(err);
		throw new AbstractionKitError("BAD_DATA", `fetching gas prices from ${gasStationUrl} failed.`, { cause: error });
	}
}
/**
* Calculate the maximum gas cost (in wei) that a UserOperation could consume.
* Uses different formulas for v0.6 (with paymaster multiplier) and v0.7+ UserOperations.
*
* @param useroperation - The UserOperation to calculate the max gas cost for
* @returns Maximum possible gas cost in wei as a bigint
*/
function calculateUserOperationMaxGasCost(useroperation) {
	if ("initCode" in useroperation) {
		const mul = useroperation.paymasterAndData !== "0x" && useroperation.paymasterAndData != null ? 3n : 1n;
		return (useroperation.callGasLimit + useroperation.verificationGasLimit * mul + useroperation.preVerificationGas) * useroperation.maxFeePerGas;
	} else return (useroperation.verificationGasLimit + useroperation.callGasLimit + (useroperation.paymasterVerificationGasLimit ?? 0n) + (useroperation.paymasterPostOpGasLimit ?? 0n) + useroperation.preVerificationGas) * useroperation.maxFeePerGas;
}
/**
* Calculate the maximum ERC-20 token cost of a UserOperation's gas at a given
* exchange rate: `(exchangeRate * maxGasCostWei) / 10^18`, floored to a
* minimum of 1 token smallest-unit so cheap-gas chains never round to zero.
*
* Shared by the token paymaster flows to compute `TokenQuote.tokenCost` and
* size the prepended approval, so the formula lives in one place.
*
* @param useroperation - The UserOperation to price. v0.8 and v0.9 share the
*   v0.7 gas fields and prefund formula.
* @param exchangeRate - Token smallest-units equivalent to 1 ETH (10^18 wei)
* @returns Maximum token cost in the token's smallest unit
*/
function calculateUserOperationErc20TokenCost(useroperation, exchangeRate) {
	const tokenCost = exchangeRate * calculateUserOperationMaxGasCost(useroperation) / 10n ** 18n;
	return tokenCost === 0n ? 1n : tokenCost;
}
/**
* @internal
* Internal dispatcher: routes to the Polygon Gas Station when a chain is
* provided, otherwise delegates to {@link JsonRpcNode.getFeeData}. Used by
* the account classes when assembling base UserOperation gas fields.
*/
async function handlefetchGasPrice(providerRpc, polygonGasStation, gasLevel = GasOption.Medium) {
	if (polygonGasStation != null) return fetchGasPricePolygon(polygonGasStation, gasLevel);
	if (providerRpc != null) return JsonRpcNode.from(providerRpc).getFeeData(gasLevel);
	throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if maxFeePerGas and maxPriorityFeePerGas are not overridden");
}
//#endregion
//#region src/account/SendUseroperationResponse.ts
/**
* Response object returned after submitting a UserOperation to a bundler.
* Provides the `included()` method to poll for on-chain inclusion.
*
* @example
* const response = await smartAccount.sendUserOperation(userOp, bundlerRpc);
* const receipt = await response.included();
*/
var SendUseroperationResponse = class {
	/** The hash of the submitted UserOperation */
	userOperationHash;
	/** The bundler client used for polling */
	bundler;
	/** The EntryPoint address the operation was submitted to */
	entrypointAddress;
	/**
	* @param userOperationHash - The hash of the submitted UserOperation
	* @param bundler - The bundler client to use for polling
	* @param entrypointAddress - The EntryPoint address
	*/
	constructor(userOperationHash, bundler, entrypointAddress) {
		this.bundler = bundler;
		this.userOperationHash = userOperationHash;
		this.entrypointAddress = entrypointAddress;
	}
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	/**
	* Poll the bundler for the UserOperation receipt until it is included on-chain or times out.
	*
	* @param timeoutInSeconds - Maximum time to wait for inclusion (default: 180s)
	* @param requestIntervalInSeconds - Time between polling requests (default: 2s)
	* @returns The UserOperation receipt once included
	* @throws RangeError if timeout or interval are <= 0, or timeout < interval
	* @throws AbstractionKitError with code "TIMEOUT" if the operation is not found within the timeout
	*/
	async included(timeoutInSeconds = 180, requestIntervalInSeconds = 2) {
		if (timeoutInSeconds <= 0 || requestIntervalInSeconds <= 0) throw new RangeError("timeoutInSeconds and requestIntervalInSeconds should be bigger than zero");
		if (timeoutInSeconds < requestIntervalInSeconds) throw new RangeError("timeoutInSeconds can't be less than requestIntervalInSeconds");
		let count = 0;
		while (count <= timeoutInSeconds) {
			await this.delay(requestIntervalInSeconds * 1e3);
			const res = await this.bundler.getUserOperationReceipt(this.userOperationHash);
			if (res == null) count += requestIntervalInSeconds;
			else return res;
		}
		throw new AbstractionKitError("TIMEOUT", "can't find useroperation", { context: this.userOperationHash });
	}
};
//#endregion
//#region src/account/SmartAccount.ts
/**
* Abstract base class for all smart account implementations.
* Defines common properties shared across account types (Safe, Simple, etc.).
*/
var SmartAccount = class {
	/** The on-chain address of the smart account */
	accountAddress;
	/** Proxy contract creation bytecode */
	static proxyByteCode;
	/** 4-byte function selector for the account initializer */
	static initializerFunctionSelector;
	/** ABI types for the initializer function parameters */
	static initializerFunctionInputAbi;
	/** 4-byte function selector for the executor function */
	static executorFunctionSelector;
	/** ABI types for the executor function parameters */
	static executorFunctionInputAbi;
	/**
	* @param accountAddress - The on-chain address of the smart account
	*/
	constructor(accountAddress) {
		this.accountAddress = accountAddress;
	}
};
//#endregion
//#region src/account/Calibur/types.ts
/**
* Key types supported by the Calibur smart account.
*/
let CaliburKeyType = /* @__PURE__ */ function(CaliburKeyType) {
	/** Raw P-256 (secp256r1) key */
	CaliburKeyType[CaliburKeyType["P256"] = 0] = "P256";
	/** WebAuthn-wrapped P-256 key (passkey) */
	CaliburKeyType[CaliburKeyType["WebAuthnP256"] = 1] = "WebAuthnP256";
	/** secp256k1 key (standard Ethereum EOA) */
	CaliburKeyType[CaliburKeyType["Secp256k1"] = 2] = "Secp256k1";
	return CaliburKeyType;
}({});
//#endregion
//#region src/account/Calibur/Calibur7702Account.ts
const DEFAULT_SINGLETON_ADDRESS = CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS;
/** Root key hash (bytes32 zero) — used for the EOA's own secp256k1 key */
const ROOT_KEY_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
/** executeUserOp selector — `executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)` from IAccountExecute */
const EXECUTE_USER_OP_SELECTOR = "0x8dd7712f";
/** register((uint8,bytes)) — registers a Key struct */
const REGISTER_SELECTOR = "0x30b1fa3b";
/** update(bytes32,uint256) — updates key settings */
const UPDATE_SELECTOR = "0xa58bb84a";
/** revoke(bytes32) — revokes a key by hash */
const REVOKE_SELECTOR = "0xb75c7dc6";
/** invalidateNonce(uint256) — invalidates nonces */
const INVALIDATE_NONCE_SELECTOR = "0xb70e36f0";
/** isRegistered(bytes32) */
const IS_REGISTERED_SELECTOR = "0x27258b22";
/** getKeySettings(bytes32) — returns packed Settings (uint256) */
const GET_KEY_SETTINGS_SELECTOR = "0x0f3ebf6e";
/** getKey(bytes32) — returns Key struct (uint8,bytes) */
const GET_KEY_SELECTOR = "0x12aaac70";
/** keyCount() */
const KEY_COUNT_SELECTOR = "0xfac750e0";
/** keyAt(uint256) — returns Key struct */
const KEY_AT_SELECTOR = "0x4223b5c2";
/**
* EIP-7702 smart account implementation for the Calibur (Uniswap) singleton.
* Calibur turns an EOA into a smart account via EIP-7702 delegation, providing
* batched transactions, passkey signing, ERC-4337 support, and per-key hooks.
*
* Unlike Safe accounts, there is no factory or proxy — the EOA IS the account.
* All transactions go through `executeUserOp(bytes)` with `BatchedCall` encoding.
*
* @example
* ```typescript
* const account = new Calibur7702Account("0xMyEOA");
* const userOp = await account.createUserOperation(
*     [{ to: "0xRecipient", value: 1000000000000000n, data: "0x" }],
*     nodeRpc, bundlerRpc,
*     { eip7702Auth: { chainId: 11155111n } }
* );
* userOp.signature = account.signUserOperation(userOp, privateKey, 11155111n);
* const response = await account.sendUserOperation(userOp, bundlerRpc);
* ```
*/
var Calibur7702Account = class Calibur7702Account extends SmartAccount {
	/** Function selector for `executeUserOp(bytes)` */
	static executorFunctionSelector = EXECUTE_USER_OP_SELECTOR;
	/**
	* Dummy ECDSA signature for gas estimation with root key signing.
	* Format: `abi.encode(bytes32 keyHash, bytes sig, bytes hookData)`
	*/
	static dummySignature = encodeAbiParameters([
		"bytes32",
		"bytes",
		"bytes"
	], [
		ROOT_KEY_HASH,
		"0xd2614025fc173b86704caf37b2fb447f7618101a0d31f5f304c777024cef38a060a29ee43fcf0c46f9107d4f670b8a85c2c017a1fe9e4af891f24f0be6ba5d671c",
		"0x"
	]);
	/**
	* Create a dummy WebAuthn signature for gas estimation with passkey signing.
	* The key hash must correspond to an actually registered key on the account,
	* otherwise the contract's `validateUserOp` will revert with `KeyDoesNotExist`.
	*
	* @param keyHash - The key hash of a registered passkey (from {@link getKeyHash})
	* @returns A dummy signature suitable for passing as `dummySignature` override
	*/
	static createDummyWebAuthnSignature(keyHash) {
		const dummyClientDataJSON = "{\"type\":\"webauthn.get\",\"challenge\":\"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\",\"origin\":\"https://example.com\",\"crossOrigin\":false}";
		return encodeAbiParameters([
			"bytes32",
			"bytes",
			"bytes"
		], [
			keyHash,
			encodeAbiParameters(["(bytes,string,uint256,uint256,uint256,uint256)"], [[
				"0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000",
				dummyClientDataJSON,
				BigInt(dummyClientDataJSON.indexOf("\"challenge\":\"")),
				BigInt(dummyClientDataJSON.indexOf("\"type\":\"webauthn.get\"")),
				BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0"),
				BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0")
			]]),
			"0x"
		]);
	}
	/**
	* Wrap a raw ECDSA signature in Calibur's signature format:
	* `abi.encode(bytes32 keyHash, bytes signature, bytes hookData)`.
	*
	* Use this when signing externally (e.g., with viem, hardware wallet, MPC)
	* to avoid manually ABI-encoding the wrapped signature.
	*
	* @param keyHash - The key hash (use ROOT_KEY_HASH `0x00...00` for the EOA's root key)
	* @param rawSignature - The raw ECDSA signature (65 bytes, hex-encoded)
	* @param hookData - Optional hook data (default: "0x")
	* @returns Hex-encoded wrapped signature ready for `userOp.signature`
	*/
	static wrapSignature(keyHash, rawSignature, hookData = "0x") {
		return encodeAbiParameters([
			"bytes32",
			"bytes",
			"bytes"
		], [
			keyHash,
			rawSignature,
			hookData
		]);
	}
	/**
	* Format a raw EIP-712 signature (from `signTypedData` over the payload
	* returned by {@link getUserOperationEip712Data}) into Calibur's
	* `userOp.signature` layout. Provided for API parity with Safe's
	* `formatEip712SingleSignatureToUseroperationSignature`.
	*
	* Under EntryPoint v0.8 / v0.9 the userOpHash IS the EIP-712 digest of
	* the PackedUserOperation, so a raw-hash signature and a typed-data
	* signature are byte-identical for deterministic-ECDSA signers; this
	* method is therefore equivalent to {@link wrapSignature} with the same
	* `keyHash` / `hookData`. The default `keyHash` is the root-key hash
	* (`bytes32(0)`), which selects the EOA's own secp256k1 key.
	*
	* @param signature - Raw ECDSA signature (65 bytes, hex-encoded) from
	*   `signTypedData` over the payload from {@link getUserOperationEip712Data}
	* @param overrides - Optional `keyHash` / `hookData` overrides
	* @returns Hex-encoded wrapped signature ready for `userOp.signature`
	*/
	static formatEip712SingleSignatureToUseroperationSignature(signature, overrides = {}) {
		const keyHash = overrides.keyHash ?? ROOT_KEY_HASH;
		const hookData = overrides.hookData ?? "0x";
		return Calibur7702Account.wrapSignature(keyHash, signature, hookData);
	}
	/** The EntryPoint contract address this account targets */
	entrypointAddress;
	/** The Calibur singleton (delegatee) contract address */
	delegateeAddress;
	/**
	* Create a new Calibur7702Account instance for an existing EOA.
	* @param accountAddress - The EOA address that will be (or already is) delegated via EIP-7702
	* @param overrides - Optional overrides for entrypoint and delegatee addresses
	* @param overrides.entrypointAddress - Custom EntryPoint address (defaults to EntryPoint v0.8)
	* @param overrides.delegateeAddress - Custom Calibur singleton address
	*/
	constructor(accountAddress, overrides = {}) {
		super(accountAddress);
		this.entrypointAddress = overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
		this.delegateeAddress = overrides.delegateeAddress ?? DEFAULT_SINGLETON_ADDRESS;
	}
	/**
	* Compute the UserOperation hash for this account's EntryPoint.
	* Convenience wrapper around the standalone `createUserOperationHash` that
	* automatically uses this account's EntryPoint address.
	*
	* @param userOperation - The UserOperation to hash
	* @param chainId - Target chain ID
	* @returns The UserOperation hash as a hex string
	*/
	getUserOperationHash(userOperation, chainId) {
		return createUserOperationHash(userOperation, this.entrypointAddress, chainId);
	}
	/**
	* Build the EIP-712 typed data payload for a UserOperation under the
	* EntryPoint v0.8 / v0.9 domain. Useful for wallets that can only sign
	* typed data (`eth_signTypedData_v4`) — the digest of the returned payload
	* equals the `userOpHash`, so a typed-data signature over it produces a
	* wrapped Calibur signature that validates against the same hash on-chain.
	*
	* Intended for the secp256k1 key path (root key or any registered
	* secondary secp256k1 key), since `eth_signTypedData_v4` only produces
	* secp256k1 signatures. P-256 and WebAuthn-P256 keys sign with their
	* own primitives — for those, use {@link getUserOperationEip712Hash}
	* (the digest), which is the value-to-be-signed regardless of key type.
	*
	* @param userOperation - Unsigned UserOperation to wrap
	* @param chainId - Target chain ID
	* @param overrides - Override the entrypoint address (defaults to EntryPoint v0.8)
	* @returns EIP-712 {@link TypedData} payload ready for `signTypedData`
	* @throws {AbstractionKitError} if the target EntryPoint is not v0.8 / v0.9.
	*/
	static getUserOperationEip712Data(userOperation, chainId, overrides = {}) {
		return getUserOperationEip712DataV8V9(userOperation, overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", chainId);
	}
	/**
	* Compute the EIP-712 digest of a UserOperation under the EntryPoint
	* v0.8 / v0.9 domain. For these EntryPoints this digest IS the
	* `userOpHash`; the wrapped Calibur signature is verified against this
	* hash on-chain.
	*
	* Universal across Calibur key types: secp256k1 and P-256 keys sign
	* this digest directly, each with their own signing primitive.
	*
	* @param userOperation - Unsigned UserOperation to hash
	* @param chainId - Target chain ID
	* @param overrides - Override the entrypoint address (defaults to EntryPoint v0.8)
	* @returns The EIP-712 digest as a hex string
	* @throws {AbstractionKitError} if the target EntryPoint is not v0.8 / v0.9.
	*/
	static getUserOperationEip712Hash(userOperation, chainId, overrides = {}) {
		return getUserOperationEip712HashV8V9(userOperation, overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", chainId);
	}
	/**
	* Encode calldata for `executeUserOp(bytes)` with BatchedCall format.
	* All transactions (even single ones) go through the same BatchedCall path.
	*
	* @param transactions - One or more transactions to encode
	* @param revertOnFailure - Whether to revert the entire batch if any call fails (default: true)
	* @returns Encoded calldata for the executeUserOp function
	*/
	static createAccountCallData(transactions, revertOnFailure = true) {
		return EXECUTE_USER_OP_SELECTOR + encodeAbiParameters(["((address,uint256,bytes)[],bool)"], [[transactions.map((tx) => [
			tx.to,
			tx.value,
			tx.data
		]), revertOnFailure]]).slice(2);
	}
	/**
	* Build an unsigned {@link UserOperationV8} from one or more transactions.
	* Determines nonce, fetches gas prices, estimates gas limits, and
	* optionally includes EIP-7702 authorization. All auto-determined
	* values can be overridden.
	*
	* @param transactions - One or more transactions to encode into callData
	* @param providerRpc - JSON-RPC endpoint for nonce and gas price queries
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides for gas, nonce, and EIP-7702 auth fields
	* @returns A promise resolving to an unsigned {@link UserOperationV8}
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		if (transactions.length < 1) throw new RangeError("There should be at least one transaction");
		let nonce = null;
		let nonceOp = null;
		if (overrides.nonce == null) if (providerRpc != null) nonceOp = fetchAccountNonce(providerRpc, this.entrypointAddress, this.accountAddress);
		else throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if nonce is not overridden");
		else nonce = overrides.nonce;
		if (typeof overrides.maxFeePerGas === "bigint" && overrides.maxFeePerGas < 0n) throw new RangeError("maxFeePerGas override can't be negative");
		if (typeof overrides.maxPriorityFeePerGas === "bigint" && overrides.maxPriorityFeePerGas < 0n) throw new RangeError("maxPriorityFeePerGas override can't be negative");
		let maxFeePerGas = BaseUserOperationDummyValues.maxFeePerGas;
		let maxPriorityFeePerGas = BaseUserOperationDummyValues.maxPriorityFeePerGas;
		let gasPriceOp = null;
		if (overrides.maxFeePerGas == null || overrides.maxPriorityFeePerGas == null) gasPriceOp = handlefetchGasPrice(providerRpc, overrides.polygonGasStation, overrides.gasLevel);
		let eip7702AuthChainId = null;
		let eip7702AuthAddress = null;
		let eip7702AuthNonce = null;
		if (overrides.eip7702Auth != null) {
			eip7702AuthChainId = overrides.eip7702Auth.chainId;
			eip7702AuthAddress = overrides.eip7702Auth.address ?? this.delegateeAddress;
			eip7702AuthNonce = overrides.eip7702Auth.nonce ?? null;
		}
		let skipEip7702Auth = false;
		let delegationCheckOp = null;
		if (overrides.eip7702Auth != null && providerRpc != null) delegationCheckOp = JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress).catch(() => null);
		if (overrides.eip7702Auth != null && eip7702AuthNonce == null) {
			let eip7702AuthNonceOp;
			if (providerRpc != null) eip7702AuthNonceOp = sendJsonRpcRequest(providerRpc, "eth_getTransactionCount", [this.accountAddress, "latest"]);
			else throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if eoaDelegatorNonce is not overridden");
			const ops = [eip7702AuthNonceOp];
			if (nonceOp != null) ops.push(nonceOp);
			if (gasPriceOp != null) ops.push(gasPriceOp);
			if (delegationCheckOp != null) ops.push(delegationCheckOp);
			const values = await Promise.all(ops);
			let idx = 0;
			eip7702AuthNonce = BigInt(values[idx++]);
			if (nonceOp != null) nonce = values[idx++];
			if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = values[idx++];
			if (delegationCheckOp != null) {
				const delegatedTo = values[idx++];
				if (delegatedTo != null && delegatedTo.toLowerCase() === eip7702AuthAddress.toLowerCase()) skipEip7702Auth = true;
			}
		} else if (overrides.eip7702Auth != null) {
			const ops = [];
			if (nonceOp != null) ops.push(nonceOp);
			if (gasPriceOp != null) ops.push(gasPriceOp);
			if (delegationCheckOp != null) ops.push(delegationCheckOp);
			if (ops.length > 0) {
				const values = await Promise.all(ops);
				let idx = 0;
				if (nonceOp != null) nonce = values[idx++];
				if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = values[idx++];
				if (delegationCheckOp != null) {
					const delegatedTo = values[idx++];
					if (delegatedTo != null && delegatedTo.toLowerCase() === eip7702AuthAddress.toLowerCase()) skipEip7702Auth = true;
				}
			}
		} else if (gasPriceOp != null && nonceOp != null) await Promise.all([nonceOp, gasPriceOp]).then((values) => {
			nonce = values[0];
			[maxFeePerGas, maxPriorityFeePerGas] = values[1];
		});
		else if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = await gasPriceOp;
		else if (nonceOp != null) nonce = await nonceOp;
		maxFeePerGas = overrides.maxFeePerGas ?? BigInt(Math.floor(Number(maxFeePerGas) * (((overrides.maxFeePerGasPercentageMultiplier ?? 0) + 100) / 100)));
		maxPriorityFeePerGas = overrides.maxPriorityFeePerGas ?? BigInt(Math.floor(Number(maxPriorityFeePerGas) * (((overrides.maxPriorityFeePerGasPercentageMultiplier ?? 0) + 100) / 100)));
		if (nonce == null) throw new RangeError("failed to determine nonce");
		else if (nonce < 0n) throw new RangeError("nonce can't be negative");
		let callData = "0x";
		if (overrides.callData == null) callData = Calibur7702Account.createAccountCallData(transactions, overrides.revertOnFailure ?? true);
		else callData = overrides.callData;
		const pmFields = overrides.paymasterFields;
		let userOperation;
		if (overrides.eip7702Auth != null && !skipEip7702Auth) {
			const yParity = overrides.eip7702Auth.yParity ?? "0x0";
			if (yParity !== "0x0" && yParity !== "0x00" && yParity !== "0x1" && yParity !== "0x01") throw new AbstractionKitError("BAD_DATA", "invalid yParity value for eoaDelegatorSignature. must be '0x0' or '0x1'");
			const authorization = {
				chainId: bigintToHex(eip7702AuthChainId),
				address: eip7702AuthAddress,
				nonce: bigintToHex(eip7702AuthNonce),
				yParity,
				r: overrides.eip7702Auth.r ?? "0x4277ba564d2c138823415df0ec8e8f97f30825056d54ec5128a8b29ec2dd81b2",
				s: overrides.eip7702Auth.s ?? "0x1075a1bec7f59848cca899ece93075199cd2aabceb0654b9ae00b881a30044cd"
			};
			userOperation = {
				...BaseUserOperationDummyValues,
				sender: this.accountAddress,
				nonce,
				callData,
				maxFeePerGas,
				maxPriorityFeePerGas,
				factory: "0x7702",
				factoryData: null,
				paymaster: pmFields?.paymaster ?? null,
				paymasterVerificationGasLimit: pmFields?.paymasterVerificationGasLimit ?? null,
				paymasterPostOpGasLimit: pmFields?.paymasterPostOpGasLimit ?? null,
				paymasterData: pmFields?.paymasterData ?? null,
				eip7702Auth: authorization
			};
		} else userOperation = {
			...BaseUserOperationDummyValues,
			sender: this.accountAddress,
			nonce,
			callData,
			maxFeePerGas,
			maxPriorityFeePerGas,
			factory: null,
			factoryData: null,
			paymaster: pmFields?.paymaster ?? null,
			paymasterVerificationGasLimit: pmFields?.paymasterVerificationGasLimit ?? null,
			paymasterPostOpGasLimit: pmFields?.paymasterPostOpGasLimit ?? null,
			paymasterData: pmFields?.paymasterData ?? null,
			eip7702Auth: null
		};
		let preVerificationGas = BaseUserOperationDummyValues.preVerificationGas;
		let verificationGasLimit = BaseUserOperationDummyValues.verificationGasLimit;
		let callGasLimit = BaseUserOperationDummyValues.callGasLimit;
		if (!(overrides.skipGasEstimation ?? false) && (overrides.preVerificationGas == null || overrides.verificationGasLimit == null || overrides.callGasLimit == null)) if (bundlerRpc != null) {
			userOperation.callGasLimit = 0n;
			userOperation.verificationGasLimit = 0n;
			userOperation.preVerificationGas = 0n;
			const inputMaxFeePerGas = userOperation.maxFeePerGas;
			const inputMaxPriorityFeePerGas = userOperation.maxPriorityFeePerGas;
			userOperation.maxFeePerGas = 0n;
			userOperation.maxPriorityFeePerGas = 0n;
			const userOperationToEstimate = { ...userOperation };
			userOperationToEstimate.signature = overrides.dummySignature ?? Calibur7702Account.dummySignature;
			const estimation = await Bundler.from(bundlerRpc).estimateUserOperationGas(userOperationToEstimate, this.entrypointAddress, overrides.state_override_set);
			preVerificationGas = BigInt(estimation.preVerificationGas);
			verificationGasLimit = BigInt(estimation.verificationGasLimit);
			callGasLimit = BigInt(estimation.callGasLimit);
			verificationGasLimit += 55000n;
			userOperation.maxFeePerGas = inputMaxFeePerGas;
			userOperation.maxPriorityFeePerGas = inputMaxPriorityFeePerGas;
		} else throw new AbstractionKitError("BAD_DATA", "bundlerRpc can't be null if preVerificationGas,verificationGasLimit and callGasLimit are not overridden");
		if (typeof overrides.preVerificationGas === "bigint" && overrides.preVerificationGas < 0n) throw new RangeError("preVerificationGas override can't be negative");
		if (typeof overrides.verificationGasLimit === "bigint" && overrides.verificationGasLimit < 0n) throw new RangeError("verificationGasLimit override can't be negative");
		if (typeof overrides.callGasLimit === "bigint" && overrides.callGasLimit < 0n) throw new RangeError("callGasLimit override can't be negative");
		userOperation.preVerificationGas = overrides.preVerificationGas ?? BigInt(Math.floor(Number(preVerificationGas) * (((overrides.preVerificationGasPercentageMultiplier ?? 0) + 100) / 100)));
		userOperation.verificationGasLimit = overrides.verificationGasLimit ?? BigInt(Math.floor(Number(verificationGasLimit) * (((overrides.verificationGasLimitPercentageMultiplier ?? 0) + 100) / 100)));
		userOperation.callGasLimit = overrides.callGasLimit ?? BigInt(Math.floor(Number(callGasLimit) * (((overrides.callGasLimitPercentageMultiplier ?? 0) + 100) / 100)));
		userOperation.signature = overrides.dummySignature ?? Calibur7702Account.dummySignature;
		return userOperation;
	}
	/**
	* Sign a UserOperation with a private key.
	* Computes the UserOperation hash and wraps the ECDSA signature in
	* Calibur's format: `abi.encode(keyHash, ecdsaSig, hookData)`.
	*
	* By default signs with the root key. To sign with a registered
	* secondary key, pass its key hash via `overrides.keyHash`.
	*
	* @param userOperation - The UserOperation to sign
	* @param privateKey - Hex-encoded private key
	* @param chainId - Target chain ID
	* @param overrides - Optional overrides (keyHash for secondary keys, hookData)
	* @returns Hex-encoded wrapped signature
	*
	* @example
	* // Sign with root key
	* userOp.signature = account.signUserOperation(userOp, privateKey, chainId);
	*
	* // Sign with a registered secondary key
	* userOp.signature = account.signUserOperation(userOp, privateKey, chainId, { keyHash });
	*/
	signUserOperation(userOperation, privateKey, chainId, overrides = {}) {
		const userOperationHash = createUserOperationHash(userOperation, this.entrypointAddress, chainId);
		const keyHash = overrides.keyHash ?? ROOT_KEY_HASH;
		const hookData = overrides.hookData ?? "0x";
		const ecdsaSig = signHash$1(privateKey, userOperationHash).serialized;
		return Calibur7702Account.wrapSignature(keyHash, ecdsaSig, hookData);
	}
	/**
	* Schemes Calibur accepts from a Signer. EntryPoint v0.8/v0.9 introduced
	* an EIP-712 domain at the EntryPoint contract, and the userOpHash IS the
	* EIP-712 digest of the PackedUserOperation under that domain — so signing
	* the typed data and signing the raw hash produce signatures that verify
	* against the same `userOpHash` (and recover to the same signer address).
	* Deterministic-ECDSA signers (ethers, viem, MetaMask) yield byte-identical
	* bytes; signers that differ in `s` / `v` normalization still validate the
	* same on-chain.
	*
	* `typedData` is listed first so JSON-RPC wallets that can only sign typed
	* data work without a separate code path; `hash` remains a valid fallback
	* for local-key signers.
	*/
	static ACCEPTED_SIGNING_SCHEMES = ["typedData", "hash"];
	/**
	* Sign a UserOperation with an {@link ExternalSigner}. The signer can implement
	* either `signTypedData` (preferred — JSON-RPC wallets, viem `WalletClient`)
	* or `signHash` (local keys, hardware wallets). Both schemes produce
	* signatures that validate against the same `userOpHash` because the
	* v0.8 / v0.9 userOpHash IS the EIP-712 digest of the PackedUserOperation
	* (deterministic-ECDSA signers yield byte-identical bytes).
	*
	* Signers that implement neither method fail offline with an actionable
	* error.
	*/
	async signUserOperationWithSigner(userOperation, signer, chainId, overrides = {}) {
		const scheme = pickScheme(signer, Calibur7702Account.ACCEPTED_SIGNING_SCHEMES, {
			accountName: "Calibur (raw ECDSA over userOpHash)",
			signerIndex: 0
		});
		const hash = createUserOperationHash(userOperation, this.entrypointAddress, chainId);
		const context = {
			userOperation,
			chainId,
			entryPoint: this.entrypointAddress
		};
		const signature = await invokeSigner(signer, scheme, {
			hash,
			typedData: scheme === "typedData" ? Calibur7702Account.getUserOperationEip712Data(userOperation, chainId, { entrypointAddress: this.entrypointAddress }) : void 0,
			context
		});
		const keyHash = overrides.keyHash ?? ROOT_KEY_HASH;
		const hookData = overrides.hookData ?? "0x";
		return Calibur7702Account.wrapSignature(keyHash, signature, hookData);
	}
	/**
	* Format a WebAuthn (passkey) assertion into Calibur's signature format.
	* The challenge for the WebAuthn assertion should be `abi.encode(userOpHash)`.
	*
	* @param keyHash - The key hash of the registered passkey (from {@link getKeyHash})
	* @param webAuthnAuth - WebAuthn assertion data from the browser
	* @param overrides - Optional signature overrides (e.g., hookData)
	* @returns Hex-encoded wrapped signature
	*/
	formatWebAuthnSignature(keyHash, webAuthnAuth, overrides = {}) {
		const hookData = overrides.hookData ?? "0x";
		return encodeAbiParameters([
			"bytes32",
			"bytes",
			"bytes"
		], [
			keyHash,
			encodeAbiParameters(["(bytes,string,uint256,uint256,uint256,uint256)"], [[
				webAuthnAuth.authenticatorData,
				webAuthnAuth.clientDataJSON,
				webAuthnAuth.challengeIndex,
				webAuthnAuth.typeIndex,
				webAuthnAuth.r,
				webAuthnAuth.s
			]]),
			hookData
		]);
	}
	/**
	* Submit a signed UserOperation to a bundler for on-chain inclusion.
	*
	* @param userOperation - The signed UserOperation to submit
	* @param bundlerRpc - Bundler RPC endpoint
	* @returns A {@link SendUseroperationResponse} that can be used to wait for inclusion
	*/
	async sendUserOperation(userOperation, bundlerRpc) {
		const bundler = Bundler.from(bundlerRpc);
		return new SendUseroperationResponse(await bundler.sendUserOperation(userOperation, this.entrypointAddress), bundler, this.entrypointAddress);
	}
	/**
	* Create a secp256k1 key descriptor from an Ethereum address.
	* @param address - The Ethereum address (EOA public address)
	* @returns A {@link CaliburKey} with type Secp256k1
	*/
	static createSecp256k1Key(address) {
		return {
			keyType: CaliburKeyType.Secp256k1,
			publicKey: encodeAbiParameters(["address"], [address])
		};
	}
	/**
	* Create a WebAuthn P-256 key descriptor from public key coordinates.
	* @param x - The x coordinate of the P-256 public key
	* @param y - The y coordinate of the P-256 public key
	* @returns A {@link CaliburKey} with type WebAuthnP256
	*/
	static createWebAuthnP256Key(x, y) {
		return {
			keyType: CaliburKeyType.WebAuthnP256,
			publicKey: encodeAbiParameters(["uint256", "uint256"], [x, y])
		};
	}
	/**
	* Create a raw P-256 key descriptor from public key coordinates.
	* @param x - The x coordinate of the P-256 public key
	* @param y - The y coordinate of the P-256 public key
	* @returns A {@link CaliburKey} with type P256
	*/
	static createP256Key(x, y) {
		return {
			keyType: CaliburKeyType.P256,
			publicKey: encodeAbiParameters(["uint256", "uint256"], [x, y])
		};
	}
	/**
	* Compute the key hash for a Calibur key.
	* Uses double hashing: `keccak256(abi.encode(uint8 keyType, bytes32 keccak256(publicKey)))`.
	*
	* @param key - The key to hash
	* @returns The key hash as a bytes32 hex string
	*/
	static getKeyHash(key) {
		const innerHash = keccak256(key.publicKey);
		return keccak256(encodeAbiParameters(["uint8", "bytes32"], [key.keyType, innerHash]));
	}
	/**
	* Pack key settings into a single uint256 value.
	* Layout: `(isAdmin << 200) | (expiration << 160) | hook`
	*
	* @param settings - The key settings to pack
	* @returns The packed settings as a bigint
	*/
	static packKeySettings(settings) {
		const hook = BigInt(settings.hook ?? "0x0000000000000000000000000000000000000000");
		const expiration = BigInt(settings.expiration ?? 0);
		const isAdmin = settings.isAdmin ? 1n : 0n;
		if (expiration < 0n || expiration >= 1n << 40n) throw new RangeError(`expiration must be a unix timestamp in seconds that fits in 40 bits, got ${expiration}. Did you pass milliseconds instead of seconds?`);
		if (hook < 0n || hook >= 1n << 160n) throw new RangeError("hook must be a valid 20-byte address.");
		return isAdmin << 200n | expiration << 160n | hook;
	}
	/**
	* Unpack a uint256 settings value into a {@link CaliburKeySettingsResult} object.
	*
	* @param packed - The packed settings value
	* @returns Parsed key settings with all fields populated
	*/
	static unpackKeySettings(packed) {
		return {
			hook: `0x${(packed & (1n << 160n) - 1n).toString(16).padStart(40, "0")}`,
			expiration: Number(packed >> 160n & (1n << 40n) - 1n),
			isAdmin: (packed >> 200n & 1n) === 1n
		};
	}
	/**
	* Create meta-transactions to register a new key on the Calibur account.
	* Returns **two transactions**: `[register, update]`. Both must be included
	* in the same UserOperation.
	*
	* **Safety guardrail:** This method never sets `isAdmin: true` regardless
	* of input settings. Developers who need admin keys must encode calldata themselves.
	*
	* @param key - The key to register
	* @param settings - Optional key settings (isAdmin is always forced to false)
	* @returns A tuple of exactly two {@link SimpleMetaTransaction}s: [registerTx, updateTx].
	*          Both must be included in the same UserOperation.
	*/
	static createRegisterKeyMetaTransactions(key, settings = {}) {
		if (settings.isAdmin === true) throw new AbstractionKitError("BAD_DATA", "createRegisterKeyMetaTransactions does not allow setting isAdmin to true. Encode the calldata manually for admin keys.");
		const registerCallData = REGISTER_SELECTOR + encodeAbiParameters(["(uint8,bytes)"], [[key.keyType, key.publicKey]]).slice(2);
		const safeSettings = {
			...settings,
			isAdmin: false
		};
		const updateCallData = UPDATE_SELECTOR + encodeAbiParameters(["bytes32", "uint256"], [Calibur7702Account.getKeyHash(key), Calibur7702Account.packKeySettings(safeSettings)]).slice(2);
		return [{
			to: ZeroAddress,
			value: 0n,
			data: registerCallData
		}, {
			to: ZeroAddress,
			value: 0n,
			data: updateCallData
		}];
	}
	/**
	* Create a meta-transaction to revoke a key from the Calibur account.
	*
	* @param keyHash - The key hash to revoke
	* @returns A {@link SimpleMetaTransaction} that calls `revoke(bytes32)`
	*/
	static createRevokeKeyMetaTransaction(keyHash) {
		return {
			to: ZeroAddress,
			value: 0n,
			data: REVOKE_SELECTOR + encodeAbiParameters(["bytes32"], [keyHash]).slice(2)
		};
	}
	/**
	* Create meta-transactions to revoke ALL registered keys on this account.
	* Queries the on-chain key list and returns one `revoke(bytes32)` call per key.
	*
	* **Recommended before revoking EIP-7702 delegation** to prevent stale keys
	* from becoming active again if the EOA re-delegates later.
	*
	* @param providerRpc - JSON-RPC endpoint to query registered keys
	* @returns Array of {@link SimpleMetaTransaction}s — one revoke call per key.
	*          Empty array if no keys are registered.
	*
	* @example
	* ```typescript
	* // Step 1: Revoke all keys (send as UserOp)
	* const revokeTxs = await account.createRevokeAllKeysMetaTransactions(providerRpc);
	* if (revokeTxs.length > 0) {
	*     const userOp = await account.createUserOperation(revokeTxs, providerRpc, bundlerRpc);
	*     userOp.signature = account.signUserOperation(userOp, privateKey, chainId);
	*     const response = await account.sendUserOperation(userOp, bundlerRpc);
	*     await response.included();
	* }
	*
	* // Step 2: Revoke delegation
	* const rawTx = await account.createRevokeDelegationRawTransaction(chainId, privateKey, providerRpc);
	* ```
	*/
	async createRevokeAllKeysMetaTransactions(providerRpc) {
		return (await this.getKeys(providerRpc)).map((key) => {
			const keyHash = Calibur7702Account.getKeyHash(key);
			return Calibur7702Account.createRevokeKeyMetaTransaction(keyHash);
		});
	}
	/**
	* Create a signed raw transaction that revokes EIP-7702 delegation,
	* restoring this account to a plain EOA.
	*
	* **Recommended flow:** Call {@link createRevokeAllKeysMetaTransactions} first
	* and send the cleanup UserOp, then call this method to revoke delegation.
	* This prevents stale keys from reactivating if the EOA re-delegates later.
	*
	* @param chainId - Target chain ID
	* @param eoaPrivateKey - The EOA's private key for signing
	* @param providerRpc - JSON-RPC endpoint for nonce and gas price queries
	* @param overrides - Optional overrides for transaction parameters
	* @param overrides.nonce - Transaction nonce (fetched from provider if omitted)
	* @param overrides.authorizationNonce - EIP-7702 authorization nonce (defaults to txNonce + 1)
	* @param overrides.maxFeePerGas - Max fee per gas (fetched from provider if omitted)
	* @param overrides.maxPriorityFeePerGas - Max priority fee per gas (fetched if omitted)
	* @param overrides.gasLimit - Gas limit (defaults to 60,000)
	* @returns Hex-encoded signed EIP-7702 type-4 transaction ready for `eth_sendRawTransaction`
	* @throws {AbstractionKitError} If the account is not delegated or is delegated to a different address
	*
	* @example
	* ```typescript
	* const rawTx = await account.createRevokeDelegationRawTransaction(
	*     11155111n, privateKey, providerRpc,
	* );
	* await sendJsonRpcRequest(providerRpc, "eth_sendRawTransaction", [rawTx]);
	* ```
	*/
	async createRevokeDelegationRawTransaction(chainId, eoaPrivateKey, providerRpc, overrides = {}) {
		if (privateKeyToAddress(eoaPrivateKey).toLowerCase() !== this.accountAddress.toLowerCase()) throw new AbstractionKitError("BAD_DATA", `eoaPrivateKey does not match accountAddress (${this.accountAddress})`);
		const delegatedTo = await JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress);
		if (delegatedTo === null) throw new AbstractionKitError("BAD_DATA", "Account is not delegated — nothing to revoke");
		if (delegatedTo.toLowerCase() !== this.delegateeAddress.toLowerCase()) throw new AbstractionKitError("BAD_DATA", "Account is delegated to a different address (" + delegatedTo + "), not " + this.delegateeAddress + " — use the correct account class to revoke");
		const results = {};
		const ops = [];
		if (overrides.nonce == null) ops.push(sendJsonRpcRequest(providerRpc, "eth_getTransactionCount", [this.accountAddress, "latest"]).then((v) => {
			results.nonce = BigInt(v);
		}));
		if (overrides.maxFeePerGas == null || overrides.maxPriorityFeePerGas == null) ops.push(handlefetchGasPrice(providerRpc, void 0).then(([fee, tip]) => {
			results.maxFeePerGas = fee;
			results.maxPriorityFeePerGas = tip;
		}));
		if (ops.length > 0) await Promise.all(ops);
		const txNonce = overrides.nonce ?? results.nonce ?? 0n;
		const maxFeePerGas = overrides.maxFeePerGas ?? results.maxFeePerGas ?? 0n;
		const maxPriorityFeePerGas = overrides.maxPriorityFeePerGas ?? results.maxPriorityFeePerGas ?? 0n;
		const authHex = createRevokeDelegationAuthorization(chainId, overrides.authorizationNonce ?? txNonce + 1n, eoaPrivateKey);
		const auth = {
			chainId: BigInt(authHex.chainId),
			address: authHex.address,
			nonce: BigInt(authHex.nonce),
			yParity: BigInt(authHex.yParity) === 0n ? 0 : 1,
			r: BigInt(authHex.r),
			s: BigInt(authHex.s)
		};
		return createAndSignEip7702RawTransaction(chainId, txNonce, maxPriorityFeePerGas, maxFeePerGas, overrides.gasLimit ?? 60000n, this.accountAddress, 0n, "0x", [], [auth], eoaPrivateKey);
	}
	/**
	* Create a meta-transaction to update settings for a registered key.
	*
	* **Safety guardrail:** Throws if `settings.isAdmin` is `true`.
	* Developers who need admin keys must encode calldata themselves.
	*
	* @param keyHash - The key hash to update
	* @param settings - New settings for the key
	* @returns A {@link SimpleMetaTransaction} that calls `update(bytes32, uint256)`
	* @throws {AbstractionKitError} If settings.isAdmin is true
	*/
	static createUpdateKeySettingsMetaTransaction(keyHash, settings) {
		if (settings.isAdmin === true) throw new AbstractionKitError("BAD_DATA", "createUpdateKeySettingsMetaTransaction does not allow setting isAdmin to true. Encode the calldata manually for admin keys.");
		return {
			to: ZeroAddress,
			value: 0n,
			data: UPDATE_SELECTOR + encodeAbiParameters(["bytes32", "uint256"], [keyHash, Calibur7702Account.packKeySettings(settings)]).slice(2)
		};
	}
	/**
	* Create a meta-transaction to invalidate nonces up to a given value.
	*
	* @param newNonce - The new nonce value (all nonces below this are invalidated)
	* @returns A {@link SimpleMetaTransaction} that calls `invalidateNonce(uint256)`
	*/
	static createInvalidateNonceMetaTransaction(newNonce) {
		return {
			to: ZeroAddress,
			value: 0n,
			data: INVALIDATE_NONCE_SELECTOR + encodeAbiParameters(["uint256"], [newNonce]).slice(2)
		};
	}
	/**
	* Check if this EOA is delegated to this account's singleton (delegatee).
	* Returns `false` if not delegated at all or delegated to a different
	* singleton. Use {@link JsonRpcNode.getDelegatedAddress} to get the raw
	* delegatee address regardless of which singleton it is.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @returns True if the account is delegated to `this.delegateeAddress`
	*/
	async isDelegatedToThisAccount(providerRpc) {
		const address = await JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress);
		if (address === null) return false;
		return address.toLowerCase() === this.delegateeAddress.toLowerCase();
	}
	/**
	* Get the account nonce from the EntryPoint.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @param sequenceKey - Optional sequence key for parallel nonce channels (default: 0)
	* @returns The fully constructed nonce `(sequenceKey << 64) | seq`
	*/
	async getNonce(providerRpc, sequenceKey = 0) {
		return fetchAccountNonce(providerRpc, this.entrypointAddress, this.accountAddress, sequenceKey);
	}
	/**
	* Check if a key is registered on this account.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @param keyHash - The key hash to check
	* @returns True if the key is registered
	*/
	async isKeyRegistered(providerRpc, keyHash) {
		const callData = IS_REGISTERED_SELECTOR + encodeAbiParameters(["bytes32"], [keyHash]).slice(2);
		const result = await sendJsonRpcRequest(providerRpc, "eth_call", [{
			from: ZeroAddress,
			to: this.accountAddress,
			data: callData
		}, "latest"]);
		if (typeof result === "string") return decodeAbiParameters(["bool"], result)[0];
		throw new AbstractionKitError("BAD_DATA", "Unexpected response from isRegistered call");
	}
	/**
	* Get the settings for a registered key.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @param keyHash - The key hash to query
	* @returns Parsed {@link CaliburKeySettingsResult} with all fields populated
	*/
	async getKeySettings(providerRpc, keyHash) {
		const callData = GET_KEY_SETTINGS_SELECTOR + encodeAbiParameters(["bytes32"], [keyHash]).slice(2);
		const result = await sendJsonRpcRequest(providerRpc, "eth_call", [{
			from: ZeroAddress,
			to: this.accountAddress,
			data: callData
		}, "latest"]);
		if (typeof result === "string") {
			const decoded = decodeAbiParameters(["uint256"], result);
			return Calibur7702Account.unpackKeySettings(BigInt(decoded[0]));
		}
		throw new AbstractionKitError("BAD_DATA", "Unexpected response from getKeySettings call");
	}
	/**
	* Get the full key data for a registered key.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @param keyHash - The key hash to query
	* @returns Parsed {@link CaliburKey}
	*/
	async getKey(providerRpc, keyHash) {
		const callData = GET_KEY_SELECTOR + encodeAbiParameters(["bytes32"], [keyHash]).slice(2);
		const result = await sendJsonRpcRequest(providerRpc, "eth_call", [{
			from: ZeroAddress,
			to: this.accountAddress,
			data: callData
		}, "latest"]);
		if (typeof result === "string") {
			const keyTuple = decodeAbiParameters(["(uint8,bytes)"], result)[0];
			return {
				keyType: Number(keyTuple[0]),
				publicKey: keyTuple[1]
			};
		}
		throw new AbstractionKitError("BAD_DATA", "Unexpected response from getKey call");
	}
	/**
	* Get all keys registered on this account.
	* Iterates `keyCount()` + `keyAt(i)` to enumerate all keys.
	*
	* @param providerRpc - JSON-RPC endpoint
	* @param overrides - Optional overrides
	* @param overrides.blockNumber - Block number to query at. If omitted,
	*        fetches the current block number once and uses it for all reads.
	* @returns Array of registered {@link CaliburKey}s
	*/
	async getKeys(providerRpc, overrides = {}) {
		let blockTag;
		if (overrides.blockNumber != null) blockTag = `0x${overrides.blockNumber.toString(16)}`;
		else blockTag = await sendJsonRpcRequest(providerRpc, "eth_blockNumber", []);
		const countResult = await sendJsonRpcRequest(providerRpc, "eth_call", [{
			from: ZeroAddress,
			to: this.accountAddress,
			data: KEY_COUNT_SELECTOR
		}, blockTag]);
		if (typeof countResult !== "string") throw new AbstractionKitError("BAD_DATA", "Unexpected response from keyCount call");
		if (countResult === "0x" || countResult === "0x0") return [];
		const count = Number(BigInt(countResult));
		if (count === 0) return [];
		const keyAtPromises = [];
		for (let i = 0; i < count; i++) {
			const keyAtCallData = KEY_AT_SELECTOR + encodeAbiParameters(["uint256"], [i]).slice(2);
			keyAtPromises.push(sendJsonRpcRequest(providerRpc, "eth_call", [{
				from: ZeroAddress,
				to: this.accountAddress,
				data: keyAtCallData
			}, blockTag]));
		}
		const keyResults = await Promise.all(keyAtPromises);
		const keys = [];
		for (let i = 0; i < keyResults.length; i++) {
			const keyResult = keyResults[i];
			if (typeof keyResult !== "string") throw new AbstractionKitError("BAD_DATA", `Unexpected response from keyAt(${i}) call on ${this.accountAddress}`);
			const keyTuple = decodeAbiParameters(["(uint8,bytes)"], keyResult)[0];
			keys.push({
				keyType: Number(keyTuple[0]),
				publicKey: keyTuple[1]
			});
		}
		return keys;
	}
	/**
	* Prepend a token `approve` call to existing calldata for a token paymaster.
	* Decodes the existing BatchedCall, prepends an ERC-20 approve transaction,
	* and re-encodes.
	*
	* @param callData - Existing encoded calldata (executeUserOp format)
	* @param tokenAddress - ERC-20 token contract to approve
	* @param paymasterAddress - Paymaster address to approve as spender
	* @param approveAmount - Token amount to approve
	* @returns Re-encoded calldata with the approve transaction prepended
	*/
	prependTokenPaymasterApproveToCallData(callData, tokenAddress, paymasterAddress, approveAmount) {
		return Calibur7702Account.prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount);
	}
	/**
	* Static version of {@link prependTokenPaymasterApproveToCallData}.
	* Decodes existing executeUserOp calldata, prepends an ERC-20 approve call,
	* and re-encodes the BatchedCall.
	*
	* @param callData - Existing encoded calldata (executeUserOp format)
	* @param tokenAddress - ERC-20 token contract to approve
	* @param paymasterAddress - Paymaster address to approve as spender
	* @param approveAmount - Token amount to approve
	* @returns Re-encoded calldata with the approve transaction prepended
	*/
	static prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount) {
		const approveCallData = createCallData(getFunctionSelector("approve(address,uint256)"), ["address", "uint256"], [paymasterAddress, approveAmount]);
		if (!callData.startsWith(EXECUTE_USER_OP_SELECTOR)) throw new AbstractionKitError("BAD_DATA", "Invalid calldata, should start with " + EXECUTE_USER_OP_SELECTOR + " (executeUserOp selector)", { context: { callData } });
		const batchedCallDecoded = decodeAbiParameters(["((address,uint256,bytes)[],bool)"], `0x${callData.slice(10)}`);
		const existingCalls = batchedCallDecoded[0][0];
		const revertOnFailure = batchedCallDecoded[0][1];
		const decodedTransactions = existingCalls.map((call) => ({
			to: call[0],
			value: BigInt(call[1]),
			data: typeof call[2] !== "string" ? hexlify(call[2]) : call[2]
		}));
		decodedTransactions.unshift({
			to: tokenAddress,
			value: 0n,
			data: approveCallData
		});
		return EXECUTE_USER_OP_SELECTOR + encodeAbiParameters(["((address,uint256,bytes)[],bool)"], [[decodedTransactions.map((tx) => [
			tx.to,
			tx.value,
			tx.data
		]), revertOnFailure]]).slice(2);
	}
};
//#endregion
//#region src/factory/SmartAccountFactory.ts
/**
* Generic factory for deploying smart account proxy contracts.
* Encodes the factory address and createProxyWithNonce calldata into
* the `initCode` field of a UserOperation.
*/
var SmartAccountFactory = class {
	/** On-chain address of the factory contract */
	address;
	/** 4-byte function selector for the factory's proxy creation method */
	generatorFunctionSelector;
	/** ABI types for the proxy creation function parameters */
	generatorFunctionInputAbi;
	/**
	* @param address - On-chain address of the factory contract
	* @param generatorFunctionSelector - 4-byte hex selector for the proxy creation function
	* @param generatorFunctionInputAbi - ABI type strings for the proxy creation function parameters
	*/
	constructor(address, generatorFunctionSelector, generatorFunctionInputAbi) {
		this.address = address;
		this.generatorFunctionSelector = generatorFunctionSelector;
		this.generatorFunctionInputAbi = generatorFunctionInputAbi;
	}
	/**
	* Encode the factory function calldata for deploying a new account proxy.
	*
	* @param generatorFunctionInputParameters - Values to ABI-encode as the factory function parameters
	* @returns ABI-encoded calldata as a hex string
	*/
	getFactoryGeneratorFunctionCallData(generatorFunctionInputParameters) {
		return createCallData(this.generatorFunctionSelector, this.generatorFunctionInputAbi, generatorFunctionInputParameters);
	}
};
//#endregion
//#region src/factory/SafeAccountFactory.ts
/**
* Factory for deploying Safe proxy contracts via `createProxyWithNonce`.
* Pre-configured with the Safe proxy factory's function selector and ABI.
*/
var SafeAccountFactory = class SafeAccountFactory extends SmartAccountFactory {
	/** Default Safe proxy factory contract address */
	static DEFAULT_FACTORY_ADDRESS = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
	/**
	* @param address - Safe proxy factory contract address
	* @defaultValue "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"
	*/
	constructor(address = SafeAccountFactory.DEFAULT_FACTORY_ADDRESS) {
		super(address, "0x1688f0b9", [
			"address",
			"bytes",
			"uint256"
		]);
	}
};
//#endregion
//#region src/account/Safe/constants.ts
/** WebAuthn shared signer contract (Safe Passkey module v0.2.1). */
const DEFAULT_WEB_AUTHN_SHARED_SIGNER_V_0_2_1 = "0x94a4F6affBd8975951142c3999aEAB7ecee555c2";
/** WebAuthn signer singleton proxied by per-owner signers (Safe Passkey module v0.2.1). */
const DEFAULT_WEB_AUTHN_SIGNER_SINGLETON_V_0_2_1 = "0x4E27b51350e6c2083EE19011120F50DAfEc5CA50";
/** WebAuthn signer factory for deploying per-owner signer proxies (Safe Passkey module v0.2.1). */
const DEFAULT_WEB_AUTHN_SIGNER_FACTORY_V_0_2_1 = "0x1d31F259eE307358a26dFb23EB365939E8641195";
/** Runtime bytecode of the WebAuthn signer proxy (Safe Passkey module v0.2.1), used for CREATE2 address prediction. */
const DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE_V_0_2_1 = "0x610100346100ad57601f6101b538819003918201601f19168301916001600160401b038311848410176100b2578084926080946040528339810103126100ad578051906001600160a01b03821682036100ad5760208101516040820151606090920151926001600160b01b03841684036100ad5760805260a05260c05260e05260405160ec90816100c98239608051816082015260a05181604d015260c051816027015260e0518160010152f35b600080fd5b634e487b7160e01b600052604160045260246000fdfe7f000000000000000000000000000000000000000000000000000000000000000060b63601527f000000000000000000000000000000000000000000000000000000000000000060a03601527f000000000000000000000000000000000000000000000000000000000000000036608001523660006080376000806056360160807f00000000000000000000000000000000000000000000000000000000000000005af43d600060803e60b1573d6080fd5b3d6080f3fea26469706673582212201660515548d15702d720bbc046b457ca85e941a4559ab9f9518488e4c82e5ee964736f6c634300081a0033";
/** RIP-7951 secp256r1 precompile address (used for WebAuthn signature verification). */
const DEFAULT_WEB_AUTHN_PRECOMPILE_RIP_7951 = "0x0000000000000000000000000000000000000100";
/** Daimo P-256 verifier contract (fallback when the RIP-7951 precompile isn't available). */
const DEFAULT_WEB_AUTHN_DAIMO_VERIFIER_V_0_2_1 = "0xc2b78104907F722DABAc4C69f826a522B2754De4";
/**
* Safe 4337 multi-chain signature module (EntryPoint v0.9): the module of
* SafeMultiChainSigAccountV1 and the default for SafeAccount's `_V9` EIP-712 helpers.
*/
const DEFAULT_SAFE_4337_MULTI_CHAIN_SIG_MODULE_V1 = "0x22939E839e3c0F479B713eAF95e0df128554AEAd";
//#endregion
//#region src/utilsTenderly.ts
/**
* The 20-byte right-padded EIP-7702 marker EntryPoint v0.8+ expects at the
* head of `initCode` (any trailing bytes are the sender initialization call).
*/
const EIP7702_INITCODE_MARKER = "0x7702000000000000000000000000000000000000";
/**
* EIP-7702 userOps mark the factory field with a sentinel instead of a real
* factory: either the short form "0x7702" or the 20-byte right-padded form
* accepted by EntryPoint v0.8 (initCode starting with bytes 0x7702).
*/
function isEip7702FactorySentinel(factory) {
	if (factory == null) return false;
	const factoryLowerCase = factory.toLowerCase();
	return factoryLowerCase === "0x7702" || factoryLowerCase === EIP7702_INITCODE_MARKER;
}
/**
* Return a copy of `stateOverrides` with the sender's EIP-7702 delegation
* code merged in. Override keys are EVM addresses, so the sender entry is
* matched case-insensitively — a caller entry keyed by a checksummed address
* merges into one lowercase entry instead of duplicating the address.
* Multiple keys matching the sender (differing only in case) are rejected,
* matching callTenderlySimulateBundle's duplicate policy — collapsing them
* here would silently pick one entry's fields over the other's.
*/
function withSenderCodeOverride(stateOverrides, sender, delegationCode) {
	const senderLower = sender.toLowerCase();
	const merged = {};
	let senderEntry = null;
	for (const [address, entry] of Object.entries(stateOverrides ?? {})) if (address.toLowerCase() === senderLower) {
		if (senderEntry != null) throw new RangeError(`Duplicate stateOverrides address (case-insensitive): ${address}.`);
		senderEntry = entry;
	} else merged[address] = entry;
	merged[senderLower] = {
		...senderEntry ?? {},
		code: delegationCode
	};
	return merged;
}
/**
* Rebuild the packed `initCode` from split factory/factoryData fields,
* normalizing the short "0x7702" sentinel to the 20-byte right-padded marker
* so non-empty factoryData lands after a well-formed head.
*/
function buildWireInitCode(factory, factoryData) {
	if (factory == null) return "0x";
	let initCode = isEip7702FactorySentinel(factory) ? EIP7702_INITCODE_MARKER : factory;
	if (factoryData != null) initCode += factoryData.slice(2);
	return initCode;
}
/**
* Shares an existing Tenderly simulation so it can be viewed via a public link.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param tenderlySimulationId - The ID of the simulation to share.
*/
async function shareTenderlySimulationAndCreateLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, tenderlySimulationId) {
	const tenderlyUrl = "https://api.tenderly.co/api/v1/account/" + tenderlyAccountSlug + "/project/" + tenderlyProjectSlug + "/simulations/" + tenderlySimulationId + "/share";
	const status = (await fetch(tenderlyUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"X-Access-Key": tenderlyAccessKey
		},
		redirect: "follow"
	})).status;
	if (status !== 204) throw new AbstractionKitError("BAD_DATA", "tenderly share simulation failed.", { context: {
		tenderlyAccountSlug,
		tenderlyProjectSlug,
		hasTenderlyAccessKey: tenderlyAccessKey.length > 0,
		tenderlySimulationId,
		status
	} });
}
/**
* Simulates a full UserOperation via Tenderly's handleOps/handleUserOps entry
* and creates a shareable link.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param userOperation - The UserOperation to simulate (v0.6, v0.7, or v0.8).
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The simulation result and a shareable dashboard link.
*/
async function simulateUserOperationWithTenderlyAndCreateShareLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber = null, stateOverrides) {
	const simulation = await simulateUserOperationWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber, stateOverrides);
	await shareTenderlySimulationAndCreateLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, simulation.simulation.id);
	return {
		simulation,
		simulationShareLink: `https://dashboard.tenderly.co/shared/simulation/${simulation.simulation.id}`
	};
}
/**
* Simulates a full UserOperation via the EntryPoint's handleOps/handleUserOps
* function on Tenderly. Encodes the UserOperation into the appropriate calldata
* based on the EntryPoint version.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param userOperation - The UserOperation to simulate (v0.6, v0.7, or v0.8).
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The simulation result from Tenderly.
*/
async function simulateUserOperationWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber = null, stateOverrides) {
	const entrypointAddressLowerCase = entrypointAddress.toLowerCase();
	let callData = null;
	const isV6UserOperation = "initCode" in userOperation;
	if (isV6UserOperation !== (entrypointAddressLowerCase === "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789")) throw new RangeError("UserOperation version does not match entrypoint.");
	if (isV6UserOperation) {
		userOperation = userOperation;
		callData = `0x1fad948c${encodeAbiParameters(["(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[]", "address"], [[[
			userOperation.sender,
			userOperation.nonce,
			userOperation.initCode,
			userOperation.callData,
			userOperation.callGasLimit,
			userOperation.verificationGasLimit,
			userOperation.preVerificationGas,
			userOperation.maxFeePerGas,
			userOperation.maxPriorityFeePerGas,
			userOperation.paymasterAndData,
			userOperation.signature
		]], "0x1000000000000000000000000000000000000000"]).slice(2)}`;
	} else {
		userOperation = userOperation;
		const initCode = buildWireInitCode(userOperation.factory, userOperation.factoryData);
		const accountGasLimits = "0x" + encodeAbiParameters(["uint128"], [userOperation.verificationGasLimit]).slice(34) + encodeAbiParameters(["uint128"], [userOperation.callGasLimit]).slice(34);
		const gasFees = "0x" + encodeAbiParameters(["uint128"], [userOperation.maxPriorityFeePerGas]).slice(34) + encodeAbiParameters(["uint128"], [userOperation.maxFeePerGas]).slice(34);
		let paymasterAndData = "0x";
		if (userOperation.paymaster != null) {
			paymasterAndData = userOperation.paymaster;
			if (userOperation.paymasterVerificationGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [userOperation.paymasterVerificationGasLimit]).slice(34);
			if (userOperation.paymasterPostOpGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [userOperation.paymasterPostOpGasLimit]).slice(34);
			if (userOperation.paymasterData != null) paymasterAndData += userOperation.paymasterData.slice(2);
		}
		const encodedUserOperation = encodeAbiParameters(["(address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[]", "address"], [[[
			userOperation.sender,
			userOperation.nonce,
			initCode,
			userOperation.callData,
			accountGasLimits,
			userOperation.preVerificationGas,
			gasFees,
			paymasterAndData,
			userOperation.signature
		]], "0x1000000000000000000000000000000000000000"]);
		if (entrypointAddressLowerCase === "0x0000000071727de22e5e9d8baf0edac6f37da032" || entrypointAddressLowerCase === "0x4337084d9e255ff0702461cf8895ce9e3b5ff108" || entrypointAddressLowerCase === "0x433709009b8330fda32311df1c2afa402ed8d009") callData = `0x765e827f${encodedUserOperation.slice(2)}`;
		else throw new RangeError("Invalid entrypoint.");
	}
	if (!isV6UserOperation && isEip7702FactorySentinel(userOperation.factory)) {
		const eip7702Auth = userOperation.eip7702Auth;
		if (eip7702Auth != null && eip7702Auth.address != null) {
			const delegationCode = `0xef0100${eip7702Auth.address.toLowerCase().replace("0x", "")}`;
			stateOverrides = withSenderCodeOverride(stateOverrides, userOperation.sender, delegationCode);
		}
	}
	return (await callTenderlySimulateBundle(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, [{
		chainId,
		blockNumber,
		from: "0x1000000000000000000000000000000000000000",
		to: entrypointAddress,
		data: callData,
		stateOverrides
	}]))[0];
}
/**
* Simulates a UserOperation's callData (and optional account deployment) on
* Tenderly, then creates shareable links for each simulation.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param userOperation - The UserOperation to simulate (v0.6, v0.7, or v0.8 format).
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The simulation results and shareable dashboard links.
*/
async function simulateUserOperationCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber = null, stateOverrides) {
	const simulation = await simulateUserOperationCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber, stateOverrides);
	const simulationIds = simulation.map((s) => s.simulation.id);
	await Promise.all(simulationIds.map((simulationId) => shareTenderlySimulationAndCreateLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, simulationId)));
	const simulationLinks = simulationIds.map((s) => `https://dashboard.tenderly.co/shared/simulation/${s}`);
	if (simulationLinks.length === 1) return {
		simulation,
		callDataSimulationShareLink: simulationLinks[0]
	};
	else if (simulationLinks.length === 2) return {
		simulation,
		accountDeploymentSimulationShareLink: simulationLinks[0],
		callDataSimulationShareLink: simulationLinks[1]
	};
	else throw new AbstractionKitError("BAD_DATA", "invalid number of simulations returned", { context: JSON.stringify(simulation, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value) });
}
/**
* Simulates a UserOperation's callData on Tenderly by extracting the sender,
* callData, and factory info, then delegating to {@link simulateSenderCallDataWithTenderly}.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param userOperation - The UserOperation to simulate (v0.6, v0.7, or v0.8 format).
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The Tenderly simulation results.
*/
async function simulateUserOperationCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation, blockNumber = null, stateOverrides) {
	let factory = null;
	let factoryData = null;
	const entrypointAddressLowerCase = entrypointAddress.toLowerCase();
	if ("initCode" in userOperation !== (entrypointAddressLowerCase === "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789")) throw new RangeError("UserOperation version does not match entrypoint.");
	let callData = userOperation.callData;
	if ("initCode" in userOperation) {
		if (userOperation.initCode != null && userOperation.initCode.length > 2) {
			factory = userOperation.initCode.slice(0, 42);
			factoryData = `0x${userOperation.initCode.slice(42)}`;
		}
	} else {
		factory = userOperation.factory;
		factoryData = userOperation.factoryData;
		if (isEip7702FactorySentinel(factory)) {
			const eip7702Auth = userOperation.eip7702Auth;
			if (eip7702Auth != null && eip7702Auth.address != null) {
				const delegationCode = `0xef0100${eip7702Auth.address.toLowerCase().replace("0x", "")}`;
				stateOverrides = withSenderCodeOverride(stateOverrides, userOperation.sender, delegationCode);
			}
			if (factoryData != null && factoryData !== "0x") factory = userOperation.sender;
			else {
				factory = null;
				factoryData = null;
			}
		}
		const EXECUTE_USEROP_SELECTOR = "0x8dd7712f";
		if (callData.toLowerCase().startsWith(EXECUTE_USEROP_SELECTOR)) {
			const initCode = buildWireInitCode(userOperation.factory, userOperation.factoryData);
			const accountGasLimits = "0x" + encodeAbiParameters(["uint128"], [userOperation.verificationGasLimit]).slice(34) + encodeAbiParameters(["uint128"], [userOperation.callGasLimit]).slice(34);
			const gasFees = "0x" + encodeAbiParameters(["uint128"], [userOperation.maxPriorityFeePerGas]).slice(34) + encodeAbiParameters(["uint128"], [userOperation.maxFeePerGas]).slice(34);
			let paymasterAndData = "0x";
			if (userOperation.paymaster != null) {
				paymasterAndData = userOperation.paymaster;
				if (userOperation.paymasterVerificationGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [userOperation.paymasterVerificationGasLimit]).slice(34);
				if (userOperation.paymasterPostOpGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [userOperation.paymasterPostOpGasLimit]).slice(34);
				if (userOperation.paymasterData != null) paymasterAndData += userOperation.paymasterData.slice(2);
			}
			const userOpHash = createUserOperationHash(userOperation, entrypointAddress, chainId);
			callData = EXECUTE_USEROP_SELECTOR + encodeAbiParameters(["(address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)", "bytes32"], [[
				userOperation.sender,
				userOperation.nonce,
				initCode,
				userOperation.callData,
				accountGasLimits,
				userOperation.preVerificationGas,
				gasFees,
				paymasterAndData,
				userOperation.signature
			], userOpHash]).slice(2);
		}
	}
	return await simulateSenderCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, userOperation.sender, callData, factory, factoryData, blockNumber, stateOverrides);
}
/**
* Simulates the sender's callData (and optional account deployment) on Tenderly,
* then creates shareable links for each simulation.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param sender - The smart account address.
* @param callData - The encoded call data to simulate.
* @param factory - The factory contract address, or null if already deployed.
* @param factoryData - The factory initialization data, or null if already deployed.
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The simulation results and shareable dashboard links.
*/
async function simulateSenderCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, sender, callData, factory = null, factoryData = null, blockNumber = null, stateOverrides) {
	const simulation = await simulateSenderCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, sender, callData, factory, factoryData, blockNumber, stateOverrides);
	const simulationIds = simulation.map((s) => s.simulation.id);
	await Promise.all(simulationIds.map((simulationId) => shareTenderlySimulationAndCreateLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, simulationId)));
	const simulationLinks = simulationIds.map((s) => `https://dashboard.tenderly.co/shared/simulation/${s}`);
	if (simulationLinks.length === 1) return {
		simulation,
		callDataSimulationShareLink: simulationLinks[0]
	};
	else if (simulationLinks.length === 2) return {
		simulation,
		accountDeploymentSimulationShareLink: simulationLinks[0],
		callDataSimulationShareLink: simulationLinks[1]
	};
	else throw new AbstractionKitError("BAD_DATA", "invalid number of simulations returned", { context: JSON.stringify(simulation, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value) });
}
/**
* Simulates the sender's callData on Tenderly. If factory and factoryData are
* provided, simulates account deployment first, then the callData execution.
* Uses the appropriate SenderCreator address based on the EntryPoint version.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param chainId - The chain ID to simulate on.
* @param entrypointAddress - The EntryPoint contract address.
* @param sender - The smart account address.
* @param callData - The encoded call data to simulate.
* @param factory - The factory contract address, or null if already deployed.
* @param factoryData - The factory initialization data, or null if already deployed.
* @param blockNumber - Optional block number for the simulation.
* @param stateOverrides - Optional state overrides for the simulation.
* @returns The Tenderly simulation results (one or two entries depending on deployment).
*/
async function simulateSenderCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, entrypointAddress, sender, callData, factory = null, factoryData = null, blockNumber = null, stateOverrides) {
	const transactions = [];
	const entrypointAddressLowerCase = entrypointAddress.toLowerCase();
	let senderCreator;
	if (entrypointAddressLowerCase === "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789") senderCreator = "0x7fc98430eaedbb6070b35b39d798725049088348";
	else if (entrypointAddressLowerCase === "0x0000000071727de22e5e9d8baf0edac6f37da032") senderCreator = "0xefc2c1444ebcc4db75e7613d20c6a62ff67a167c";
	else if (entrypointAddressLowerCase === "0x4337084d9e255ff0702461cf8895ce9e3b5ff108") senderCreator = "0x449ed7c3e6fee6a97311d4b55475df59c44add33";
	else if (entrypointAddressLowerCase === "0x433709009b8330fda32311df1c2afa402ed8d009") senderCreator = "0x0A630a99Df908A81115A3022927Be82f9299987e";
	else throw new RangeError(`Invalid entrypoint: ${entrypointAddress}`);
	if (factory == null && factoryData != null || factory != null && factoryData == null) throw new RangeError(`Invalid factory and factoryData`);
	if (factory != null && factoryData != null) transactions.push({
		chainId,
		blockNumber,
		from: senderCreator,
		to: factory,
		data: factoryData,
		stateOverrides
	});
	transactions.push({
		chainId,
		blockNumber,
		from: entrypointAddress,
		to: sender,
		data: callData,
		stateOverrides
	});
	const simulationsResult = await callTenderlySimulateBundle(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, transactions);
	for (const simulationResult of simulationsResult) if (simulationResult.simulation.id === "") throw new AbstractionKitError("TENDERLY_SIMULATION_ERROR", "tenderly simulation failed", { context: JSON.stringify(simulationsResult, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value) });
	return simulationsResult;
}
/**
* Sends a bundle of transactions to Tenderly's simulate-bundle API endpoint.
* This is the low-level function that all other Tenderly simulation functions delegate to.
* @param tenderlyAccountSlug - The Tenderly account slug.
* @param tenderlyProjectSlug - The Tenderly project slug.
* @param tenderlyAccessKey - The Tenderly API access key.
* @param transactions - Array of transaction objects to simulate as a bundle.
* @returns The simulation results from Tenderly.
*/
async function callTenderlySimulateBundle(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, transactions) {
	const tenderlyUrl = "https://api.tenderly.co/api/v1/account/" + tenderlyAccountSlug + "/project/" + tenderlyProjectSlug + "/simulate-bundle";
	const simulations = transactions.map((transaction) => {
		const transactionObject = {
			network_id: transaction.chainId.toString(),
			save: transaction.save ?? true,
			save_if_fails: transaction.saveIfFails ?? true,
			from: transaction.from,
			to: transaction.to,
			input: transaction.data,
			simulation_type: transaction.simulationType ?? "full"
		};
		if (transaction.blockNumber != null) transactionObject.block_number = transaction.blockNumber;
		if (transaction.gas != null) transactionObject.gas = transaction.gas;
		if (transaction.gasPrice != null) transactionObject.gas_price = typeof transaction.gasPrice === "bigint" ? transaction.gasPrice.toString() : transaction.gasPrice;
		if (transaction.value != null) transactionObject.value = typeof transaction.value === "bigint" ? transaction.value.toString() : transaction.value;
		if (transaction.stateOverrides != null) {
			const stateOverrides = {};
			for (const address in transaction.stateOverrides) {
				const entry = { ...transaction.stateOverrides[address] };
				for (const key in entry) if (key !== "balance" && key !== "code" && key !== "storage" && key !== "stateDiff") throw new RangeError(`Invalid stateOverrides key: ${key}.`);
				if ("storage" in entry && "stateDiff" in entry) throw new RangeError("can't set both storage and stateDiff for stateOverrides");
				if ("stateDiff" in entry) {
					entry.storage = entry.stateDiff;
					delete entry.stateDiff;
				}
				const addressLower = address.toLowerCase();
				if (addressLower in stateOverrides) throw new RangeError(`Duplicate stateOverrides address (case-insensitive): ${address}.`);
				stateOverrides[addressLower] = entry;
			}
			transactionObject.state_objects = stateOverrides;
		}
		if (transaction.transactionIndex != null) transactionObject.transaction_index = transaction.transactionIndex;
		if (transaction.estimateGas != null) transactionObject.estimate_gas = transaction.estimateGas;
		if (transaction.generateAccessList != null) transactionObject.generate_access_list = transaction.generateAccessList;
		if (transaction.accessList != null) transactionObject.access_list = transaction.accessList;
		return transactionObject;
	});
	const headers = {
		Accept: "application/json",
		"Content-Type": "application/json",
		"X-Access-Key": tenderlyAccessKey
	};
	const body = JSON.stringify({
		method: "tenderly_simulateBundle",
		simulations,
		id: Date.now(),
		jsonrpc: "2.0"
	}, (_key, value) => typeof value === "bigint" ? `0x${value.toString(16)}` : value);
	let response;
	try {
		response = await fetch(tenderlyUrl, {
			method: "POST",
			headers,
			body,
			redirect: "follow"
		});
	} catch (err) {
		const e = ensureError(err);
		throw new AbstractionKitError("TENDERLY_NETWORK_ERROR", `tenderly_simulateBundle network error: ${e.message}`, { cause: e });
	}
	if (!response.ok) throw new AbstractionKitError("TENDERLY_HTTP_ERROR", `tenderly_simulateBundle HTTP ${response.status}: ${response.statusText}`, {
		errno: response.status,
		context: {
			status: response.status,
			statusText: response.statusText
		}
	});
	const responseText = await response.text();
	let json;
	try {
		json = JSON.parse(responseText);
	} catch (err) {
		const e = ensureError(err);
		throw new AbstractionKitError("TENDERLY_INVALID_JSON", `tenderly_simulateBundle returned invalid JSON: ${e.message}`, {
			cause: e,
			context: { responseText }
		});
	}
	if (json.simulation_results != null) return json.simulation_results;
	throw new AbstractionKitError("TENDERLY_SIMULATION_ERROR", "tenderly_simulateBundle failed", {
		errno: json.error?.code,
		context: JSON.stringify(json)
	});
}
//#endregion
//#region src/account/Safe/multisend.ts
/** Function selector of `multiSend(bytes)`. */
const MULTISEND_SELECTOR = "0x8d80ff0a";
/**
* Pack a single MetaTransaction into the MultiSend byte layout
* (operation, to, value, dataLength, data).
* @param metaTransaction - The transaction to encode
* @returns The encoded transaction bytes (without 0x prefix)
*/
function encodeMultiSendTransaction(metaTransaction) {
	const operation = metaTransaction.operation ?? Operation.Call;
	const data = getBytes(metaTransaction.data);
	return solidityPacked([
		"uint8",
		"address",
		"uint256",
		"uint256",
		"bytes"
	], [
		operation,
		metaTransaction.to,
		metaTransaction.value,
		data.length,
		data
	]).slice(2);
}
/**
* Encode a list of MetaTransactions into the `multiSend` argument for batch execution.
* @param metaTransactions - The transactions to batch
* @returns The concatenated encoded transactions as a 0x-prefixed hex string
*/
function encodeMultiSendCallData(metaTransactions) {
	return `0x${metaTransactions.map((tx) => encodeMultiSendTransaction(tx)).join("")}`;
}
/**
* Decodes a MultiSend callData back into its packed transaction bytes.
* Strips the function selector and ABI-decodes the inner bytes payload.
* @param callData - The full MultiSend callData (with 0x prefix and function selector).
* @returns The decoded packed transaction bytes as a hex string.
*/
function decodeMultiSendCallData(callData) {
	return decodeAbiParameters(["bytes"], `0x${callData.slice(10)}`)[0];
}
//#endregion
//#region src/account/Safe/safeMessage.ts
/** The primary EIP-712 type name used for Safe message signing. */
const SAFE_MESSAGE_PRIMARY_TYPE = "SafeMessage";
/** EIP-712 type definition for SafeMessage, containing a single bytes field. */
const SAFE_MESSAGE_MODULE_TYPE = { SafeMessage: [{
	type: "bytes",
	name: "message"
}] };
/**
* Create EIP-712 signing data for a Safe message.
* @param accountAddress - the Safe account address
* @param chainId - target chain id
* @param message - the message string to sign
* @returns an object with domain, types, and messageValue for EIP-712 signing
*/
function getSafeMessageEip712Data(accountAddress, chainId, message) {
	const messageValue = { message: hashMessage(message) };
	return {
		domain: {
			chainId: Number(chainId),
			verifyingContract: accountAddress
		},
		types: SAFE_MESSAGE_MODULE_TYPE,
		messageValue
	};
}
//#endregion
//#region src/account/Safe/types.ts
/**
* Safe has two executor functions "executeUserOpWithErrorString" and "executeUserOp"
*/
let SafeModuleExecutorFunctionSelector = /* @__PURE__ */ function(SafeModuleExecutorFunctionSelector) {
	SafeModuleExecutorFunctionSelector["executeUserOpWithErrorString"] = "0x541d63c8";
	SafeModuleExecutorFunctionSelector["executeUserOp"] = "0x7bb37428";
	return SafeModuleExecutorFunctionSelector;
}({});
/** Dummy signer-signature pair for gas estimation with EOA signers. */
const EOADummySignerSignaturePair = {
	signer: "0xfD90FAd33ee8b58f32c00aceEad1358e4AFC23f9",
	signature: "0x47003599ffa7e9198f321afa774e34a12a959844efd6363b88896e9c24ed33cf4e1be876ef123a3c4467e7d451511434039539699f2baa2f44955fa3d1c1c6d81c",
	isContractSignature: false
};
/** Dummy signer-signature pair for gas estimation with WebAuthn signers. */
const WebauthnDummySignerSignaturePair = {
	signer: "0xfD90FAd33ee8b58f32c00aceEad1358e4AFC23f9",
	signature: "0x000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e06c92f0ac5c4ef9e74721c23d80a9fc12f259ca84afb160f0890483539b9e6080d824c0e6c795157ad5d1ee5eff1ceeb3031009a595f9360919b83dd411c5a78d0000000000000000000000000000000000000000000000000000000000000025a24f744b28d73f066bf3203d145765a7bc735e6328168c8b03e476da3ad0d8fe0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001e226f726967696e223a2268747470733a2f2f736166652e676c6f62616c220000",
	isContractSignature: true
};
//#endregion
//#region src/account/Safe/SafeAccount.ts
/**
* Base implementation shared by all Safe-account variants.
*
* Provides the core logic for Safe ERC-4337 accounts: counterfactual address
* derivation, initializer/factory-data encoding, EIP-712 UserOperation signing,
* multi-signer aggregation (ECDSA + WebAuthn), module enable/disable helpers,
* and UserOperation construction. Versioned subclasses
* ({@link SafeAccountV0_2_0}, {@link SafeAccountV0_3_0},
* {@link SafeAccountV1_5_0_M_0_3_0}) bind this class to a specific EntryPoint
* and Safe singleton, and expose version-typed wrappers.
*
* Instantiate directly only for an already-deployed account; use a subclass's
* static `initializeNewAccount` to produce a counterfactual account + factory
* data for first-time deployment.
*/
var SafeAccount = class SafeAccount extends SmartAccount {
	static DEFAULT_WEB_AUTHN_SHARED_SIGNER = "0xfD90FAd33ee8b58f32c00aceEad1358e4AFC23f9";
	static DEFAULT_WEB_AUTHN_SIGNER_SINGLETON = "0x270D7E4a57E6322f336261f3EaE2BADe72E68d72";
	static DEFAULT_WEB_AUTHN_SIGNER_FACTORY = "0xF7488fFbe67327ac9f37D5F722d83Fc900852Fbf";
	static DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER = "0x445a0683e494ea0c5AF3E83c5159fBE47Cf9e765";
	static DEFAULT_WEB_AUTHN_PRECOMPILE = "0x0000000000000000000000000000000000000000";
	static DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE = "0x61010060405234801561001157600080fd5b506040516101ee3803806101ee83398101604081905261003091610058565b6001600160a01b0390931660805260a09190915260c0526001600160b01b031660e0526100bc565b6000806000806080858703121561006e57600080fd5b84516001600160a01b038116811461008557600080fd5b60208601516040870151606088015192965090945092506001600160b01b03811681146100b157600080fd5b939692955090935050565b60805160a05160c05160e05160ff6100ef60003960006008015260006031015260006059015260006080015260ff6000f3fe608060408190527f00000000000000000000000000000000000000000000000000000000000000003660b681018290527f000000000000000000000000000000000000000000000000000000000000000060a082018190527f00000000000000000000000000000000000000000000000000000000000000008285018190527f00000000000000000000000000000000000000000000000000000000000000009490939192600082376000806056360183885af490503d6000803e8060c3573d6000fd5b503d6000f3fea2646970667358221220ddd9bb059ba7a6497d560ca97aadf4dbf0476f578378554a50d41c6bb654beae64736f6c63430008180033";
	static DEFAULT_MULTISEND_CONTRACT_ADDRESS = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";
	static initializerFunctionSelector = "0xb63e800d";
	static initializerFunctionInputAbi = [
		"address[]",
		"uint256",
		"address",
		"bytes",
		"address",
		"address",
		"uint256",
		"address"
	];
	static DEFAULT_EXECUTOR_FUCNTION_SELECTOR = SafeModuleExecutorFunctionSelector.executeUserOpWithErrorString;
	static executorFunctionInputAbi = [
		"address",
		"uint256",
		"bytes",
		"uint8"
	];
	isInitWebAuthn;
	x = null;
	y = null;
	safeAccountSingleton;
	entrypointAddress;
	safe4337ModuleAddress;
	factoryAddress;
	factoryData;
	onChainIdentifier;
	/**
	* @param accountAddress - On-chain address of the Safe account
	* @param safe4337ModuleAddress - Address of the Safe 4337 module the account delegates to
	* @param entrypointAddress - Target EntryPoint address (v0.6 / v0.7 / v0.9)
	* @param overrides - Optional on-chain-identifier configuration and custom singleton
	* @param overrides.onChainIdentifierParams - Attribution params for analytics (mutually exclusive with `onChainIdentifier`)
	* @param overrides.onChainIdentifier - Pre-computed 32-byte identifier hex (no 0x prefix or with 0x)
	* @param overrides.safeAccountSingleton - Override Safe singleton address + init hash (defaults to Safe L2 v1.4.1)
	*/
	constructor(accountAddress, safe4337ModuleAddress, entrypointAddress, overrides = {}) {
		super(accountAddress);
		this.entrypointAddress = entrypointAddress;
		this.safe4337ModuleAddress = safe4337ModuleAddress;
		this.factoryAddress = null;
		this.factoryData = null;
		this.isInitWebAuthn = false;
		if (overrides.onChainIdentifierParams != null && overrides.onChainIdentifier != null) throw new RangeError("can't override both onChainIdentifier and onChainIdentifierParams");
		else if (overrides.onChainIdentifierParams != null) this.onChainIdentifier = generateOnChainIdentifier(overrides.onChainIdentifierParams.project, overrides.onChainIdentifierParams.platform, overrides.onChainIdentifierParams.tool, overrides.onChainIdentifierParams.toolVersion);
		else if (overrides.onChainIdentifier != null) {
			let onChainIdentifier = overrides.onChainIdentifier;
			if (onChainIdentifier.startsWith("0x")) onChainIdentifier = onChainIdentifier.slice(2);
			if (onChainIdentifier.length !== 64) throw new RangeError("onChainIdentifier length must be 64.");
			this.onChainIdentifier = onChainIdentifier;
		} else this.onChainIdentifier = null;
		this.safeAccountSingleton = overrides.safeAccountSingleton ?? Safe_L2_V1_4_1;
	}
	/**
	* calculate proxy/account address using initializer call data
	* @param initializerCallData from createBaseInitializerCallData
	* @param overrides - overrides for the default values
	* @param overrides.c2Nonce - create2 nonce to generate different sender addresses from the same owners
	* defaults to zero
	* @param overrides.safeFactoryAddress - safeFactoryAddress, defaults to
	* SafeAccountFactory.DEFAULT_FACTORY_ADDRESS
	* @param overrides.singletonInitHash - a hash that includes the singleton address and the proxy bytecode
	* keccak256(solidityPacked(["bytes", "bytes"], [proxyByteCode, abiCoder.encode(["uint256"], [singletonAddress])]))
	* defaults to SafeAccount.safeAccountSingleton.singletonInitHash
	* @returns proxy/account address
	*/
	static createProxyAddress(initializerCallData, overrides = {}) {
		const c2Nonce = overrides.c2Nonce ?? 0n;
		if (c2Nonce < 0n) throw new RangeError("c2Nonce can't be negative");
		const safeFactoryAddress = overrides.safeFactoryAddress ?? SafeAccountFactory.DEFAULT_FACTORY_ADDRESS;
		const singletonInitHash = overrides.singletonInitHash ?? Safe_L2_V1_4_1.singletonInitHash;
		return getAddress(`0x${solidityPackedKeccak256([
			"bytes1",
			"address",
			"bytes32",
			"bytes32"
		], [
			"0xff",
			safeFactoryAddress,
			keccak256(solidityPacked(["bytes32", "uint256"], [keccak256(initializerCallData), c2Nonce])),
			singletonInitHash
		]).slice(-40)}`);
	}
	/**
	* Check whether a Safe account is already deployed at the given address.
	*
	* Use this to decide between connecting to an existing account
	* (`new SafeAccountV0_3_0(address)`) and initializing a new one
	* (`SafeAccountV0_3_0.initializeNewAccount(owners)`). Once an account is
	* deployed, the factory data carried by `initializeNewAccount` is no
	* longer needed and including it would waste gas.
	*
	* Note: this only checks whether bytecode exists at `accountAddress`, not
	* whether the deployed code is actually a Safe or whether its on-chain
	* configuration matches a given set of owners.
	*
	* @param accountAddress - the Safe account address to check
	* @param nodeRpcUrl - Ethereum JSON-RPC node URL
	* @returns `true` if bytecode is deployed at `accountAddress`, `false` otherwise
	*
	* @example
	* ```ts
	* const account = (await SafeAccountV0_3_0.isDeployed(addr, rpc))
	*   ? new SafeAccountV0_3_0(addr)
	*   : SafeAccountV0_3_0.initializeNewAccount(owners);
	* ```
	*/
	static async isDeployed(accountAddress, nodeRpcUrl) {
		return (await JsonRpcNode.from(nodeRpcUrl).getCode(accountAddress, "latest")).length > 2;
	}
	/**
	* encode calldata for a single MetaTransaction to be executed by Safe account
	* @param metaTransaction - metaTransaction to create calldata for
	* @param overrides - overrides for the default values
	* @param overrides.safeModuleExecutorFunctionSelector - select the
	* executor function, either "executeUserOpWithErrorString" or "executeUserOp"
	* defaults to "executeUserOpWithErrorString"
	* @returns calldata
	*/
	static createAccountCallDataSingleTransaction(metaTransaction, overrides = {}) {
		const value = metaTransaction.value ?? 0;
		const data = metaTransaction.data ?? "0x";
		const operation = metaTransaction.operation ?? Operation.Call;
		const safeModuleExecutorFunctionSelector = overrides.safeModuleExecutorFunctionSelector ?? SafeAccount.DEFAULT_EXECUTOR_FUCNTION_SELECTOR;
		return SafeAccount.createAccountCallData(metaTransaction.to, value, data, operation, { safeModuleExecutorFunctionSelector });
	}
	/**
	* encode calldata for a list of MetaTransactions to be executed by Safe account
	* @param metaTransaction - metaTransaction to create calldata for
	* @param overrides - overrides for the default values
	* @param overrides.safeModuleExecutorFunctionSelector - select the
	* executor function, either "executeUserOpWithErrorString" or "executeUserOp"
	* defaults to "executeUserOpWithErrorString"
	* @param overrides.multisendContractAddress - defaults to
	* SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS
	* @returns calldata
	*/
	static createAccountCallDataBatchTransactions(metaTransactions, overrides = {}) {
		if (metaTransactions.length < 1) throw new RangeError("There should be at least one metaTransaction");
		const safeModuleExecutorFunctionSelector = overrides.safeModuleExecutorFunctionSelector ?? SafeAccount.DEFAULT_EXECUTOR_FUCNTION_SELECTOR;
		const multisendContractAddress = overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS;
		const multiSendCallData = createCallData(MULTISEND_SELECTOR, ["bytes"], [encodeMultiSendCallData(metaTransactions)]);
		return SafeAccount.createAccountCallData(multisendContractAddress, 0n, multiSendCallData, Operation.Delegate, { safeModuleExecutorFunctionSelector });
	}
	/**
	* encode calldata to be executed by Safe account
	* @param to - target address
	* @param value - amount of native token to transfer to target address
	* @param data - calldata
	* @param operation - either call or delegate call
	* @param overrides - overrides for the default values
	* @param overrides.safeModuleExecutorFunctionSelector - select the
	* executor function, either "executeUserOpWithErrorString" or "executeUserOp"
	* defaults to "executeUserOpWithErrorString"
	* @returns callData
	*/
	static createAccountCallData(to, value, data, operation, overrides = {}) {
		const safeModuleExecutorFunctionSelector = overrides.safeModuleExecutorFunctionSelector ?? SafeAccount.DEFAULT_EXECUTOR_FUCNTION_SELECTOR;
		const executorFunctionInputParameters = [
			to,
			value,
			data,
			operation
		];
		return createCallData(safeModuleExecutorFunctionSelector, SafeAccount.executorFunctionInputAbi, executorFunctionInputParameters);
	}
	/**
	* decode calldata to a Metatransaction
	* @param callData - calldata to decode
	* @returns [MetaTransaction, SafeModuleExecutorFunctionSelector]
	*/
	static decodeAccountCallData(callData) {
		let safeModuleExecutorFunctionSelector = null;
		if (callData.startsWith(SafeModuleExecutorFunctionSelector.executeUserOpWithErrorString)) safeModuleExecutorFunctionSelector = SafeModuleExecutorFunctionSelector.executeUserOpWithErrorString;
		else if (callData.startsWith(SafeModuleExecutorFunctionSelector.executeUserOp)) safeModuleExecutorFunctionSelector = SafeModuleExecutorFunctionSelector.executeUserOp;
		if (safeModuleExecutorFunctionSelector != null) {
			const decodedParams = decodeAbiParameters([
				"address",
				"uint256",
				"bytes",
				"uint8"
			], `0x${callData.slice(10)}`);
			const accountCallDataString = typeof decodedParams[2] === "string" ? decodedParams[2] : hexlify(decodedParams[2]);
			return [{
				to: decodedParams[0],
				value: BigInt(decodedParams[1]),
				data: accountCallDataString,
				operation: Number(decodedParams[3])
			}, safeModuleExecutorFunctionSelector];
		} else throw new AbstractionKitError("BAD_DATA", "Invalid calldata, should start with " + SafeModuleExecutorFunctionSelector.executeUserOpWithErrorString + " or " + SafeModuleExecutorFunctionSelector.executeUserOp, { context: { callData } });
	}
	/**
	* adds a token approve call to the call data for a token paymaster
	* @param callData - calldata to be added to, if after decoding it is not
	* a multisend transaction, it will be encoded as a multisend transaction
	* @param tokenAddress - token to add approve for
	* @param paymasterAddress - paymaster to add approve for
	* @param approveAmount - amount to add approve for
	* @param overrides - overrides for the default values
	* @param overrides.multisendContractAddress - defaults to
	* SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS
	* @returns callData
	*/
	static prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount, overrides = {}) {
		const multisendContractAddress = overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS;
		const [metaTransaction, safeModuleExecutorFunctionSelector] = SafeAccount.decodeAccountCallData(callData);
		const encodedApproveMetatransaction = encodeMultiSendCallData([{
			to: tokenAddress,
			value: 0n,
			data: createCallData(getFunctionSelector("approve(address,uint256)"), ["address", "uint256"], [paymasterAddress, approveAmount]),
			operation: Operation.Call
		}]);
		let multiSendCallDataParams = "";
		if (metaTransaction.data.startsWith("0x8d80ff0a")) multiSendCallDataParams = encodedApproveMetatransaction + decodeMultiSendCallData(metaTransaction.data).slice(2);
		else multiSendCallDataParams = encodedApproveMetatransaction + encodeMultiSendCallData([metaTransaction]).slice(2);
		const multiSendCallData = createCallData(MULTISEND_SELECTOR, ["bytes"], [multiSendCallDataParams]);
		return SafeAccount.createAccountCallData(multisendContractAddress, 0n, multiSendCallData, Operation.Delegate, { safeModuleExecutorFunctionSelector });
	}
	/**
	* @deprecated
	* format a list of eip712 signatures to a useroperation signature
	* @param signersAddresses - signers public addresses
	* @param signatures - list of eip712 signatures
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @returns signature
	*/
	static formatEip712SignaturesToUseroperationSignature(signersAddresses, signatures, overrides = {}) {
		if (signersAddresses.length !== signatures.length) throw new RangeError("signersAddresses and signatures arrays should be the same length");
		const signersSignatures = [];
		signersAddresses.forEach((signer, index) => {
			signersSignatures.push({
				signer: signer.toLowerCase(),
				signature: signatures[index]
			});
		});
		return SafeAccount.formatSignaturesToUseroperationSignature(signersSignatures, {
			validAfter: overrides.validAfter,
			validUntil: overrides.validUntil,
			isMultiChainSignature: overrides.isMultiChainSignature,
			multiChainMerkleProof: overrides.merkleProof
		});
	}
	/**
	* Get the EIP-712 typed data for this account's configured EntryPoint and
	* Safe 4337 module. Prefer this instance method for manual signing so
	* custom constructor overrides are carried through automatically.
	*
	* @param useroperation - UserOperation to get typed data for
	* @param chainId - target chain ID
	* @param overrides - optional validity window and explicit address overrides
	* @returns Object with domain, types, and messageValue for EIP-712 signing
	*/
	getUserOperationEip712Data(useroperation, chainId, overrides = {}) {
		return SafeAccount.getUserOperationEip712Data(useroperation, chainId, {
			...overrides,
			entrypointAddress: overrides.entrypointAddress ?? this.entrypointAddress,
			safe4337ModuleAddress: overrides.safe4337ModuleAddress ?? this.safe4337ModuleAddress
		});
	}
	/**
	* Hash the EIP-712 typed data for this account's configured EntryPoint and
	* Safe 4337 module. Prefer this instance method for manual signing so
	* custom constructor overrides are carried through automatically.
	*
	* @param useroperation - UserOperation to hash
	* @param chainId - target chain ID
	* @param overrides - optional validity window and explicit address overrides
	* @returns EIP-712 digest as a hex string
	*/
	getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		const data = this.getUserOperationEip712Data(useroperation, chainId, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	/**
	* Format signer/signature pairs for this account's signature encoding.
	* Prefer this instance method for manual signing so account-level module
	* context is applied automatically.
	*
	* @param signerSignaturePairs - signer/signature pairs to encode
	* @param options - optional validity window, multi-chain, module, and WebAuthn encoding overrides
	* @returns formatted UserOperation signature
	*/
	formatUserOperationSignature(signerSignaturePairs, options = {}) {
		return SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
			...options,
			safe4337ModuleAddress: options.safe4337ModuleAddress ?? this.safe4337ModuleAddress
		});
	}
	/**
	* create a v0.07 or v0.06 useroperation eip712 data
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* @param overrides.safe4337ModuleAddress - target module address
	* @returns useroperation hash
	*/
	static getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		if ("initCode" in useroperation) return SafeAccount.getUserOperationEip712Hash_V6(useroperation, chainId, overrides);
		else if (overrides.entrypointAddress) if (overrides.entrypointAddress.toLowerCase() === "0x433709009B8330FDa32311DF1C2AFA402eD8D009".toLowerCase()) return SafeAccount.getUserOperationEip712Hash_V9(useroperation, chainId, overrides);
		else return SafeAccount.getUserOperationEip712Hash_V7(useroperation, chainId, overrides);
		else return SafeAccount.getUserOperationEip712Hash_V7(useroperation, chainId, overrides);
	}
	/**
	* create a v0.07 or v0.06 useroperation eip712 data
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* @param overrides.safe4337ModuleAddress - target module address
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	static getUserOperationEip712Data(useroperation, chainId, overrides) {
		if ("initCode" in useroperation) {
			const data = SafeAccount.getUserOperationEip712Data_V6(useroperation, chainId, overrides);
			return {
				domain: data.domain,
				types: data.types,
				messageValue: data.messageValue
			};
		} else {
			let data;
			if (overrides?.entrypointAddress) if (overrides.entrypointAddress.toLowerCase() === "0x433709009B8330FDa32311DF1C2AFA402eD8D009".toLowerCase()) data = SafeAccount.getUserOperationEip712Data_V9(useroperation, chainId, overrides);
			else data = SafeAccount.getUserOperationEip712Data_V7(useroperation, chainId, overrides);
			else data = SafeAccount.getUserOperationEip712Data_V7(useroperation, chainId, overrides);
			return {
				domain: data.domain,
				types: data.types,
				messageValue: data.messageValue
			};
		}
	}
	/**
	* create a v0.06 useroperation eip712 data
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V6
	* @param overrides.safe4337ModuleAddress - defaults to "0xa581c4A4DB7175302464fF3C06380BC3270b4037"
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	static getUserOperationEip712Data_V6(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? "0xa581c4A4DB7175302464fF3C06380BC3270b4037";
		const messageValue = {
			safe: useroperation.sender,
			nonce: useroperation.nonce,
			initCode: useroperation.initCode,
			callData: useroperation.callData,
			callGasLimit: useroperation.callGasLimit,
			verificationGasLimit: useroperation.verificationGasLimit,
			preVerificationGas: useroperation.preVerificationGas,
			maxFeePerGas: useroperation.maxFeePerGas,
			maxPriorityFeePerGas: useroperation.maxPriorityFeePerGas,
			paymasterAndData: useroperation.paymasterAndData,
			validAfter,
			validUntil,
			entryPoint: entrypointAddress
		};
		return {
			domain: {
				chainId: Number(chainId),
				verifyingContract: safe4337ModuleAddress
			},
			types: EIP712_SAFE_OPERATION_V6_TYPE,
			messageValue
		};
	}
	/**
	* create a v0.06 useroperation eip712 data
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V6
	* @param overrides.safe4337ModuleAddress - defaults to "0xa581c4A4DB7175302464fF3C06380BC3270b4037"
	* @returns useroperation hash
	*/
	static getUserOperationEip712Hash_V6(useroperation, chainId, overrides = {}) {
		const data = SafeAccount.getUserOperationEip712Data_V6(useroperation, chainId, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	static baseGetUserOperationEip712DataV7V8V9(useroperation, chainId, entrypointAddress, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226";
		let initCode = "0x";
		if (useroperation.factory != null) {
			initCode = useroperation.factory;
			if (useroperation.factoryData != null) initCode += useroperation.factoryData.slice(2);
		}
		let paymasterAndData = "0x";
		if (useroperation.paymaster != null) {
			paymasterAndData = useroperation.paymaster;
			if (useroperation.paymasterVerificationGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [useroperation.paymasterVerificationGasLimit]).slice(34);
			if (useroperation.paymasterPostOpGasLimit != null) paymasterAndData += encodeAbiParameters(["uint128"], [useroperation.paymasterPostOpGasLimit]).slice(34);
			if (useroperation.paymasterData != null) {
				const PAYMASTER_SIG_MAGIC = "22e325a297439656";
				if (overrides.is_v9 && useroperation.paymasterData.toLowerCase().endsWith(PAYMASTER_SIG_MAGIC)) {
					const sigLenHex = useroperation.paymasterData.slice(useroperation.paymasterData.length - 16 - 4, useroperation.paymasterData.length - 16);
					const sigLen = parseInt(sigLenHex, 16);
					const prefixEnd = useroperation.paymasterData.length - 16 - 4 - sigLen * 2;
					paymasterAndData += useroperation.paymasterData.slice(0, prefixEnd).replaceAll("0x", "") + PAYMASTER_SIG_MAGIC;
				} else paymasterAndData += useroperation.paymasterData.slice(2);
			}
		}
		const messageValue = {
			safe: useroperation.sender,
			nonce: useroperation.nonce,
			initCode,
			callData: useroperation.callData,
			verificationGasLimit: useroperation.verificationGasLimit,
			callGasLimit: useroperation.callGasLimit,
			preVerificationGas: useroperation.preVerificationGas,
			maxPriorityFeePerGas: useroperation.maxPriorityFeePerGas,
			maxFeePerGas: useroperation.maxFeePerGas,
			paymasterAndData,
			validAfter,
			validUntil,
			entryPoint: entrypointAddress
		};
		return {
			domain: {
				chainId: Number(chainId),
				verifyingContract: safe4337ModuleAddress
			},
			types: EIP712_SAFE_OPERATION_V7_TYPE,
			messageValue
		};
	}
	/**
	* create a v0.07 useroperation eip712 hash
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V7
	* @param overrides.safe4337ModuleAddress - defaults to "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226"
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	static getUserOperationEip712Data_V7(useroperation, chainId, overrides = {}) {
		return SafeAccount.baseGetUserOperationEip712DataV7V8V9(useroperation, chainId, overrides.entrypointAddress ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032", overrides);
	}
	/**
	* create a v0.07 useroperation eip712 hash
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V7
	* @param overrides.safe4337ModuleAddress - defaults to "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226"
	* @returns useroperation hash
	*/
	static getUserOperationEip712Hash_V7(useroperation, chainId, overrides = {}) {
		const data = SafeAccount.getUserOperationEip712Data_V7(useroperation, chainId, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	/**
	* create a v0.09 useroperation eip712 hash
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V9
	* @param overrides.safe4337ModuleAddress - defaults to the multi-chain signature module,
	* SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	static getUserOperationEip712Data_V9(useroperation, chainId, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? "0x22939E839e3c0F479B713eAF95e0df128554AEAd";
		return SafeAccount.baseGetUserOperationEip712DataV7V8V9(useroperation, chainId, overrides.entrypointAddress ?? "0x433709009B8330FDa32311DF1C2AFA402eD8D009", {
			...overrides,
			safe4337ModuleAddress,
			is_v9: true
		});
	}
	/**
	* create a v0.09 useroperation eip712 hash
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V9
	* @param overrides.safe4337ModuleAddress - defaults to the multi-chain signature module,
	* SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS
	* @returns useroperation hash
	*/
	static getUserOperationEip712Hash_V9(useroperation, chainId, overrides = {}) {
		const data = SafeAccount.getUserOperationEip712Data_V9(useroperation, chainId, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	/**
	* @deprecated Use `account.formatUserOperationSignature([{ signer, signature }], options)`
	* when an account instance is available, or
	* `SafeAccount.formatSignaturesToUseroperationSignature([{ signer, signature }], options)`
	* for static formatting. For `SafeMultiChainSigAccountV1`, prefer the
	* instance method so `isMultiChainSignature` is applied automatically; if
	* using the lower-level static formatter directly, pass
	* `isMultiChainSignature: true`.
	*
	* format an eip712 signature to a useroperation signature
	* @param signature - an eip712 signature
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @returns formatted signature
	*/
	static formatEip712SingleSignatureToUseroperationSignature(signature, overrides = {}) {
		return SafeAccount.formatSignaturesToUseroperationSignature([{
			signer: "0x0000000000000000000000000000000000000000",
			signature
		}], overrides);
	}
	/**
	* sends a useroperation to a bundler rpc
	* @param userOperation - useroperation to send
	* @param bundlerRpc - bundler rpc URL, {@link Transport}, or pre-constructed {@link Bundler}
	* @returns promise with SendUseroperationResponse
	*/
	async sendUserOperation(userOperation, bundlerRpc) {
		const bundler = Bundler.from(bundlerRpc);
		return new SendUseroperationResponse(await bundler.sendUserOperation(userOperation, this.entrypointAddress), bundler, this.entrypointAddress);
	}
	/**
	* calculate account address and initcode from owners
	* @param owners - list of account owners addresses
	* @param overrides - override values to change the initialization default values
	* @returns account address ,factory address and factorydata
	*/
	static createAccountAddressAndFactoryAddressAndData(owners, overrides, safe4337ModuleAddress, safeModuleSetupAddress) {
		if (owners.length < 1) throw new RangeError("There should be at least one owner");
		const initializerCallData = SafeAccount.createBaseInitializerCallData(owners, overrides.threshold ?? 1, safe4337ModuleAddress, safeModuleSetupAddress, overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS, overrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER, overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE, overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER);
		let safeAccountFactory;
		if (overrides.safeAccountFactoryAddress != null) safeAccountFactory = new SafeAccountFactory(overrides.safeAccountFactoryAddress);
		else safeAccountFactory = new SafeAccountFactory();
		const safeSingleton = overrides.safeAccountSingleton ?? Safe_L2_V1_4_1;
		const sender = SafeAccount.createProxyAddress(initializerCallData, {
			c2Nonce: overrides.c2Nonce ?? 0n,
			safeFactoryAddress: safeAccountFactory.address,
			singletonInitHash: safeSingleton.singletonInitHash
		});
		const generatorFunctionInputParameters = [
			safeSingleton.singletonAddress,
			initializerCallData,
			overrides.c2Nonce ?? 0n
		];
		const factoryGeneratorFunctionCallData = safeAccountFactory.getFactoryGeneratorFunctionCallData(generatorFunctionInputParameters);
		return [
			sender,
			safeAccountFactory.address,
			factoryGeneratorFunctionCallData
		];
	}
	static createBaseInitializerCallData(owners, threshold, safe4337ModuleAddress, safeModuleSetupAddress, multisendContractAddress = SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS, webAuthnSharedSigner = SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER, eip7212WebAuthnPrecompileVerifierForSharedSigner = SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE, eip7212WebAuthnContractVerifierForSharedSigner = SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER) {
		if (owners.length < 1) throw new RangeError("There should be at least one owner");
		if (threshold < 1) throw new RangeError("threshold should be at least one");
		if (threshold > owners.length) throw new RangeError("threshold can't be larger than number of owners");
		const enable4337ModuleCallData = createCallData("0x8d0dc49f", ["address[]"], [[safe4337ModuleAddress]]);
		let isInitWebAuthn = false;
		let initializerFunctionInputParameters;
		const owners_str = [];
		for (const owner of owners) if (typeof owner !== "string") isInitWebAuthn = true;
		else owners_str.push(owner);
		if (isInitWebAuthn) {
			const safeModuleSetupCallData = {
				to: safeModuleSetupAddress,
				value: 0n,
				data: enable4337ModuleCallData,
				operation: Operation.Delegate
			};
			const txs = [];
			txs.push(safeModuleSetupCallData);
			const modOwners = [];
			let numOfWebAuthnOwners = 0;
			for (const owner of owners) if (typeof owner !== "string") {
				if (numOfWebAuthnOwners > 0) throw new RangeError("Only one WebAuthn owner can be set during initialization");
				const setSignerCallData = {
					to: webAuthnSharedSigner,
					value: 0n,
					data: createCallData("0x0dd9692f", [
						"uint256",
						"uint256",
						"uint176"
					], [
						owner.x,
						owner.y,
						"0x" + eip7212WebAuthnPrecompileVerifierForSharedSigner.slice(-4) + eip7212WebAuthnContractVerifierForSharedSigner.slice(2)
					]),
					operation: Operation.Delegate
				};
				txs.push(setSignerCallData);
				modOwners.push(webAuthnSharedSigner);
				numOfWebAuthnOwners++;
			} else modOwners.push(owner);
			initializerFunctionInputParameters = [
				modOwners,
				threshold,
				multisendContractAddress,
				createCallData(MULTISEND_SELECTOR, ["bytes"], [encodeMultiSendCallData(txs)]),
				safe4337ModuleAddress,
				ZeroAddress,
				0,
				ZeroAddress
			];
		} else initializerFunctionInputParameters = [
			owners_str,
			threshold,
			safeModuleSetupAddress,
			enable4337ModuleCallData,
			safe4337ModuleAddress,
			ZeroAddress,
			0,
			ZeroAddress
		];
		return createCallData(SafeAccount.initializerFunctionSelector, SafeAccount.initializerFunctionInputAbi, initializerFunctionInputParameters);
	}
	/**
	* create factory address and factoryData (initcode)
	* @param owners - list of account owners signers
	* @param overrides - overrides for the default values
	* @returns factoryAddress and factoryData
	*/
	static createFactoryAddressAndData(owners, overrides = {}, safe4337ModuleAddress, safeModuleSetupAddress) {
		if (owners.length < 1) throw new RangeError("There should be at least one owner");
		const threshold = overrides.threshold ?? 1;
		const c2Nonce = overrides.c2Nonce ?? 0;
		if (threshold < 1) throw new RangeError("threshold should be at least one");
		if (threshold > owners.length) throw new RangeError("threshold can't be larger than number of owners");
		if (c2Nonce < 0n) throw new RangeError("c2Nonce can't be negative");
		const initializerCallData = SafeAccount.createBaseInitializerCallData(owners, overrides.threshold ?? 1, safe4337ModuleAddress, safeModuleSetupAddress, overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS, overrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER, overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE, overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER);
		let safeAccountFactory;
		if (overrides.safeAccountFactoryAddress != null) safeAccountFactory = new SafeAccountFactory(overrides.safeAccountFactoryAddress);
		else safeAccountFactory = new SafeAccountFactory();
		const generatorFunctionInputParameters = [
			(overrides.safeAccountSingleton ?? Safe_L2_V1_4_1).singletonAddress,
			initializerCallData,
			c2Nonce
		];
		const factoryGeneratorFunctionCallData = safeAccountFactory.getFactoryGeneratorFunctionCallData(generatorFunctionInputParameters);
		return [safeAccountFactory.address, factoryGeneratorFunctionCallData];
	}
	/**
	* a non static wrapper function for  prependTokenPaymasterApproveToCallDataStatic
	* which adds a token approve call to the call data for a token paymaster
	* @param callData - calldata to be added to, if after decoding it is not
	* a multisend transaction, it will be encoded as a multisend transaction
	* @param tokenAddress - token to add approve for
	* @param paymasterAddress - paymaster to add approve for
	* @param approveAmount - amount to add approve for
	* @param overrides - overrides for the default values
	* @param overrides.multisendContractAddress - defaults to
	* SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS
	* @returns callData
	*/
	prependTokenPaymasterApproveToCallData(callData, tokenAddress, paymasterAddress, approveAmount, overrides = {}) {
		const multisendContractAddress = overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS;
		return SafeAccount.prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount, { multisendContractAddress });
	}
	/**
	* estimate gas limits for a useroperation
	*
	* The returned verificationGasLimit includes ~55k gas per dummy signer
	* used for estimation (from dummySignerSignaturePairs, expectedSigners,
	* or the single-EOA default), compensating for the per-signature
	* verification cost bundler simulation skips. If the operation already
	* carries a signature, no compensation is added and the caller is
	* responsible for it.
	*
	* The passed userOperation is not mutated; estimation runs on an
	* internal copy carrying the dummy signature and zeroed gas fees.
	* @param userOperation - useroperation to estimate gas for
	* @param bundlerRpc - bundler rpc for gas estimation
	* @param overrides - overrides for the default values
	* @param overrides.stateOverrideSet - state override values to set during gs estimation
	* @param overrides.dummySignerSignaturePairs - list of dummy signers signature pairs
	* defaults to a single eoa signature
	* @returns promise with [preVerificationGas, verificationGasLimit, callGasLimit]
	*/
	async baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		const validAfter = 281474976710655n;
		const validUntil = 281474976710655n;
		let initCode;
		if ("initCode" in userOperation) initCode = userOperation.initCode;
		else initCode = userOperation.factory;
		const webAuthnSignatureOverrides = {
			isInit: initCode != null && initCode !== "0x",
			webAuthnSharedSigner: overrides.webAuthnSharedSigner,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton,
			webAuthnSignerProxyCreationCode: overrides.webAuthnSignerProxyCreationCode
		};
		let dummySignersCount = 0;
		let estimationSignature = userOperation.signature;
		if (overrides.dummySignerSignaturePairs != null) {
			if (overrides.expectedSigners != null) throw new RangeError("Can't use both dummySignerSignaturePairs and expectedSigners overrides.");
			if (overrides.dummySignerSignaturePairs.length < 1) throw new RangeError("Number of dummy signers signature pairs can't be less than 1");
			dummySignersCount = overrides.dummySignerSignaturePairs.length;
			estimationSignature = SafeAccount.formatSignaturesToUseroperationSignature(overrides.dummySignerSignaturePairs, {
				validAfter,
				validUntil,
				isMultiChainSignature: overrides.isMultiChainSignature,
				...webAuthnSignatureOverrides
			});
		} else if (overrides.expectedSigners != null) {
			const dummySignerSignaturePairs = SafeAccount.createDummySignerSignaturePairForExpectedSigners(overrides.expectedSigners, webAuthnSignatureOverrides);
			dummySignersCount = dummySignerSignaturePairs.length;
			estimationSignature = SafeAccount.formatSignaturesToUseroperationSignature(dummySignerSignaturePairs, {
				validAfter,
				validUntil,
				isMultiChainSignature: overrides.isMultiChainSignature,
				...webAuthnSignatureOverrides
			});
		} else if (userOperation.signature.length < 3) {
			dummySignersCount = 1;
			estimationSignature = SafeAccount.formatSignaturesToUseroperationSignature([EOADummySignerSignaturePair], {
				validAfter,
				validUntil,
				isMultiChainSignature: overrides.isMultiChainSignature
			});
		}
		const bundler = Bundler.from(bundlerRpc);
		const userOperationToEstimate = {
			...userOperation,
			signature: estimationSignature,
			maxFeePerGas: 0n,
			maxPriorityFeePerGas: 0n
		};
		const estimation = await bundler.estimateUserOperationGas(userOperationToEstimate, this.entrypointAddress, overrides.stateOverrideSet);
		return [
			BigInt(estimation.preVerificationGas),
			BigInt(estimation.verificationGasLimit) + BigInt(dummySignersCount) * 55000n,
			BigInt(estimation.callGasLimit)
		];
	}
	/**
	* createBaseUserOperationAndFactoryAddressAndFactoryData will
	* determine the nonce, fetch the gas prices,
	* estimate gas limits and return a useroperation to be signed.
	* you can override all these values using the overrides parameter.
	* @param transactions - metatransaction list to be encoded
	* @param providerRpc - node rpc to fetch account nonce and gas prices
	* @param bundlerRpc - bundler rpc for gas estimation
	* @param overrides - overrides for the default values
	* @returns a promise with (base useroperation, factoryAddress, factoryData)
	*/
	async createBaseUserOperationAndFactoryAddressAndFactoryData(transactions, isV06, providerRpc, bundlerRpc, overrides = {}) {
		if (transactions.length < 1) throw new RangeError("There should be at least one transaction");
		const webAuthnSharedSigner = overrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER;
		const safeModuleExecutorFunctionSelector = overrides.safeModuleExecutorFunctionSelector ?? SafeAccount.DEFAULT_EXECUTOR_FUCNTION_SELECTOR;
		const multisendContractAddress = overrides.multisendContractAddress ?? SafeAccount.DEFAULT_MULTISEND_CONTRACT_ADDRESS;
		let nonce = null;
		let nonceOp = null;
		if (overrides.nonce == null) if (providerRpc != null) nonceOp = fetchAccountNonce(providerRpc, this.entrypointAddress, this.accountAddress);
		else throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if nonce is not overridden");
		else nonce = overrides.nonce;
		if (typeof overrides.maxFeePerGas === "bigint" && overrides.maxFeePerGas < 0n) throw new RangeError("maxFeePerGas overrid can't be negative");
		if (typeof overrides.maxPriorityFeePerGas === "bigint" && overrides.maxPriorityFeePerGas < 0n) throw new RangeError("maxPriorityFeePerGas overrid can't be negative");
		let maxFeePerGas = BaseUserOperationDummyValues.maxFeePerGas;
		let maxPriorityFeePerGas = BaseUserOperationDummyValues.maxPriorityFeePerGas;
		let gasPriceOp = null;
		if (overrides.maxFeePerGas == null || overrides.maxPriorityFeePerGas == null) gasPriceOp = handlefetchGasPrice(providerRpc, overrides.polygonGasStation, overrides.gasLevel);
		if (gasPriceOp != null && nonceOp != null) await Promise.all([nonceOp, gasPriceOp]).then((values) => {
			nonce = values[0];
			[maxFeePerGas, maxPriorityFeePerGas] = values[1];
		});
		else if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = await gasPriceOp;
		else if (nonceOp != null) nonce = await nonceOp;
		maxFeePerGas = overrides.maxFeePerGas ?? maxFeePerGas * BigInt((overrides.maxFeePerGasPercentageMultiplier ?? 0) + 100) / 100n;
		maxPriorityFeePerGas = overrides.maxPriorityFeePerGas ?? maxPriorityFeePerGas * BigInt((overrides.maxPriorityFeePerGasPercentageMultiplier ?? 0) + 100) / 100n;
		const eip7212WebAuthnPrecompileVerifier = overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
		const eip7212WebAuthnContractVerifier = overrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
		const webAuthnSignerFactory = overrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY;
		const webAuthnSignerSingleton = overrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
		const webAuthnSignerProxyCreationCode = overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
		let factoryAddress = this.factoryAddress;
		let factoryData = this.factoryData;
		if (nonce == null) throw new RangeError("failed to determine nonce");
		else if (nonce < 0n) throw new RangeError("nonce can't be negative");
		else if (nonce > 0n) {
			factoryAddress = null;
			factoryData = null;
		} else if (this.isInitWebAuthn) {
			if (this.x == null || this.y == null) throw new RangeError("Invalid account initialization with Webauthn signer.Webauthn signer publickey can be null!!");
			const createDeterministicWebAuthnVerifierOwner = SafeAccount.createDeployWebAuthnVerifierMetaTransaction(this.x, this.y, {
				eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory
			});
			const swapSingletonWithDeterministicWebAuthnVerifierOwnerCallData = createCallData("0xe318b52b", [
				"address",
				"address",
				"address"
			], [
				"0x0000000000000000000000000000000000000001",
				webAuthnSharedSigner,
				SafeAccount.createWebAuthnSignerVerifierAddress(this.x, this.y, {
					eip7212WebAuthnPrecompileVerifier,
					eip7212WebAuthnContractVerifier,
					webAuthnSignerFactory,
					webAuthnSignerSingleton,
					webAuthnSignerProxyCreationCode
				})
			]);
			transactions = [createDeterministicWebAuthnVerifierOwner, {
				to: this.accountAddress,
				value: 0n,
				data: swapSingletonWithDeterministicWebAuthnVerifierOwnerCallData
			}].concat(transactions);
		}
		let callData = "0x";
		if (overrides.callData == null) if (transactions.length === 1) callData = SafeAccount.createAccountCallDataSingleTransaction(transactions[0], { safeModuleExecutorFunctionSelector });
		else callData = SafeAccount.createAccountCallDataBatchTransactions(transactions, {
			safeModuleExecutorFunctionSelector,
			multisendContractAddress
		});
		else callData = overrides.callData;
		if (this.onChainIdentifier != null) callData = callData + this.onChainIdentifier;
		const userOperation = {
			...BaseUserOperationDummyValues,
			sender: this.accountAddress,
			nonce,
			callData,
			maxFeePerGas,
			maxPriorityFeePerGas
		};
		let preVerificationGas = BaseUserOperationDummyValues.preVerificationGas;
		let verificationGasLimit = BaseUserOperationDummyValues.verificationGasLimit;
		let callGasLimit = BaseUserOperationDummyValues.callGasLimit;
		const validAfter = 281474976710655n;
		const validUntil = 281474976710655n;
		let resolvedV06InitCode = null;
		if (isV06) {
			resolvedV06InitCode = overrides.initCode ?? null;
			if (resolvedV06InitCode == null) {
				resolvedV06InitCode = "0x";
				if (factoryAddress != null) {
					resolvedV06InitCode = factoryAddress;
					if (factoryData != null) resolvedV06InitCode += factoryData.slice(2);
				}
			}
		}
		const isInit = isV06 ? resolvedV06InitCode !== "0x" : factoryAddress != null && factoryAddress !== "0x";
		let dummySignerSignaturePairs;
		if (overrides.dummySignerSignaturePairs != null) {
			if (overrides.expectedSigners != null) throw new RangeError("Can't use both dummySignerSignaturePairs and expectedSigners overrides.");
			if (overrides.dummySignerSignaturePairs.length < 1) throw new RangeError("Number of dummySignerSignaturePairs can't be less than 1");
			dummySignerSignaturePairs = overrides.dummySignerSignaturePairs;
		} else if (overrides.expectedSigners == null) dummySignerSignaturePairs = [EOADummySignerSignaturePair];
		else dummySignerSignaturePairs = SafeAccount.createDummySignerSignaturePairForExpectedSigners(overrides.expectedSigners, {
			isInit,
			webAuthnSharedSigner,
			eip7212WebAuthnPrecompileVerifier,
			eip7212WebAuthnContractVerifier,
			webAuthnSignerFactory,
			webAuthnSignerSingleton,
			webAuthnSignerProxyCreationCode
		});
		userOperation.signature = SafeAccount.formatSignaturesToUseroperationSignature(dummySignerSignaturePairs, {
			validAfter,
			validUntil,
			isMultiChainSignature: overrides.isMultiChainSignature,
			isInit,
			webAuthnSharedSigner,
			eip7212WebAuthnPrecompileVerifier,
			eip7212WebAuthnContractVerifier,
			webAuthnSignerFactory,
			webAuthnSignerSingleton,
			webAuthnSignerProxyCreationCode
		});
		if (!(overrides.skipGasEstimation ?? false) && (overrides.preVerificationGas == null || overrides.verificationGasLimit == null || overrides.callGasLimit == null)) if (bundlerRpc != null) {
			userOperation.callGasLimit = 0n;
			userOperation.verificationGasLimit = 0n;
			userOperation.preVerificationGas = 0n;
			const inputMaxFeePerGas = userOperation.maxFeePerGas;
			const inputMaxPriorityFeePerGas = userOperation.maxPriorityFeePerGas;
			userOperation.maxFeePerGas = 0n;
			userOperation.maxPriorityFeePerGas = 0n;
			let userOperationToEstimate;
			if (isV06) userOperationToEstimate = {
				...userOperation,
				initCode: resolvedV06InitCode,
				paymasterAndData: "0x"
			};
			else {
				userOperationToEstimate = {
					...userOperation,
					factory: factoryAddress,
					factoryData,
					paymaster: null,
					paymasterVerificationGasLimit: null,
					paymasterPostOpGasLimit: null,
					paymasterData: null
				};
				const parallelPaymasterInitValues = overrides.parallelPaymasterInitValues;
				if (parallelPaymasterInitValues != null) {
					if (!parallelPaymasterInitValues.paymasterData.toLowerCase().endsWith("22e325a297439656")) throw new RangeError("Invalid paymasterData override, it must end with the PAYMASTER_SIG_MAGIC '22e325a297439656'.");
					if (this.entrypointAddress.toLowerCase() !== "0x433709009B8330FDa32311DF1C2AFA402eD8D009".toLowerCase()) throw new RangeError("parallelPaymasterInitValues only works with ep v0.9");
					userOperationToEstimate.paymaster = parallelPaymasterInitValues.paymaster;
					userOperationToEstimate.paymasterVerificationGasLimit = parallelPaymasterInitValues.paymasterVerificationGasLimit;
					userOperationToEstimate.paymasterPostOpGasLimit = parallelPaymasterInitValues.paymasterPostOpGasLimit;
					userOperationToEstimate.paymasterData = parallelPaymasterInitValues.paymasterData;
				}
			}
			[preVerificationGas, verificationGasLimit, callGasLimit] = await this.baseEstimateUserOperationGas(userOperationToEstimate, bundlerRpc, {
				stateOverrideSet: overrides.state_override_set,
				isMultiChainSignature: overrides.isMultiChainSignature
			});
			verificationGasLimit += BigInt(dummySignerSignaturePairs.length) * 55000n;
			userOperation.maxFeePerGas = inputMaxFeePerGas;
			userOperation.maxPriorityFeePerGas = inputMaxPriorityFeePerGas;
		} else throw new AbstractionKitError("BAD_DATA", "bundlerRpc can't be null if preVerificationGas,verificationGasLimit and callGasLimit are not overridden");
		if (typeof overrides.preVerificationGas === "bigint" && overrides.preVerificationGas < 0n) throw new RangeError("preVerificationGas overrid can't be negative");
		if (typeof overrides.verificationGasLimit === "bigint" && overrides.verificationGasLimit < 0n) throw new RangeError("verificationGasLimit overrid can't be negative");
		if (typeof overrides.callGasLimit === "bigint" && overrides.callGasLimit < 0n) throw new RangeError("callGasLimit overrid can't be negative");
		userOperation.preVerificationGas = overrides.preVerificationGas ?? preVerificationGas * BigInt((overrides.preVerificationGasPercentageMultiplier ?? 0) + 100) / 100n;
		userOperation.verificationGasLimit = overrides.verificationGasLimit ?? verificationGasLimit * BigInt((overrides.verificationGasLimitPercentageMultiplier ?? 0) + 100) / 100n;
		userOperation.callGasLimit = overrides.callGasLimit ?? callGasLimit * BigInt((overrides.callGasLimitPercentageMultiplier ?? 0) + 100) / 100n;
		return [
			userOperation,
			factoryAddress,
			factoryData
		];
	}
	/**
	* create a useroperation signature
	* @param useroperation - useroperation to sign
	* @param privateKeys - for the signers
	* @param chainId - target chain id
	* @param entrypointAddress - target EntryPoint
	* @param safe4337ModuleAddress - Safe 4337 module
	* @param options - per-call signing options (timing, multi-chain encoding, module address) — passed through to {@link formatSignaturesToUseroperationSignature}
	* @returns signature
	*/
	static baseSignSingleUserOperation(useroperation, privateKeys, chainId, entrypointAddress, safe4337ModuleAddress, options = {}) {
		const validAfter = options.validAfter ?? 0n;
		const validUntil = options.validUntil ?? 0n;
		const moduleAddress = options.safe4337ModuleAddress ?? safe4337ModuleAddress;
		if (privateKeys.length < 1) throw new RangeError("There should be at least one privateKey");
		if (chainId < 0n) throw new RangeError("chainId can't be negative");
		if (validAfter < 0n) throw new RangeError("validAfter can't be negative");
		if (validUntil < 0n) throw new RangeError("validUntil can't be negative");
		const userOperationEip712Hash = SafeAccount.getUserOperationEip712Hash(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress: moduleAddress
		});
		const signerSignaturePairs = [];
		for (const privateKey of privateKeys) {
			const signature = signHash$1(privateKey, userOperationEip712Hash).serialized;
			signerSignaturePairs.push({
				signer: privateKeyToAddress(privateKey),
				signature
			});
		}
		return SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
			...options,
			validAfter,
			validUntil
		});
	}
	/**
	* Schemes Safe accepts from an {@link ExternalSigner}, in preference order.
	* `typedData` is preferred because wallets can display structured fields
	* rather than a hex blob; `hash` is accepted as a fallback for signers
	* that only support raw ECDSA.
	*/
	static ACCEPTED_SIGNING_SCHEMES = ["typedData", "hash"];
	/**
	* Sign a UserOperation using one or more {@link ExternalSigner}s. This is the
	* capability-oriented signing path: each signer declares what it can do
	* (`signHash`, `signTypedData`, both) and the account picks the best
	* match per signer. Incompatible signers fail offline with an actionable
	* error rather than a silent bundler rejection.
	*
	* Signers are invoked in parallel. For interactive wallets that share a
	* popup session, sequence the prompts inside your ExternalSigner implementation.
	*
	* @param useroperation - UserOperation to sign
	* @param signers - ExternalSigner instances (`fromViem(account)`, `fromEthersWallet(wallet)`, etc.)
	* @param chainId - target chain id
	* @param params - bag combining required wiring (`entrypointAddress`,
	*   `safe4337ModuleAddress`, `context`) with optional `options`
	*   ({@link SafeSignatureOptions}: timing, multi-chain encoding,
	*   module address).
	*   Both flow through to {@link formatSignaturesToUseroperationSignature}.
	* @returns formatted signature
	*/
	static async baseSignUserOperationWithSigners(useroperation, signers, chainId, params) {
		const { entrypointAddress, safe4337ModuleAddress, context, options = {} } = params;
		const validAfter = options.validAfter ?? 0n;
		const validUntil = options.validUntil ?? 0n;
		const moduleAddress = options.safe4337ModuleAddress ?? safe4337ModuleAddress;
		if (signers.length < 1) throw new RangeError("There should be at least one signer");
		const typedDataRaw = SafeAccount.getUserOperationEip712Data(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress: moduleAddress
		});
		const userOpHash = hashTypedData(typedDataRaw.domain, typedDataRaw.types, typedDataRaw.messageValue);
		const { EIP712Domain: _drop, ...primaryTypes } = typedDataRaw.types;
		const typedData = {
			domain: typedDataRaw.domain,
			types: primaryTypes,
			primaryType: EIP712_SAFE_OPERATION_PRIMARY_TYPE,
			message: typedDataRaw.messageValue
		};
		const normalizedAddresses = signers.map((signer) => getAddress(signer.address));
		const schemes = signers.map((signer, signerIndex) => pickScheme(signer, SafeAccount.ACCEPTED_SIGNING_SCHEMES, {
			accountName: "Safe (EIP-712 or raw hash over SafeOp digest)",
			signerIndex
		}));
		const signerSignaturePairs = (await Promise.all(signers.map((signer, i) => invokeSigner(signer, schemes[i], {
			hash: userOpHash,
			typedData,
			context
		})))).map((signature, i) => ({
			signer: normalizedAddresses[i],
			signature,
			isContractSignature: signers[i].type === "contract"
		}));
		return SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
			...options,
			validAfter,
			validUntil
		});
	}
	/**
	* compute the deterministic address for a webauthn proxy verifier based on a
	* webauthn public key(x, y)
	* @param x - webauthn public key x parameter
	* @param y - webauthn public key y parameter
	* @param overrides - overrides for the default values
	* @returns webauthn verifier address
	*/
	static createWebAuthnSignerVerifierAddress(x, y, overrides = {}) {
		const eip7212WebAuthnPrecompileVerifier = overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
		const eip7212WebAuthnContractVerifier = overrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
		const webAuthnSignerFactory = overrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY;
		const webAuthnSignerSingleton = overrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
		if (eip7212WebAuthnPrecompileVerifier.length !== 42 || eip7212WebAuthnPrecompileVerifier.slice(0, 38) !== "0x0000000000000000000000000000000000000000".slice(0, 38)) throw new RangeError("Invalid precompile address. It should have the format 0x000000000000000000000000000000000000____");
		return getAddress(`0x${solidityPackedKeccak256([
			"bytes1",
			"address",
			"bytes32",
			"bytes32"
		], [
			"0xff",
			webAuthnSignerFactory,
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			keccak256(solidityPacked([
				"bytes",
				"uint256",
				"uint256",
				"uint256",
				"uint256"
			], [
				overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
				webAuthnSignerSingleton,
				x,
				y,
				"0x" + eip7212WebAuthnPrecompileVerifier.slice(-4) + eip7212WebAuthnContractVerifier.slice(2)
			]))
		]).slice(-40)}`);
	}
	/**
	* format a list of eip712 signatures to a useroperation signature
	* @param signerSignaturePairs - a list of a pair of a signer and it's signature
	* @param options - merged bag of {@link SafeSignatureOptions} (timing, multi-chain encoding, module address) and {@link WebAuthnSignatureOverrides} (verifier addresses, init flag). Single param for back-compat with the pre-split shape — callers may pass any combination of fields from either type.
	* @returns signature
	*/
	static formatSignaturesToUseroperationSignature(signerSignaturePairs, options = {}) {
		const validAfter = options.validAfter ?? 0n;
		const validUntil = options.validUntil ?? 0n;
		const signature = SafeAccount.buildSignaturesFromSingerSignaturePairs(signerSignaturePairs, options);
		if (options.isMultiChainSignature) if (options.multiChainMerkleProof != null) {
			const merkleProofLength = options.multiChainMerkleProof.slice(2).length;
			if (merkleProofLength < 128 || merkleProofLength % 64 !== 0) throw new RangeError("invalid multiChainMerkleProof length.");
			let merkleTreeDepthHex = (merkleProofLength / 64 - 1).toString(16);
			if (merkleTreeDepthHex.length % 2 === 0) merkleTreeDepthHex = `0x${merkleTreeDepthHex}`;
			else merkleTreeDepthHex = `0x0${merkleTreeDepthHex}`;
			return solidityPacked([
				"bytes1",
				"uint48",
				"uint48",
				"bytes"
			], [
				merkleTreeDepthHex,
				validAfter,
				validUntil,
				options.multiChainMerkleProof + signature.slice(2)
			]);
		} else return solidityPacked([
			"bytes1",
			"uint48",
			"uint48",
			"bytes"
		], [
			"0x00",
			validAfter,
			validUntil,
			signature
		]);
		else return solidityPacked([
			"uint48",
			"uint48",
			"bytes"
		], [
			validAfter,
			validUntil,
			signature
		]);
	}
	/**
	* Resolve a {@link Signer} to the lowercase address the Safe contract
	* sees as the owner — not merely a case conversion:
	*
	* - string signer: returned lowercased as-is.
	* - WebAuthn public key with `overrides.isInit` set: resolves to the
	*   WebAuthn **shared signer** address, since during account init the
	*   shared signer is the enabled owner rather than a per-owner verifier.
	* - WebAuthn public key otherwise: **derives** the deterministic CREATE2
	*   address of the per-owner WebAuthn verifier proxy from the key's x/y
	*   coordinates and the verifier/factory configuration.
	*
	* Used as the sort key in {@link sortSignatures}, so it must always match
	* the owner address that signature encoding will emit for the same
	* overrides — pass the same overrides bag to both.
	* @param signer - a signer to compute the owner address for
	* @param overrides - WebAuthn verifier configuration and the init flag
	* @returns the owner address, lowercased
	*/
	static getSignerLowerCaseAddress(signer, overrides = {}) {
		if (typeof signer === "string") return signer.toLowerCase();
		else if (overrides.isInit) return (overrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER).toLowerCase();
		else {
			const eip7212WebAuthnPrecompileVerifier = overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
			const eip7212WebAuthnContractVerifier = overrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
			const webAuthnSignerFactory = overrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY;
			const webAuthnSignerSingleton = overrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
			const webAuthnSignerProxyCreationCode = overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
			return SafeAccount.createWebAuthnSignerVerifierAddress(signer.x, signer.y, {
				eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory,
				webAuthnSignerSingleton,
				webAuthnSignerProxyCreationCode
			}).toLowerCase();
		}
	}
	/**
	* sorts a list of signerSginaturesPairs in place based on the signer
	* public address, as the signatures needs to be sorted to be validated
	* by a safe account
	* @param signer - a signer to compute address for
	* @param overrides - overrides for the default values
	*/
	static sortSignatures(signerSignaturePairs, overrides = {}) {
		signerSignaturePairs.sort((left, right) => SafeAccount.getSignerLowerCaseAddress(left.signer, overrides).localeCompare(SafeAccount.getSignerLowerCaseAddress(right.signer, overrides)));
	}
	/**
	* format a list of eip712 signatures to a safe signature (without the time range)
	* @param signerSignaturePairs - a list of a pair of a signer and it's signature
	* @param webAuthnSignatureOverrides - WebAuthn-only configuration (verifier addresses, init flag)
	* @returns signature
	*/
	static buildSignaturesFromSingerSignaturePairs(signerSignaturePairs, webAuthnSignatureOverrides = {}) {
		SafeAccount.sortSignatures(signerSignaturePairs, webAuthnSignatureOverrides);
		const start = 65 * signerSignaturePairs.length;
		const { segments } = signerSignaturePairs.reduce(({ segments, offset }, { signer, signature, isContractSignature }) => {
			isContractSignature = isContractSignature || typeof signer !== "string";
			if (isContractSignature) {
				if (typeof signer !== "string") {
					if (webAuthnSignatureOverrides.isInit == null) throw new RangeError("Must define isInit parameter when using WebAuthn");
					if (webAuthnSignatureOverrides.isInit) signer = webAuthnSignatureOverrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER;
					else {
						const eip7212WebAuthnPrecompileVerifier = webAuthnSignatureOverrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
						const eip7212WebAuthnContractVerifier = webAuthnSignatureOverrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
						const webAuthnSignerFactory = webAuthnSignatureOverrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY;
						const webAuthnSignerSingleton = webAuthnSignatureOverrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
						const webAuthnSignerProxyCreationCode = webAuthnSignatureOverrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
						signer = SafeAccount.createWebAuthnSignerVerifierAddress(signer.x, signer.y, {
							eip7212WebAuthnPrecompileVerifier,
							eip7212WebAuthnContractVerifier,
							webAuthnSignerFactory,
							webAuthnSignerSingleton,
							webAuthnSignerProxyCreationCode
						});
					}
				}
				return {
					segments: [...segments, solidityPacked([
						"uint256",
						"uint256",
						"uint8"
					], [
						signer,
						start + offset,
						0
					])],
					offset: offset + 32 + dataLength(signature)
				};
			} else return {
				segments: [...segments, solidityPacked(["bytes"], [signature])],
				offset
			};
		}, {
			segments: [],
			offset: 0
		});
		return concat([...segments, ...signerSignaturePairs.map(({ signer, signature, isContractSignature }) => {
			isContractSignature = isContractSignature || typeof signer !== "string";
			if (isContractSignature) return solidityPacked(["uint256", "bytes"], [dataLength(signature), signature]);
			else return "0x";
		})]);
	}
	/**
	* encode webauthn signature from WebauthnSignatureData
	* @param signatureData - signature data to format
	* @returns formatted signature
	*/
	static createWebAuthnSignature(signatureData) {
		return encodeAbiParameters([
			"bytes",
			"bytes",
			"uint256[2]"
		], [
			new Uint8Array(signatureData.authenticatorData),
			signatureData.clientDataFields,
			signatureData.rs
		]);
	}
	/**
	* create a swapOwner metatransaction and create a metatransaction to
	* deploy a webauthn verifier owner if not deployed and it will automatically
	* fetch the prevOwner needed for the swap
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* (to get the prevOwner parameter) and to check if a webauthn newowner verifier
	* is already deployed.
	* @param newOwner - newOwner public address
	* @param oldOwner - oldOwner to replace public address
	* @param overrides - overrides for the default values
	* @param overrides.prevOwner - if set, it will be used as the previous owner and
	* nodeRpcUrl won't be used to fetch it
	* @returns a promise of a list of metaTransactions
	*/
	async createSwapOwnerMetaTransactions(nodeRpcUrl, newOwner, oldOwner, overrides = {}) {
		let deployNewOwnerSignerMetaTransaction = null;
		let newOwnerT;
		let oldOwnerT;
		const webAuthnSignerProxyCreationCode = overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
		if (typeof newOwner !== "string") {
			newOwnerT = SafeAccount.createWebAuthnSignerVerifierAddress(newOwner.x, newOwner.y, {
				eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory: overrides.webAuthnSignerFactory,
				webAuthnSignerSingleton: overrides.webAuthnSignerSingleton,
				webAuthnSignerProxyCreationCode
			});
			if ((await JsonRpcNode.from(nodeRpcUrl).getCode(newOwnerT, "latest")).length < 3) deployNewOwnerSignerMetaTransaction = SafeAccount.createDeployWebAuthnVerifierMetaTransaction(newOwner.x, newOwner.y, {
				eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory: overrides.webAuthnSignerFactory
			});
		} else newOwnerT = newOwner;
		if (typeof oldOwner !== "string") oldOwnerT = SafeAccount.createWebAuthnSignerVerifierAddress(oldOwner.x, oldOwner.y, {
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton,
			webAuthnSignerProxyCreationCode
		});
		else oldOwnerT = oldOwner;
		let prevOwnerT = overrides.prevOwner;
		if (prevOwnerT == null) {
			const owners = await this.getOwners(nodeRpcUrl);
			const oldOwnerIndex = owners.findIndex((owner) => owner.toLowerCase() === oldOwnerT.toLowerCase());
			if (oldOwnerIndex === -1) throw new RangeError("oldOwner is not a current owner.");
			else if (oldOwnerIndex === 0) prevOwnerT = "0x0000000000000000000000000000000000000001";
			else prevOwnerT = owners[oldOwnerIndex - 1];
		}
		const swapMetaTransaction = this.createStandardSwapOwnerMetaTransaction(newOwnerT, oldOwnerT, prevOwnerT);
		if (deployNewOwnerSignerMetaTransaction == null) return [swapMetaTransaction];
		else return [deployNewOwnerSignerMetaTransaction, swapMetaTransaction];
	}
	/**
	* create a removeOwner metatransaction, and fetch the prevOwner
	* needed for the remove
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* (to get the prevOwner parameter).
	* @param ownerToDelete - owner to delete public address
	* @param threshold - new threshold
	* @param overrides - overrides for the default values
	* @param overrides.prevOwner - if set, it will be used as the previous owner and
	* nodeRpcUrl won't be used to fetch it
	* @returns a promise of a metaTransaction
	*/
	async createRemoveOwnerMetaTransaction(nodeRpcUrl, ownerToDelete, threshold, overrides = {}) {
		let ownerToDeleteT;
		if (typeof ownerToDelete !== "string") {
			const webAuthnSignerProxyCreationCode = overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
			ownerToDeleteT = SafeAccount.createWebAuthnSignerVerifierAddress(ownerToDelete.x, ownerToDelete.y, {
				eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory: overrides.webAuthnSignerFactory,
				webAuthnSignerSingleton: overrides.webAuthnSignerSingleton,
				webAuthnSignerProxyCreationCode
			});
		} else ownerToDeleteT = ownerToDelete;
		let prevOwnerT = overrides.prevOwner;
		if (prevOwnerT == null) {
			const owners = await this.getOwners(nodeRpcUrl);
			const ownerToDeleteIndex = owners.findIndex((owner) => owner.toLowerCase() === ownerToDeleteT.toLowerCase());
			if (ownerToDeleteIndex === -1) throw new RangeError("ownerToDelete is not a current owner.");
			else if (ownerToDeleteIndex === 0) prevOwnerT = "0x0000000000000000000000000000000000000001";
			else prevOwnerT = owners[ownerToDeleteIndex - 1];
		}
		return this.createStandardRemoveOwnerMetaTransaction(ownerToDeleteT, threshold, prevOwnerT);
	}
	/**
	* create an addOwner metatransaction and create a metatransaction to
	* deploy a webauthn verifier owner if it is not deployed
	* @param newOwner - newOwner public address
	* @param threshold - new threshold
	* @param overrides - overrides for the default values
	* @param overrides.nodeRpcUrl - The JSON-RPC API url for the target chain
	* (to check if the new webauthn owner is deployed or not).
	* @returns a promise of a list of metaTransactions
	*/
	async createAddOwnerWithThresholdMetaTransactions(newOwner, threshold, overrides = {}) {
		let deployNewOwnerSignerMetaTransaction = null;
		let newOwnerT;
		if (typeof newOwner !== "string") {
			const webAuthnSignerProxyCreationCode = overrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
			newOwnerT = SafeAccount.createWebAuthnSignerVerifierAddress(newOwner.x, newOwner.y, {
				eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory: overrides.webAuthnSignerFactory,
				webAuthnSignerSingleton: overrides.webAuthnSignerSingleton,
				webAuthnSignerProxyCreationCode
			});
			if (overrides.nodeRpcUrl == null) throw new RangeError("overrides.nodeRpcUrl can't be null if adding a webauthn owner");
			if ((await JsonRpcNode.from(overrides.nodeRpcUrl).getCode(newOwnerT, "latest")).length < 3) deployNewOwnerSignerMetaTransaction = SafeAccount.createDeployWebAuthnVerifierMetaTransaction(newOwner.x, newOwner.y, {
				eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier,
				eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier,
				webAuthnSignerFactory: overrides.webAuthnSignerFactory
			});
		} else newOwnerT = newOwner;
		const addMetaTransaction = this.createStandardAddOwnerWithThresholdMetaTransaction(newOwnerT, threshold);
		if (deployNewOwnerSignerMetaTransaction == null) return [addMetaTransaction];
		else return [deployNewOwnerSignerMetaTransaction, addMetaTransaction];
	}
	/**
	* create a standard addOwner metatransaction
	* @param newOwner - newOwner public address
	* @param threshold - new threshold
	* @returns a metaTransaction
	*/
	createStandardAddOwnerWithThresholdMetaTransaction(newOwner, threshold) {
		const callData = createCallData("0x0d582f13", ["address", "uint256"], [newOwner, threshold]);
		return {
			to: this.accountAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a standard swapOwner metatransaction
	* @param newOwner - newOwner public address
	* @param oldOwner - oldOwner public address
	* @param prevOwner - prevOwner public address in the owners linked list
	* @returns a metaTransaction
	*/
	createStandardSwapOwnerMetaTransaction(newOwner, oldOwner, prevOwner) {
		const callData = createCallData("0xe318b52b", [
			"address",
			"address",
			"address"
		], [
			prevOwner,
			oldOwner,
			newOwner
		]);
		return {
			to: this.accountAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a standard removeOwner metatransaction
	* @param ownerToDelete - owner to delete public address
	* @param threshold - new threshold
	* @param prevOwner - prevOwner public address in the owners linked list
	* @returns a metaTransaction
	*/
	createStandardRemoveOwnerMetaTransaction(ownerToDelete, threshold, prevOwner) {
		const callData = createCallData("0xf8dc5dd9", [
			"address",
			"address",
			"uint256"
		], [
			prevOwner,
			ownerToDelete,
			threshold
		]);
		return {
			to: this.accountAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a change threshold metatransaction
	* @param threshold - new threshold
	* @returns a metaTransactions
	*/
	createChangeThresholdMetaTransaction(threshold) {
		if (threshold < 1) throw new RangeError("threshold can't be less than 1.");
		const changeThresholdCallData = createCallData("0x694e80c3", ["uint256"], [threshold]);
		return {
			to: this.accountAddress,
			data: changeThresholdCallData,
			value: 0n
		};
	}
	/**
	* create an approve hash metatransaction
	* @param hashToApprove - hash to approve
	* @returns a metaTransactions
	*/
	createApproveHashMetaTransaction(hashToApprove) {
		const approveHashCallData = createCallData("0xd4d9bdcd", ["bytes32"], [hashToApprove]);
		return {
			to: this.accountAddress,
			data: approveHashCallData,
			value: 0n
		};
	}
	/**
	* create a deploy webauthn verifier metatransaction
	* @param x - webauthn public key x parameter
	* @param y - webauthn public key y parameter
	* @param overrides - overrides for the default values
	* @returns a metaTransaction
	*/
	static createDeployWebAuthnVerifierMetaTransaction(x, y, overrides = {}) {
		const eip7212WebAuthnPrecompileVerifier = overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
		const eip7212WebAuthnContractVerifier = overrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
		return {
			to: overrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			value: 0n,
			data: createCallData("0x0d2f0489", [
				"uint256",
				"uint256",
				"uint176"
			], [
				x,
				y,
				"0x" + eip7212WebAuthnPrecompileVerifier.slice(-4) + eip7212WebAuthnContractVerifier.slice(2)
			])
		};
	}
	/**
	* fetches a list of the account owners public addresses
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @returns a promise of a list of owners public addresses
	*/
	async getOwners(nodeRpcUrl) {
		const callData = createCallData(getFunctionSelector("getOwners()"), [], []);
		const ethCallParams = {
			to: this.accountAddress,
			data: callData
		};
		return decodeAbiParameters(["address[]"], await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest"))[0];
	}
	/**
	* fetches the current threshold
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @returns a promise with the current threshold
	*/
	async getThreshold(nodeRpcUrl) {
		const callData = createCallData("0xe75235b8", [], []);
		const ethCallParams = {
			to: this.accountAddress,
			data: callData
		};
		const decodedCalldata = decodeAbiParameters(["uint256"], await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest"));
		return Number(decodedCalldata[0]);
	}
	/**
	* fetches a paginated list of enabled modules for this account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @param overrides - pagination overrides
	* @param overrides.start - module address to start from (defaults to the sentinel 0x...0001)
	* @param overrides.pageSize - maximum number of modules to return (default 10)
	* @returns a promise of [moduleAddresses, nextPageStart]; pass nextPageStart back in overrides.start to continue
	*/
	async getModules(nodeRpcUrl, overrides = {}) {
		try {
			let start = overrides.start;
			if (start == null) start = "0x0000000000000000000000000000000000000001";
			let pageSize = overrides.pageSize;
			if (pageSize == null) pageSize = 10n;
			const callData = createCallData("0xcc2f8452", ["address", "uint256"], [start, pageSize]);
			const ethCallParams = {
				to: this.accountAddress,
				data: callData
			};
			const getModulesResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
			if (getModulesResult === "0x") throw new AbstractionKitError("BAD_DATA", "getModules returned an empty result, the target account is probably not deployed yet.");
			const decodedCalldata = decodeAbiParameters(["address[]", "address"], getModulesResult);
			return [decodedCalldata[0], decodedCalldata[1]];
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", "getModules failed", { cause: ensureError(err) });
		}
	}
	/**
	* check if a module is enabled
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @param moduleAddress - the module address to check if enabled
	* @returns a promise of boolean
	*/
	async isModuleEnabled(nodeRpcUrl, moduleAddress) {
		const callData = createCallData(getFunctionSelector("isModuleEnabled(address)"), ["address"], [moduleAddress]);
		const ethCallParams = {
			to: this.accountAddress,
			data: callData
		};
		return decodeAbiParameters(["bool"], await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest"))[0];
	}
	/**
	* read the Safe's current fallback handler address from storage.
	* For Safe ERC-4337 accounts the fallback handler is the 4337 module, so this
	* is the canonical way to confirm which module/EntryPoint version an account
	* is on (e.g. after a module migration).
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @returns a promise of the fallback handler address (checksummed)
	*/
	async getFallbackHandler(nodeRpcUrl) {
		return getAddress("0x" + (await JsonRpcNode.from(nodeRpcUrl).getStorageAt(this.accountAddress, SAFE_FALLBACK_HANDLER_STORAGE_SLOT, "latest")).slice(-40));
	}
	/**
	* read the Safe's version string via `VERSION()` (e.g. "1.4.1").
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @returns a promise of the Safe singleton version string
	*/
	async getSafeVersion(nodeRpcUrl) {
		const callData = createCallData(getFunctionSelector("VERSION()"), [], []);
		const [version] = decodeAbiParameters(["string"], await JsonRpcNode.from(nodeRpcUrl).call({
			to: this.accountAddress,
			data: callData
		}, "latest"));
		return version;
	}
	/**
	* create a list of dummy signer/signature pairs for gas estimation based on the expected signers.
	* @param expectedSigners - signers whose signatures will be produced at sign time
	* @param webAuthnSignatureOverrides - WebAuthn verifier/module configuration
	* @returns a list of dummy SignerSignaturePair entries, one per expected signer
	*/
	static createDummySignerSignaturePairForExpectedSigners(expectedSigners, webAuthnSignatureOverrides = {}) {
		const signers = [...expectedSigners];
		const dummySignerSignatures = [];
		for (const signer of signers) {
			let signerSignaturePair;
			if (typeof signer === "string") signerSignaturePair = EOADummySignerSignaturePair;
			else {
				if (webAuthnSignatureOverrides.isInit == null) throw new RangeError("Must define isInit parameter when using WebAuthn");
				signerSignaturePair = { ...WebauthnDummySignerSignaturePair };
				if (webAuthnSignatureOverrides.isInit) {
					const webauthnsharedsigner = webAuthnSignatureOverrides.webAuthnSharedSigner ?? SafeAccount.DEFAULT_WEB_AUTHN_SHARED_SIGNER;
					signerSignaturePair.signer = webauthnsharedsigner;
				} else {
					const eip7212WebAuthnPrecompileVerifier = webAuthnSignatureOverrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
					const eip7212WebAuthnContractVerifier = webAuthnSignatureOverrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
					const webAuthnSignerFactory = webAuthnSignatureOverrides.webAuthnSignerFactory ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY;
					const webAuthnSignerSingleton = webAuthnSignatureOverrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
					const webAuthnSignerProxyCreationCode = webAuthnSignatureOverrides.webAuthnSignerProxyCreationCode ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE;
					signerSignaturePair.signer = SafeAccount.createWebAuthnSignerVerifierAddress(signer.x, signer.y, {
						eip7212WebAuthnPrecompileVerifier,
						eip7212WebAuthnContractVerifier,
						webAuthnSignerFactory,
						webAuthnSignerSingleton,
						webAuthnSignerProxyCreationCode
					});
				}
			}
			dummySignerSignatures.push(signerSignaturePair);
		}
		return dummySignerSignatures;
	}
	/**
	* verify a webauthn signature against a signer and a message hash
	* @note: this function works by constructing the bytecode of a webauthn
	* verifying contract proxy that represent the input signer, then overriding
	* an arbitrary address code and caling "isValidSignature" using eth_call
	* this way we can check a signature even if the verifying contract is not
	* deployed
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @param signer - a signer to check the signature against
	* @param messageHash - a messageHash to check the signature against
	* @param signature - a webauthn signature to check
	* @param overrides - overrides for the default values
	* @returns a promise of boolean - True if a valid signature
	*/
	static async verifyWebAuthnSignatureForMessageHash(nodeRpcUrl, signer, messageHash, signature, overrides = {}) {
		if (messageHash.length !== 66 || messageHash.slice(0, 2) !== "0x") throw new RangeError("Invalid messageHash, must be a 0x-prefixed keccak256 hash.");
		const eip7212WebAuthnPrecompileVerifier = overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_PRECOMPILE;
		const eip7212WebAuthnContractVerifier = overrides.eip7212WebAuthnContractVerifier ?? SafeAccount.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER;
		const webAuthnSignerSingleton = overrides.webAuthnSignerSingleton ?? SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON;
		if (eip7212WebAuthnPrecompileVerifier.length !== 42 || eip7212WebAuthnPrecompileVerifier.slice(0, 38) !== "0x0000000000000000000000000000000000000000".slice(0, 38)) throw new RangeError("Invalid precompile address. It should have the format 0x000000000000000000000000000000000000____");
		const callData = createCallData("0x1626ba7e", ["bytes32", "bytes"], [messageHash, signature]);
		const arbitraryAddress = "0x1111111111111111111111111111111111111111";
		const ethCallParams = {
			to: arbitraryAddress,
			data: callData
		};
		const deployedByteCode = SafeAccount.createSafeWebAuthnSignerProxyDeployedByteCode(signer, eip7212WebAuthnPrecompileVerifier, eip7212WebAuthnContractVerifier, webAuthnSignerSingleton);
		return decodeAbiParameters(["bool"], await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest", { [arbitraryAddress]: { code: deployedByteCode } }))[0];
	}
	static createSafeWebAuthnSignerProxyDeployedByteCode(signer, eip7212WebAuthnPrecompileVerifier, eip7212WebAuthnContractVerifier, webAuthnSignerSingleton) {
		const x = encodeAbiParameters(["uint256"], [signer.x]);
		const y = encodeAbiParameters(["uint256"], [signer.y]);
		return "0x608060408190527f" + encodeAbiParameters(["uint176"], ["0x" + eip7212WebAuthnPrecompileVerifier.slice(-4) + eip7212WebAuthnContractVerifier.slice(2)]).slice(2) + "3660b681018290527f" + y.slice(2) + "60a082018190527f" + x.slice(2) + "8285018190527f000000000000000000000000" + webAuthnSignerSingleton.slice(2) + "9490939192600082376000806056360183885af490503d6000803e8060c3573d6000fd5b503d6000f3fea2646970667358221220ddd9bb059ba7a6497d560ca97aadf4dbf0476f578378554a50d41c6bb654beae64736f6c63430008180033";
	}
	/**
	* create MetaTransaction to enable a module on a Safe account
	* @param moduleAddress - Module to enable
	* @param accountAddress - Safe account to enable the module for
	* @returns a MetaTransaction
	*/
	static createEnableModuleMetaTransaction(moduleAddress, accountAddress) {
		return {
			to: accountAddress,
			data: createCallData("0x610b5925", ["address"], [moduleAddress]),
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that disables a module on this Safe account,
	* fetching the previous module in the linked list automatically when not provided.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain (used when prevModuleAddress is not provided)
	* @param moduleToDisableAddress - Module to disable
	* @param accountAddress - Safe account to disable the module on
	* @param overrides - overrides for the default values
	* @param overrides.prevModuleAddress - previous module in the linked list (skips the RPC lookup when set)
	* @param overrides.modulesStart - pagination start when scanning modules to find the previous one
	* @param overrides.modulesPageSize - pagination page size when scanning modules
	* @returns a promise of a MetaTransaction
	*/
	async createDisableModuleMetaTransaction(nodeRpcUrl, moduleToDisableAddress, accountAddress, overrides = {}) {
		try {
			let prevModuleAddressT = overrides.prevModuleAddress;
			if (prevModuleAddressT == null) {
				const SENTINEL_MODULES = "0x0000000000000000000000000000000000000001";
				const target = moduleToDisableAddress.toLowerCase();
				let cursor = overrides.modulesStart ?? SENTINEL_MODULES;
				let prev = cursor;
				while (prevModuleAddressT == null) {
					const [modules, next] = await this.getModules(nodeRpcUrl, {
						start: cursor,
						pageSize: overrides.modulesPageSize
					});
					for (const module of modules) {
						if (module.toLowerCase() === target) {
							prevModuleAddressT = prev;
							break;
						}
						prev = module;
					}
					if (prevModuleAddressT != null) break;
					if (modules.length === 0 || next.toLowerCase() === SENTINEL_MODULES || next.toLowerCase() === cursor.toLowerCase()) throw new RangeError(`moduleToDisable ${moduleToDisableAddress} is not an enabled module.`);
					cursor = next;
				}
			}
			return SafeAccount.createStandardDisableModuleMetaTransaction(moduleToDisableAddress, prevModuleAddressT, accountAddress);
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", "createDisableModuleMetaTransaction failed", { cause: ensureError(err) });
		}
	}
	/**
	* create a standard disable-module MetaTransaction (callers provide the previous module).
	* @param moduleAddress - Module to disable
	* @param prevModuleAddress - previous module in the linked list
	* @param accountAddress - Safe account to disable the module on
	* @returns a MetaTransaction
	*/
	static createStandardDisableModuleMetaTransaction(moduleAddress, prevModuleAddress, accountAddress) {
		return {
			to: accountAddress,
			data: createCallData("0xe009cfde", ["address", "address"], [prevModuleAddress, moduleAddress]),
			value: 0n
		};
	}
	/**
	* create the MetaTransactions that migrate a DEPLOYED Safe from one ERC-4337
	* module (and EntryPoint) to another. For Safe 4337 accounts the module is
	* both the enabled module and the fallback handler, so a migration is exactly:
	*   1. disableModule(oldModule)
	*   2. enableModule(newModule)
	*   3. setFallbackHandler(newModule)
	*
	* @note Both the v0.6/v0.7 `Safe4337Module` and the v0.9
	* `Safe4337MultiChainSignatureModule` are stateless (no per-account storage),
	* so there is NO storage to clear when swapping modules — these three
	* transactions are the whole migration. The batch is validated and executed
	* by the OLD module on the OLD EntryPoint; disabling that module mid-batch is
	* safe because validation has already completed.
	*
	* Unless `skipPreflight` is set, this verifies on-chain that the account is
	* actually a Safe running `oldModuleAddress` (the module is enabled AND is the
	* current fallback handler) and that its Safe version meets the module minimum
	* (>= 1.4.1) — turning a would-be cryptic on-chain `AA23`/`AA24` into a clear
	* up-front error.
	*
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain (used to find
	*   the previous module in the linked list when not provided, and for preflight)
	* @param oldModuleAddress - the currently-enabled 4337 module to disable
	* @param newModuleAddress - the 4337 module to enable and set as fallback handler
	* @param overrides - previous-module lookup overrides and `skipPreflight`
	* @returns a promise of [disableOld, enableNew, setFallbackHandler] MetaTransactions
	*
	* @remarks Shared implementation behind the version-specific migration helpers
	* (e.g. {@link SafeAccountV0_3_0.createMigrateToSafeMultiChainSigAccountV1MetaTransactions}).
	* It is `protected` on purpose: those wrappers pin the correct module addresses,
	* so callers reach migration through them rather than supplying raw module
	* addresses directly.
	*/
	async createModuleMigrationMetaTransactions(nodeRpcUrl, oldModuleAddress, newModuleAddress, overrides = {}) {
		if (overrides.skipPreflight !== true) await this.assertMigratableFromModule(nodeRpcUrl, oldModuleAddress);
		return [
			await this.createDisableModuleMetaTransaction(nodeRpcUrl, oldModuleAddress, this.accountAddress, overrides),
			SafeAccount.createEnableModuleMetaTransaction(newModuleAddress, this.accountAddress),
			{
				to: this.accountAddress,
				value: 0n,
				data: createCallData("0xf08a0323", ["address"], [newModuleAddress])
			}
		];
	}
	/**
	* Minimum Safe singleton version required by the ERC-4337 modules.
	*/
	static MIN_SAFE_4337_VERSION = "1.4.1";
	/**
	* Assert that this account is a deployed Safe currently running `oldModuleAddress`
	* as both its enabled module and its fallback handler, on a Safe version that
	* meets the 4337 module minimum. Throws a descriptive `BAD_DATA` error otherwise.
	*/
	async assertMigratableFromModule(nodeRpcUrl, oldModuleAddress) {
		const node = JsonRpcNode.from(nodeRpcUrl);
		let fallbackHandler;
		try {
			fallbackHandler = await this.getFallbackHandler(node);
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", `Could not read the fallback handler of ${this.accountAddress} — is it a deployed Safe? Pass { skipPreflight: true } to bypass this check.`, { cause: ensureError(err) });
		}
		if (fallbackHandler.toLowerCase() !== oldModuleAddress.toLowerCase()) throw new AbstractionKitError("BAD_DATA", `Safe ${this.accountAddress} fallback handler is ${fallbackHandler}, expected the old 4337 module ${oldModuleAddress}. This account is not a Safe running that module; pass { skipPreflight: true } to bypass.`);
		let moduleEnabled;
		try {
			moduleEnabled = await this.isModuleEnabled(node, oldModuleAddress);
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", `Could not check whether module ${oldModuleAddress} is enabled on Safe ${this.accountAddress} — is it a deployed Safe? Pass { skipPreflight: true } to bypass.`, { cause: ensureError(err) });
		}
		if (!moduleEnabled) throw new AbstractionKitError("BAD_DATA", `The 4337 module ${oldModuleAddress} is not enabled on Safe ${this.accountAddress}. Pass { skipPreflight: true } to bypass.`);
		let version;
		try {
			version = await this.getSafeVersion(node);
		} catch (err) {
			throw new AbstractionKitError("BAD_DATA", `Could not read the Safe version (VERSION()) of ${this.accountAddress} — is it a deployed Safe running module ${oldModuleAddress}? Pass { skipPreflight: true } to bypass.`, { cause: ensureError(err) });
		}
		if (typeof version !== "string" || version.trim() === "" || !SafeAccount.isVersionAtLeast(version, SafeAccount.MIN_SAFE_4337_VERSION)) throw new AbstractionKitError("BAD_DATA", `Safe ${this.accountAddress} reported version "${version}", which does not meet the minimum ${SafeAccount.MIN_SAFE_4337_VERSION} required by the 4337 modules (module ${oldModuleAddress}). Pass { skipPreflight: true } to bypass.`);
	}
	/**
	* Compare dotted version strings numerically (ignoring any "+suffix"), e.g.
	* isVersionAtLeast("1.4.1", "1.4.1") === true, ("1.5.0", "1.4.1") === true.
	*/
	static isVersionAtLeast(version, minimum) {
		const parse = (v) => v.split("+")[0].split(".").map((n) => parseInt(n, 10) || 0);
		const a = parse(version);
		const b = parse(minimum);
		for (let i = 0; i < Math.max(a.length, b.length); i++) {
			const x = a[i] ?? 0;
			const y = b[i] ?? 0;
			if (x !== y) return x > y;
		}
		return true;
	}
	/**
	* Simulate the encoded calldata for this account on Tenderly and optionally return a share link.
	* When `isInit` isn't provided, nonce is fetched via `nodeRpcUrl` to decide whether to include
	* factory address/data in the simulation.
	* @param tenderlyAccountSlug - The Tenderly account slug
	* @param tenderlyProjectSlug - The Tenderly project slug
	* @param tenderlyAccessKey - The Tenderly API access key
	* @param nodeRpcUrl - Ethereum JSON-RPC node URL (only used when overrides.isInit is not set)
	* @param chainId - Target chain ID
	* @param metaTransactions - Transactions to simulate (ignored if overrides.callData is set)
	* @param blockNumber - Optional block number for the simulation
	* @param overrides - overrides for the default values
	* @param overrides.safeModuleExecutorFunctionSelector - executor function to use
	* @param overrides.multisendContractAddress - multisend address for batch transactions
	* @param overrides.callData - pre-encoded calldata, overriding metaTransactions
	* @param overrides.createShareLink - if true (default), also create a shareable dashboard link
	* @param overrides.isInit - skip the nonce RPC check and explicitly set whether this is a deployment simulation
	* @returns The simulation result, and optionally `callDataSimulationShareLink` / `accountDeploymentSimulationShareLink`
	*/
	async simulateCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, nodeRpcUrl = null, chainId, metaTransactions, blockNumber = null, overrides = {}) {
		let isInit = false;
		if (nodeRpcUrl == null && overrides.isInit == null) throw new RangeError("nodeRpcUrl and overrides.isInit can't both be null");
		else if (overrides.isInit == null) isInit = await fetchAccountNonce(nodeRpcUrl, this.entrypointAddress, this.accountAddress) === 0n;
		else isInit = overrides.isInit;
		let callData = "0x";
		if (overrides.callData == null) if (metaTransactions.length === 1) callData = SafeAccount.createAccountCallDataSingleTransaction(metaTransactions[0], { safeModuleExecutorFunctionSelector: overrides.safeModuleExecutorFunctionSelector });
		else callData = SafeAccount.createAccountCallDataBatchTransactions(metaTransactions, {
			safeModuleExecutorFunctionSelector: overrides.safeModuleExecutorFunctionSelector,
			multisendContractAddress: overrides.multisendContractAddress
		});
		else callData = overrides.callData;
		if (overrides.createShareLink ?? true) return await simulateSenderCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, this.entrypointAddress, this.accountAddress, callData, isInit ? this.factoryAddress : null, isInit ? this.factoryData : null, blockNumber);
		else return { simulation: await simulateSenderCallDataWithTenderly(tenderlyAccountSlug, tenderlyProjectSlug, tenderlyAccessKey, chainId, this.entrypointAddress, this.accountAddress, callData, isInit ? this.factoryAddress : null, isInit ? this.factoryData : null, blockNumber) };
	}
	/**
	* create EIP-712 signing data for a Safe message, scoped to this account.
	* @param chainId - target chain id
	* @param message - message string to sign
	* @returns an object containing the typed data domain, types, and message value
	* needed for hashing and signing a Safe message
	*/
	getSafeMessageEip712Data(chainId, message) {
		return getSafeMessageEip712Data(this.accountAddress, chainId, message);
	}
};
/**
* generate a Safe on-chain identifier per https://docs.safe.global/sdk/onchain-tracking
* @param project - project name
* @param platform - "Web", "Mobile", "Safe App", or "Widget"; defaults to "Web"
* @param tool - tool name; defaults to "abstractionkit"
* @param toolVersion - tool version; defaults to the current abstractionkit version
* @returns the on-chain identifier as a hex string (not 0x prefixed)
*/
function generateOnChainIdentifier(project, platform = "Web", tool = "abstractionkit", toolVersion = "0.4.3") {
	const identifierPrefix = "5afe";
	const identifierVersion = "00";
	const projectHash = keccak256(hexlify(toUtf8Bytes(project))).slice(-20);
	const platformHash = keccak256(hexlify(toUtf8Bytes(platform))).slice(-3);
	const toolHash = keccak256(hexlify(toUtf8Bytes(tool))).slice(-3);
	const toolVersionHash = keccak256(hexlify(toUtf8Bytes(toolVersion))).slice(-3);
	return `${identifierPrefix}${identifierVersion}${hexlify(toUtf8Bytes(projectHash)).slice(2)}${hexlify(toUtf8Bytes(platformHash)).slice(2)}${hexlify(toUtf8Bytes(toolHash)).slice(2)}${hexlify(toUtf8Bytes(toolVersionHash)).slice(2)}`;
}
//#endregion
//#region src/account/Safe/modules/SafeModule.ts
/**
* Abstract base class for Safe modules. Provides shared utilities for
* encoding calldata, enabling the module, and validating on-chain results.
*/
var SafeModule = class {
	moduleAddress;
	/**
	* @param moduleAddress - The deployed address of the Safe module contract.
	*/
	constructor(moduleAddress) {
		this.moduleAddress = moduleAddress;
	}
	/**
	* create MetaTransaction to enable this module
	* @param accountAddress - Safe account to enable the module for
	* @returns a MetaTransaction
	*/
	createEnableModuleMetaTransaction(accountAddress) {
		return SafeAccount.createEnableModuleMetaTransaction(this.moduleAddress, accountAddress);
	}
	/**
	* Throws if the RPC call returned empty data (`0x`), which typically
	* indicates the module contract is not deployed at the expected address.
	* @param result - The raw hex result from an `eth_call`.
	* @param requestName - Name of the calling method, used in the error message.
	*/
	checkForEmptyResultAndRevert(result, requestName) {
		if (result === "0x") throw new AbstractionKitError("BAD_DATA", requestName + " returned 0x, module contract " + this.moduleAddress + " is probably not deployed");
	}
};
//#endregion
//#region src/account/Safe/modules/AllowanceModule.ts
/**
* Address of the legacy Allowance Module v0.1.0 contract.
* Replaced by v1.0.0 due to a bug in the v0.1.0 contract.
* Use this to interact with existing allowances set on the old module.
* @deprecated Prefer `AllowanceModule.DEFAULT_ALLOWANCE_MODULE_ADDRESS` (v1.0.0) for new allowances.
*/
const ALLOWANCE_MODULE_V0_1_0_ADDRESS = "0xAA46724893dedD72658219405185Fb0Fc91e091C";
/**
* Safe module for managing token spending allowances (v1.0.0). Enables Safe owners
* to grant delegates recurring or one-time permission to transfer ERC-20
* tokens from the Safe, subject to configurable limits and reset periods.
*
* Requires Safe v1.1.1 or later.
*
* Each delegate is limited to 65534 transfers per token allowance (uint16 nonce).
* Once exhausted, a new delegate must be used.
*
* **Breaking change (v1.0.0):** The default module address changed from
* {@link ALLOWANCE_MODULE_V0_1_0_ADDRESS} (`0xAA46…091C`) due to a bug in the
* v0.1.0 contract. If you have active allowances on the old module, use
* `new AllowanceModule(ALLOWANCE_MODULE_V0_1_0_ADDRESS)` to interact with them.
*/
var AllowanceModule = class AllowanceModule extends SafeModule {
	static DEFAULT_ALLOWANCE_MODULE_ADDRESS = "0x691f59471Bfd2B7d639DCF74671a2d648ED1E331";
	/**
	* @param moduleAddress - Deployed address of the Allowance Module contract.
	*   Defaults to {@link DEFAULT_ALLOWANCE_MODULE_ADDRESS}.
	*/
	constructor(moduleAddress = AllowanceModule.DEFAULT_ALLOWANCE_MODULE_ADDRESS) {
		super(moduleAddress);
	}
	/**
	* Creates a MetaTransaction that sets a one-time (non-recurring) token allowance
	* for a delegate. The allowance is consumed once and never resets, and it is
	* active as soon as the Safe executes the transaction.
	*
	* Note: the deployed AllowanceModule cannot delay activation of a one-time
	* allowance — `setAllowance` explicitly requires `resetTimeMin > 0` whenever
	* `resetBaseMin` is nonzero and reverts otherwise.
	* @param delegate - Address of the delegate to grant the allowance to.
	* @param token - ERC-20 token contract address (use zero address for native token).
	* @param allowanceAmount - Maximum amount the delegate can spend, in the token's smallest unit.
	* @returns A MetaTransaction to be executed by the Safe.
	*/
	createOneTimeAllowanceMetaTransaction(delegate, token, allowanceAmount) {
		return this.createBaseSetAllowanceMetaTransaction(delegate, token, allowanceAmount, 0n, 0n);
	}
	/**
	* Creates a MetaTransaction that sets a recurring token allowance for a delegate.
	* The allowance resets to the full amount after each validity period elapses,
	* and is spendable immediately once the Safe executes the transaction.
	* @param delegate - Address of the delegate to grant the allowance to.
	* @param token - ERC-20 token contract address (use zero address for native token).
	* @param allowanceAmount - Maximum amount per period, in the token's smallest unit.
	* @param recurringAllowanceValidityPeriodInMinutes - Duration of each allowance period in minutes.
	* @param inThePastPeriodStartBaseTimeStamp - Optional unix
	* timestamp **in seconds** that must be in the past (less than the block timestamp).
	* It represents the start of the recurring allowance period accounting — it does
	* **not** delay activation: the allowance is active and spendable immediately once
	* the Safe executes the transaction; this value only sets when each period resets.
	* So if you want to start accounting from a Saturday 10am for example, calculate the
	* timestamp of any previous Saturday 10am and use it as the value for this param.
	* Defaults to 0n, which starts the period accounting at the moment the Safe
	* executes the transaction for a new allowance; when updating an existing
	* allowance, 0n keeps its current accounting anchor unchanged.
	* @returns A MetaTransaction to be executed by the Safe.
	*/
	createRecurringAllowanceMetaTransaction(delegate, token, allowanceAmount, recurringAllowanceValidityPeriodInMinutes, inThePastPeriodStartBaseTimeStamp = 0n) {
		if (recurringAllowanceValidityPeriodInMinutes < 0n || recurringAllowanceValidityPeriodInMinutes >= 2n ** 16n) throw new RangeError("recurringAllowanceValidityPeriodInMinutes must fit the contract's uint16 resetTimeMin (0 to 65535 minutes).");
		const baseInMinutes = inThePastPeriodStartBaseTimeStamp / 60n;
		if (inThePastPeriodStartBaseTimeStamp < 0n || baseInMinutes >= 2n ** 32n) throw new RangeError("inThePastPeriodStartBaseTimeStamp must be a unix timestamp in seconds — its minutes equivalent must fit the contract's uint32 resetBaseMin; a millisecond timestamp does not.");
		return this.createBaseSetAllowanceMetaTransaction(delegate, token, allowanceAmount, recurringAllowanceValidityPeriodInMinutes, baseInMinutes);
	}
	/**
	* create MetaTransaction that allows to update the allowance for
	* a specified token. This can only be done via a Safe transaction.
	* @param delegate - Delegate whose allowance should be updated.
	* @param token - Token contract address.
	* @param allowanceAmount - allowance in smallest token unit.
	* @param resetTimeMin - Time after which the allowance should reset
	* @param resetBaseMin - Time based on which the reset time should be increased
	* @returns a MetaTransaction
	*/
	createBaseSetAllowanceMetaTransaction(delegate, token, allowanceAmount, resetTimeMin, resetBaseMin) {
		const callData = createCallData("0xbeaeb388", [
			"address",
			"address",
			"uint96",
			"uint16",
			"uint32"
		], [
			delegate,
			token,
			allowanceAmount,
			resetTimeMin,
			resetBaseMin
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create MetaTransaction that allows to renew(reset) the allowance for a specific
	* delegate and token.
	* @param delegate - Delegate whose allowance should be updated.
	* @param token - Token contract address.
	* @returns a MetaTransaction
	*/
	createRenewAllowanceMetaTransaction(delegate, token) {
		const callData = createCallData("0xc19bf50e", ["address", "address"], [delegate, token]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create MetaTransaction that allows to remove the allowance for a specific
	* delegate and token. This will set all values except the `nonce` to 0.
	* @param delegate - Delegate whose allowance should be updated.
	* @param token - Token contract address.
	* @returns a MetaTransaction
	*/
	createDeleteAllowanceMetaTransaction(delegate, token) {
		const callData = createCallData("0x885133e3", ["address", "address"], [delegate, token]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* Creates a MetaTransaction that executes a token transfer using an existing allowance.
	* Can be called by the delegate or by anyone with a valid delegate signature.
	* @param allowanceSourceSafeAddress - Safe address whose allowance is being spent.
	* @param token - ERC-20 token contract address to transfer.
	* @param to - Recipient address for the token transfer.
	* @param amount - Amount to transfer, in the token's smallest unit.
	* @param delegate - Delegate address whose allowance is being used.
	* @param overrides.delegateSignature - Optional signature from the delegate. Defaults to a
	*   sentinel value indicating the caller is the delegate themselves.
	* @param overrides.paymentToken - Optional token address used to pay for execution.
	* @param overrides.paymentAmount - Amount to pay for execution (required if paymentToken is set).
	* @returns A MetaTransaction to be executed by the Safe.
	* @throws Will revert on-chain if the delegate's nonce has reached 65534 for this token.
	*/
	createAllowanceTransferMetaTransaction(allowanceSourceSafeAddress, token, to, amount, delegate, overrides = {}) {
		let paymentToken = "0x0000000000000000000000000000000000000000";
		let paymentAmount = 0n;
		if (overrides.paymentToken != null) {
			paymentToken = overrides.paymentToken;
			if (overrides.paymentAmount == null) throw new RangeError("must specify paymentAmount if paymentToken is set");
			paymentAmount = overrides.paymentAmount;
		}
		const delegateSignature = overrides.delegateSignature ?? "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
		return this.createBaseExecuteAllowanceTransferMetaTransaction(allowanceSourceSafeAddress, token, to, amount, paymentToken, paymentAmount, delegate, delegateSignature);
	}
	/**
	* create MetaTransaction that allows to use the allowance to perform a transfer.
	* @param safeAddress - The Safe whose funds should be used.
	* @param token - Token contract address.
	* @param to - Address that should receive the tokens.
	* @param amount - Amount that should be transferred.
	* @param paymentToken - Token that should be used to pay for the execution of the transfer.
	* @param payment - Amount to should be paid for executing the transfer.
	* @param delegate - Delegate whose allowance should be updated.
	* @param signature - Signature generated by the delegate to authorize the transfer.
	* @returns a MetaTransaction
	*/
	createBaseExecuteAllowanceTransferMetaTransaction(safeAddress, token, to, amount, paymentToken, payment, delegate, delegateSignature) {
		const callData = createCallData("0x4515641a", [
			"address",
			"address",
			"address",
			"uint96",
			"address",
			"uint96",
			"address",
			"bytes"
		], [
			safeAddress,
			token,
			to,
			amount,
			paymentToken,
			payment,
			delegate,
			delegateSignature
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that allows to add a delegate.
	* @param delegate - Delegate that should be added.
	* @returns a MetaTransaction
	*/
	createAddDelegateMetaTransaction(delegate) {
		const callData = createCallData("0xe71bdf41", ["address"], [delegate]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that allows to remove a delegate.
	* @param delegate - Delegate that should be removed.
	* @param removeAllowances - Indicator if allowances should also be removed.
	* This should be set to `true` unless this causes an out of gas,
	* in this case the allowances should be "manually" deleted via `deleteAllowance`.
	* @returns a MetaTransaction
	*/
	createRemoveDelegateMetaTransaction(delegate, removeAllowances) {
		const callData = createCallData("0xdd43a79f", ["address", "bool"], [delegate, removeAllowances]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* Get delegated tokens
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param safeAddress - The target account.
	* @param delegate - The target delegate.
	* @returns promise of a list of tokens
	*/
	async getTokens(nodeRpcUrl, safeAddress, delegate) {
		const callData = createCallData("0x8d0e8e1d", ["address", "address"], [safeAddress, delegate]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const tokens = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(tokens, "getTokens");
		return decodeAbiParameters(["address[]"], tokens)[0];
	}
	/**
	* Get the delegate's allowance for a specific token.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param safeAddress - The target account.
	* @param delegate - The target delegate.
	* @param token - The target token.
	* @returns promise of Allowance
	*/
	async getTokensAllowance(nodeRpcUrl, safeAddress, delegate, token) {
		const callData = createCallData("0x94b31fbd", [
			"address",
			"address",
			"address"
		], [
			safeAddress,
			delegate,
			token
		]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const tokenAllowance = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(tokenAllowance, "getTokenAllowance");
		const allowance = decodeAbiParameters(["uint256[5]"], tokenAllowance)[0];
		return {
			amount: BigInt(allowance[0]),
			spent: BigInt(allowance[1]),
			resetTimeMin: BigInt(allowance[2]),
			lastResetMin: BigInt(allowance[3]),
			nonce: BigInt(allowance[4])
		};
	}
	/**
	* Fetches all delegate addresses for a Safe. Automatically paginates through
	* all results unless `maxNumberOfResults` is specified.
	* @param nodeRpcUrl - JSON-RPC endpoint URL for the target chain.
	* @param safeAddress - The Safe account address to query delegates for.
	* @param overrides.start - Starting index for pagination (default 0).
	* @param overrides.maxNumberOfResults - Maximum number of delegates to return.
	*   If omitted, all delegates are fetched via automatic pagination.
	* @returns Array of delegate addresses.
	*/
	async getDelegates(nodeRpcUrl, safeAddress, overrides = {}) {
		let start = overrides.start ?? 0n;
		if (overrides.maxNumberOfResults != null) {
			if (overrides.maxNumberOfResults < 0n || overrides.maxNumberOfResults > 255n) throw new RangeError("maxNumberOfResults must be between 0 and 255 (the module's page size is a uint8) — omit it to fetch all delegates via pagination.");
			return (await this.baseGetDelegates(nodeRpcUrl, safeAddress, start, overrides.maxNumberOfResults)).results;
		}
		const pageSize = 20n;
		const delegates = [];
		while (true) {
			const getDelegatesResult = await this.baseGetDelegates(nodeRpcUrl, safeAddress, start, pageSize);
			delegates.push.apply(delegates, getDelegatesResult.results);
			if (getDelegatesResult.next === 0n) break;
			else start = getDelegatesResult.next;
		}
		return delegates;
	}
	/**
	* Fetch a single page of delegate addresses from the module (used internally by `getDelegates`).
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param safeAddress - The target account.
	* @param start - Pagination start index
	* @param pageSize - Maximum number of delegates to return in this page
	* @returns promise of `{ results, next }` — `next` is 0 when there are no more pages
	*/
	async baseGetDelegates(nodeRpcUrl, safeAddress, start, pageSize) {
		const callData = createCallData("0xeb37abe0", [
			"address",
			"uint48",
			"uint8"
		], [
			safeAddress,
			start,
			pageSize
		]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const delegates = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(delegates, "getDelegates");
		const decodedCalldata = decodeAbiParameters(["address[]", "uint48"], delegates);
		return {
			results: decodedCalldata[0],
			next: BigInt(decodedCalldata[1])
		};
	}
};
//#endregion
//#region src/account/Safe/modules/SocialRecoveryModule.ts
/**
* Pre-deployed Social Recovery Module addresses, each with a different
* grace period before a confirmed recovery can be finalized.
*/
let SocialRecoveryModuleGracePeriodSelector = /* @__PURE__ */ function(SocialRecoveryModuleGracePeriodSelector) {
	/** 3-minute grace period (useful for testing). */
	SocialRecoveryModuleGracePeriodSelector["After3Minutes"] = "0x949d01d424bE050D09C16025dd007CB59b3A8c66";
	/** 3-day grace period. */
	SocialRecoveryModuleGracePeriodSelector["After3Days"] = "0x38275826E1933303E508433dD5f289315Da2541c";
	/** 7-day grace period. */
	SocialRecoveryModuleGracePeriodSelector["After7Days"] = "0x088f6cfD8BB1dDb1BB069CCb3fc1A98927D233f2";
	/** 14-day grace period. */
	SocialRecoveryModuleGracePeriodSelector["After14Days"] = "0x9BacD92F4687Db306D7ded5d4513a51EA05df25b";
	return SocialRecoveryModuleGracePeriodSelector;
}({});
/**
* Safe module for social recovery with guardians. Allows designated guardians
* to replace the owners of a Safe account when the original keys are lost.
* Guardians must reach a configurable approval threshold before recovery
* can be executed, and a grace period must elapse before finalization.
*/
var SocialRecoveryModule = class SocialRecoveryModule extends SafeModule {
	static DEFAULT_SOCIAL_RECOVERY_ADDRESS = SocialRecoveryModuleGracePeriodSelector.After3Days;
	/**
	* @param moduleAddress - Deployed address of the Social Recovery Module.
	*   Defaults to the 3-day grace period deployment.
	*/
	constructor(moduleAddress = SocialRecoveryModule.DEFAULT_SOCIAL_RECOVERY_ADDRESS) {
		super(moduleAddress);
	}
	/**
	* create MetaTransaction that lets single guardian confirm the execution of the recovery request.
	* Can also trigger the start of the execution by passing true to 'execute' parameter.
	* Once triggered the recovery is pending for the recovery period before it can be finalised.
	* @param accountAddress - The target account.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @param execute - Whether to auto-start execution of recovery.
	* @returns a MetaTransaction
	*/
	createConfirmRecoveryMetaTransaction(accountAddress, newOwners, newThreshold, execute) {
		const callData = createCallData("0x064e2d0e", [
			"address",
			"address[]",
			"uint256",
			"bool"
		], [
			accountAddress,
			newOwners,
			newThreshold,
			execute
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create MetaTransaction that lets multiple guardians confirm the execution of the recovery request.
	* Can also trigger the start of the execution by passing true to 'execute' parameter.
	* Once triggered the recovery is pending for the recovery period before it can be finalised.
	* @param accountAddress - The target account.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @param signatureData - The guardians signers and signatures pair list.
	* @param execute - true to auto-start execution of recovery or false for not.
	* @returns a MetaTransaction
	*/
	createMultiConfirmRecoveryMetaTransaction(accountAddress, newOwners, newThreshold, signaturePairList, execute) {
		const callData = createCallData("0x0728e1e7", [
			"address",
			"address[]",
			"uint256",
			"(address,bytes)[]",
			"bool"
		], [
			accountAddress,
			newOwners,
			newThreshold,
			[...signaturePairList].sort((a, b) => {
				const aSigner = BigInt(a.signer);
				const bSigner = BigInt(b.signer);
				if (aSigner < bSigner) return -1;
				if (aSigner > bSigner) return 1;
				throw new AbstractionKitError("BAD_DATA", `Duplicate signer in recovery signaturePairList: ${a.signer}`);
			}).map((signaturePair) => [signaturePair.signer, signaturePair.signature]),
			execute
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* @notice create MetaTransaction that lets the guardians start the execution of the recovery request.
	* Once triggered the recovery is pending for the recovery period before it can be finalised.
	* @param accountAddress - The target account.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @returns a MetaTransaction
	*/
	createExecuteRecoveryMetaTransaction(accountAddress, newOwners, newThreshold) {
		const callData = createCallData("0xb1f85f69", [
			"address",
			"address[]",
			"uint256"
		], [
			accountAddress,
			newOwners,
			newThreshold
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that finalizes an ongoing recovery request if the recovery period is over.
	* The method is public and callable by anyone to enable orchestration.
	* @param accountAddress - The target account.
	* @returns a MetaTransaction
	*/
	createFinalizeRecoveryMetaTransaction(accountAddress) {
		const callData = createCallData("0x315a7af3", ["address"], [accountAddress]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that lets the account cancel an ongoing recovery request.
	* @returns a MetaTransaction
	*/
	createCancelRecoveryMetaTransaction() {
		return {
			to: this.moduleAddress,
			data: "0x0ba234d6",
			value: 0n
		};
	}
	/**
	* create a MetaTransaction that lets the owner add a guardian for its account.
	* @param guardianAddress - The guardian to add.
	* @param threshold - The new threshold that will be set after addition.
	* @returns a MetaTransaction
	*/
	createAddGuardianWithThresholdMetaTransaction(guardianAddress, threshold) {
		const callData = createCallData("0xbe0e54d7", ["address", "uint256"], [guardianAddress, threshold]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create MetaTransaction that lets the owner revoke a guardian from its account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* (to get the prevGuardian parameter).
	* @param accountAddress - The target account.
	* @param guardianAddress - The guardian to revoke.
	* @param threshold - The new threshold that will be set after execution of revocation.
	* @param prevGuardian - (if not provided, will be detected using the nodeRpcUrl)
	* The previous guardian linking to the guardian in the linked list.
	* @returns promise of a MetaTransaction
	*/
	async createRevokeGuardianWithThresholdMetaTransaction(nodeRpcUrl, accountAddress, guardianAddress, threshold, overrides = {}) {
		let prevGuardianAddressT = overrides.prevGuardianAddress;
		if (prevGuardianAddressT == null) {
			const guardians = await this.getGuardians(nodeRpcUrl, accountAddress);
			const guardianToDeleteIndex = guardians.indexOf(guardianAddress);
			if (guardianToDeleteIndex === -1) throw new RangeError(`${guardianAddress} is not a current guardian for account : ${accountAddress}`);
			else if (guardianToDeleteIndex === 0) prevGuardianAddressT = "0x0000000000000000000000000000000000000001";
			else if (guardianToDeleteIndex > 0) prevGuardianAddressT = guardians[guardianToDeleteIndex - 1];
			else throw new RangeError("Invalid guardian index");
		}
		return this.createStandardRevokeGuardianWithThresholdMetaTransaction(prevGuardianAddressT, guardianAddress, threshold);
	}
	/**
	* create MetaTransaction that lets the owner revoke a guardian from its account.
	* @param prevGuardian - The previous guardian linking to the guardian in the linked list.
	* @param guardian - The guardian to revoke.
	* @param threshold - The new threshold that will be set after execution of revocation.
	* @returns a MetaTransaction
	*/
	createStandardRevokeGuardianWithThresholdMetaTransaction(prevGuardianAddress, guardianAddress, threshold) {
		const callData = createCallData("0x936f7d86", [
			"address",
			"address",
			"uint256"
		], [
			prevGuardianAddress,
			guardianAddress,
			threshold
		]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* create MetaTransaction that lets the owner change the guardian threshold required to initiate a recovery.
	* @param threshold - The new threshold that will be set after execution of revocation.
	* @returns a MetaTransaction
	*/
	createChangeThresholdMetaTransaction(threshold) {
		const callData = createCallData("0x694e80c3", ["uint256"], [threshold]);
		return {
			to: this.moduleAddress,
			data: callData,
			value: 0n
		};
	}
	/**
	* Generates the recovery hash that should be signed by the guardian to authorize a recovery
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @param nonce - recovery nonce
	* @returns promise of a recovery hash
	*/
	async getRecoveryHash(nodeRpcUrl, accountAddress, newOwners, newThreshold, nonce) {
		const callData = createCallData("0x5f19df08", [
			"address",
			"address[]",
			"uint256",
			"uint256"
		], [
			accountAddress,
			newOwners,
			newThreshold,
			nonce
		]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const recoveryHashResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(recoveryHashResult, "getRecoveryHash");
		return decodeAbiParameters(["bytes32"], recoveryHashResult)[0];
	}
	/**
	* Retrieves the account's current ongoing recovery request.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @return promise of the account's current recovery request
	*/
	async getRecoveryRequest(nodeRpcUrl, accountAddress) {
		const callData = createCallData("0x4f9a28b9", ["address"], [accountAddress]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const recoveryRequestResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(recoveryRequestResult, "getRecoveryRequest");
		const decodedCalldata = decodeAbiParameters(["(uint256,uint256,uint64,address[])"], recoveryRequestResult);
		return {
			guardiansApprovalCount: BigInt(decodedCalldata[0][0]),
			newThreshold: BigInt(decodedCalldata[0][1]),
			executeAfter: BigInt(decodedCalldata[0][2]),
			newOwners: decodedCalldata[0][3]
		};
	}
	/**
	* Retrieves the guardian approval count for this particular recovery request at current nonce.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @return promise of the account's current recovery approvals count
	*/
	async getRecoveryApprovals(nodeRpcUrl, accountAddress, newOwners, newThreshold) {
		const callData = createCallData("0x6c6595ca", [
			"address",
			"address[]",
			"uint256"
		], [
			accountAddress,
			newOwners,
			newThreshold
		]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const recoveryApprovalResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(recoveryApprovalResult, "getRecoveryApprovals");
		const decodedCalldata = decodeAbiParameters(["uint256"], recoveryApprovalResult);
		return BigInt(decodedCalldata[0]);
	}
	/**
	* Retrieves specific guardian approval status a particular recovery request at current nonce.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @param guardian - The guardian.
	* @param newOwners - The new owners' addresses.
	* @param newThreshold - The new threshold for the safe.
	* @return promise of guardian approval status
	*/
	async hasGuardianApproved(nodeRpcUrl, accountAddress, guardian, newOwners, newThreshold) {
		const callData = createCallData("0x37d82c36", [
			"address",
			"address",
			"address[]",
			"uint256"
		], [
			accountAddress,
			guardian,
			newOwners,
			newThreshold
		]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const hasGuardianApprovedResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(hasGuardianApprovedResult, "hasGuardianApproved");
		const decodedCalldata = decodeAbiParameters(["bool"], hasGuardianApprovedResult);
		return Boolean(decodedCalldata[0]);
	}
	/**
	* Checks if an address is a guardian for an account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @param guardian - The address to check.
	* @return promise of `true` if the address is a guardian for
	* the account otherwise `false`.
	*/
	async isGuardian(nodeRpcUrl, accountAddress, guardian) {
		const callData = createCallData("0xd4ee9734", ["address", "address"], [accountAddress, guardian]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const isGuardianResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(isGuardianResult, "isGuardian");
		const decodedCalldata = decodeAbiParameters(["bool"], isGuardianResult);
		return Boolean(decodedCalldata[0]);
	}
	/**
	* Counts the number of active guardians for an account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @return promise of The number of active guardians for an account.
	*/
	async guardiansCount(nodeRpcUrl, accountAddress) {
		const callData = createCallData("0xc026e7ee", ["address"], [accountAddress]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const guardiansCountResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(guardiansCountResult, "guardiansCount");
		const decodedCalldata = decodeAbiParameters(["uint256"], guardiansCountResult);
		return BigInt(decodedCalldata[0]);
	}
	/**
	* Retrieves the account threshold.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @return promise of Threshold.
	*/
	async threshold(nodeRpcUrl, accountAddress) {
		const callData = createCallData("0xc86ec2bf", ["address"], [accountAddress]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const thresholdResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(thresholdResult, "threshold");
		const decodedCalldata = decodeAbiParameters(["uint256"], thresholdResult);
		return BigInt(decodedCalldata[0]);
	}
	/**
	* Get the active guardians for an account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @return promise of a list of the active guardians for an account.
	*/
	async getGuardians(nodeRpcUrl, accountAddress) {
		const callData = createCallData("0xf18858ab", ["address"], [accountAddress]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const getGuardiansResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(getGuardiansResult, "getGuardians");
		return decodeAbiParameters(["address[]"], getGuardiansResult)[0];
	}
	/**
	* Get the module nonce for an account.
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain.
	* @param accountAddress - The target account.
	* @return promise of the nonce for this account.
	*/
	async nonce(nodeRpcUrl, accountAddress) {
		const callData = createCallData("0x70ae92d2", ["address"], [accountAddress]);
		const ethCallParams = {
			to: this.moduleAddress,
			data: callData
		};
		const nonceResult = await JsonRpcNode.from(nodeRpcUrl).call(ethCallParams, "latest");
		this.checkForEmptyResultAndRevert(nonceResult, "nonce");
		const decodedCalldata = decodeAbiParameters(["uint256"], nonceResult);
		return BigInt(decodedCalldata[0]);
	}
	/**
	* create recovery request eip712 data
	* @param rpcNode - node to fetch the recovery nonce
	* @param accountAddress - address of account to recover
	* @param newOwners - new owners to recover to
	* @param newThreshold - new threshold
	* @param overrides.recoveryNonce - manually set the recovery nonce
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	async getRecoveryRequestEip712Data(rpcNode, chainId, accountAddress, newOwners, newThreshold, overrides = {}) {
		let recoveryNonce;
		if (overrides.recoveryNonce == null) recoveryNonce = await new SocialRecoveryModule(this.moduleAddress).nonce(rpcNode, accountAddress);
		else recoveryNonce = overrides.recoveryNonce;
		const messageValue = {
			wallet: accountAddress,
			newOwners,
			newThreshold,
			nonce: recoveryNonce
		};
		return {
			domain: {
				name: "Social Recovery Module",
				version: "0.0.1",
				chainId: Number(chainId),
				verifyingContract: this.moduleAddress
			},
			types: EIP712_RECOVERY_MODULE_TYPE,
			messageValue
		};
	}
};
/** EIP-712 primary type string used when signing recovery requests. */
const EXECUTE_RECOVERY_PRIMARY_TYPE = "ExecuteRecovery";
/** EIP-712 type definitions for the `ExecuteRecovery` primary type. */
const EIP712_RECOVERY_MODULE_TYPE = { ExecuteRecovery: [
	{
		type: "address",
		name: "wallet"
	},
	{
		type: "address[]",
		name: "newOwners"
	},
	{
		type: "uint256",
		name: "newThreshold"
	},
	{
		type: "uint256",
		name: "nonce"
	}
] };
//#endregion
//#region src/account/Safe/MerkleTree.ts
/**
* Hashes two values together using keccak256, sorting them so the smaller
* value is always first to ensure consistent ordering.
* @param left - The first hash value.
* @param right - The second hash value.
* @returns The keccak256 hash of the sorted pair.
*/
function hashPair(left, right) {
	if (left < right) return keccak256(left + right.slice(2));
	else return keccak256(right + left.slice(2));
}
/**
* Builds a Merkle tree and returns proofs for each input hash
* @param hashes - Array of hash strings to include in the Merkle tree
* @returns Array of MerkleProof objects containing the original hash, its proof path, and the root
*/
function generateMerkleProofs(hashes) {
	if (hashes.length === 0) throw new Error("Cannot create Merkle tree with empty hash list");
	const originalHashes = [...hashes];
	let currentLevel = [...hashes];
	const tree = [currentLevel];
	while (currentLevel.length > 1) {
		const nextLevel = [];
		for (let i = 0; i < currentLevel.length; i += 2) if (i + 1 < currentLevel.length) nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
		else nextLevel.push(hashPair(currentLevel[i], currentLevel[i]));
		tree.push(nextLevel);
		currentLevel = nextLevel;
	}
	const root = tree[tree.length - 1][0];
	return [root, originalHashes.map((_hash, index) => {
		const proofArr = [];
		let currentIndex = index;
		for (let level = 0; level < tree.length - 1; level++) {
			const currentLevelNodes = tree[level];
			if (currentIndex % 2 === 1) proofArr.push(currentLevelNodes[currentIndex - 1]);
			else if (currentIndex + 1 < currentLevelNodes.length) proofArr.push(currentLevelNodes[currentIndex + 1]);
			else proofArr.push(currentLevelNodes[currentIndex]);
			currentIndex = Math.floor(currentIndex / 2);
		}
		let proof = root;
		proofArr.reverse().forEach((proofElement) => {
			proof += proofElement.slice(2);
		});
		return proof;
	})];
}
//#endregion
//#region src/account/Safe/SafeMultiChainSigAccount.ts
/**
* Safe account on EntryPoint v0.9. Use it as a regular single-chain Safe
* account, and opt into multi-chain signatures via Merkle trees when you want
* to sign UserOperations for several chains under one signature.
*
* API-compatible with {@link SafeAccountV0_3_0}: same {@link SafeAccount} base,
* same method signatures, same {@link InitCodeOverrides} shape, so building on
* EntryPoint v0.9 is not a separate integration. The multi-op methods
* ({@link signUserOperations}, {@link signUserOperationsWithSigners}) and the
* Merkle-root EIP-712 helpers are additive; ignore them and the account
* behaves as a single-chain Safe.
*
* Which account this class refers to, however, is not interchangeable with
* `SafeAccountV0_3_0`:
*
* - **New accounts** derive a different counterfactual address for the same
*   owners, since the module and EntryPoint addresses feed that derivation.
* - **Deployed accounts** keep the address they have, but must be migrated
*   before this class can operate on them. Attaching this class to a Safe
*   deployed through `SafeAccountV0_3_0` is not enough: two pieces of Safe
*   configuration have to change first — the v0.9 module must be enabled on
*   the Safe, and the Safe's fallback handler must be updated to point at it.
*   Until both land, UserOperations sent to the account will fail. Use
*   {@link SafeAccountV0_3_0.createMigrateToSafeMultiChainSigAccountV1MetaTransactions},
*   whose batch must be sent as a UserOperation from the v0.7 account itself.
*
* @example Single-chain use — the common case
* ```ts
* const account = SafeMultiChainSigAccountV1.initializeNewAccount([owner]);
* const userOp = await account.createUserOperation([tx], nodeRpc, bundlerRpc);
* userOp.signature = await account.signUserOperationWithSigners(
*   userOp,
*   [signer],
*   chainId,
* );
* ```
*
* Uses Safe Passkey module v0.2.1 WebAuthn verifiers by default (Daimo P256
* verifier instead of the base class's FCL P256).
* @see {@link https://github.com/safe-fndn/safe-modules/blob/04e65efbce634e776cc8c1fbe90061f09e09a71b/modules/passkey/CHANGELOG.md?plain=1#L23}
*
* @remarks Signer typing is asymmetric:
* - {@link signUserOperationWithSigners} (singular) → {@link SignContext}
* - {@link signUserOperationsWithSigners} (plural) → {@link MultiOpSignContext}
*
* Type a signer as `ExternalSigner<unknown>` (what the built-in adapters
* return) to work on both methods; the narrow contexts exist so signers that
* read the context get correct non-optional fields per path.
*/
var SafeMultiChainSigAccountV1 = class SafeMultiChainSigAccountV1 extends SafeAccount {
	static DEFAULT_ENTRYPOINT_ADDRESS = ENTRYPOINT_V9;
	static DEFAULT_SAFE_4337_MODULE_ADDRESS = DEFAULT_SAFE_4337_MULTI_CHAIN_SIG_MODULE_V1;
	static DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";
	static DEFAULT_WEB_AUTHN_SHARED_SIGNER = DEFAULT_WEB_AUTHN_SHARED_SIGNER_V_0_2_1;
	static DEFAULT_WEB_AUTHN_SIGNER_SINGLETON = DEFAULT_WEB_AUTHN_SIGNER_SINGLETON_V_0_2_1;
	static DEFAULT_WEB_AUTHN_SIGNER_FACTORY = DEFAULT_WEB_AUTHN_SIGNER_FACTORY_V_0_2_1;
	static DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE = DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE_V_0_2_1;
	static DEFAULT_WEB_AUTHN_PRECOMPILE = DEFAULT_WEB_AUTHN_PRECOMPILE_RIP_7951;
	static DEFAULT_WEB_AUTHN_DAIMO_VERIFIER = DEFAULT_WEB_AUTHN_DAIMO_VERIFIER_V_0_2_1;
	static DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER = DEFAULT_WEB_AUTHN_DAIMO_VERIFIER_V_0_2_1;
	/**
	* Create a SafeMultiChainSigAccount instance for an existing or new account.
	*
	* An existing account must already have the v0.9 module enabled, and its
	* fallback handler pointing at that module. A Safe deployed through
	* {@link SafeAccountV0_3_0} has neither until it is migrated — see the
	* class documentation.
	*
	* @param accountAddress - the Safe account address
	* @param overrides - optional overrides for module, entrypoint, and singleton addresses
	*/
	constructor(accountAddress, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const entrypointAddress = overrides.entrypointAddress ?? SafeMultiChainSigAccountV1.DEFAULT_ENTRYPOINT_ADDRESS;
		super(accountAddress, safe4337ModuleAddress, entrypointAddress, {
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier,
			safeAccountSingleton: overrides.safeAccountSingleton
		});
	}
	/**
	* calculate account address from initial owners signers
	* @param owners - list of account owners addresses
	* @param overrides - override values to change the initialization default values
	* @returns account address
	*/
	static createAccountAddress(owners, overrides = {}) {
		const modOverrides = {
			...overrides,
			webAuthnSharedSigner: overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		const [accountAddress, ,] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, modOverrides, overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		return accountAddress;
	}
	/**
	* To create and initialize a SafeAccount object from its
	* initial owners
	* @remarks
	* initializeNewAccount only needed when the smart account
	* have not been deployed yet and the account address is unknown.
	* @param owners - list of account owners signers
	* @param overrides - override values to change the initialization default values
	* @returns a SafeAccount object
	*/
	static initializeNewAccount(owners, overrides = {}) {
		let isInitWebAuthn = false;
		let x = 0n;
		let y = 0n;
		for (const owner of owners) if (typeof owner !== "string") {
			if (isInitWebAuthn) throw new RangeError("Only one Webauthn signer is allowed during initialization");
			if (owners.indexOf(owner) !== 0) throw new RangeError("Webauthn owner has to be the first owner for an init transaction.");
			isInitWebAuthn = true;
			x = owner.x;
			y = owner.y;
		}
		const modOverrides = {
			...overrides,
			webAuthnSharedSigner: overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		const [accountAddress, factoryAddress, factoryData] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, modOverrides, overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		const safe = new SafeMultiChainSigAccountV1(accountAddress, {
			safe4337ModuleAddress: overrides.safe4337ModuleAddress,
			entrypointAddress: overrides.entrypointAddress,
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier,
			safeAccountSingleton: overrides.safeAccountSingleton
		});
		safe.factoryAddress = factoryAddress;
		safe.factoryData = factoryData;
		if (isInitWebAuthn) {
			safe.isInitWebAuthn = true;
			safe.x = x;
			safe.y = y;
		}
		return safe;
	}
	/**
	* create a useroperation eip712 hash
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* defaults to ENTRYPOINT_V9
	* @param overrides.safe4337ModuleAddress - defaults to DEFAULT_SAFE_4337_MODULE_ADDRESS
	* @returns useroperation hash
	*/
	static getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeMultiChainSigAccountV1.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Hash(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* create a useroperation eip712 data
	* @param useroperation - useroperation to hash
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @param overrides.entrypoint - target entrypoint
	* @param overrides.safe4337ModuleAddress - target module address
	* @returns an object containing the typed data domain, type and typed data vales
	* object needed for hashing and signing
	*/
	static getUserOperationEip712Data(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeMultiChainSigAccountV1.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Data(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* Create the initializer callData for setting up a new Safe account.
	* @param owners - list of account owner signers
	* @param threshold - number of required signatures for execution
	* @param overrides - optional overrides for module and contract addresses
	* @returns hex-encoded initializer callData
	*/
	static createInitializerCallData(owners, threshold, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const safeModuleSetupAddress = overrides.safeModuleSetupAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_MODULE_SETUP_ADDRESS;
		return SafeAccount.createBaseInitializerCallData(owners, threshold, safe4337ModuleAddress, safeModuleSetupAddress, overrides.multisendContractAddress, overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER, overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE, overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER);
	}
	/**
	* create account factory address and factory data
	* @param owners - list of account owners signers
	* @param overrides - override values to change the initialization default values
	* @returns factoryAddress and factoryData
	*/
	static createFactoryAddressAndData(owners, overrides = {}) {
		const modOverrides = {
			...overrides,
			webAuthnSharedSigner: overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		return SafeAccount.createFactoryAddressAndData(owners, modOverrides, overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
	}
	/**
	* createUserOperation will determine the nonce, fetch the gas prices,
	* estimate gas limits and return a useroperation to be signed.
	* you can override all these values using the overrides parameter.
	* @param transactions - metatransaction list to be encoded
	* @param providerRpc - node rpc to fetch account nonce and gas prices
	* @param bundlerRpc - bundler rpc for gas estimation
	* @param overrides - overrides for the default values
	* @returns promise with useroperation
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		const parallelPaymasterInitValues = overrides.parallelPaymasterInitValues;
		if (parallelPaymasterInitValues != null && !parallelPaymasterInitValues.paymasterData.toLowerCase().endsWith("22e325a297439656")) throw new RangeError("Invalid paymasterData override, it must end with the PAYMASTER_SIG_MAGIC '22e325a297439656'");
		const [userOperation, factoryAddress, factoryData] = await this.createBaseUserOperationAndFactoryAddressAndFactoryData(transactions, false, providerRpc, bundlerRpc, {
			...overrides,
			isMultiChainSignature: true,
			webAuthnSharedSigner: overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: overrides.webAuthnSignerProxyCreationCode ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE
		});
		if (parallelPaymasterInitValues != null) return {
			...userOperation,
			factory: factoryAddress,
			factoryData,
			...parallelPaymasterInitValues,
			eip7702Auth: null
		};
		else return {
			...userOperation,
			factory: factoryAddress,
			factoryData,
			paymaster: null,
			paymasterVerificationGasLimit: null,
			paymasterPostOpGasLimit: null,
			paymasterData: null,
			eip7702Auth: null
		};
	}
	/**
	* Estimate gas limits for a multichain UserOperation using the bundler.
	* Applies the multichain dummy-signature encoding and Safe Passkey module
	* v0.2.1 WebAuthn defaults.
	*
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC URL, transport, or Bundler instance
	* @param overrides - State overrides, dummy signatures, and WebAuthn configuration
	* @returns A tuple of [preVerificationGas, verificationGasLimit, callGasLimit]
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return this.baseEstimateUserOperationGas(userOperation, bundlerRpc, {
			...overrides,
			isMultiChainSignature: true,
			webAuthnSharedSigner: overrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: overrides.webAuthnSignerProxyCreationCode ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Get the single-operation EIP-712 typed data for this multichain account.
	* Uses the instance EntryPoint and Safe 4337 module, and is the recommended
	* manual-signing path for length-1 multichain UserOperations.
	*
	* @param useroperation - UserOperation to get typed data for
	* @param chainId - target chain ID
	* @param overrides - optional validity window and explicit address overrides
	* @returns Object with domain, types, and messageValue for EIP-712 signing
	*/
	getUserOperationEip712Data(useroperation, chainId, overrides = {}) {
		return SafeMultiChainSigAccountV1.getUserOperationEip712Data(useroperation, chainId, {
			...overrides,
			entrypointAddress: overrides.entrypointAddress ?? this.entrypointAddress,
			safe4337ModuleAddress: overrides.safe4337ModuleAddress ?? this.safe4337ModuleAddress
		});
	}
	/**
	* Hash the single-operation EIP-712 typed data for this multichain account.
	* Uses the instance EntryPoint and Safe 4337 module.
	*
	* @param useroperation - UserOperation to hash
	* @param chainId - target chain ID
	* @param overrides - optional validity window and explicit address overrides
	* @returns EIP-712 digest as a hex string
	*/
	getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		const data = this.getUserOperationEip712Data(useroperation, chainId, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	/**
	* Format signer/signature pairs for this multichain account. The multichain
	* signature flag, module address, and v0.2.1 WebAuthn defaults are applied
	* automatically.
	*
	* @param signerSignaturePairs - signer/signature pairs to encode
	* @param options - optional validity window, Merkle proof, module, and WebAuthn encoding overrides
	* @returns formatted UserOperation signature
	*/
	formatUserOperationSignature(signerSignaturePairs, options = {}) {
		return SafeMultiChainSigAccountV1.formatSingleUserOperationSignature(signerSignaturePairs, {
			...options,
			safe4337ModuleAddress: options.safe4337ModuleAddress ?? this.safe4337ModuleAddress
		}, options);
	}
	/**
	* Create a signature for a single UserOperation. This is the regular
	* signing path — use it for ordinary single-chain transactions. To sign
	* several UserOperations under one signature, use
	* {@link signUserOperations}.
	*
	* The multi-chain flag is set automatically, which only affects how the
	* signature is encoded: this account's module validates single-chain
	* UserOperations through the same scheme, signing the leaf SafeOp hash
	* directly rather than a Merkle root.
	*
	* @param useroperation - useroperation to sign
	* @param privateKeys - for the signers
	* @param chainId - target chain id
	* @param options - {@link SafeSignatureOptions} — timing, multiChainMerkleProof, module address. The multi-chain flag is force-set true and overrides any caller value.
	* @returns signature
	*/
	signUserOperation(userOperation, privateKeys, chainId, options = {}) {
		if (options.multiChainMerkleProof != null && options.multiChainMerkleProof.length > 0) throw new RangeError("signUserOperation does not accept multiChainMerkleProof; use signUserOperations for multi-op Merkle signatures");
		return SafeAccount.baseSignSingleUserOperation(userOperation, privateKeys, chainId, this.entrypointAddress, this.safe4337ModuleAddress, {
			...options,
			isMultiChainSignature: true
		});
	}
	/**
	* Sign a single UserOperation using one or more {@link ExternalSigner}
	* instances. This is the regular signing path — use it for ordinary
	* single-chain transactions. See
	* {@link SafeAccountV0_3_0.signUserOperationWithSigners} for the full
	* design rationale.
	*
	* The multi-chain flag is set automatically, which only affects how the
	* signature is encoded: this account's module validates single-chain
	* UserOperations through the same scheme, signing the leaf SafeOp hash
	* directly rather than a Merkle root. Signing several UserOperations under
	* one signature is a separate method,
	* {@link signUserOperationsWithSigners}.
	*
	* Note the chainId plumbing asymmetry vs the multi-op variant:
	*   - **Singular** (this method): `chainId` is a positional argument.
	*   - **Plural** ({@link signUserOperationsWithSigners}): `chainId` lives
	*     inside each `UserOperationToSign` element, since each op may
	*     target a different chain.
	* Pick the variant that matches your bundle shape; don't pass the same
	* chainId twice.
	*
	* @param userOperation - UserOperation to sign
	* @param signers - one ExternalSigner per owner (any order)
	* @param chainId - target chain id
	* @param options - {@link SafeSignatureOptions} — timing, multiChainMerkleProof, module address. The multi-chain flag is force-set true and overrides any caller value.
	* @returns Promise resolving to the formatted signature string
	*/
	signUserOperationWithSigners(userOperation, signers, chainId, options = {}) {
		if (options.multiChainMerkleProof != null && options.multiChainMerkleProof.length > 0) throw new RangeError("signUserOperationWithSigners does not accept multiChainMerkleProof; use signUserOperationsWithSigners for multi-op Merkle signatures");
		const context = {
			userOperation,
			chainId,
			entryPoint: this.entrypointAddress
		};
		return SafeAccount.baseSignUserOperationWithSigners(userOperation, signers, chainId, {
			entrypointAddress: this.entrypointAddress,
			safe4337ModuleAddress: this.safe4337ModuleAddress,
			context,
			options: {
				...options,
				isMultiChainSignature: true
			}
		});
	}
	/**
	* sign a list of useroperations - multi chain signature
	* @param useroperation - useroperation to sign
	* @param privateKeys - for the signers
	* @param chainId - target chain id
	* @param overrides - overrides for the default values
	* @param overrides.validAfter - timestamp the signature will be valid after
	* @param overrides.validUntil - timestamp the signature will be valid until
	* @returns signature
	*/
	signUserOperations(userOperationsToSign, privateKeys) {
		if (userOperationsToSign.length < 1) throw new RangeError("There should be at least one userOperationsToSign");
		if (privateKeys.length < 1) throw new RangeError("There should be at least one privateKey");
		if (userOperationsToSign.length > 1) {
			const userOperationsHashes = [];
			userOperationsToSign.forEach((userOperationsToSign, _index) => {
				const userOperationHash = SafeAccount.getUserOperationEip712Hash_V9(userOperationsToSign.userOperation, userOperationsToSign.chainId, {
					validAfter: userOperationsToSign.validAfter,
					validUntil: userOperationsToSign.validUntil,
					safe4337ModuleAddress: this.safe4337ModuleAddress,
					entrypointAddress: this.entrypointAddress
				});
				userOperationsHashes.push(userOperationHash);
			});
			const [root, proofs] = generateMerkleProofs(userOperationsHashes);
			const merkleTreeRootHash = hashTypedData({ verifyingContract: this.safe4337ModuleAddress }, EIP712_MULTI_CHAIN_OPERATIONS_TYPE, { merkleTreeRoot: root });
			const signerSignaturePairs = [];
			for (const privateKey of privateKeys) {
				const signature = signHash$1(privateKey, merkleTreeRootHash).serialized;
				signerSignaturePairs.push({
					signer: privateKeyToAddress(privateKey),
					signature
				});
			}
			const userOpSignatures = [];
			userOperationsToSign.forEach((userOperationsToSign, index) => {
				userOpSignatures.push(SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
					validAfter: userOperationsToSign.validAfter,
					validUntil: userOperationsToSign.validUntil,
					isMultiChainSignature: true,
					multiChainMerkleProof: proofs[index]
				}));
			});
			return userOpSignatures;
		} else return [this.signUserOperation(userOperationsToSign[0].userOperation, privateKeys, userOperationsToSign[0].chainId, {
			validUntil: userOperationsToSign[0].validUntil,
			validAfter: userOperationsToSign[0].validAfter
		})];
	}
	/**
	* Sign a list of UserOperations with a single multi-chain signature. Each
	* signer signs the Merkle root of the UserOperation EIP-712 hashes via
	* either `signTypedData` (the root is wrapped in an EIP-712 `MerkleTreeRoot`
	* message) or raw-hash signing; both schemes produce signatures that
	* validate against the same on-chain digest.
	*
	* Signers always receive {@link MultiOpSignContext}. The built-in adapters
	* `fromPrivateKey`, `fromViem`, `fromEthersWallet`, and `fromViemWalletClient`
	* all work here without retyping (`fromViemWalletClient` will sign the
	* typed-data Merkle wrapper). User-defined single-op signers
	* (`ExternalSigner<SignContext>`) still don't work — they'd receive a
	* context shape they didn't declare.
	*
	* Note the chainId plumbing asymmetry vs the single-op variant:
	*   - **Plural** (this method): each `UserOperationToSign` carries its
	*     own `chainId`, since a multichain bundle's ops target different
	*     chains.
	*   - **Singular** ({@link signUserOperationWithSigners}): `chainId` is
	*     a positional argument.
	* For a length-1 bundle on this method, set `chainId` on the single
	* element rather than reaching for the singular variant.
	*
	* @param userOperationsToSign - UserOperations + chain IDs + validity windows
	* @param signers - one ExternalSigner per owner (any order; sorted by address on-chain)
	* @returns one signature per input UserOperation, in the same order
	*/
	async signUserOperationsWithSigners(userOperationsToSign, signers) {
		if (userOperationsToSign.length < 1) throw new RangeError("There should be at least one userOperationsToSign");
		if (signers.length < 1) throw new RangeError("There should be at least one signer");
		const context = {
			userOperations: userOperationsToSign.map((u) => ({
				userOperation: u.userOperation,
				chainId: u.chainId
			})),
			entryPoint: this.entrypointAddress
		};
		if (userOperationsToSign.length > 1) {
			const userOperationsHashes = [];
			userOperationsToSign.forEach((uopToSign) => {
				const userOperationHash = SafeAccount.getUserOperationEip712Hash_V9(uopToSign.userOperation, uopToSign.chainId, {
					validAfter: uopToSign.validAfter,
					validUntil: uopToSign.validUntil,
					safe4337ModuleAddress: this.safe4337ModuleAddress,
					entrypointAddress: this.entrypointAddress
				});
				userOperationsHashes.push(userOperationHash);
			});
			const [root, proofs] = generateMerkleProofs(userOperationsHashes);
			const merkleTreeRootHash = hashTypedData({ verifyingContract: this.safe4337ModuleAddress }, EIP712_MULTI_CHAIN_OPERATIONS_TYPE, { merkleTreeRoot: root });
			const normalizedAddresses = signers.map((signer) => getAddress(signer.address));
			const typedDataForBundle = {
				domain: { verifyingContract: this.safe4337ModuleAddress },
				types: EIP712_MULTI_CHAIN_OPERATIONS_TYPE,
				primaryType: EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE,
				message: { merkleTreeRoot: root }
			};
			const schemes = signers.map((signer, i) => pickScheme(signer, ["typedData", "hash"], {
				accountName: "SafeMultiChainSigAccountV1 (multi-op Merkle root)",
				signerIndex: i
			}));
			const signatures = await Promise.all(signers.map((signer, i) => invokeSigner(signer, schemes[i], {
				hash: merkleTreeRootHash,
				typedData: typedDataForBundle,
				context
			})));
			const signerSignaturePairs = signers.map((_signer, i) => ({
				signer: normalizedAddresses[i],
				signature: signatures[i],
				isContractSignature: signers[i].type === "contract"
			}));
			const userOpSignatures = [];
			userOperationsToSign.forEach((uopToSign, index) => {
				userOpSignatures.push(SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
					validAfter: uopToSign.validAfter,
					validUntil: uopToSign.validUntil,
					isMultiChainSignature: true,
					multiChainMerkleProof: proofs[index]
				}));
			});
			return userOpSignatures;
		} else {
			const u = userOperationsToSign[0];
			return [await SafeAccount.baseSignUserOperationWithSigners(u.userOperation, signers, u.chainId, {
				entrypointAddress: this.entrypointAddress,
				safe4337ModuleAddress: this.safe4337ModuleAddress,
				context,
				options: {
					validAfter: u.validAfter,
					validUntil: u.validUntil,
					isMultiChainSignature: true
				}
			})];
		}
	}
	/**
	* Compute the EIP-712 Merkle root wrapper digest that owners sign once
	* across all UserOperations in a multi-chain bundle.
	*
	* Requires length≥2. For a single UserOperation use
	* {@link SafeMultiChainSigAccountV1.getUserOperationEip712Hash} (the on-chain
	* `merkleTreeDepth == 0` branch verifies against the per-op SafeOp digest,
	* not a Merkle wrapper, so signing the wrapper for length=1 produces bytes
	* the contract rejects with AA24).
	*
	* @param userOperationsToSignsToSign - list of UserOperations with their target chain IDs (length ≥ 2)
	* @param overrides - optional overrides for the Safe 4337 module address
	* @returns the EIP-712 hash as a hex string
	*/
	static getMultiChainSingleSignatureUserOperationsEip712Hash(userOperationsToSignsToSign, overrides = {}) {
		const data = SafeMultiChainSigAccountV1.getMultiChainSingleSignatureUserOperationsEip712Data(userOperationsToSignsToSign, overrides);
		return hashTypedData(data.domain, data.types, data.messageValue);
	}
	/**
	* Get the EIP-712 typed data components for a multi-chain Merkle tree root.
	* Returns the domain, types, and message value needed for signing or hashing.
	*
	* Requires length≥2. For a single UserOperation use
	* {@link SafeMultiChainSigAccountV1.getUserOperationEip712Data} (or
	* {@link SafeMultiChainSigAccountV1.getUserOperationEip712Hash}): those
	* multichain-class overrides default `safe4337ModuleAddress` to
	* `DEFAULT_SAFE_4337_MODULE_ADDRESS`. The on-chain depth=0 path verifies
	* against the per-op SafeOp digest, not a Merkle wrapper, so signing the
	* wrapper for length=1 produces bytes the contract rejects with AA24. The
	* parent `SafeAccount.getUserOperationEip712Data_V9` /
	* `getUserOperationEip712Hash_V9` helpers default to the same module.
	*
	* @param userOperationsToSignsToSign - list of UserOperations with their target chain IDs (length ≥ 2)
	* @param overrides - optional overrides for the Safe 4337 module address
	* @returns an object with domain, types, and messageValue for EIP-712 signing
	*/
	static getMultiChainSingleSignatureUserOperationsEip712Data(userOperationsToSign, overrides = {}) {
		if (userOperationsToSign.length < 2) throw new RangeError("Multi-chain Merkle wrapper helpers require >= 2 userOperations. For a single UserOperation, use SafeMultiChainSigAccountV1.getUserOperationEip712Data or SafeMultiChainSigAccountV1.getUserOperationEip712Hash (these multichain-class overrides default safe4337ModuleAddress to DEFAULT_SAFE_4337_MODULE_ADDRESS, the multi-chain module). The on-chain depth=0 path verifies against the per-op SafeOp digest, not a Merkle wrapper.");
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const userOperationsHashes = [];
		userOperationsToSign.forEach((userOperationsToSign, _index) => {
			const userOperationHash = SafeAccount.getUserOperationEip712Hash_V9(userOperationsToSign.userOperation, userOperationsToSign.chainId, {
				validAfter: userOperationsToSign.validAfter,
				validUntil: userOperationsToSign.validUntil,
				safe4337ModuleAddress,
				entrypointAddress: overrides.entrypointAddress
			});
			userOperationsHashes.push(userOperationHash);
		});
		const [root, _proofs] = generateMerkleProofs(userOperationsHashes);
		return {
			domain: { verifyingContract: safe4337ModuleAddress },
			types: EIP712_MULTI_CHAIN_OPERATIONS_TYPE,
			messageValue: { merkleTreeRoot: root }
		};
	}
	static formatSingleUserOperationSignature(signerSignaturePairs, options = {}, webAuthnSignatureOverrides = {}) {
		return SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
			safe4337ModuleAddress: SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS,
			eip7212WebAuthnPrecompileVerifier: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
			webAuthnSharedSigner: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER,
			...options,
			...webAuthnSignatureOverrides,
			isMultiChainSignature: true
		});
	}
	/**
	* format a list of eip712 signatures to a list of multi chain useroperations signatures
	* @param signerSignaturePairs - a list of a pair of a signer and it's signature
	* @param overrides - overrides for the default values
	* @returns signature
	*/
	static formatSignaturesToUseroperationsSignatures(userOperationsToSign, signerSignaturePairs) {
		if (userOperationsToSign.length < 1) throw new RangeError("There should be at least one userOperationsToSign");
		const defaultOptions = { safe4337ModuleAddress: SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS };
		const defaultWebAuthnOverrides = {
			eip7212WebAuthnPrecompileVerifier: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
			webAuthnSharedSigner: SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER
		};
		if (userOperationsToSign.length === 1) return [SafeMultiChainSigAccountV1.formatSingleUserOperationSignature(signerSignaturePairs, {
			...userOperationsToSign[0].options,
			validAfter: userOperationsToSign[0].validAfter,
			validUntil: userOperationsToSign[0].validUntil
		}, userOperationsToSign[0].webAuthnSignatureOverrides)];
		const userOperationsHashes = [];
		const resolvedValidity = userOperationsToSign.map((userOperationToSign) => ({
			validAfter: userOperationToSign.options?.validAfter ?? userOperationToSign.validAfter,
			validUntil: userOperationToSign.options?.validUntil ?? userOperationToSign.validUntil
		}));
		userOperationsToSign.forEach((userOperationToSign, index) => {
			const userOperationHash = SafeAccount.getUserOperationEip712Hash_V9(userOperationToSign.userOperation, userOperationToSign.chainId, {
				validAfter: resolvedValidity[index].validAfter,
				validUntil: resolvedValidity[index].validUntil,
				safe4337ModuleAddress: userOperationToSign.options?.safe4337ModuleAddress ?? defaultOptions.safe4337ModuleAddress
			});
			userOperationsHashes.push(userOperationHash);
		});
		const [_root, proofs] = generateMerkleProofs(userOperationsHashes);
		const userOpSignatures = [];
		userOperationsToSign.forEach((userOperationToSign, index) => {
			userOpSignatures.push(SafeAccount.formatSignaturesToUseroperationSignature(signerSignaturePairs, {
				...defaultOptions,
				...defaultWebAuthnOverrides,
				...userOperationToSign.options,
				...userOperationToSign.webAuthnSignatureOverrides,
				validAfter: resolvedValidity[index].validAfter,
				validUntil: resolvedValidity[index].validUntil,
				isMultiChainSignature: true,
				multiChainMerkleProof: proofs[index]
			}));
		});
		return userOpSignatures;
	}
	static createWebAuthnSignerVerifierAddress(x, y, overrides = {}) {
		return SafeAccount.createWebAuthnSignerVerifierAddress(x, y, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: overrides.webAuthnSignerProxyCreationCode ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE
		});
	}
	static createDeployWebAuthnVerifierMetaTransaction(x, y, overrides = {}) {
		return SafeAccount.createDeployWebAuthnVerifierMetaTransaction(x, y, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: overrides.webAuthnSignerFactory ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY
		});
	}
	static createDummySignerSignaturePairForExpectedSigners(expectedSigners, webAuthnSignatureOverrides = {}) {
		return SafeAccount.createDummySignerSignaturePairForExpectedSigners(expectedSigners, {
			...webAuthnSignatureOverrides,
			eip7212WebAuthnPrecompileVerifier: webAuthnSignatureOverrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: webAuthnSignatureOverrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerFactory: webAuthnSignatureOverrides.webAuthnSignerFactory ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: webAuthnSignatureOverrides.webAuthnSignerSingleton ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: webAuthnSignatureOverrides.webAuthnSignerProxyCreationCode ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
			webAuthnSharedSigner: webAuthnSignatureOverrides.webAuthnSharedSigner ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SHARED_SIGNER
		});
	}
	static async verifyWebAuthnSignatureForMessageHash(nodeRpcUrl, signer, messageHash, signature, overrides = {}) {
		return SafeAccount.verifyWebAuthnSignatureForMessageHash(nodeRpcUrl, signer, messageHash, signature, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER,
			webAuthnSignerSingleton: overrides.webAuthnSignerSingleton ?? SafeMultiChainSigAccountV1.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON
		});
	}
};
//#endregion
//#region src/account/Safe/SafeAccountV0_3_0.ts
/**
* Safe smart account implementation for EntryPoint v0.7.
* Provides methods to create, sign, and send ERC-4337 UserOperations
* using Safe's modular smart account architecture with the v0.7 EntryPoint.
*
* @example
* // Create a new account (not yet deployed on-chain)
* const smartAccount = SafeAccountV0_3_0.initializeNewAccount([ownerAddress]);
*
* // Or connect to an existing deployed account
* const smartAccount = new SafeAccountV0_3_0(existingAccountAddress);
*/
var SafeAccountV0_3_0 = class SafeAccountV0_3_0 extends SafeAccount {
	static DEFAULT_ENTRYPOINT_ADDRESS = ENTRYPOINT_V7;
	static DEFAULT_SAFE_4337_MODULE_ADDRESS = "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226";
	static DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";
	/**
	* Create a SafeAccountV0_3_0 instance for an existing deployed account.
	* For new (undeployed) accounts, use the static `initializeNewAccount` method instead.
	*
	* @param accountAddress - The on-chain address of the Safe account
	* @param overrides - Override default module, EntryPoint, and singleton addresses
	*/
	constructor(accountAddress, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_3_0.DEFAULT_ENTRYPOINT_ADDRESS;
		super(accountAddress, safe4337ModuleAddress, entrypointAddress, {
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier,
			safeAccountSingleton: overrides.safeAccountSingleton
		});
	}
	/**
	* Calculate the counterfactual account address from the initial owner signers.
	* Does not deploy the account.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param overrides - Override default initialization values
	* @returns The deterministic account address
	*/
	static createAccountAddress(owners, overrides = {}) {
		const [accountAddress, ,] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		return accountAddress;
	}
	/**
	* Create and initialize a new SafeAccountV0_3_0 from its initial owners.
	* The account address is deterministically computed but not yet deployed on-chain.
	* The first UserOperation sent will deploy it automatically via factory data.
	*
	* Instantiates through `new this(...)`, so subclasses calling this
	* factory (directly or via `super`) get an instance of the subclass,
	* not a plain SafeAccountV0_3_0. A detached call (the method extracted
	* into a bare function, where `this` is undefined) falls back to
	* constructing a SafeAccountV0_3_0, matching the pre-polymorphic
	* behavior.
	*
	* @param owners - Array of owner signers (at least one required)
	* @param overrides - Override default initialization values
	* @returns An instance of the calling class with factory data set for deployment
	*
	* @example
	* const smartAccount = SafeAccountV0_3_0.initializeNewAccount(["0xOwnerAddress"]);
	*/
	static initializeNewAccount(owners, overrides = {}) {
		let isInitWebAuthn = false;
		let x = 0n;
		let y = 0n;
		for (const owner of owners) if (typeof owner !== "string") {
			if (isInitWebAuthn) throw new RangeError("Only one Webauthn signer is allowed during initialization");
			if (owners.indexOf(owner) !== 0) throw new RangeError("Webauthn owner has to be the first owner for an init transaction.");
			isInitWebAuthn = true;
			x = owner.x;
			y = owner.y;
		}
		const [accountAddress, factoryAddress, factoryData] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		const safe = new (this ?? SafeAccountV0_3_0)(accountAddress, {
			safe4337ModuleAddress: overrides.safe4337ModuleAddress,
			entrypointAddress: overrides.entrypointAddress,
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier,
			safeAccountSingleton: overrides.safeAccountSingleton
		});
		safe.factoryAddress = factoryAddress;
		safe.factoryData = factoryData;
		if (isInitWebAuthn) {
			safe.isInitWebAuthn = true;
			safe.x = x;
			safe.y = y;
		}
		return safe;
	}
	/**
	* Compute the EIP-712 hash of a UserOperation for Safe signature verification.
	*
	* @param useroperation - UserOperation to hash
	* @param chainId - Target chain ID
	* @param overrides - Override validAfter, validUntil, entrypoint, and module addresses
	* @returns The EIP-712 hash as a hex string
	*/
	static getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_3_0.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Hash(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* Get the EIP-712 typed data components for a UserOperation.
	* Useful for signing with external signers that need domain, types, and message separately.
	*
	* @param useroperation - UserOperation to get typed data for
	* @param chainId - Target chain ID
	* @param overrides - Override validAfter, validUntil, entrypoint, and module addresses
	* @returns Object with domain, types, and messageValue for EIP-712 signing
	*/
	static getUserOperationEip712Data(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_3_0.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Data(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* Build the Safe initializer calldata for the account setup transaction.
	* Encodes the owners, threshold, module setup, and optional WebAuthn configuration.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param threshold - Number of required signatures for transaction approval
	* @param overrides - Override default module, multisend, and WebAuthn addresses
	* @returns The encoded initializer calldata hex string
	*/
	static createInitializerCallData(owners, threshold, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const safeModuleSetupAddress = overrides.safeModuleSetupAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS;
		return SafeAccount.createBaseInitializerCallData(owners, threshold, safe4337ModuleAddress, safeModuleSetupAddress, overrides.multisendContractAddress, overrides.webAuthnSharedSigner, overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner, overrides.eip7212WebAuthnContractVerifierForSharedSigner);
	}
	/**
	* Create the factory address and encoded factory data for deploying a new Safe account.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param overrides - Override default initialization values
	* @returns A tuple of [factoryAddress, factoryData]
	*/
	static createFactoryAddressAndData(owners, overrides = {}) {
		return SafeAccount.createFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
	}
	/**
	* Create a complete UserOperation ready for signing.
	* Automatically determines the nonce, fetches gas prices, estimates gas limits,
	* and encodes the transactions into calldata. All values can be overridden.
	*
	* @param transactions - Array of MetaTransactions to execute
	* @param providerRpc - Ethereum JSON-RPC node URL (for nonce and gas prices)
	* @param bundlerRpc - Bundler RPC URL (for gas estimation)
	* @param overrides - Override any auto-determined values
	* @returns The unsigned UserOperation (UserOperationV7) ready to be signed
	*
	* @example
	* const userOp = await smartAccount.createUserOperation(
	*   [{ to: recipientAddress, value: 1000000000000000n, data: "0x" }],
	*   nodeRpcUrl,
	*   bundlerRpcUrl,
	* );
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		const [userOperation, factoryAddress, factoryData] = await this.createBaseUserOperationAndFactoryAddressAndFactoryData(transactions, false, providerRpc, bundlerRpc, overrides);
		return {
			...userOperation,
			factory: factoryAddress,
			factoryData,
			paymaster: null,
			paymasterVerificationGasLimit: null,
			paymasterPostOpGasLimit: null,
			paymasterData: null
		};
	}
	/**
	* Estimate gas limits for a UserOperation using the bundler.
	*
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC URL
	* @param overrides - State overrides, dummy signatures, and WebAuthn configuration
	* @returns A tuple of [preVerificationGas, verificationGasLimit, callGasLimit]
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return this.baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides);
	}
	/**
	* Sign a UserOperation using one or more private keys via EIP-712 typed data signing.
	*
	* @param useroperation - The UserOperation to sign
	* @param privateKeys - Array of private keys for the signers
	* @param chainId - The target chain ID
	* @param options - {@link SafeSignatureOptions} — timing, multi-chain encoding, module address
	* @returns The formatted signature string ready to set on the UserOperation
	*
	* @example
	* const signature = smartAccount.signUserOperation(userOp, [privateKey], 1n);
	* userOp.signature = signature;
	*/
	signUserOperation(useroperation, privateKeys, chainId, options = {}) {
		return SafeAccount.baseSignSingleUserOperation(useroperation, privateKeys, chainId, this.entrypointAddress, this.safe4337ModuleAddress, options);
	}
	/**
	* Sign a UserOperation with one or more {@link ExternalSigner} instances
	* (viem, ethers, hardware wallets, MPC, HSMs). Each signer declares its
	* capabilities (`signHash`, `signTypedData`, or both) and the account picks
	* the best match; incompatible signers fail offline with an actionable error.
	*
	* For a raw private-key string, use the sync {@link signUserOperation}
	* instead or wrap with `fromPrivateKey(pk)`. Prebuilt adapters: `fromViem`,
	* `fromEthersWallet`, `fromViemWalletClient`, `fromPrivateKey`.
	*
	* @example
	* import { fromViem } from "abstractionkit";
	* import { privateKeyToAccount } from "viem/accounts";
	*
	* const signer = fromViem(privateKeyToAccount(pk));
	* userOp.signature = await account.signUserOperationWithSigners(userOp, [signer], chainId);
	*
	* @param useroperation - UserOperation to sign
	* @param signers - one ExternalSigner per owner (any order)
	* @param chainId - target chain ID
	* @param options - {@link SafeSignatureOptions} — timing, multi-chain encoding, module address
	* @returns Promise resolving to the formatted signature string
	*/
	signUserOperationWithSigners(useroperation, signers, chainId, options = {}) {
		const context = {
			userOperation: useroperation,
			chainId,
			entryPoint: this.entrypointAddress
		};
		return SafeAccount.baseSignUserOperationWithSigners(useroperation, signers, chainId, {
			entrypointAddress: this.entrypointAddress,
			safe4337ModuleAddress: this.safe4337ModuleAddress,
			context,
			options
		});
	}
	/**
	* Create the MetaTransactions that migrate this DEPLOYED Safe from EntryPoint
	* v0.7 (this account's `Safe4337Module`) to EntryPoint v0.9
	* (`SafeMultiChainSigAccountV1`'s `Safe4337MultiChainSignatureModule`).
	*
	* The returned batch must be sent as a UserOperation FROM THIS v0.7 account
	* (it is validated/executed by the v0.7 module on the v0.7 EntryPoint). After
	* it lands, attach the same account address to `SafeMultiChainSigAccountV1` to
	* operate on EntryPoint v0.9. Both modules are stateless, so no storage
	* clearing is required. See {@link createModuleMigrationMetaTransactions}.
	*
	* @param nodeRpcUrl - The JSON-RPC API url for the target chain
	* @param overrides - override the source/target module addresses or module lookup
	* @returns a promise of [disableV07, enableV09, setFallbackHandler] MetaTransactions
	*/
	async createMigrateToSafeMultiChainSigAccountV1MetaTransactions(nodeRpcUrl, overrides = {}) {
		const moduleV07Address = overrides.safeV07ModuleAddress ?? this.safe4337ModuleAddress;
		const moduleV09Address = overrides.safeV09ModuleAddress ?? SafeMultiChainSigAccountV1.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return this.createModuleMigrationMetaTransactions(nodeRpcUrl, moduleV07Address, moduleV09Address, {
			prevModuleAddress: overrides.prevModuleAddress,
			modulesStart: overrides.modulesStart,
			modulesPageSize: overrides.modulesPageSize,
			skipPreflight: overrides.skipPreflight
		});
	}
};
//#endregion
//#region src/account/Safe/SafeAccountV0_2_0.ts
/**
* Safe smart account implementation for EntryPoint v0.6.
* Provides methods to create, sign, and send ERC-4337 UserOperations
* using Safe's modular smart account architecture.
*
* @example
* // Create a new account (not yet deployed on-chain)
* const smartAccount = SafeAccountV0_2_0.initializeNewAccount([ownerAddress]);
*
* // Or connect to an existing deployed account
* const smartAccount = new SafeAccountV0_2_0(existingAccountAddress);
*/
var SafeAccountV0_2_0 = class SafeAccountV0_2_0 extends SafeAccount {
	static DEFAULT_ENTRYPOINT_ADDRESS = ENTRYPOINT_V6;
	static DEFAULT_SAFE_4337_MODULE_ADDRESS = "0xa581c4A4DB7175302464fF3C06380BC3270b4037";
	static DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb";
	/**
	* Create a SafeAccountV0_2_0 instance for an existing deployed account.
	* For new (undeployed) accounts, use the static `initializeNewAccount` method instead.
	*
	* @param accountAddress - The on-chain address of the Safe account
	* @param overrides - Override default module and EntryPoint addresses
	*/
	constructor(accountAddress, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_2_0.DEFAULT_ENTRYPOINT_ADDRESS;
		super(accountAddress, safe4337ModuleAddress, entrypointAddress, {
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier
		});
	}
	/**
	* Calculate the counterfactual account address from the initial owner signers.
	* Does not deploy the account.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param overrides - Override default initialization values
	* @returns The deterministic account address
	*/
	static createAccountAddress(owners, overrides = {}) {
		const [accountAddress, ,] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		return accountAddress;
	}
	/**
	* Create and initialize a new SafeAccountV0_2_0 from its initial owners.
	* The account address is deterministically computed but not yet deployed on-chain.
	* The first UserOperation sent will deploy it automatically via initCode.
	*
	* @param owners - Array of owner signers (at least one required)
	* @param overrides - Override default initialization values
	* @returns A SafeAccountV0_2_0 instance with factory data set for deployment
	*
	* @example
	* const smartAccount = SafeAccountV0_2_0.initializeNewAccount(["0xOwnerAddress"]);
	*/
	static initializeNewAccount(owners, overrides = {}) {
		let isInitWebAuthn = false;
		let x = 0n;
		let y = 0n;
		for (const owner of owners) if (typeof owner !== "string") {
			if (isInitWebAuthn) throw new RangeError("Only one Webauthn signer is allowed during initialization");
			if (owners.indexOf(owner) !== 0) throw new RangeError("Webauthn owner has to be the first owner for an init transaction.");
			isInitWebAuthn = true;
			x = owner.x;
			y = owner.y;
		}
		const [accountAddress, factoryAddress, factoryData] = SafeAccountV0_2_0.createAccountAddressAndFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		const safe = new SafeAccountV0_2_0(accountAddress, {
			safe4337ModuleAddress: overrides.safe4337ModuleAddress,
			entrypointAddress: overrides.entrypointAddress,
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier
		});
		safe.factoryAddress = factoryAddress;
		safe.factoryData = factoryData;
		if (isInitWebAuthn) {
			safe.isInitWebAuthn = true;
			safe.x = x;
			safe.y = y;
		}
		return safe;
	}
	/**
	* Compute the EIP-712 hash of a UserOperation for Safe signature verification.
	*
	* @param useroperation - UserOperation to hash
	* @param chainId - Target chain ID
	* @param overrides - Override validAfter, validUntil, entrypoint, and module addresses
	* @returns The EIP-712 hash as a hex string
	*/
	static getUserOperationEip712Hash(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_2_0.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Hash(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* Get the EIP-712 typed data components for a UserOperation.
	* Useful for signing with external signers that need domain, types, and message separately.
	*
	* @param useroperation - UserOperation to get typed data for
	* @param chainId - Target chain ID
	* @param overrides - Override validAfter, validUntil, entrypoint, and module addresses
	* @returns Object with domain, types, and messageValue for EIP-712 signing
	*/
	static getUserOperationEip712Data(useroperation, chainId, overrides = {}) {
		const validAfter = overrides.validAfter ?? 0n;
		const validUntil = overrides.validUntil ?? 0n;
		const entrypointAddress = overrides.entrypointAddress ?? SafeAccountV0_2_0.DEFAULT_ENTRYPOINT_ADDRESS;
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return SafeAccount.getUserOperationEip712Data(useroperation, chainId, {
			validAfter,
			validUntil,
			entrypointAddress,
			safe4337ModuleAddress
		});
	}
	/**
	* Calculate both the counterfactual account address and the initCode from owner signers.
	*
	* @param owners - Array of owner signers
	* @param overrides - Override default initialization values
	* @returns A tuple of [accountAddress, initCode]
	*/
	static createAccountAddressAndInitCode(owners, overrides = {}) {
		const [sender, safeAccountFactoryAddress, factoryData] = SafeAccount.createAccountAddressAndFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		return [sender, safeAccountFactoryAddress + factoryData.slice(2)];
	}
	/**
	* Build the Safe initializer calldata for the account setup transaction.
	* Encodes the owners, threshold, module setup, and optional WebAuthn configuration.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param threshold - Number of required signatures for transaction approval
	* @param overrides - Override default module, multisend, and WebAuthn addresses
	* @returns The encoded initializer calldata hex string
	*/
	static createInitializerCallData(owners, threshold, overrides = {}) {
		const safe4337ModuleAddress = overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const safeModuleSetupAddress = overrides.safeModuleSetupAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS;
		return SafeAccount.createBaseInitializerCallData(owners, threshold, safe4337ModuleAddress, safeModuleSetupAddress, overrides.multisendContractAddress, overrides.webAuthnSharedSigner, overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner, overrides.eip7212WebAuthnContractVerifierForSharedSigner);
	}
	/**
	* Create the initCode for deploying a new Safe account via the factory.
	*
	* @param owners - Array of owner signers
	* @param overrides - Override default initialization values
	* @returns The initCode string (factory address + encoded calldata)
	*/
	static createInitCode(owners, overrides = {}) {
		const [safeAccountFactoryAddress, factoryData] = SafeAccount.createFactoryAddressAndData(owners, overrides, overrides.safe4337ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS, overrides.safeModuleSetupAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_MODULE_SETUP_ADDRESS);
		return safeAccountFactoryAddress + factoryData.slice(2);
	}
	/**
	* Create a complete UserOperation ready for signing.
	* Automatically determines the nonce, fetches gas prices, estimates gas limits,
	* and encodes the transactions into calldata. All values can be overridden.
	*
	* @param transactions - Array of MetaTransactions to execute
	* @param providerRpc - Ethereum JSON-RPC node URL (for nonce and gas prices)
	* @param bundlerRpc - Bundler RPC URL (for gas estimation)
	* @param overrides - Override any auto-determined values
	* @returns The unsigned UserOperation (UserOperationV6) ready to be signed
	*
	* @example
	* const userOp = await smartAccount.createUserOperation(
	*   [{ to: recipientAddress, value: 1000000000000000n, data: "0x" }],
	*   nodeRpcUrl,
	*   bundlerRpcUrl,
	* );
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		const [userOperation, factoryAddress, factoryData] = await this.createBaseUserOperationAndFactoryAddressAndFactoryData(transactions, true, providerRpc, bundlerRpc, overrides);
		let initCode = "0x";
		if (overrides.initCode == null) {
			if (factoryAddress != null) {
				let factoryDataStr = "0x";
				if (factoryData != null) factoryDataStr = factoryData;
				initCode = factoryAddress + factoryDataStr.slice(2);
			}
		} else initCode = overrides.initCode;
		return {
			...userOperation,
			initCode,
			paymasterAndData: "0x"
		};
	}
	/**
	* Create MetaTransactions to migrate this account from EntryPoint v0.6 (module v0.2.0)
	* to EntryPoint v0.7 (module v0.3.0).
	*
	* @param nodeRpcUrl - Ethereum JSON-RPC node URL
	* @param overrides - Override module addresses and pagination
	* @returns Array of MetaTransactions for the migration
	*/
	async createMigrateToSafeAccountV0_3_0MetaTransactions(nodeRpcUrl, overrides = {}) {
		const moduleV06Address = overrides.safeV06ModuleAddress ?? SafeAccountV0_2_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		const moduleV07Address = overrides.safeV07ModuleAddress ?? SafeAccountV0_3_0.DEFAULT_SAFE_4337_MODULE_ADDRESS;
		return this.createModuleMigrationMetaTransactions(nodeRpcUrl, moduleV06Address, moduleV07Address, {
			prevModuleAddress: overrides.prevModuleAddress,
			modulesPageSize: overrides.pageSize,
			modulesStart: overrides.modulesStart,
			skipPreflight: overrides.skipPreflight
		});
	}
	/**
	* Estimate gas limits for a UserOperation using the bundler.
	*
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC URL
	* @param overrides - State overrides, dummy signatures, and WebAuthn configuration
	* @returns A tuple of [preVerificationGas, verificationGasLimit, callGasLimit]
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return this.baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides);
	}
	/**
	* Sign a UserOperation using one or more private keys via EIP-712 typed data signing.
	*
	* @param useroperation - The UserOperation to sign
	* @param privateKeys - Array of private keys for the signers
	* @param chainId - The target chain ID
	* @param options - {@link SafeSignatureOptions} — timing, multi-chain encoding, module address
	* @returns The formatted signature string ready to set on the UserOperation
	*
	* @example
	* const signature = smartAccount.signUserOperation(userOp, [privateKey], 1n);
	* userOp.signature = signature;
	*/
	signUserOperation(useroperation, privateKeys, chainId, options = {}) {
		return SafeAccount.baseSignSingleUserOperation(useroperation, privateKeys, chainId, this.entrypointAddress, this.safe4337ModuleAddress, options);
	}
	/**
	* Sign a UserOperation using one or more {@link ExternalSigner} instances.
	* See {@link SafeAccountV0_3_0.signUserOperationWithSigners} for full
	* design rationale and examples.
	*
	* @param useroperation - The UserOperation to sign
	* @param signers - one ExternalSigner per owner (any order)
	* @param chainId - The target chain ID
	* @param options - {@link SafeSignatureOptions} — timing, multi-chain encoding, module address
	* @returns Promise resolving to the formatted signature string
	*/
	signUserOperationWithSigners(useroperation, signers, chainId, options = {}) {
		const context = {
			userOperation: useroperation,
			chainId,
			entryPoint: this.entrypointAddress
		};
		return SafeAccount.baseSignUserOperationWithSigners(useroperation, signers, chainId, {
			entrypointAddress: this.entrypointAddress,
			safe4337ModuleAddress: this.safe4337ModuleAddress,
			context,
			options
		});
	}
};
//#endregion
//#region src/account/Safe/SafeAccountV1_5_0_M_0_3_0.ts
/**
* Safe v1.5.0 smart account implementation with module v0.3.0 for EntryPoint v0.7.
* Extends {@link SafeAccountV0_3_0} using the Safe L2 v1.5.0 singleton instead of v1.4.1.
*
* @example
* // Create a new account using Safe v1.5.0 singleton
* const smartAccount = SafeAccountV1_5_0_M_0_3_0.initializeNewAccount([ownerAddress]);
*
* // Or connect to an existing deployed account
* const smartAccount = new SafeAccountV1_5_0_M_0_3_0(existingAccountAddress);
*/
var SafeAccountV1_5_0_M_0_3_0 = class SafeAccountV1_5_0_M_0_3_0 extends SafeAccountV0_3_0 {
	static DEFAULT_WEB_AUTHN_PRECOMPILE = "0x0000000000000000000000000000000000000100";
	static DEFAULT_WEB_AUTHN_DAIMO_VERIFIER = "0xc2b78104907F722DABAc4C69f826a522B2754De4";
	static DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER = "0xc2b78104907F722DABAc4C69f826a522B2754De4";
	/**
	* Create a SafeAccountV1_5_0_M_0_3_0 instance for an existing deployed account.
	* For new (undeployed) accounts, use the static `initializeNewAccount` method instead.
	*
	* @param accountAddress - The on-chain address of the Safe account
	* @param overrides - Override default module and EntryPoint addresses
	*/
	constructor(accountAddress, overrides = {}) {
		super(accountAddress, {
			safe4337ModuleAddress: overrides.safe4337ModuleAddress,
			entrypointAddress: overrides.entrypointAddress,
			onChainIdentifierParams: overrides.onChainIdentifierParams,
			onChainIdentifier: overrides.onChainIdentifier,
			safeAccountSingleton: overrides.safeAccountSingleton ?? Safe_L2_V1_5_0
		});
	}
	/**
	* Calculate the deterministic proxy address from the initializer calldata.
	* Uses the Safe v1.5.0 singleton init hash by default.
	*
	* @param initializerCallData - The encoded initializer calldata for the proxy
	* @param overrides - Override default nonce, factory address, and singleton init hash
	* @returns The deterministic proxy address
	*/
	static createProxyAddress(initializerCallData, overrides = {}) {
		const modOverrides = {
			...overrides,
			singletonInitHash: overrides.singletonInitHash ?? Safe_L2_V1_5_0.singletonInitHash
		};
		return SafeAccountV0_3_0.createProxyAddress(initializerCallData, modOverrides);
	}
	/**
	* Create and initialize a new SafeAccountV1_5_0_M_0_3_0 from its initial owners.
	* The account address is deterministically computed but not yet deployed on-chain.
	* The first UserOperation sent will deploy it automatically via factory data.
	*
	* @param owners - Array of owner signers (at least one required)
	* @param overrides - Override default initialization values
	* @returns A SafeAccountV1_5_0_M_0_3_0 instance with factory data set for deployment
	*
	* @example
	* const smartAccount = SafeAccountV1_5_0_M_0_3_0.initializeNewAccount(["0xOwnerAddress"]);
	*/
	static initializeNewAccount(owners, overrides = {}) {
		const modOverrides = {
			...overrides,
			safeAccountSingleton: overrides.safeAccountSingleton ?? Safe_L2_V1_5_0,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		return super.initializeNewAccount(owners, modOverrides);
	}
	/**
	* Calculate the counterfactual account address from the initial owner signers.
	* Does not deploy the account. Uses the Safe v1.5.0 singleton by default.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param overrides - Override default initialization values
	* @returns The deterministic account address
	*/
	static createAccountAddress(owners, overrides = {}) {
		const modOverrides = {
			...overrides,
			safeAccountSingleton: overrides.safeAccountSingleton ?? Safe_L2_V1_5_0,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		return SafeAccountV0_3_0.createAccountAddress(owners, modOverrides);
	}
	/**
	* Create the factory address and encoded factory data for deploying a new Safe account.
	* Uses the Safe v1.5.0 singleton by default.
	*
	* @param owners - Array of owner signers (ECDSA addresses or WebAuthn public keys)
	* @param overrides - Override default initialization values
	* @returns A tuple of [factoryAddress, factoryData]
	*/
	static createFactoryAddressAndData(owners, overrides = {}) {
		const modOverrides = {
			...overrides,
			safeAccountSingleton: overrides.safeAccountSingleton ?? Safe_L2_V1_5_0,
			eip7212WebAuthnPrecompileVerifierForSharedSigner: overrides.eip7212WebAuthnPrecompileVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifierForSharedSigner: overrides.eip7212WebAuthnContractVerifierForSharedSigner ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		};
		return SafeAccountV0_3_0.createFactoryAddressAndData(owners, modOverrides);
	}
	/**
	* Create a UserOperation with v1.5.0 defaults applied for WebAuthn verification
	* (RIP-7951 precompile + Daimo fallback). See {@link SafeAccountV0_3_0.createUserOperation}.
	*
	* @param transactions - Array of MetaTransactions to execute
	* @param providerRpc - Ethereum JSON-RPC node URL (for nonce and gas prices)
	* @param bundlerRpc - Bundler RPC URL (for gas estimation)
	* @param overrides - Override any auto-determined values
	* @returns The unsigned UserOperation (UserOperationV7) ready to be signed
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		return super.createUserOperation(transactions, providerRpc, bundlerRpc, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Estimate gas limits for a UserOperation with v1.5.0 WebAuthn defaults applied.
	*
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC URL
	* @param overrides - State overrides, dummy signatures, and WebAuthn configuration
	* @returns A tuple of [preVerificationGas, verificationGasLimit, callGasLimit]
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return super.estimateUserOperationGas(userOperation, bundlerRpc, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Compute the counterfactual address of the WebAuthn signer proxy for the given public key.
	* Applies v1.5.0 defaults for precompile + Daimo verifier.
	*
	* @param x - X coordinate of the WebAuthn P-256 public key
	* @param y - Y coordinate of the WebAuthn P-256 public key
	* @param overrides - Override WebAuthn verifier, factory, singleton, and proxy-code addresses
	* @returns The counterfactual verifier/proxy address
	*/
	static createWebAuthnSignerVerifierAddress(x, y, overrides = {}) {
		return SafeAccount.createWebAuthnSignerVerifierAddress(x, y, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Create a MetaTransaction that deploys the WebAuthn verifier/proxy for the given public key.
	* Applies v1.5.0 defaults for precompile + Daimo verifier.
	*
	* @param x - X coordinate of the WebAuthn P-256 public key
	* @param y - Y coordinate of the WebAuthn P-256 public key
	* @param overrides - Override WebAuthn verifier and factory addresses
	* @returns A MetaTransaction that deploys the verifier
	*/
	static createDeployWebAuthnVerifierMetaTransaction(x, y, overrides = {}) {
		return SafeAccount.createDeployWebAuthnVerifierMetaTransaction(x, y, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Build dummy signer/signature pairs for gas estimation, with v1.5.0 WebAuthn defaults.
	*
	* @param expectedSigners - Signers whose signatures will be produced at sign time
	* @param webAuthnSignatureOverrides - Override WebAuthn verifier/module configuration
	* @returns An array of dummy SignerSignaturePair entries, one per expected signer
	*/
	static createDummySignerSignaturePairForExpectedSigners(expectedSigners, webAuthnSignatureOverrides = {}) {
		return SafeAccount.createDummySignerSignaturePairForExpectedSigners(expectedSigners, {
			...webAuthnSignatureOverrides,
			eip7212WebAuthnPrecompileVerifier: webAuthnSignatureOverrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: webAuthnSignatureOverrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
	/**
	* Verify a WebAuthn signature over a message hash on-chain via the P-256 verifier.
	* Applies v1.5.0 defaults for precompile + Daimo verifier.
	*
	* @param nodeRpcUrl - Ethereum JSON-RPC node URL
	* @param signer - WebAuthn public key that purportedly produced the signature
	* @param messageHash - The hash that was signed
	* @param signature - The WebAuthn signature bytes
	* @param overrides - Override WebAuthn verifier and singleton addresses
	* @returns Promise of `true` if the signature verifies, otherwise `false`
	*/
	static async verifyWebAuthnSignatureForMessageHash(nodeRpcUrl, signer, messageHash, signature, overrides = {}) {
		return SafeAccount.verifyWebAuthnSignatureForMessageHash(nodeRpcUrl, signer, messageHash, signature, {
			...overrides,
			eip7212WebAuthnPrecompileVerifier: overrides.eip7212WebAuthnPrecompileVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: overrides.eip7212WebAuthnContractVerifier ?? SafeAccountV1_5_0_M_0_3_0.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		});
	}
};
//#endregion
//#region src/account/simple/Simple7702Account.ts
/**
* Abstract base class for EIP-7702 simple smart accounts.
* Provides shared logic for creating, signing, and sending UserOperations
* using the SimpleAccount execute/executeBatch interface. Subclasses
* (e.g., {@link Simple7702Account}, {@link Simple7702AccountV09}) bind
* a specific EntryPoint version and delegatee address.
*/
var BaseSimple7702Account = class BaseSimple7702Account extends SmartAccount {
	/** Function selector for `execute(address,uint256,bytes)` */
	static executorFunctionSelector = "0xb61d27f6";
	/** ABI parameter types for the single-call `execute` function */
	static executorFunctionInputAbi = [
		"address",
		"uint256",
		"bytes"
	];
	/** Function selector for `executeBatch((address,uint256,bytes)[])` */
	static batchExecutorFunctionSelector = "0x34fcd5be";
	/** ABI parameter types for the batch `executeBatch` function */
	static batchExecutorFunctionInputAbi = ["(address,uint256,bytes)[]"];
	/** Dummy ECDSA signature used during gas estimation */
	static dummySignature = "0xd2614025fc173b86704caf37b2fb447f7618101a0d31f5f304c777024cef38a060a29ee43fcf0c46f9107d4f670b8a85c2c017a1fe9e4af891f24f0be6ba5d671c";
	/** The EntryPoint contract address this account targets */
	entrypointAddress;
	/** The EIP-7702 delegatee (implementation) contract address */
	delegateeAddress;
	/**
	* @param accountAddress - The EOA address that will be delegated via EIP-7702
	* @param entrypointAddress - The EntryPoint contract address
	* @param delegateeAddress - The EIP-7702 delegatee (implementation) contract address
	*/
	constructor(accountAddress, entrypointAddress, delegateeAddress) {
		super(accountAddress);
		this.entrypointAddress = entrypointAddress;
		this.delegateeAddress = delegateeAddress;
	}
	/**
	* Check if this EOA is delegated to the expected delegatee address via EIP-7702.
	* Returns `true` only when delegated to `this.delegateeAddress`.
	* Use `JsonRpcNode.getDelegatedAddress()` directly to get the raw delegatee address.
	*
	* @param providerRpc - Ethereum JSON-RPC node URL
	* @returns `true` if delegated to the expected address, `false` otherwise
	*/
	async isDelegatedToThisAccount(providerRpc) {
		const address = await JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress);
		if (address === null) return false;
		return address.toLowerCase() === this.delegateeAddress.toLowerCase();
	}
	/**
	* Create a signed raw EIP-7702 transaction that revokes the delegation,
	* restoring the EOA to a normal account. The transaction is type 0x04
	* with a zero-address authorization.
	*
	* Cannot be done via UserOp — the authorization_list is processed before
	* execution, removing the account's code mid-transaction.
	*
	* Authorization nonce defaults to txNonce + 1 because EIP-7702 increments
	* the sender's transaction nonce before processing the authorization list.
	*
	* @param eoaPrivateKey - The EOA's private key (signs both auth and tx)
	* @param providerRpc - JSON-RPC endpoint for nonce, gas price, chain ID
	* @param overrides - Optional overrides for transaction fields
	* @returns Signed raw transaction hex, ready for `eth_sendRawTransaction`
	*/
	async createRevokeDelegationTransaction(eoaPrivateKey, providerRpc, overrides = {}) {
		if (privateKeyToAddress(eoaPrivateKey).toLowerCase() !== this.accountAddress.toLowerCase()) throw new AbstractionKitError("BAD_DATA", `eoaPrivateKey does not match accountAddress (${this.accountAddress})`);
		const delegatedTo = await JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress);
		if (delegatedTo === null) throw new AbstractionKitError("BAD_DATA", "Account is not delegated — nothing to revoke");
		if (delegatedTo.toLowerCase() !== this.delegateeAddress.toLowerCase()) throw new AbstractionKitError("BAD_DATA", "Account is delegated to a different address (" + delegatedTo + "), not " + this.delegateeAddress + " — use the correct account class to revoke");
		const results = {};
		const ops = [];
		if (overrides.nonce == null) ops.push(sendJsonRpcRequest(providerRpc, "eth_getTransactionCount", [this.accountAddress, "latest"]).then((v) => {
			results.nonce = BigInt(v);
		}));
		if (overrides.maxFeePerGas == null || overrides.maxPriorityFeePerGas == null) ops.push(handlefetchGasPrice(providerRpc, void 0).then(([fee, tip]) => {
			results.maxFeePerGas = fee;
			results.maxPriorityFeePerGas = tip;
		}));
		if (overrides.chainId == null) ops.push(sendJsonRpcRequest(providerRpc, "eth_chainId", []).then((v) => {
			results.chainId = BigInt(v);
		}));
		if (ops.length > 0) await Promise.all(ops);
		const txNonce = overrides.nonce ?? results.nonce ?? 0n;
		const maxFeePerGas = overrides.maxFeePerGas ?? results.maxFeePerGas ?? 0n;
		const maxPriorityFeePerGas = overrides.maxPriorityFeePerGas ?? results.maxPriorityFeePerGas ?? 0n;
		const chainId = overrides.chainId ?? results.chainId ?? 0n;
		const authHex = createRevokeDelegationAuthorization(chainId, overrides.authorizationNonce ?? txNonce + 1n, eoaPrivateKey);
		const auth = {
			chainId: BigInt(authHex.chainId),
			address: authHex.address,
			nonce: BigInt(authHex.nonce),
			yParity: BigInt(authHex.yParity) === 0n ? 0 : 1,
			r: BigInt(authHex.r),
			s: BigInt(authHex.s)
		};
		return createAndSignEip7702RawTransaction(chainId, txNonce, maxPriorityFeePerGas, maxFeePerGas, overrides.gasLimit ?? 60000n, this.accountAddress, 0n, "0x", [], [auth], eoaPrivateKey);
	}
	/**
	* Encode calldata for a single `execute(address,uint256,bytes)` call.
	* @param to - Target contract or EOA address
	* @param value - Amount of native token (in wei) to transfer
	* @param data - ABI-encoded calldata for the target
	* @returns Encoded calldata for the execute function
	*/
	static createAccountCallData(to, value, data) {
		const executorFunctionInputParameters = [
			to,
			value,
			data
		];
		return createCallData(BaseSimple7702Account.executorFunctionSelector, BaseSimple7702Account.executorFunctionInputAbi, executorFunctionInputParameters);
	}
	/**
	* Encode calldata for a single {@link SimpleMetaTransaction} using `execute`.
	* @param metaTransaction - The transaction to encode
	* @returns Encoded calldata for the execute function
	*/
	static createAccountCallDataSingleTransaction(metaTransaction) {
		const value = metaTransaction.value ?? 0;
		const data = metaTransaction.data ?? "0x";
		return BaseSimple7702Account.createAccountCallData(metaTransaction.to, value, data);
	}
	/**
	* Encode calldata for a batch of {@link SimpleMetaTransaction}s using `executeBatch`.
	* @param transactions - Array of transactions to batch
	* @returns Encoded calldata for the executeBatch function
	*/
	static createAccountCallDataBatchTransactions(transactions) {
		const encodedTransactions = [transactions.map((transaction) => [
			transaction.to,
			transaction.value,
			transaction.data
		])];
		return createCallData(BaseSimple7702Account.batchExecutorFunctionSelector, BaseSimple7702Account.batchExecutorFunctionInputAbi, encodedTransactions);
	}
	/**
	* Build an unsigned UserOperation from one or more transactions.
	* Determines nonce, fetches gas prices, estimates gas limits, and
	* optionally includes EIP-7702 authorization. All auto-determined
	* values can be overridden.
	* @param transactions - One or more transactions to encode into callData
	* @param providerRpc - JSON-RPC endpoint for nonce and gas price queries
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides for gas, nonce, and EIP-7702 auth fields
	* @returns A promise resolving to an unsigned UserOperation (v8 or v9)
	*/
	async baseCreateUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		if (transactions.length < 1) throw new RangeError("There should be at least one transaction");
		let nonce = null;
		let nonceOp = null;
		if (overrides.nonce == null) if (providerRpc != null) nonceOp = fetchAccountNonce(providerRpc, this.entrypointAddress, this.accountAddress);
		else throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if nonce is not overridden");
		else nonce = overrides.nonce;
		if (typeof overrides.maxFeePerGas === "bigint" && overrides.maxFeePerGas < 0n) throw new RangeError("maxFeePerGas override can't be negative");
		if (typeof overrides.maxPriorityFeePerGas === "bigint" && overrides.maxPriorityFeePerGas < 0n) throw new RangeError("maxPriorityFeePerGas override can't be negative");
		let maxFeePerGas = BaseUserOperationDummyValues.maxFeePerGas;
		let maxPriorityFeePerGas = BaseUserOperationDummyValues.maxPriorityFeePerGas;
		let gasPriceOp = null;
		if (overrides.maxFeePerGas == null || overrides.maxPriorityFeePerGas == null) gasPriceOp = handlefetchGasPrice(providerRpc, overrides.polygonGasStation, overrides.gasLevel);
		let eip7702AuthChainId = null;
		let eip7702AuthAddress = null;
		let eip7702AuthNonce = null;
		let skipEip7702Auth = false;
		if (overrides.eip7702Auth != null) {
			eip7702AuthChainId = overrides.eip7702Auth.chainId;
			eip7702AuthAddress = overrides.eip7702Auth.address ?? this.delegateeAddress;
			eip7702AuthNonce = overrides.eip7702Auth.nonce ?? null;
		}
		let delegationCheckOp = null;
		if (overrides.eip7702Auth != null && providerRpc != null) delegationCheckOp = JsonRpcNode.from(providerRpc).getDelegatedAddress(this.accountAddress).catch(() => null);
		if (overrides.eip7702Auth != null && eip7702AuthNonce == null) {
			let eip7702AuthNonceOp;
			if (providerRpc != null) eip7702AuthNonceOp = sendJsonRpcRequest(providerRpc, "eth_getTransactionCount", [this.accountAddress, "latest"]);
			else throw new AbstractionKitError("BAD_DATA", "providerRpc can't be null if eoaDelegatorNonce is not overridden");
			const ops = [eip7702AuthNonceOp];
			if (nonceOp != null) ops.push(nonceOp);
			if (gasPriceOp != null) ops.push(gasPriceOp);
			if (delegationCheckOp != null) ops.push(delegationCheckOp);
			const values = await Promise.all(ops);
			let idx = 0;
			eip7702AuthNonce = BigInt(values[idx++]);
			if (nonceOp != null) nonce = values[idx++];
			if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = values[idx++];
			if (delegationCheckOp != null) {
				const delegatedTo = values[idx++];
				if (delegatedTo != null && delegatedTo.toLowerCase() === eip7702AuthAddress.toLowerCase()) skipEip7702Auth = true;
			}
		} else if (overrides.eip7702Auth != null) {
			const ops = [];
			if (nonceOp != null) ops.push(nonceOp);
			if (gasPriceOp != null) ops.push(gasPriceOp);
			if (delegationCheckOp != null) ops.push(delegationCheckOp);
			if (ops.length > 0) {
				const values = await Promise.all(ops);
				let idx = 0;
				if (nonceOp != null) nonce = values[idx++];
				if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = values[idx++];
				if (delegationCheckOp != null) {
					const delegatedTo = values[idx++];
					if (delegatedTo != null && delegatedTo.toLowerCase() === eip7702AuthAddress.toLowerCase()) skipEip7702Auth = true;
				}
			}
		} else if (gasPriceOp != null && nonceOp != null) await Promise.all([nonceOp, gasPriceOp]).then((values) => {
			nonce = values[0];
			[maxFeePerGas, maxPriorityFeePerGas] = values[1];
		});
		else if (gasPriceOp != null) [maxFeePerGas, maxPriorityFeePerGas] = await gasPriceOp;
		else if (nonceOp != null) nonce = await nonceOp;
		maxFeePerGas = overrides.maxFeePerGas ?? BigInt(Math.floor(Number(maxFeePerGas) * (((overrides.maxFeePerGasPercentageMultiplier ?? 0) + 100) / 100)));
		maxPriorityFeePerGas = overrides.maxPriorityFeePerGas ?? BigInt(Math.floor(Number(maxPriorityFeePerGas) * (((overrides.maxPriorityFeePerGasPercentageMultiplier ?? 0) + 100) / 100)));
		if (nonce == null) throw new RangeError("failed to determine nonce");
		else if (nonce < 0n) throw new RangeError("nonce can't be negative");
		let callData = "0x";
		if (overrides.callData == null) if (transactions.length === 1) callData = BaseSimple7702Account.createAccountCallDataSingleTransaction(transactions[0]);
		else callData = BaseSimple7702Account.createAccountCallDataBatchTransactions(transactions);
		else callData = overrides.callData;
		let userOperation;
		if (overrides.eip7702Auth != null && !skipEip7702Auth) {
			const yParity = overrides.eip7702Auth.yParity ?? "0x0";
			if (yParity !== "0x0" && yParity !== "0x00" && yParity !== "0x1" && yParity !== "0x01") throw new AbstractionKitError("BAD_DATA", "invalid yParity value for eoaDelegatorSignature. must be '0x0' or '0x1'");
			const authorization = {
				chainId: bigintToHex(eip7702AuthChainId),
				address: eip7702AuthAddress,
				nonce: bigintToHex(eip7702AuthNonce),
				yParity,
				r: overrides.eip7702Auth.r ?? "0x4277ba564d2c138823415df0ec8e8f97f30825056d54ec5128a8b29ec2dd81b2",
				s: overrides.eip7702Auth.s ?? "0x1075a1bec7f59848cca899ece93075199cd2aabceb0654b9ae00b881a30044cd"
			};
			userOperation = {
				...BaseUserOperationDummyValues,
				sender: this.accountAddress,
				nonce,
				callData,
				maxFeePerGas,
				maxPriorityFeePerGas,
				factory: "0x7702",
				factoryData: null,
				paymaster: null,
				paymasterVerificationGasLimit: null,
				paymasterPostOpGasLimit: null,
				paymasterData: null,
				eip7702Auth: authorization
			};
		} else userOperation = {
			...BaseUserOperationDummyValues,
			sender: this.accountAddress,
			nonce,
			callData,
			maxFeePerGas,
			maxPriorityFeePerGas,
			factory: null,
			factoryData: null,
			paymaster: null,
			paymasterVerificationGasLimit: null,
			paymasterPostOpGasLimit: null,
			paymasterData: null,
			eip7702Auth: null
		};
		let preVerificationGas = BaseUserOperationDummyValues.preVerificationGas;
		let verificationGasLimit = BaseUserOperationDummyValues.verificationGasLimit;
		let callGasLimit = BaseUserOperationDummyValues.callGasLimit;
		userOperation.signature = overrides.dummySignature ?? BaseSimple7702Account.dummySignature;
		const skipGasEstimation = overrides.skipGasEstimation ?? false;
		const parallelPaymasterInitValues = overrides.parallelPaymasterInitValues;
		if (parallelPaymasterInitValues != null) {
			if (this.entrypointAddress !== "0x433709009B8330FDa32311DF1C2AFA402eD8D009") throw new RangeError("parallelPaymasterInitValues only works with ep v0.9");
			userOperation.paymaster = parallelPaymasterInitValues.paymaster;
			userOperation.paymasterVerificationGasLimit = parallelPaymasterInitValues.paymasterVerificationGasLimit;
			userOperation.paymasterPostOpGasLimit = parallelPaymasterInitValues.paymasterPostOpGasLimit;
			userOperation.paymasterData = parallelPaymasterInitValues.paymasterData;
		}
		if (!skipGasEstimation && (overrides.preVerificationGas == null || overrides.verificationGasLimit == null || overrides.callGasLimit == null)) if (bundlerRpc != null) {
			userOperation.callGasLimit = 0n;
			userOperation.verificationGasLimit = 0n;
			userOperation.preVerificationGas = 0n;
			const inputMaxFeePerGas = userOperation.maxFeePerGas;
			const inputMaxPriorityFeePerGas = userOperation.maxPriorityFeePerGas;
			userOperation.maxFeePerGas = 0n;
			userOperation.maxPriorityFeePerGas = 0n;
			const userOperationToEstimate = { ...userOperation };
			[preVerificationGas, verificationGasLimit, callGasLimit] = await this.baseEstimateUserOperationGas(userOperationToEstimate, bundlerRpc, { stateOverrideSet: overrides.state_override_set });
			verificationGasLimit += 55000n;
			userOperation.maxFeePerGas = inputMaxFeePerGas;
			userOperation.maxPriorityFeePerGas = inputMaxPriorityFeePerGas;
		} else throw new AbstractionKitError("BAD_DATA", "bundlerRpc can't be null if preVerificationGas,verificationGasLimit and callGasLimit are not overridden");
		if (typeof overrides.preVerificationGas === "bigint" && overrides.preVerificationGas < 0n) throw new RangeError("preVerificationGas override can't be negative");
		if (typeof overrides.verificationGasLimit === "bigint" && overrides.verificationGasLimit < 0n) throw new RangeError("verificationGasLimit override can't be negative");
		if (typeof overrides.callGasLimit === "bigint" && overrides.callGasLimit < 0n) throw new RangeError("callGasLimit override can't be negative");
		userOperation.preVerificationGas = overrides.preVerificationGas ?? BigInt(Math.floor(Number(preVerificationGas) * (((overrides.preVerificationGasPercentageMultiplier ?? 0) + 100) / 100)));
		userOperation.verificationGasLimit = overrides.verificationGasLimit ?? BigInt(Math.floor(Number(verificationGasLimit) * (((overrides.verificationGasLimitPercentageMultiplier ?? 0) + 100) / 100)));
		userOperation.callGasLimit = overrides.callGasLimit ?? BigInt(Math.floor(Number(callGasLimit) * (((overrides.callGasLimitPercentageMultiplier ?? 0) + 100) / 100)));
		return userOperation;
	}
	/**
	* Estimate gas limits for a UserOperation via the bundler.
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides
	* @param overrides.stateOverrideSet - State overrides to apply during estimation
	* @param overrides.dummySignature - Custom dummy ECDSA signature for estimation
	* @returns A promise resolving to `[preVerificationGas, verificationGasLimit, callGasLimit]`
	*/
	async baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		const bundler = Bundler.from(bundlerRpc);
		const userOperationToEstimate = {
			...userOperation,
			signature: overrides.dummySignature ?? BaseSimple7702Account.dummySignature,
			maxFeePerGas: 0n,
			maxPriorityFeePerGas: 0n
		};
		const estimation = await bundler.estimateUserOperationGas(userOperationToEstimate, this.entrypointAddress, overrides.stateOverrideSet);
		return [
			BigInt(estimation.preVerificationGas),
			BigInt(estimation.verificationGasLimit),
			BigInt(estimation.callGasLimit)
		];
	}
	/**
	* Sign a UserOperation with an EOA private key.
	* Computes the UserOperation hash and produces an ECDSA signature.
	* @param useroperation - The UserOperation to sign
	* @param privateKey - Hex-encoded private key of the EOA signer
	* @param chainId - Target chain ID
	* @returns Hex-encoded ECDSA signature
	*/
	baseSignUserOperation(useroperation, privateKey, chainId) {
		return signHash$1(privateKey, createUserOperationHash(useroperation, this.entrypointAddress, chainId)).serialized;
	}
	/**
	* Schemes Simple7702 accepts from a Signer. EntryPoint v0.8/v0.9 introduced
	* an EIP-712 domain at the EntryPoint contract, and the userOpHash IS the
	* EIP-712 digest of the PackedUserOperation under that domain — so signing
	* the typed data and signing the raw hash produce signatures that verify
	* against the same `userOpHash` (and recover to the same signer address).
	* Deterministic-ECDSA signers (ethers, viem, MetaMask) yield byte-identical
	* bytes; signers that differ in `s` / `v` normalization still validate the
	* same on-chain.
	*
	* `typedData` is listed first so JSON-RPC wallets that can only sign typed
	* data work without a separate code path; `hash` remains a valid fallback
	* for local-key signers.
	*/
	static ACCEPTED_SIGNING_SCHEMES = ["typedData", "hash"];
	/**
	* Build the EIP-712 typed data payload for a UserOperation under the
	* EntryPoint v0.8 / v0.9 domain. Lower-level escape hatch for integrators
	* driving `signTypedData` themselves with their own signing primitive
	* (HSM, MPC, custom wallet abstraction). Most callers should pass an
	* {@link ExternalSigner} to {@link signUserOperationWithSigner} instead, which
	* builds this internally.
	*
	* The digest of the returned payload equals the UserOperation hash from
	* {@link createUserOperationHash}, so a wallet calling
	* `signTypedData(domain, types, message)` produces a signature that
	* verifies against the same `userOpHash` as raw ECDSA over that hash.
	* Deterministic-ECDSA signers yield byte-identical signatures; signers
	* that differ in `s` / `v` normalization still validate the same on-chain.
	*
	* The base class defaults to EntryPoint v0.8; subclasses
	* ({@link Simple7702AccountV09}) override with their own default.
	*
	* @param userOperation - Unsigned UserOperation to wrap
	* @param chainId - Target chain ID (must match the chain that will validate
	*   the signature)
	* @param overrides - Override the entrypoint address
	* @returns EIP-712 {@link TypedData} payload ready for `signTypedData`
	* @throws {AbstractionKitError} if the target EntryPoint is not v0.8 / v0.9.
	*/
	static getUserOperationEip712Data(userOperation, chainId, overrides = {}) {
		return getUserOperationEip712DataV8V9(userOperation, overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", chainId);
	}
	/**
	* Compute the EIP-712 digest of a UserOperation under the EntryPoint
	* v0.8 / v0.9 domain. For these EntryPoints this digest IS the
	* `userOpHash` ({@link createUserOperationHash}); signing it with raw
	* ECDSA or via `signTypedData` over the data from
	* {@link getUserOperationEip712Data} produces a signature that validates
	* against the same hash on-chain.
	*
	* @param userOperation - Unsigned UserOperation to hash
	* @param chainId - Target chain ID
	* @param overrides - Override the entrypoint address (defaults to EntryPoint v0.8)
	* @returns The EIP-712 digest as a hex string
	* @throws {AbstractionKitError} if the target EntryPoint is not v0.8 / v0.9.
	*/
	static getUserOperationEip712Hash(userOperation, chainId, overrides = {}) {
		return getUserOperationEip712HashV8V9(userOperation, overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", chainId);
	}
	/**
	* Sign a UserOperation with an {@link ExternalSigner}. The signer can implement
	* either `signTypedData` (preferred — JSON-RPC wallets, viem `WalletClient`)
	* or `signHash` (local keys, hardware wallets). Both schemes produce
	* signatures that validate against the same `userOpHash` because the
	* v0.8 / v0.9 userOpHash IS the EIP-712 digest of the PackedUserOperation
	* (deterministic-ECDSA signers yield byte-identical bytes).
	*
	* Signers that implement neither method fail offline with an actionable
	* error.
	*/
	async baseSignUserOperationWithSigner(useroperation, signer, chainId) {
		const scheme = pickScheme(signer, BaseSimple7702Account.ACCEPTED_SIGNING_SCHEMES, {
			accountName: "Simple7702 (EIP-712 typed data or raw ECDSA over userOpHash)",
			signerIndex: 0
		});
		const hash = createUserOperationHash(useroperation, this.entrypointAddress, chainId);
		const context = {
			userOperation: useroperation,
			chainId,
			entryPoint: this.entrypointAddress
		};
		return invokeSigner(signer, scheme, {
			hash,
			typedData: scheme === "typedData" ? BaseSimple7702Account.getUserOperationEip712Data(useroperation, chainId, { entrypointAddress: this.entrypointAddress }) : void 0,
			context
		});
	}
	/**
	* Submit a signed UserOperation to a bundler for on-chain inclusion.
	* @param userOperation - The signed UserOperation to submit
	* @param bundlerRpc - Bundler RPC endpoint
	* @returns A {@link SendUseroperationResponse} that can be used to wait for inclusion
	*/
	async baseSendUserOperation(userOperation, bundlerRpc) {
		const bundler = Bundler.from(bundlerRpc);
		return new SendUseroperationResponse(await bundler.sendUserOperation(userOperation, this.entrypointAddress), bundler, this.entrypointAddress);
	}
	/**
	* Prepend a token `approve` call to existing calldata for a token paymaster.
	* Instance wrapper for {@link BaseSimple7702Account.prependTokenPaymasterApproveToCallDataStatic}.
	* @param callData - Existing encoded calldata (execute or executeBatch)
	* @param tokenAddress - ERC-20 token contract to approve
	* @param paymasterAddress - Paymaster address to approve as spender
	* @param approveAmount - Token amount to approve
	* @returns Re-encoded calldata with the approve transaction prepended as a batch
	*/
	prependTokenPaymasterApproveToCallData(callData, tokenAddress, paymasterAddress, approveAmount) {
		return BaseSimple7702Account.prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount);
	}
	/**
	* Prepend a token `approve` call to existing calldata for a token paymaster.
	* Decodes the existing calldata, prepends an ERC-20 approve transaction,
	* and re-encodes as a batch via `executeBatch`.
	* @param callData - Existing encoded calldata (execute or executeBatch)
	* @param tokenAddress - ERC-20 token contract to approve
	* @param paymasterAddress - Paymaster address to approve as spender
	* @param approveAmount - Token amount to approve
	* @returns Re-encoded calldata with the approve transaction prepended as a batch
	*/
	static prependTokenPaymasterApproveToCallDataStatic(callData, tokenAddress, paymasterAddress, approveAmount) {
		const approveMetatransaction = {
			to: tokenAddress,
			value: 0n,
			data: createCallData(getFunctionSelector("approve(address,uint256)"), ["address", "uint256"], [paymasterAddress, approveAmount])
		};
		let decodedMetaTransactions;
		if (callData.startsWith(BaseSimple7702Account.batchExecutorFunctionSelector)) decodedMetaTransactions = decodeAbiParameters(BaseSimple7702Account.batchExecutorFunctionInputAbi, `0x${callData.slice(10)}`)[0].map((decodedParams) => ({
			to: decodedParams[0],
			value: BigInt(decodedParams[1]),
			data: typeof decodedParams[2] === "string" ? decodedParams[2] : hexlify(decodedParams[2])
		}));
		else if (callData.startsWith(BaseSimple7702Account.executorFunctionSelector)) {
			const decodedParams = decodeAbiParameters(BaseSimple7702Account.executorFunctionInputAbi, `0x${callData.slice(10)}`);
			decodedMetaTransactions = [{
				to: decodedParams[0],
				value: BigInt(decodedParams[1]),
				data: typeof decodedParams[2] === "string" ? decodedParams[2] : hexlify(decodedParams[2])
			}];
		} else throw new AbstractionKitError("BAD_DATA", "Invalid calldata, should start with " + BaseSimple7702Account.batchExecutorFunctionSelector + " or " + BaseSimple7702Account.executorFunctionSelector, { context: { callData } });
		decodedMetaTransactions.unshift(approveMetatransaction);
		return BaseSimple7702Account.createAccountCallDataBatchTransactions(decodedMetaTransactions);
	}
};
/**
* EIP-7702 simple smart account targeting EntryPoint v0.8
* (`0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`).
* Wraps {@link BaseSimple7702Account} with concrete types for
* {@link UserOperationV8} and sensible defaults for the delegatee address.
*/
var Simple7702Account = class Simple7702Account extends BaseSimple7702Account {
	static DEFAULT_DELEGATEE_ADDRESS = "0xe6Cae83BdE06E4c305530e199D7217f42808555B";
	/**
	* @param accountAddress - The EOA address that will be delegated via EIP-7702
	* @param overrides - Optional overrides for entrypoint and delegatee addresses
	* @param overrides.entrypointAddress - Custom EntryPoint address (defaults to EntryPoint v0.8)
	* @param overrides.delegateeAddress - Custom delegatee contract address
	*/
	constructor(accountAddress, overrides = {}) {
		super(accountAddress, overrides.entrypointAddress ?? "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108", overrides.delegateeAddress ?? Simple7702Account.DEFAULT_DELEGATEE_ADDRESS);
	}
	/**
	* Create a {@link UserOperationV8} for EntryPoint v0.8.
	* Determines nonce, fetches gas prices, estimates gas limits, and returns
	* an unsigned UserOperation. All auto-determined values can be overridden.
	* @param transactions - One or more transactions to encode into callData
	* @param providerRpc - JSON-RPC endpoint for nonce and gas price queries
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides for gas, nonce, and EIP-7702 auth fields
	* @returns A promise resolving to an unsigned {@link UserOperationV8}
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		return this.baseCreateUserOperation(transactions, providerRpc, bundlerRpc, overrides);
	}
	/**
	* Estimate gas limits for a {@link UserOperationV8}.
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides
	* @param overrides.stateOverrideSet - State overrides to apply during estimation
	* @param overrides.dummySignature - Custom dummy signature for estimation
	* @returns A promise resolving to `[preVerificationGas, verificationGasLimit, callGasLimit]`
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return this.baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides);
	}
	/**
	* Sign a {@link UserOperationV8} with an EOA private key.
	* Computes the UserOperation hash and produces an ECDSA signature.
	* @param useroperation - The UserOperation to sign
	* @param privateKey - Hex-encoded private key of the EOA signer
	* @param chainId - Target chain ID
	* @returns Hex-encoded ECDSA signature
	*/
	signUserOperation(useroperation, privateKey, chainId) {
		return this.baseSignUserOperation(useroperation, privateKey, chainId);
	}
	/**
	* Sign a {@link UserOperationV8} using an {@link ExternalSigner}. This is
	* the recommended entry point for any non-private-key signer.
	*
	* Accepts signers that implement `signTypedData` (JSON-RPC wallets, viem
	* `WalletClient`, browser wallets), `signHash` (local keys, hardware
	* wallets), or both. The v0.8 userOpHash IS the EIP-712 digest of the
	* PackedUserOperation under the EntryPoint domain, so both schemes
	* produce signatures that validate against the same `userOpHash`.
	*
	* Wrapping a custom signing primitive is just an object literal; no
	* adapter function required:
	*
	* ```ts
	* const signer: ExternalSigner = {
	*   address: ownerAddress,
	*   signTypedData: async (td) => myWallet.signTypedData(td),
	* }
	* userOp.signature = await account.signUserOperationWithSigner(userOp, signer, chainId)
	* ```
	*
	* For signing with a raw private-key string, use the sync
	* {@link signUserOperation} method, or wrap explicitly with
	* `fromPrivateKey(pk)`.
	*
	* @see {@link BaseSimple7702Account.getUserOperationEip712Data} for the
	*   lower-level escape hatch when you need the typed data outside the
	*   dispatcher (e.g., to render a custom confirmation UI or feed an HSM
	*   that doesn't fit the {@link ExternalSigner} shape).
	*/
	async signUserOperationWithSigner(useroperation, signer, chainId) {
		return this.baseSignUserOperationWithSigner(useroperation, signer, chainId);
	}
	/**
	* Send a signed {@link UserOperationV8} to a bundler for on-chain inclusion.
	* @param userOperation - The signed UserOperation to submit
	* @param bundlerRpc - Bundler RPC endpoint
	* @returns A {@link SendUseroperationResponse} that can be used to wait for inclusion
	*/
	async sendUserOperation(userOperation, bundlerRpc) {
		return this.baseSendUserOperation(userOperation, bundlerRpc);
	}
};
//#endregion
//#region src/account/simple/Simple7702AccountV09.ts
/**
* EIP-7702 simple smart account targeting EntryPoint v0.9
* (`0x433709009B8330FDa32311DF1C2AFA402eD8D009`).
* Extends {@link BaseSimple7702Account} with concrete types for
* {@link UserOperationV9} and sensible defaults for the delegatee address.
*/
var Simple7702AccountV09 = class Simple7702AccountV09 extends BaseSimple7702Account {
	static DEFAULT_DELEGATEE_ADDRESS = "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5";
	/**
	* Build the EIP-712 typed data payload for a {@link UserOperationV9}
	* under the EntryPoint v0.9 domain. See
	* {@link BaseSimple7702Account.getUserOperationEip712Data} for the
	* full semantics; this override just defaults `entrypointAddress` to v0.9.
	*/
	static getUserOperationEip712Data(userOperation, chainId, overrides = {}) {
		return BaseSimple7702Account.getUserOperationEip712Data(userOperation, chainId, { entrypointAddress: overrides.entrypointAddress ?? "0x433709009B8330FDa32311DF1C2AFA402eD8D009" });
	}
	/**
	* Compute the EIP-712 digest of a {@link UserOperationV9} under the
	* EntryPoint v0.9 domain. Defaults `entrypointAddress` to v0.9.
	*/
	static getUserOperationEip712Hash(userOperation, chainId, overrides = {}) {
		return BaseSimple7702Account.getUserOperationEip712Hash(userOperation, chainId, { entrypointAddress: overrides.entrypointAddress ?? "0x433709009B8330FDa32311DF1C2AFA402eD8D009" });
	}
	/**
	* @param accountAddress - The EOA address that will be delegated via EIP-7702
	* @param overrides - Optional overrides for entrypoint and delegatee addresses
	* @param overrides.entrypointAddress - Custom EntryPoint address (defaults to EntryPoint v0.9)
	* @param overrides.delegateeAddress - Custom delegatee contract address
	*/
	constructor(accountAddress, overrides = {}) {
		super(accountAddress, overrides.entrypointAddress ?? "0x433709009B8330FDa32311DF1C2AFA402eD8D009", overrides.delegateeAddress ?? Simple7702AccountV09.DEFAULT_DELEGATEE_ADDRESS);
	}
	/**
	* Create a {@link UserOperationV9} for EntryPoint v0.9.
	* Determines nonce, fetches gas prices, estimates gas limits, and returns
	* an unsigned UserOperation. All auto-determined values can be overridden.
	* @param transactions - One or more transactions to encode into callData
	* @param providerRpc - JSON-RPC endpoint for nonce and gas price queries
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides for gas, nonce, and EIP-7702 auth fields
	* @returns A promise resolving to an unsigned {@link UserOperationV9}
	*/
	async createUserOperation(transactions, providerRpc, bundlerRpc, overrides = {}) {
		return this.baseCreateUserOperation(transactions, providerRpc, bundlerRpc, overrides);
	}
	/**
	* Estimate gas limits for a {@link UserOperationV9}.
	* @param userOperation - The UserOperation to estimate gas for
	* @param bundlerRpc - Bundler RPC endpoint for gas estimation
	* @param overrides - Optional overrides
	* @param overrides.stateOverrideSet - State overrides to apply during estimation
	* @param overrides.dummySignature - Custom dummy signature for estimation
	* @returns A promise resolving to `[preVerificationGas, verificationGasLimit, callGasLimit]`
	*/
	async estimateUserOperationGas(userOperation, bundlerRpc, overrides = {}) {
		return this.baseEstimateUserOperationGas(userOperation, bundlerRpc, overrides);
	}
	/**
	* Sign a {@link UserOperationV9} with an EOA private key.
	* Computes the UserOperation hash and produces an ECDSA signature.
	* @param useroperation - The UserOperation to sign
	* @param privateKey - Hex-encoded private key of the EOA signer
	* @param chainId - Target chain ID
	* @returns Hex-encoded ECDSA signature
	*/
	signUserOperation(useroperation, privateKey, chainId) {
		return this.baseSignUserOperation(useroperation, privateKey, chainId);
	}
	/**
	* Sign a {@link UserOperationV9} using an {@link ExternalSigner}. This is
	* the recommended entry point for any non-private-key signer.
	*
	* Accepts signers that implement `signTypedData` (JSON-RPC wallets, viem
	* `WalletClient`, browser wallets), `signHash` (local keys, hardware
	* wallets), or both. The v0.9 userOpHash IS the EIP-712 digest of the
	* PackedUserOperation under the EntryPoint domain, so both schemes
	* produce signatures that validate against the same `userOpHash`.
	*
	* Wrapping a custom signing primitive is just an object literal; no
	* adapter function required:
	*
	* ```ts
	* const signer: ExternalSigner = {
	*   address: ownerAddress,
	*   signTypedData: async (td) => myWallet.signTypedData(td),
	* }
	* userOp.signature = await account.signUserOperationWithSigner(userOp, signer, chainId)
	* ```
	*
	* For signing with a raw private-key string, use the sync
	* {@link signUserOperation} method, or wrap explicitly with
	* `fromPrivateKey(pk)`.
	*
	* @see {@link BaseSimple7702Account.getUserOperationEip712Data} for the
	*   lower-level escape hatch when you need the typed data outside the
	*   dispatcher.
	*/
	async signUserOperationWithSigner(useroperation, signer, chainId) {
		return this.baseSignUserOperationWithSigner(useroperation, signer, chainId);
	}
	/**
	* Send a signed {@link UserOperationV9} to a bundler for on-chain inclusion.
	* @param userOperation - The signed UserOperation to submit
	* @param bundlerRpc - Bundler RPC endpoint
	* @returns A {@link SendUseroperationResponse} that can be used to wait for inclusion
	*/
	async sendUserOperation(userOperation, bundlerRpc) {
		return this.baseSendUserOperation(userOperation, bundlerRpc);
	}
};
//#endregion
//#region src/paymaster/Paymaster.ts
/**
* Abstract base class for all paymaster implementations.
* Subclasses provide specific logic for gas sponsorship or ERC-20 token gas payment.
*/
var Paymaster = class {};
/**
* Paymaster address carried by a set of paymaster fields: `paymaster` for
* v0.7+ shapes, or the first 20 bytes of `paymasterAndData` for v0.6.
* Works on a UserOperation as well as on a raw paymaster RPC response.
* Returns `null` when no paymaster is present.
*/
function extractPaymasterAddress(fields, isV6) {
	if (isV6) {
		const packed = fields.paymasterAndData;
		if (typeof packed !== "string" || packed.length < 42) return null;
		return packed.slice(0, 42);
	}
	return fields.paymaster ?? null;
}
/** Paymaster address carried by a UserOperation, or `null` when it has none. */
function getUserOperationPaymaster(userOp) {
	return extractPaymasterAddress(userOp, "initCode" in userOp);
}
/**
* Guard for the token paymaster flows. The ERC-20 `approve` is prepended to
* `callData` for `spender` before the paymaster RPC returns its final fields,
* so nothing else ties the two together: a response that finalizes with a
* different paymaster, or with none at all, would leave the caller signing an
* approval to an address the operation never pays. Throws in both cases.
*
* @param finalPaymaster - Paymaster named by the final response (or carried
*   by the finished operation), `null` when absent.
* @param spender - Address the approval was built for.
*/
function assertPaymasterMatchesApproveSpender(finalPaymaster, spender) {
	if (finalPaymaster == null || finalPaymaster.toLowerCase() !== spender.toLowerCase()) throw new AbstractionKitError("PAYMASTER_ERROR", `token paymaster mismatch: the ERC-20 approval was built for ${spender} but the final paymaster is ${finalPaymaster ?? "missing"}. Refusing to return an operation whose approval and paymaster disagree.`, { context: {
		approveSpender: spender,
		finalPaymaster
	} });
}
//#endregion
//#region src/paymaster/AllowAllPaymaster.ts
/**
* A paymaster that sponsors all UserOperations unconditionally.
* Uses a fixed magic signature that the on-chain paymaster contract accepts
* without additional validation.
* Supports ep v0.9 paymaster parallel signing.
*
* **WARNING: FOR DEVELOPMENT AND TESTING ONLY.**
* This paymaster accepts all operations without validation and should
* not be used in production environments. Use CandidePaymaster for prod.
*/
var ExperimentalAllowAllParallelPaymaster = class extends Paymaster {
	/** The on-chain paymaster contract address. */
	address;
	/**
	* @param address - Paymaster contract address. Defaults to the canonical AllowAll deployment.
	*/
	constructor(address = "0x36A337b8b4cE5CF6ca1dDaeef73Da4928d714DF2") {
		super();
		this.address = address;
	}
	/**
	* Returns initial paymaster fields (address, gas limits, and data) for
	* UserOperation construction before gas estimation.
	* @param chainId - The chain ID (unused, kept for interface compatibility)
	* @returns Paymaster fields with the magic signature as paymasterData
	*/
	async getPaymasterFieldsInitValues(_chainId) {
		return {
			paymaster: this.address,
			paymasterVerificationGasLimit: 45000n,
			paymasterPostOpGasLimit: 45000n,
			paymasterData: "0x010101010101010101010101010101010101010101010101010101010101011c002022e325a297439656"
		};
	}
	/**
	* getApprovedPaymasterData will return a valid paymasterData
	* This function is async to simulate a paymaster service
	* that requires an HTTP call to fetch approved data.
	* @param userOperation - User operation to be sponsored
	* @returns a promise of string
	*/
	async getApprovedPaymasterData(_userOperation) {
		return "0x7603fbcd3c6cebdb7193b716f62fe7e9d4afd859df4bf7fcdb2e9d486f57a1ca002022e325a297439656";
	}
};
//#endregion
//#region src/paymaster/decodeTokenQuote.ts
/** Known token paymaster deployments; the same address on every chain. */
const KNOWN_TOKEN_PAYMASTERS = {
	"0x36f4aa64673568782461bf03c75462f8ef0a1b76": { provider: "candide" },
	"0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba": { provider: "candide" },
	"0xa8151918eac3818deb713d3dbbb7930329fe86ed": { provider: "candide" },
	"0xca944fb73fa5191969014ded9bb075381d59c7de": {
		provider: "candide",
		hasTrustedBundlersFlag: true
	},
	"0x6666666666667849c56f2850848ce1c4da65c68b": { provider: "pimlico" },
	"0x777777777777aec03fd955926dbf81597e66834c": { provider: "pimlico" },
	"0x888888888888ec68a58ab8094cc1ad20ba3d2402": { provider: "pimlico" }
};
/** Candide paymaster post-operation gas overhead (`COST_OF_POST`). */
const CANDIDE_COST_OF_POST = 35000n;
/** Candide price markup denominator (`PRICE_DENOMINATOR`). */
const CANDIDE_PRICE_DENOMINATOR = 10n ** 26n;
/** Cursor over paymaster data hex (no 0x prefix). */
var ByteReader = class {
	offset = 0;
	constructor(hex, provider) {
		this.hex = hex;
		this.provider = provider;
	}
	read(length) {
		const end = this.offset + length * 2;
		if (end > this.hex.length) throw new AbstractionKitError("BAD_DATA", `${this.provider} paymaster data is truncated`, { context: { paymasterData: `0x${this.hex}` } });
		const value = this.hex.slice(this.offset, end);
		this.offset = end;
		return value;
	}
	uint(length) {
		return BigInt(`0x${this.read(length)}`);
	}
};
/**
* Paymaster data without the paymaster address (and, on v0.7+, without the
* packed paymaster gas limits), as the paymaster contract parses it.
*/
function paymasterDataHex(userOperation) {
	const hex = "initCode" in userOperation ? userOperation.paymasterAndData.slice(42) : (userOperation.paymasterData ?? "0x").replace(/^0x/, "");
	if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new AbstractionKitError("BAD_DATA", "paymaster data is not valid hex", { context: { paymasterData: `0x${hex}` } });
	return hex.toLowerCase();
}
/**
* Parse Candide paymaster data (CandidePaymaster06/07/08/09V4). Returns
* `null` for sponsored (FREE) mode.
*/
function parseCandide(hex, known, maxGasCost, maxFeePerGas) {
	const reader = new ByteReader(hex, "candide");
	const mode = Number(reader.uint(1));
	const markupMode = Number(reader.uint(1));
	if (known.hasTrustedBundlersFlag) reader.read(1);
	if (mode === 2) return null;
	if (mode !== 0) throw new AbstractionKitError("BAD_DATA", `unsupported Candide paymaster mode ${mode}`, { context: { mode } });
	const gasTokenSlot = Number(reader.uint(1));
	const validUntil = Number(reader.uint(6));
	const exchangeRate = reader.uint(32);
	let priceMarkup;
	if (markupMode === 0) priceMarkup = 0n;
	else if (markupMode === 1) priceMarkup = null;
	else if (markupMode === 2) priceMarkup = reader.uint(32);
	else throw new AbstractionKitError("BAD_DATA", `unsupported Candide paymaster markup mode ${markupMode}`, { context: { markupMode } });
	const maxCostWei = maxGasCost + CANDIDE_COST_OF_POST * maxFeePerGas;
	return {
		gasTokenSlot,
		exchangeRate,
		priceMarkup,
		maxCostWei,
		validUntil
	};
}
/**
* The most a Candide paymaster can charge, in token units. Like the
* contract, the markup applies only above zero; zero keeps the signed rate.
*/
function candideMaxTokenCost(parsed, priceMarkup) {
	const rate = priceMarkup > 0n ? parsed.exchangeRate * priceMarkup / CANDIDE_PRICE_DENOMINATOR : parsed.exchangeRate;
	const maxTokenCost = parsed.maxCostWei * rate / 10n ** 18n;
	return maxTokenCost === 0n ? 1n : maxTokenCost;
}
/**
* Parse Pimlico paymaster data (SingletonPaymasterV6/V7/V8). Returns `null`
* for verifying (sponsored) mode.
*/
function parsePimlico(hex, maxGasCost, maxFeePerGas) {
	const reader = new ByteReader(hex, "pimlico");
	const mode = Number(reader.uint(1)) >> 1;
	if (mode === 0) return null;
	if (mode !== 1) throw new AbstractionKitError("BAD_DATA", `unsupported Pimlico paymaster mode ${mode}`, { context: { mode } });
	const flags = Number(reader.uint(1));
	const validUntil = Number(reader.uint(6));
	const validAfter = Number(reader.uint(6));
	const token = `0x${reader.read(20)}`;
	const postOpGas = reader.uint(16);
	const exchangeRate = reader.uint(32);
	reader.read(16);
	reader.read(20);
	if (flags & 4) reader.read(16);
	const constantFee = flags & 1 ? reader.uint(16) : 0n;
	return {
		token,
		exchangeRate,
		maxTokenCost: (maxGasCost + postOpGas * maxFeePerGas) * exchangeRate / 10n ** 18n + constantFee,
		validUntil,
		validAfter
	};
}
/** `getTokens(uint8[])` on Candide's paymaster contracts. */
const CANDIDE_GET_TOKENS_SELECTOR = getFunctionSelector("getTokens(uint8[])");
/**
* Read a slot of a Candide paymaster's on-chain token table: the token the
* paymaster charges, and the markup it applies in on-chain markup mode.
*/
async function readCandideGasToken(nodeRpcUrl, paymaster, gasTokenSlot) {
	const result = await JsonRpcNode.from(nodeRpcUrl).call({
		to: paymaster,
		data: createCallData(CANDIDE_GET_TOKENS_SELECTOR, ["uint8[]"], [[gasTokenSlot]])
	});
	let token;
	let priceMarkup;
	try {
		const [gasTokens] = decodeAbiParameters(["(address,uint8,bytes,uint256,uint256)[]"], result);
		token = gasTokens[0][0];
		priceMarkup = BigInt(gasTokens[0][4]);
	} catch (err) {
		throw new AbstractionKitError("BAD_DATA", "paymaster getTokens returned ill formed data", {
			cause: ensureError(err),
			context: {
				paymaster,
				gasTokenSlot,
				result
			}
		});
	}
	if (/^0x0{40}$/i.test(token)) throw new AbstractionKitError("BAD_DATA", `Candide paymaster token slot ${gasTokenSlot} holds no token; the operation cannot be charged`, { context: {
		paymaster,
		gasTokenSlot
	} });
	return {
		token: getAddress(token.toLowerCase()),
		priceMarkup
	};
}
/**
* Implementation behind the public statics {@link Erc7677Paymaster.decodeTokenQuote}
* and {@link CandidePaymaster.decodeTokenQuote}.
*
* Read the token payment a finished UserOperation commits to from the
* paymaster data the paymaster signed: the exchange rate, the most it can
* charge, the validity window and the token. The only network use is one
* `eth_call` reading Candide's token (and, in on-chain markup mode, its
* markup) from the paymaster contract; for Pimlico `nodeRpcUrl` is not used.
* It reads nothing from `callData`, so it works for any account.
*
* Meant for co-signers who did not build the operation and so never saw its
* `TokenQuote`. Supports Candide's (EntryPoint v0.6 to v0.9) and Pimlico's
* (v0.6 to v0.8) token paymasters, identified by address.
*
* @param userOperation - The finished UserOperation
* @param nodeRpcUrl - Node RPC used to read Candide's token from its paymaster
*   contract (one `eth_call`); not used for Pimlico
* @param overrides - overrides for the default values
* @param overrides.paymasterAddresses - Additional paymaster deployments to
*   accept, keyed by address, for custom deployments that keep a known layout
* @returns The decoded quote, or `null` when the operation has no paymaster
*   or its paymaster sponsors it (no token payment)
* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the paymaster is
*   not a known deployment
* @throws AbstractionKitError with code "BAD_DATA" if the paymaster data is in
*   an unsupported mode, truncated, or not valid hex, or Candide's token slot
*   is empty
*/
async function decodeTokenQuote(userOperation, nodeRpcUrl, overrides = {}) {
	const paymaster = getUserOperationPaymaster(userOperation);
	if (paymaster == null || /^0x0*$/.test(paymaster)) return null;
	const customPaymasters = new Map(Object.entries(overrides.paymasterAddresses ?? {}).map(([address, known]) => [address.toLowerCase(), known]));
	const key = paymaster.toLowerCase();
	const known = !/^0x[0-9a-f]{40}$/.test(key) ? void 0 : customPaymasters.get(key) ?? (Object.prototype.hasOwnProperty.call(KNOWN_TOKEN_PAYMASTERS, key) ? KNOWN_TOKEN_PAYMASTERS[key] : void 0);
	if (known == null) throw new AbstractionKitError("PAYMASTER_ERROR", `paymaster ${paymaster} is not a known token paymaster; its data cannot be decoded. Pass overrides.paymasterAddresses for a custom deployment.`, { context: { paymaster } });
	const maxGasCost = calculateUserOperationMaxGasCost(userOperation);
	const hex = paymasterDataHex(userOperation);
	const checksummedPaymaster = getAddress(key);
	if (known.provider === "pimlico") {
		const parsed = parsePimlico(hex, maxGasCost, userOperation.maxFeePerGas);
		if (parsed == null) return null;
		return {
			provider: known.provider,
			paymaster: checksummedPaymaster,
			token: getAddress(parsed.token.toLowerCase()),
			exchangeRate: parsed.exchangeRate,
			maxTokenCost: parsed.maxTokenCost,
			validUntil: parsed.validUntil,
			validAfter: parsed.validAfter
		};
	}
	const parsed = parseCandide(hex, known, maxGasCost, userOperation.maxFeePerGas);
	if (parsed == null) return null;
	const gasToken = await readCandideGasToken(nodeRpcUrl, key, parsed.gasTokenSlot);
	return {
		provider: known.provider,
		paymaster: checksummedPaymaster,
		token: gasToken.token,
		exchangeRate: parsed.exchangeRate,
		maxTokenCost: candideMaxTokenCost(parsed, parsed.priceMarkup ?? gasToken.priceMarkup),
		validUntil: parsed.validUntil
	};
}
//#endregion
//#region src/paymaster/CandidePaymaster.ts
/** Buffer added to verificationGasLimit for paymasterAndData verification overhead */
const PAYMASTER_V06_VERIFICATION_OVERHEAD = 40000n;
/** Max value for uint256 */
const UINT256_MAX$1 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
/** Multiplier for token approve amount to cover paymasterAndData cost variance */
const TOKEN_APPROVE_AMOUNT_MULTIPLIER$1 = 2n;
/**
* ERC-20 tokens that require resetting their allowance to 0 before setting a
* new approval amount (e.g. USDT on mainnet).
* Addresses are stored lowercase for case-insensitive comparison.
*
* If you encounter a token with this behavior that is not listed here,
* please open an issue at https://github.com/candidelabs/abstractionkit/issues
* or use the `resetApproval` override as a workaround.
*/
const TOKENS_REQUIRING_ALLOWANCE_RESET$1 = ["0xdac17f958d2ee523a2206206994597c13d831ec7"];
/**
* Client for the Candide Paymaster service.
* Supports both gas sponsorship (sponsor paymaster) and ERC-20 token payment for gas (token paymaster).
* Auto-initializes on first use by fetching supported tokens and metadata from the paymaster RPC.
*
* Candide's paymaster endpoint follows the format:
* - `https://api.candide.dev/api/v3/{chainId}/{apiKey}` (authenticated)
* - `https://api.candide.dev/public/v3/{chainId}` (public, no key required)
*
* @example
* const paymaster = new CandidePaymaster("https://api.candide.dev/public/v3/11155111");
* const { userOperation: sponsoredOp } = await paymaster.createSponsorPaymasterUserOperation(userOp, bundlerRpcUrl);
*/
var CandidePaymaster = class CandidePaymaster extends Paymaster {
	/**
	* The raw transport the user passed in (or {@link HttpTransport} when a URL
	* string was passed). Exposed for introspection — reading `.url`,
	* `isHttpTransport(...)` checks, passing it back into another service.
	*
	* Calls made directly on this field (`paymaster.transport.request(...)`)
	* go to the raw transport and skip SDK-level behavior like bigint param
	* normalization. For SDK-pipeline behavior, use
	* {@link CandidePaymaster.request} or the typed methods.
	*/
	transport;
	/** Normalizing wrapper around {@link transport}, used for every SDK-outbound call. */
	outbound;
	/** Cached token/metadata per EntryPoint address (lowercase keys) */
	entrypointData = /* @__PURE__ */ new Map();
	/** Per-entrypoint initialization promises (lowercase keys) */
	initPromises = /* @__PURE__ */ new Map();
	/** Cached chain ID (hex string), resolved from URL or pm_chainId RPC */
	chainId = null;
	chainIdPromise = null;
	/**
	* @param rpc - The Candide paymaster JSON-RPC endpoint URL, or any {@link Transport}.
	*   When a URL string is passed, the chain id is inferred from the URL path
	*   when possible; otherwise it's resolved lazily via `pm_chainId`.
	*/
	constructor(rpc) {
		super();
		this.transport = typeof rpc === "string" ? new HttpTransport(rpc) : rpc;
		this.outbound = normalizingTransport(this.transport);
		this.chainId = typeof rpc === "string" ? CandidePaymaster.extractChainIdFromUrl(rpc) : null;
	}
	/**
	* Normalize any acceptable input into a `CandidePaymaster`. Returns the
	* input by reference when it's already a `CandidePaymaster`.
	*/
	static from(input) {
		return input instanceof CandidePaymaster ? input : new CandidePaymaster(input);
	}
	/**
	* Read the token payment a finished UserOperation commits to, entirely
	* offline, for co-signers who never saw its `TokenQuote`. Static: needs no
	* paymaster URL. Same as {@link Erc7677Paymaster.decodeTokenQuote}, which
	* documents the parameters, result and errors.
	*/
	static decodeTokenQuote(userOperation, nodeRpcUrl, overrides = {}) {
		return decodeTokenQuote(userOperation, nodeRpcUrl, overrides);
	}
	/**
	* Transport delegate. Forwards directly to {@link Transport.request}, so a
	* `CandidePaymaster` can be slotted into any other transport position.
	*/
	request(args, options) {
		return this.outbound.request(args, options);
	}
	/**
	* Extract chain ID from a Candide paymaster URL.
	* Matches: https://api.candide.dev/(api|public)/v{N}/{chainId}(/{apiKey})?
	*/
	static extractChainIdFromUrl(url) {
		const match = url.match(/api\.candide\.dev\/(?:api|public)\/v\d+\/(\d+)(?:\/|$)/);
		if (match) return `0x${BigInt(match[1]).toString(16)}`;
		return null;
	}
	/**
	* Get the chain ID, resolving it from the URL or via pm_chainId RPC.
	* Deduplicates concurrent calls.
	*/
	async getChainId() {
		if (this.chainId != null) return this.chainId;
		if (this.chainIdPromise == null) this.chainIdPromise = this.fetchChainId().then((id) => {
			this.chainId = id;
			return id;
		}).catch((err) => {
			this.chainIdPromise = null;
			throw err;
		});
		return this.chainIdPromise;
	}
	async fetchChainId() {
		try {
			return await this.outbound.request({ method: "pm_chainId" });
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "pm_chainId failed", { cause: ensureError(err) });
		}
	}
	/**
	* Determine the EntryPoint address from the UserOperation's shape.
	* V6 ops have `initCode`, V8 ops have `eip7702Auth`, V7 is the default.
	*/
	resolveEntrypoint(smartAccount, userOperation) {
		if (smartAccount.entrypointAddress != null && smartAccount.entrypointAddress.trim() !== "") return smartAccount.entrypointAddress;
		if ("initCode" in userOperation) return ENTRYPOINT_V6;
		else if ("eip7702Auth" in userOperation) return ENTRYPOINT_V8;
		else return ENTRYPOINT_V7;
	}
	/**
	* Get the cached entrypoint data for a given entrypoint address.
	*/
	getEntrypointData(entrypoint) {
		return this.entrypointData.get(entrypoint.toLowerCase());
	}
	static mapTokens(tokens) {
		return tokens.map((t) => ({
			name: t.name,
			symbol: t.symbol,
			address: t.address,
			decimals: Number(t.decimals)
		}));
	}
	static mapTokensWithExchangeRate(tokens) {
		return tokens.map((t) => ({
			name: t.name,
			symbol: t.symbol,
			address: t.address,
			decimals: Number(t.decimals),
			exchangeRate: BigInt(t.exchangeRate)
		}));
	}
	/**
	* Convert dummyPaymasterAndData gas fields from hex strings to bigint.
	* RPC returns these as hex strings, but our types expect bigint.
	*/
	static normalizePaymasterMetadata(metadata) {
		if (typeof metadata.dummyPaymasterAndData !== "string") return {
			...metadata,
			dummyPaymasterAndData: {
				...metadata.dummyPaymasterAndData,
				paymasterVerificationGasLimit: BigInt(metadata.dummyPaymasterAndData.paymasterVerificationGasLimit),
				paymasterPostOpGasLimit: BigInt(metadata.dummyPaymasterAndData.paymasterPostOpGasLimit)
			}
		};
		return metadata;
	}
	/**
	* Ensure the paymaster data for a specific entrypoint is initialized.
	* Deduplicates concurrent calls for the same entrypoint.
	* On failure, resets so the next call retries.
	*/
	ensureInitialized(entrypoint) {
		const key = entrypoint.toLowerCase();
		let promise = this.initPromises.get(key);
		if (promise == null) {
			promise = this.doInitialize(entrypoint).catch((err) => {
				this.initPromises.delete(key);
				throw err;
			});
			this.initPromises.set(key, promise);
		}
		return promise;
	}
	/**
	* Fetch and cache the paymaster's supported tokens and metadata for a specific entrypoint.
	*
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if initialization fails
	*/
	async doInitialize(entrypoint) {
		try {
			const data = await this.fetchAndTransformTokenData(entrypoint);
			if (data == null) throw new RangeError(`Invalid data received during initialization for entrypoint ${entrypoint}.`);
			this.entrypointData.set(entrypoint.toLowerCase(), data);
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "failed initializing the paymaster", { cause: ensureError(err) });
		}
	}
	/**
	* Fetch supported tokens and metadata for a specific entrypoint from the RPC
	* and transform the result into a normalized format. Used during initialization.
	*/
	async fetchAndTransformTokenData(entrypoint) {
		try {
			const result = await this.fetchSupportedTokensRpc(entrypoint);
			return {
				tokens: CandidePaymaster.mapTokens(result.tokens),
				paymasterMetadata: CandidePaymaster.normalizePaymasterMetadata(result.paymasterMetadata)
			};
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "fetchAndTransformTokenData failed", { cause: ensureError(err) });
		}
	}
	async fetchSupportedTokensRpc(entrypoint) {
		return await this.outbound.request({
			method: "pm_supportedERC20Tokens",
			params: [entrypoint]
		});
	}
	/**
	* Get the EntryPoint addresses supported by this paymaster.
	*
	* @returns Array of supported EntryPoint contract addresses
	*/
	async getSupportedEntrypoints() {
		try {
			return await this.outbound.request({ method: "pm_supportedEntryPoints" });
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "pm_supportedEntryPoints failed", { cause: ensureError(err) });
		}
	}
	/**
	* Get the paymaster contract metadata for a specific EntryPoint.
	* Auto-initializes if not yet initialized.
	*
	* @param entrypoint - Target EntryPoint address
	* @returns The paymaster metadata (name, address, icons, dummyPaymasterAndData, etc.)
	* @throws RangeError if the entrypoint is not supported
	*/
	async getPaymasterMetaData(entrypoint) {
		await this.ensureInitialized(entrypoint);
		const data = this.getEntrypointData(entrypoint);
		if (data == null) throw new RangeError("unsupported entrypoint.");
		return data.paymasterMetadata;
	}
	/**
	* Check if the token paymaster supports a given ERC-20 token for gas payment.
	*
	* @param erc20TokenAddress - The ERC-20 token contract address to check
	* @param entrypoint - Target EntryPoint address (default: ENTRYPOINT_V7)
	* @returns true if the token is supported, false otherwise
	*/
	async isSupportedERC20Token(erc20TokenAddress, entrypoint = ENTRYPOINT_V7) {
		return await this.getSupportedERC20TokenData(erc20TokenAddress, entrypoint) != null;
	}
	/**
	* Get the paymaster's data for a specific ERC-20 token.
	*
	* @param erc20TokenAddress - The ERC-20 token contract address
	* @param entrypoint - Target EntryPoint address (default: ENTRYPOINT_V7)
	* @returns The token data (name, symbol, address, decimals), or null if not supported
	* @throws RangeError if the entrypoint is not supported
	*/
	async getSupportedERC20TokenData(erc20TokenAddress, entrypoint = ENTRYPOINT_V7) {
		await this.ensureInitialized(entrypoint);
		const data = this.getEntrypointData(entrypoint);
		if (data == null) throw new RangeError("unsupported entrypoint.");
		const gasToken = data.tokens.find((token) => token.address.toLowerCase() === erc20TokenAddress.toLowerCase());
		if (!gasToken) return null;
		return {
			name: gasToken.name,
			symbol: gasToken.symbol,
			address: gasToken.address,
			decimals: Number(gasToken.decimals)
		};
	}
	setDummyPaymasterFields(userOp, epData) {
		const dummyPaymasterAndData = epData.paymasterMetadata.dummyPaymasterAndData;
		if ("initCode" in userOp) userOp.paymasterAndData = dummyPaymasterAndData;
		else {
			const structured = dummyPaymasterAndData;
			userOp.paymaster = structured.paymaster;
			userOp.paymasterVerificationGasLimit = structured.paymasterVerificationGasLimit;
			userOp.paymasterPostOpGasLimit = structured.paymasterPostOpGasLimit;
			userOp.paymasterData = structured.paymasterData;
		}
	}
	async estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides) {
		let preVerificationGas = userOp.preVerificationGas;
		let verificationGasLimit = userOp.verificationGasLimit;
		let callGasLimit = userOp.callGasLimit;
		if (overrides.preVerificationGas == null || overrides.verificationGasLimit == null || overrides.callGasLimit == null) {
			if (bundlerRpc == null) throw new AbstractionKitError("BAD_DATA", "bundlerRpc can't be null if preVerificationGas,verificationGasLimit and callGasLimit are not overridden");
			const bundler = Bundler.from(bundlerRpc);
			userOp.callGasLimit = 0n;
			userOp.verificationGasLimit = 0n;
			userOp.preVerificationGas = 0n;
			const inputMaxFeePerGas = userOp.maxFeePerGas;
			const inputMaxPriorityFeePerGas = userOp.maxPriorityFeePerGas;
			userOp.maxFeePerGas = 0n;
			userOp.maxPriorityFeePerGas = 0n;
			const estimation = await bundler.estimateUserOperationGas(userOp, entrypoint, overrides.state_override_set);
			if (preVerificationGas < estimation.preVerificationGas) preVerificationGas = estimation.preVerificationGas;
			if (verificationGasLimit < estimation.verificationGasLimit) verificationGasLimit = estimation.verificationGasLimit;
			if (callGasLimit < estimation.callGasLimit) callGasLimit = estimation.callGasLimit;
			userOp.maxFeePerGas = inputMaxFeePerGas;
			userOp.maxPriorityFeePerGas = inputMaxPriorityFeePerGas;
		}
		if (typeof overrides.preVerificationGas === "bigint" && overrides.preVerificationGas < 0n) throw new RangeError("preVerificationGas override can't be negative");
		if (typeof overrides.verificationGasLimit === "bigint" && overrides.verificationGasLimit < 0n) throw new RangeError("verificationGasLimit override can't be negative");
		if (typeof overrides.callGasLimit === "bigint" && overrides.callGasLimit < 0n) throw new RangeError("callGasLimit override can't be negative");
		const applyMultiplier = (value, multiplier) => value + value * BigInt(Math.round((multiplier ?? 0) * 100)) / 10000n;
		userOp.preVerificationGas = overrides.preVerificationGas ?? applyMultiplier(preVerificationGas, overrides.preVerificationGasPercentageMultiplier ?? 5);
		userOp.verificationGasLimit = overrides.verificationGasLimit ?? applyMultiplier(verificationGasLimit, overrides.verificationGasLimitPercentageMultiplier ?? 10);
		userOp.callGasLimit = overrides.callGasLimit ?? applyMultiplier(callGasLimit, overrides.callGasLimitPercentageMultiplier ?? 10);
		if (overrides.verificationGasLimit == null && entrypoint.toLowerCase() === "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()) userOp.verificationGasLimit += PAYMASTER_V06_VERIFICATION_OVERHEAD;
	}
	applyPaymasterResult(userOp, jsonRpcResult) {
		const result = jsonRpcResult;
		if ("initCode" in userOp) userOp.paymasterAndData = jsonRpcResult.paymasterAndData;
		else {
			const v7Result = jsonRpcResult;
			userOp.paymaster = v7Result.paymaster;
			userOp.paymasterVerificationGasLimit = BigInt(v7Result.paymasterVerificationGasLimit);
			userOp.paymasterPostOpGasLimit = BigInt(v7Result.paymasterPostOpGasLimit);
			userOp.paymasterData = v7Result.paymasterData;
		}
		if (result.sponsor?.name != null) {
			const { name, icon } = result.sponsor;
			return {
				name,
				description: "",
				url: "",
				icons: icon ? [icon] : []
			};
		}
	}
	async createPaymasterUserOperation(smartAccount, userOperation, context = {}, overrides = {}) {
		try {
			const entrypoint = overrides.entrypoint ?? this.resolveEntrypoint(smartAccount, userOperation);
			const chainId = await this.getChainId();
			const jsonRpcResult = await this.outbound.request({
				method: "pm_getPaymasterData",
				params: [
					userOperation,
					entrypoint,
					chainId,
					context
				]
			});
			return {
				userOperation,
				sponsorMetadata: this.applyPaymasterResult(userOperation, jsonRpcResult)
			};
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "pm_getPaymasterData failed", { cause: ensureError(err) });
		}
	}
	/**
	* Create a gas-sponsored UserOperation (no token payment required).
	*
	* @param smartAccount - The smart account instance
	* @param userOperation - The UserOperation to sponsor
	* @param bundlerRpc - Bundler RPC URL for gas estimation
	* @param sponsorshipPolicyId - Optional sponsorship policy ID
	* @param context - Optional additional context to pass to the paymaster RPC
	* @param overrides - Override gas limits and multipliers
	* @returns An object `{ userOperation, sponsorMetadata? }`
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if sponsorship fails
	*/
	async createSponsorPaymasterUserOperation(smartAccount, userOperation, bundlerRpc, sponsorshipPolicyId, context, overrides) {
		const userOp = { ...userOperation };
		context = {
			...context || {},
			...sponsorshipPolicyId !== void 0 ? { sponsorshipPolicyId } : {}
		};
		const entrypoint = overrides?.entrypoint ?? this.resolveEntrypoint(smartAccount, userOp);
		await this.ensureInitialized(entrypoint);
		const epData = this.getEntrypointData(entrypoint);
		if (epData == null) throw new RangeError(`UserOperation for entrypoint ${entrypoint} is not supported`);
		if (context.signingPhase !== "finalize") {
			this.setDummyPaymasterFields(userOp, epData);
			await this.estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides ?? {});
		}
		const _overrides = {
			...overrides || {},
			entrypoint
		};
		return await this.createPaymasterUserOperation(smartAccount, userOp, context, _overrides);
	}
	/**
	* Create a UserOperation that pays for gas with an ERC-20 token.
	* Automatically prepends a token approval to the calldata and sets paymaster fields.
	*
	* @param smartAccount - The smart account instance (must implement prependTokenPaymasterApproveToCallData)
	* @param userOperation - The UserOperation to modify for token payment
	* @param tokenAddress - The ERC-20 token contract address to pay gas with
	* @param bundlerRpc - Bundler RPC URL for gas estimation
	* @param context - Optional additional context to pass to the paymaster RPC
	* @param overrides - Override gas limits and multipliers
	* @returns An object `{ userOperation, tokenQuote? }`. `tokenQuote` is absent
	*   when called under the `finalize` signing phase (no cost recomputation).
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the token is not supported
	*/
	async createTokenPaymasterUserOperation(smartAccount, userOperation, tokenAddress, bundlerRpc, context, overrides) {
		try {
			const userOp = { ...userOperation };
			context = {
				...context || {},
				token: tokenAddress
			};
			if (!context.token || context.token.trim().length === 0 || !isAddress(context.token)) throw new RangeError(`Invalid token ${context.token ?? "undefined"}`);
			const entrypoint = overrides?.entrypoint ?? this.resolveEntrypoint(smartAccount, userOp);
			await this.ensureInitialized(entrypoint);
			let tokenQuote;
			if (context.signingPhase !== "finalize") {
				const epData = this.getEntrypointData(entrypoint);
				if (epData == null) throw new RangeError(`UserOperation for entrypoint ${entrypoint} is not supported`);
				this.setDummyPaymasterFields(userOp, epData);
				const oldCallData = userOp.callData;
				const requiresAllowanceReset = overrides?.resetApproval ?? TOKENS_REQUIRING_ALLOWANCE_RESET$1.includes(context.token.toLowerCase());
				let callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(userOp.callData, context.token, epData.paymasterMetadata.address, UINT256_MAX$1);
				if (requiresAllowanceReset) callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(callDataWithApprove, context.token, epData.paymasterMetadata.address, 0n);
				userOp.callData = callDataWithApprove;
				await this.estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides ?? {});
				const exchangeRate = await this.fetchTokenPaymasterExchangeRate(context.token, entrypoint);
				const tokenCost = calculateUserOperationErc20TokenCost(userOp, exchangeRate);
				const approveAmount = tokenCost * TOKEN_APPROVE_AMOUNT_MULTIPLIER$1;
				tokenQuote = {
					token: context.token,
					exchangeRate,
					tokenCost,
					paymaster: epData.paymasterMetadata.address,
					approveAmount
				};
				callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(oldCallData, context.token, epData.paymasterMetadata.address, approveAmount);
				if (requiresAllowanceReset) callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(callDataWithApprove, context.token, epData.paymasterMetadata.address, 0n);
				userOp.callData = callDataWithApprove;
			}
			const _overrides = {
				...overrides || {},
				entrypoint
			};
			const { userOperation: resultUserOp } = await this.createPaymasterUserOperation(smartAccount, userOp, context, _overrides);
			const epMetadata = this.getEntrypointData(entrypoint);
			if (epMetadata == null) throw new RangeError(`UserOperation for entrypoint ${entrypoint} is not supported`);
			assertPaymasterMatchesApproveSpender(getUserOperationPaymaster(resultUserOp), epMetadata.paymasterMetadata.address);
			return {
				userOperation: resultUserOp,
				tokenQuote
			};
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "createTokenPaymasterUserOperation failed", { cause: ensureError(err) });
		}
	}
	/**
	* Calculate the maximum ERC-20 token cost for a UserOperation's gas.
	* Uses the token's exchange rate from the paymaster to convert from wei.
	*
	* @param smartAccount - The smart account instance
	* @param userOperation - The UserOperation to calculate the cost for
	* @param erc20TokenAddress - The ERC-20 token contract address
	* @param overrides - Optional entrypoint override
	* @returns Maximum token cost as a bigint (in token's smallest unit)
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the token is not supported
	*/
	async calculateUserOperationErc20TokenMaxGasCost(smartAccount, userOperation, erc20TokenAddress, overrides = {}) {
		try {
			const entrypoint = overrides.entrypoint ?? this.resolveEntrypoint(smartAccount, userOperation);
			await this.ensureInitialized(entrypoint);
			return calculateUserOperationErc20TokenCost(userOperation, await this.fetchTokenPaymasterExchangeRate(erc20TokenAddress, entrypoint));
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "calculateUserOperationErc20TokenMaxGasCost failed", { cause: ensureError(err) });
		}
	}
	/**
	* Fetch the current exchange rate for an ERC-20 token from the paymaster.
	*
	* @param erc20TokenAddress - The ERC-20 token contract address
	* @param entrypoint - Target EntryPoint address (default: ENTRYPOINT_V7)
	* @returns The exchange rate as a bigint
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the token is not supported
	*/
	async fetchTokenPaymasterExchangeRate(erc20TokenAddress, entrypoint = ENTRYPOINT_V7) {
		try {
			await this.ensureInitialized(entrypoint);
			const jsonRpcResult = await this.fetchSupportedTokensRpc(entrypoint);
			const gasToken = jsonRpcResult.tokens.find((token) => token.address.toLowerCase() === erc20TokenAddress.toLowerCase());
			if (!gasToken) throw new AbstractionKitError("PAYMASTER_ERROR", `${erc20TokenAddress} token is not supported by the paymaster.`, { context: {
				entrypoint,
				supportedTokens: jsonRpcResult.tokens.map((t) => t.address)
			} });
			const exchangeRate = BigInt(gasToken.exchangeRate);
			if (exchangeRate <= 0n) throw new AbstractionKitError("PAYMASTER_ERROR", `pm_supportedERC20Tokens returned a non-positive exchangeRate for token ${erc20TokenAddress} (got ${exchangeRate})`);
			return exchangeRate;
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "fetchTokenPaymasterExchangeRate failed", { cause: ensureError(err) });
		}
	}
	/**
	* Fetch fresh supported ERC-20 tokens with exchange rates and paymaster metadata.
	* Unlike the cached version, this always makes an RPC call.
	*
	* @param entrypoint - Target EntryPoint address (default: ENTRYPOINT_V7)
	* @returns Supported tokens with exchange rates and paymaster metadata
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the call fails
	*/
	async fetchSupportedERC20TokensAndPaymasterMetadata(entrypoint = ENTRYPOINT_V7) {
		try {
			await this.ensureInitialized(entrypoint);
			if (this.getEntrypointData(entrypoint) == null) throw new RangeError("unsupported entrypoint.");
			const result = await this.fetchSupportedTokensRpc(entrypoint);
			return {
				tokens: CandidePaymaster.mapTokensWithExchangeRate(result.tokens),
				paymasterMetadata: CandidePaymaster.normalizePaymasterMetadata(result.paymasterMetadata)
			};
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "fetchSupportedERC20TokensAndPaymasterMetadata failed", { cause: ensureError(err) });
		}
	}
};
//#endregion
//#region src/paymaster/Erc7677Paymaster.ts
/** Max value for uint256 */
const UINT256_MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
/** Multiplier for token approve amount to cover paymasterAndData cost variance */
const TOKEN_APPROVE_AMOUNT_MULTIPLIER = 2n;
/**
* ERC-20 tokens that require resetting their allowance to 0 before setting a
* new approval amount (e.g. USDT on mainnet).
*/
const TOKENS_REQUIRING_ALLOWANCE_RESET = ["0xdac17f958d2ee523a2206206994597c13d831ec7"];
/**
* Time-to-live for cached Candide `pm_supportedERC20Tokens` responses, applied
* only when the fetch is initiated for an exchange-rate lookup. Stub-data
* lookups (paymaster address + dummyPaymasterAndData) reuse the cache
* indefinitely since those fields are effectively static per EP.
*/
const CANDIDE_TOKEN_QUOTE_TTL_MS = 45e3;
/**
* Parse a raw exchange-rate value (bigint or hex/decimal string) into a
* positive bigint. Returns `null` if the value is missing, unparseable, or
* `<= 0` — callers throw with their own RPC-method-specific error context.
*/
function parsePositiveExchangeRate(raw) {
	if (raw == null) return null;
	let value;
	try {
		value = BigInt(raw);
	} catch {
		return null;
	}
	return value > 0n ? value : null;
}
var Erc7677Paymaster = class Erc7677Paymaster extends Paymaster {
	/**
	* The raw transport the user passed in (or {@link HttpTransport} when a URL
	* string was passed). Exposed for introspection — reading `.url`,
	* `isHttpTransport(...)` checks, passing it back into another service.
	*
	* Calls made directly on this field (`paymaster.transport.request(...)`)
	* go to the raw transport and skip SDK-level behavior like bigint param
	* normalization. For SDK-pipeline behavior, use
	* {@link Erc7677Paymaster.request} or the typed methods.
	*/
	transport;
	/** Normalizing wrapper around {@link transport}, used for every SDK-outbound call. */
	outbound;
	/** Cached chain ID (hex string). Passed via constructor or resolved from the bundler at first use. */
	chainId;
	/** Detected or explicitly set paymaster provider. `null` means no provider-specific features. */
	provider;
	/**
	* Cached Candide `pm_supportedERC20Tokens` response, keyed by lowercase
	* entrypoint. Used for both token quotes and stub data to avoid a second
	* round-trip (`pm_getPaymasterStubData`) for Candide-hosted paymasters.
	*
	* The cache is indefinite for stub-data lookups but has a TTL for
	* exchange-rate lookups — see {@link CANDIDE_TOKEN_QUOTE_TTL_MS}.
	*/
	candideCache = /* @__PURE__ */ new Map();
	/**
	* Detect the paymaster provider from the RPC URL hostname.
	* Returns `null` for unknown hosts or malformed URLs.
	*
	* Hostname-based (not substring) so that proxies or paths containing a
	* provider name (e.g. `https://my-proxy.com/pimlico-compat/...`) are not
	* misidentified.
	*/
	static detectProvider(rpcUrl) {
		let host;
		try {
			host = new URL(rpcUrl).hostname.toLowerCase();
		} catch {
			return null;
		}
		if (host === "pimlico.io" || host.endsWith(".pimlico.io")) return "pimlico";
		if (host === "candide.dev" || host.endsWith(".candide.dev")) return "candide";
		return null;
	}
	/**
	* @param rpc - Paymaster JSON-RPC endpoint URL, or any {@link Transport}.
	*   Can be the same URL as the bundler when the provider bundles both
	*   (Candide, Pimlico, Alchemy); can also be a separate paymaster-only
	*   endpoint, or a fully custom transport.
	* @param options
	* @param options.chainId - Optional chain id as a bigint (e.g. `1n` for
	*   mainnet). When provided, avoids a lookup at first use. Otherwise,
	*   resolved from the bundler via `eth_chainId` on the first call.
	* @param options.provider - Paymaster provider. `"auto"` (default) detects
	*   from the RPC URL (only when a URL string is passed; non-string inputs
	*   default to `null` unless overridden here). Set explicitly to override,
	*   or `null` to disable provider-specific features.
	*/
	constructor(rpc, options = {}) {
		super();
		this.transport = typeof rpc === "string" ? new HttpTransport(rpc) : rpc;
		this.outbound = normalizingTransport(this.transport);
		this.chainId = options.chainId != null ? `0x${options.chainId.toString(16)}` : null;
		if (options.provider === void 0 || options.provider === "auto") this.provider = typeof rpc === "string" ? Erc7677Paymaster.detectProvider(rpc) : null;
		else this.provider = options.provider;
	}
	/**
	* Normalize any acceptable input into an `Erc7677Paymaster`. Returns the
	* input by reference when it's already an `Erc7677Paymaster` (in which
	* case the second `options` argument is ignored — the existing instance's
	* configuration is preserved).
	*/
	static from(input, options) {
		return input instanceof Erc7677Paymaster ? input : new Erc7677Paymaster(input, options);
	}
	/**
	* Read the token payment a finished UserOperation commits to from the
	* paymaster data the paymaster signed: the exchange rate, `maxTokenCost`
	* (the most it can charge), the validity window and the token. The only
	* network use is one `eth_call` reading Candide's token (and, in on-chain
	* markup mode, its markup) from its paymaster contract; for Pimlico
	* `nodeRpcUrl` is not used.
	*
	* Meant for co-signers who did not build the operation and so never saw its
	* `TokenQuote`. Supports Candide's (EntryPoint v0.6 to v0.9) and Pimlico's
	* (v0.6 to v0.8) token paymasters, identified by the paymaster address on
	* the operation, whichever paymaster class built it. It reads nothing from
	* `callData`, so it works for any account. Static: needs no paymaster URL.
	* Same as {@link CandidePaymaster.decodeTokenQuote}.
	*
	* @param userOperation - The finished UserOperation
	* @param nodeRpcUrl - Node RPC used to read Candide's token from its
	*   paymaster contract (one `eth_call`); not used for Pimlico, whose
	*   paymaster data carries the token
	* @param overrides - overrides for the default values
	* @param overrides.paymasterAddresses - Additional paymaster deployments to
	*   accept, keyed by address, for custom deployments that keep a known layout
	* @returns The decoded quote, or `null` when the operation has no paymaster
	*   or its paymaster sponsors it (no token payment)
	* @throws AbstractionKitError with code "PAYMASTER_ERROR" if the paymaster is
	*   not a known deployment
	* @throws AbstractionKitError with code "BAD_DATA" if the paymaster data is in
	*   an unsupported mode, truncated, or not valid hex, or Candide's token slot
	*   is empty
	*/
	static decodeTokenQuote(userOperation, nodeRpcUrl, overrides = {}) {
		return decodeTokenQuote(userOperation, nodeRpcUrl, overrides);
	}
	/**
	* Transport delegate. Forwards directly to {@link Transport.request}, so
	* an `Erc7677Paymaster` can be slotted into any other transport position.
	*/
	request(args, options) {
		return this.outbound.request(args, options);
	}
	/**
	* Resolve the chain id, querying the bundler if not provided at construction.
	*/
	async getChainId(bundlerRpc) {
		if (this.chainId != null) return this.chainId;
		const id = await Bundler.from(bundlerRpc).chainId();
		this.chainId = id;
		return id;
	}
	/**
	* Determine the EntryPoint address from the UserOperation shape.
	* V6 ops have `initCode`, V8+ ops have `eip7702Auth`, V7 is the default.
	*/
	resolveEntrypoint(smartAccount, userOperation) {
		if (smartAccount.entrypointAddress != null && smartAccount.entrypointAddress.trim() !== "") return smartAccount.entrypointAddress;
		if ("initCode" in userOperation) return ENTRYPOINT_V6;
		if ("eip7702Auth" in userOperation) return ENTRYPOINT_V8;
		return ENTRYPOINT_V7;
	}
	/**
	* Low-level ERC-7677 `pm_getPaymasterStubData` call.
	* Returns dummy paymaster fields intended for gas estimation.
	*
	* Most consumers should prefer {@link createPaymasterUserOperation}, which
	* runs the full stub → estimate → final pipeline. Use this directly if you
	* need to drive the flow manually.
	*/
	async getPaymasterStubData(userOperation, entrypoint, chainIdHex, context = {}) {
		try {
			return await this.outbound.request({
				method: "pm_getPaymasterStubData",
				params: [
					userOperation,
					entrypoint,
					chainIdHex,
					context
				]
			});
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "pm_getPaymasterStubData failed", { cause: ensureError(err) });
		}
	}
	/**
	* Low-level ERC-7677 `pm_getPaymasterData` call.
	* Returns the final signed paymaster fields.
	*/
	async getPaymasterData(userOperation, entrypoint, chainIdHex, context = {}) {
		try {
			return await this.outbound.request({
				method: "pm_getPaymasterData",
				params: [
					userOperation,
					entrypoint,
					chainIdHex,
					context
				]
			});
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", "pm_getPaymasterData failed", { cause: ensureError(err) });
		}
	}
	/**
	* Send an arbitrary JSON-RPC request through the paymaster endpoint.
	* Useful for provider-specific methods that fall outside the ERC-7677 spec.
	*
	* @param method - The JSON-RPC method name
	* @param params - The JSON-RPC params array
	* @returns The `result` field from the JSON-RPC response
	*/
	async sendRPCRequest(method, params = []) {
		try {
			return await this.outbound.request({
				method,
				params
			});
		} catch (err) {
			throw new AbstractionKitError("PAYMASTER_ERROR", `sendRPCRequest(${method}) failed`, { cause: ensureError(err) });
		}
	}
	/**
	* Runs the full ERC-7677 pipeline and returns a UserOperation with paymaster
	* fields populated. The caller is responsible for signing and sending.
	*
	* @param smartAccount - Provides the target EntryPoint; not mutated.
	* @param userOperation - Starting UserOperation. Not mutated — a shallow copy is returned.
	* @param bundlerRpc - Bundler URL used for gas estimation and, if
	*   `options.chainId` was not provided to the constructor, chain-id lookup.
	* @param context - Provider-specific paymaster context
	*   (e.g. `{ sponsorshipPolicyId }` or `{ token }`).
	* @param overrides - Gas estimation overrides and state-override set.
	*
	* @returns An object `{ userOperation, tokenQuote? }`. `tokenQuote` is only
	*   populated when the token-payment flow is taken (`context.token` set).
	*/
	async createPaymasterUserOperation(smartAccount, userOperation, bundlerRpc, context = {}, overrides = {}) {
		try {
			const userOp = { ...userOperation };
			const entrypoint = overrides.entrypoint ?? this.resolveEntrypoint(smartAccount, userOp);
			const chainIdHex = await this.getChainId(bundlerRpc);
			if (context.token != null && typeof context.token === "string") return this.tokenPaymasterFlow(smartAccount, userOp, context.token, bundlerRpc, entrypoint, chainIdHex, context, overrides);
			return this.sponsoredFlow(userOp, bundlerRpc, entrypoint, chainIdHex, context, overrides);
		} catch (err) {
			const error = ensureError(err);
			if (error instanceof AbstractionKitError) throw error;
			throw new AbstractionKitError("PAYMASTER_ERROR", "createPaymasterUserOperation failed", { cause: error });
		}
	}
	/**
	* Merge paymaster fields into a UserOperation. Handles both v0.6
	* (`paymasterAndData`) and v0.7+ split fields.
	*/
	applyPaymasterFields(userOp, fields) {
		if ("initCode" in userOp) {
			if (fields.paymasterAndData != null) userOp.paymasterAndData = fields.paymasterAndData;
			return;
		}
		if (fields.paymaster != null) userOp.paymaster = fields.paymaster;
		if (fields.paymasterData != null) userOp.paymasterData = fields.paymasterData;
		if (fields.paymasterVerificationGasLimit != null) userOp.paymasterVerificationGasLimit = BigInt(fields.paymasterVerificationGasLimit);
		if (fields.paymasterPostOpGasLimit != null) userOp.paymasterPostOpGasLimit = BigInt(fields.paymasterPostOpGasLimit);
	}
	/**
	* Estimate gas limits via the bundler and apply them (with multipliers).
	* Reads paymaster gas fields back from the bundler when present — some
	* providers' `pm_getPaymasterStubData` returns `paymasterPostOpGasLimit: 0x1`
	* as a placeholder, relying on the bundler's estimate for the real value.
	*
	* Mirrors CandidePaymaster.estimateAndApplyGasLimits default multipliers
	* (5%/10%/10% on preVerification/verification/call) for consistent UX.
	*/
	async estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides) {
		let preVerificationGas = userOp.preVerificationGas;
		let verificationGasLimit = userOp.verificationGasLimit;
		let callGasLimit = userOp.callGasLimit;
		if (overrides.preVerificationGas == null || overrides.verificationGasLimit == null || overrides.callGasLimit == null) {
			if (bundlerRpc == null) throw new AbstractionKitError("BAD_DATA", "bundlerRpc can't be null if preVerificationGas, verificationGasLimit and callGasLimit are not overridden");
			const bundler = Bundler.from(bundlerRpc);
			userOp.callGasLimit = 0n;
			userOp.verificationGasLimit = 0n;
			userOp.preVerificationGas = 0n;
			const skipFeeZeroing = this.provider === "pimlico";
			const inputMaxFeePerGas = userOp.maxFeePerGas;
			const inputMaxPriorityFeePerGas = userOp.maxPriorityFeePerGas;
			if (!skipFeeZeroing) {
				userOp.maxFeePerGas = 0n;
				userOp.maxPriorityFeePerGas = 0n;
			}
			const estimation = await bundler.estimateUserOperationGas(userOp, entrypoint, overrides.state_override_set);
			if (!skipFeeZeroing) {
				userOp.maxFeePerGas = inputMaxFeePerGas;
				userOp.maxPriorityFeePerGas = inputMaxPriorityFeePerGas;
			}
			if (estimation.preVerificationGas > preVerificationGas) preVerificationGas = estimation.preVerificationGas;
			if (estimation.verificationGasLimit > verificationGasLimit) verificationGasLimit = estimation.verificationGasLimit;
			if (estimation.callGasLimit > callGasLimit) callGasLimit = estimation.callGasLimit;
			if ("paymaster" in userOp && estimation.paymasterVerificationGasLimit != null) userOp.paymasterVerificationGasLimit = estimation.paymasterVerificationGasLimit;
			if ("paymaster" in userOp && estimation.paymasterPostOpGasLimit != null) userOp.paymasterPostOpGasLimit = estimation.paymasterPostOpGasLimit;
		}
		if (typeof overrides.preVerificationGas === "bigint" && overrides.preVerificationGas < 0n) throw new RangeError("preVerificationGas override can't be negative");
		if (typeof overrides.verificationGasLimit === "bigint" && overrides.verificationGasLimit < 0n) throw new RangeError("verificationGasLimit override can't be negative");
		if (typeof overrides.callGasLimit === "bigint" && overrides.callGasLimit < 0n) throw new RangeError("callGasLimit override can't be negative");
		const applyMultiplier = (value, multiplier) => value + value * BigInt(Math.round((multiplier ?? 0) * 100)) / 10000n;
		userOp.preVerificationGas = overrides.preVerificationGas ?? applyMultiplier(preVerificationGas, overrides.preVerificationGasPercentageMultiplier ?? 5);
		userOp.verificationGasLimit = overrides.verificationGasLimit ?? applyMultiplier(verificationGasLimit, overrides.verificationGasLimitPercentageMultiplier ?? 10);
		userOp.callGasLimit = overrides.callGasLimit ?? applyMultiplier(callGasLimit, overrides.callGasLimitPercentageMultiplier ?? 10);
		if (overrides.verificationGasLimit == null && entrypoint.toLowerCase() === "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()) userOp.verificationGasLimit += 40000n;
	}
	/**
	* Fetch token exchange rate and paymaster address via Pimlico's
	* `pimlico_getTokenQuotes` RPC.
	*
	* @returns `exchangeRate` as a bigint: the count of token smallest-units
	*   equivalent to 1 ETH (10^18 wei). E.g. for USDC ($1, 6 decimals) at
	*   $3000/ETH this is `3000 * 10^6 = 3e9`. Used to compute the token
	*   approval amount via `(exchangeRate * gasCostWei) / 10^18`, floored to
	*   a minimum of 1 token smallest-unit (see
	*   {@link Erc7677Paymaster.tokenFlow}).
	*/
	async fetchPimlicoTokenQuote(tokenAddress, entrypoint, chainIdHex) {
		const quotes = (await this.outbound.request({
			method: "pimlico_getTokenQuotes",
			params: [
				{ tokens: [tokenAddress] },
				entrypoint,
				chainIdHex
			]
		}))?.quotes;
		if (!Array.isArray(quotes) || quotes.length === 0) throw new AbstractionKitError("PAYMASTER_ERROR", `pimlico_getTokenQuotes returned no quotes for token ${tokenAddress}`);
		const quote = quotes.find((q) => q.token.toLowerCase() === tokenAddress.toLowerCase());
		if (quote == null) throw new AbstractionKitError("PAYMASTER_ERROR", `pimlico_getTokenQuotes did not include token ${tokenAddress}`);
		const exchangeRate = parsePositiveExchangeRate(quote.exchangeRate);
		if (exchangeRate == null) throw new AbstractionKitError("PAYMASTER_ERROR", `pimlico_getTokenQuotes returned a non-positive exchangeRate for token ${tokenAddress} (got ${String(quote.exchangeRate)})`);
		return {
			exchangeRate,
			paymasterAddress: quote.paymaster
		};
	}
	/**
	* Fetch (and cache) Candide's `pm_supportedERC20Tokens` response for the
	* given entrypoint. The response carries both exchange rates and the
	* `dummyPaymasterAndData` used for gas estimation, so one round-trip
	* suffices for the entire paymaster flow.
	*
	* @param options.enforceTTL - When true, re-fetches if the cached entry is
	*   older than {@link CANDIDE_TOKEN_QUOTE_TTL_MS}. Set by exchange-rate
	*   lookups (where staleness matters). Stub-data lookups leave this false
	*   and reuse the cache indefinitely — the paymaster address and
	*   `dummyPaymasterAndData` are effectively static per paymaster version.
	*/
	async fetchCandideSupportedTokens(entrypoint, options = {}) {
		const key = entrypoint.toLowerCase();
		const cached = this.candideCache.get(key);
		const isStale = cached != null && options.enforceTTL === true && Date.now() - cached.fetchedAt > CANDIDE_TOKEN_QUOTE_TTL_MS;
		if (cached != null && !isStale) return cached.data;
		const result = await this.outbound.request({
			method: "pm_supportedERC20Tokens",
			params: [entrypoint]
		});
		this.candideCache.set(key, {
			data: result,
			fetchedAt: Date.now()
		});
		return result;
	}
	/**
	* Fetch token exchange rate and paymaster address via Candide's
	* `pm_supportedERC20Tokens` RPC.
	*
	* @returns `exchangeRate` as a bigint: the count of token smallest-units
	*   equivalent to 1 ETH (10^18 wei). E.g. for USDC ($1, 6 decimals) at
	*   $3000/ETH this is `3000 * 10^6 = 3e9`. Used to compute the token
	*   approval amount via `(exchangeRate * gasCostWei) / 10^18`, floored to
	*   a minimum of 1 token smallest-unit (see
	*   {@link Erc7677Paymaster.tokenFlow}).
	*/
	async fetchCandideTokenQuote(tokenAddress, entrypoint) {
		const result = await this.fetchCandideSupportedTokens(entrypoint, { enforceTTL: true });
		const token = result.tokens?.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase());
		if (token == null) throw new AbstractionKitError("PAYMASTER_ERROR", `${tokenAddress} token is not supported by the Candide paymaster`);
		const exchangeRate = parsePositiveExchangeRate(token.exchangeRate);
		if (exchangeRate == null) throw new AbstractionKitError("PAYMASTER_ERROR", `pm_supportedERC20Tokens returned a non-positive exchangeRate for token ${tokenAddress} (got ${String(token.exchangeRate)})`);
		return {
			exchangeRate,
			paymasterAddress: result.paymasterMetadata.address
		};
	}
	/**
	* Convert Candide's `dummyPaymasterAndData` metadata into a stub result
	* compatible with {@link applyPaymasterFields}. Handles both v0.6
	* (concatenated hex string) and v0.7+ (structured) shapes.
	*/
	candideStubFromMetadata(metadata) {
		const dummy = metadata.dummyPaymasterAndData;
		if (typeof dummy === "string") return { paymasterAndData: dummy };
		return {
			paymaster: dummy.paymaster,
			paymasterData: dummy.paymasterData,
			paymasterVerificationGasLimit: dummy.paymasterVerificationGasLimit,
			paymasterPostOpGasLimit: dummy.paymasterPostOpGasLimit
		};
	}
	/**
	* Get stub paymaster data. For Candide-hosted paymasters this derives the
	* stub from the cached `pm_supportedERC20Tokens` response (no extra
	* round-trip). For other providers, falls back to `pm_getPaymasterStubData`.
	*/
	async getStubData(userOperation, entrypoint, chainIdHex, context) {
		if (this.provider === "candide") {
			const response = await this.fetchCandideSupportedTokens(entrypoint);
			return this.candideStubFromMetadata(response.paymasterMetadata);
		}
		return this.getPaymasterStubData(userOperation, entrypoint, chainIdHex, context);
	}
	/**
	* Route to the correct provider-specific token quote fetcher.
	* Returns `null` when no provider is configured.
	*/
	async fetchProviderTokenQuote(tokenAddress, entrypoint, chainIdHex) {
		switch (this.provider) {
			case "pimlico": return this.fetchPimlicoTokenQuote(tokenAddress, entrypoint, chainIdHex);
			case "candide": return this.fetchCandideTokenQuote(tokenAddress, entrypoint);
			default: return null;
		}
	}
	/**
	* Internal token paymaster pipeline. Called from `createPaymasterUserOperation`
	* when `context.token` is set and the smart account supports approval prepending.
	*
	* Three cases:
	* - **Provider detected**: exchange rate + paymaster address from provider RPC.
	* - **No provider, `context.exchangeRate` set**: uses provided rate, paymaster
	*   address from stub.
	* - **No provider, no rate**: falls through to the regular sponsored flow
	*   (developer already handled approval).
	*/
	async tokenPaymasterFlow(smartAccount, userOp, tokenAddress, bundlerRpc, entrypoint, chainIdHex, context, overrides) {
		if (this.provider == null && context.exchangeRate == null) return this.sponsoredFlow(userOp, bundlerRpc, entrypoint, chainIdHex, context, overrides);
		if (typeof smartAccount.prependTokenPaymasterApproveToCallData !== "function") throw new AbstractionKitError("PAYMASTER_ERROR", "context.token is set but this smart account does not implement prependTokenPaymasterApproveToCallData, which the token paymaster flow requires to prepend the ERC-20 approval.");
		let exchangeRate;
		let paymasterAddress = null;
		const providerQuote = await this.fetchProviderTokenQuote(tokenAddress, entrypoint, chainIdHex);
		if (providerQuote != null) {
			exchangeRate = providerQuote.exchangeRate;
			paymasterAddress = providerQuote.paymasterAddress;
			if (typeof context.paymasterAddress === "string" && context.paymasterAddress.toLowerCase() !== paymasterAddress.toLowerCase()) throw new AbstractionKitError("PAYMASTER_ERROR", `token paymaster mismatch: context.paymasterAddress is ${context.paymasterAddress} but the provider quote names ${paymasterAddress} as the paymaster. Refusing to build an ERC-20 approval for an unexpected spender.`, { context: {
				expectedPaymaster: context.paymasterAddress,
				quotedPaymaster: paymasterAddress
			} });
		} else if (context.exchangeRate != null) {
			try {
				exchangeRate = BigInt(context.exchangeRate);
			} catch (err) {
				throw new AbstractionKitError("PAYMASTER_ERROR", `context.exchangeRate could not be parsed as a bigint: ${String(context.exchangeRate)}`, { cause: ensureError(err) });
			}
			if (exchangeRate <= 0n) throw new AbstractionKitError("PAYMASTER_ERROR", `context.exchangeRate must be > 0, got ${exchangeRate}`);
		} else return this.sponsoredFlow(userOp, bundlerRpc, entrypoint, chainIdHex, context, overrides);
		const stub = await this.getStubData(userOp, entrypoint, chainIdHex, context);
		this.applyPaymasterFields(userOp, stub);
		if (paymasterAddress == null) if (context.paymasterAddress != null) paymasterAddress = context.paymasterAddress;
		else if ("initCode" in userOp && stub.paymasterAndData != null) paymasterAddress = `0x${stub.paymasterAndData.slice(2, 42)}`;
		else if (stub.paymaster != null) paymasterAddress = stub.paymaster;
		else throw new AbstractionKitError("PAYMASTER_ERROR", "pm_getPaymasterStubData did not return a paymaster address. Pass paymasterAddress in the context or set a provider.");
		const originalCallData = userOp.callData;
		const requiresAllowanceReset = overrides.resetApproval ?? TOKENS_REQUIRING_ALLOWANCE_RESET.includes(tokenAddress.toLowerCase());
		let callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(userOp.callData, tokenAddress, paymasterAddress, UINT256_MAX);
		if (requiresAllowanceReset) callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(callDataWithApprove, tokenAddress, paymasterAddress, 0n);
		userOp.callData = callDataWithApprove;
		await this.estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides);
		const tokenCost = calculateUserOperationErc20TokenCost(userOp, exchangeRate);
		const approveAmount = tokenCost * TOKEN_APPROVE_AMOUNT_MULTIPLIER;
		const tokenQuote = {
			token: tokenAddress,
			exchangeRate,
			tokenCost,
			paymaster: paymasterAddress,
			approveAmount
		};
		callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(originalCallData, tokenAddress, paymasterAddress, approveAmount);
		if (requiresAllowanceReset) callDataWithApprove = smartAccount.prependTokenPaymasterApproveToCallData(callDataWithApprove, tokenAddress, paymasterAddress, 0n);
		userOp.callData = callDataWithApprove;
		const final = await this.getPaymasterData(userOp, entrypoint, chainIdHex, context);
		assertPaymasterMatchesApproveSpender(extractPaymasterAddress(final, "initCode" in userOp), paymasterAddress);
		this.applyPaymasterFields(userOp, final);
		return {
			userOperation: userOp,
			tokenQuote
		};
	}
	/**
	* The regular (non-token) sponsored flow: stub → estimate → final.
	* Extracted to allow `tokenPaymasterFlow` to fall through to it for Case C.
	*/
	async sponsoredFlow(userOp, bundlerRpc, entrypoint, chainIdHex, context, overrides) {
		const stub = await this.getStubData(userOp, entrypoint, chainIdHex, context);
		this.applyPaymasterFields(userOp, stub);
		await this.estimateAndApplyGasLimits(userOp, bundlerRpc, entrypoint, overrides);
		if (stub.isFinal === true) return { userOperation: userOp };
		const final = await this.getPaymasterData(userOp, entrypoint, chainIdHex, context);
		this.applyPaymasterFields(userOp, final);
		return { userOperation: userOp };
	}
};
//#endregion
//#region src/paymaster/WorldIdPermissionlessPaymaster.ts
/**
* A paymaster that sponsors UserOperations for accounts verified through
* World ID proof-of-personhood. Encodes the World ID Merkle root,
* nullifier hash, and zero-knowledge proof into the paymasterData field
* and re-estimates gas limits via the bundler.
*/
var WorldIdPermissionlessPaymaster = class extends Paymaster {
	/** The on-chain paymaster contract address. */
	address;
	/**
	* @param address - The deployed WorldIdPermissionlessPaymaster contract address
	*/
	constructor(address) {
		super();
		this.address = address;
	}
	async createPaymasterUserOperation(userOperation, bundlerRpc, nullifierHash, root, proof, overrides) {
		if (proof.slice(0, 2) !== "0x" || proof.length !== 514) throw new RangeError("Invalid proof.");
		proof = proof.slice(2);
		const proofArr = [
			`0x${proof.slice(0, 64)}`,
			`0x${proof.slice(64, 128)}`,
			`0x${proof.slice(128, 192)}`,
			`0x${proof.slice(192, 256)}`,
			`0x${proof.slice(256, 320)}`,
			`0x${proof.slice(320, 384)}`,
			`0x${proof.slice(384, 448)}`,
			`0x${proof.slice(448, 512)}`
		];
		const paymasterData = encodeAbiParameters(["uint256"], [root]) + encodeAbiParameters(["uint256"], [nullifierHash]).slice(2) + encodeAbiParameters(["uint256[8]"], [proofArr]).slice(2);
		const userOp = { ...userOperation };
		userOp.paymaster = this.address;
		userOp.paymasterData = paymasterData;
		userOp.paymasterPostOpGasLimit = 45000n;
		userOp.paymasterVerificationGasLimit = 350000n;
		if (overrides == null) overrides = {};
		let entrypointAddress = overrides.entrypoint;
		if (entrypointAddress == null) if ("eip7702Auth" in userOp) entrypointAddress = ENTRYPOINT_V8;
		else entrypointAddress = ENTRYPOINT_V7;
		let preVerificationGas = userOp.preVerificationGas;
		let verificationGasLimit = userOp.verificationGasLimit;
		let callGasLimit = userOp.callGasLimit;
		userOp.preVerificationGas = 0n;
		const estimation = await Bundler.from(bundlerRpc).estimateUserOperationGas(userOp, entrypointAddress, overrides.state_override_set);
		if (preVerificationGas < estimation.preVerificationGas) preVerificationGas = estimation.preVerificationGas;
		if (verificationGasLimit < estimation.verificationGasLimit) verificationGasLimit = estimation.verificationGasLimit;
		if (callGasLimit < estimation.callGasLimit) callGasLimit = estimation.callGasLimit;
		userOp.preVerificationGas = preVerificationGas;
		userOp.verificationGasLimit = verificationGasLimit;
		userOp.callGasLimit = callGasLimit;
		return userOp;
	}
};
/**
* Build the signal parameter expected by `@worldcoin/idkit`'s `IDKitWidget`.
* Binds the proof to a specific account, nonce, and chain.
* @param accountAddress - account address
* @param accountNonce - account nonce
* @param chainId - chain id
* @returns keccak256 hash to use as the `signal` for IDKitWidget
*/
function createWorldIdSignal(accountAddress, accountNonce, chainId) {
	return keccak256(solidityPacked([
		"address",
		"uint256",
		"uint256"
	], [
		accountAddress,
		accountNonce,
		chainId
	]));
}
//#endregion
//#region src/account/Safe/adapters.ts
/**
* Adapt a WebAuthn credential to an ExternalSigner for `signUserOperationWithSigners`
* on Safe accounts. Safe-specific (uses Safe's WebAuthn shared signer /
* verifier proxy / signature encoding) — for non-Safe accounts, use the
* account's own WebAuthn adapter.
*
* Hides the address routing (shared signer for the init UserOp, per-owner
* verifier proxy after that), the `type: "contract"` tag, and the
* Safe-specific signature encoding. The caller supplies a
* {@link FromSafeWebauthnParams.getAssertion} callback that runs the
* actual WebAuthn ceremony — this is where you call
* `navigator.credentials.get(...)` (browser) or an equivalent native
* bridge, since the SDK doesn't import `navigator` itself.
*
* Only `signHash` is exposed: WebAuthn signs a flat challenge, so a typed-data
* preview would never reach the authenticator anyway.
*
* **Override consistency.** Pass the same `accountClass` you passed to
* `initializeNewAccount` so the adapter sources the right Safe Passkey
* module defaults — v0.2.0 / FCL P256 for `SafeAccount` / `SafeAccountV0_2_0`
* / `SafeAccountV0_3_0`, v0.2.1 / Daimo P256 + RIP-7951 for
* `SafeMultiChainSigAccountV1`. Every individual WebAuthn override
* (`webAuthnSharedSigner`, `webAuthnSignerFactory`, `webAuthnSignerSingleton`,
* `webAuthnSignerProxyCreationCode`, `eip7212WebAuthnPrecompileVerifier`,
* `eip7212WebAuthnContractVerifier`) must likewise match what was passed to
* `InitCodeOverrides` at init time — only set them when you've also
* overridden them at init. The on-chain owner set is locked to whatever was
* used at init: `webAuthnSharedSigner` for `isInit=true`, the deterministic
* verifier proxy derived from the other five for `isInit=false`. A mismatch
* produces a signature pointing at an address that isn't an owner; on-chain
* `checkSignatures` reverts with `GS026` and the bundler surfaces it as a
* generic "Invalid UserOp signature" with no offline diagnostic.
*
* @example
* import { fromSafeWebauthn, SafeAccountV0_3_0 } from "abstractionkit";
*
* // Pass `expectedSigners: [{ x, y }]` so createUserOperation picks the
* // WebAuthn dummy signature for gas estimation. Without it, the
* // bundler sizes verification gas against the EOA dummy and the
* // real signed UserOp gets rejected (or under-budgeted on-chain) at submit.
* let userOperation = await safe.createUserOperation(
*   transactions, nodeUrl, bundlerUrl,
*   { expectedSigners: [{ x, y }] },
* );
*
* const signer = fromSafeWebauthn({
*   publicKey: { x, y },
*   isInit: userOperation.nonce === 0n,
*   accountClass: SafeAccountV0_3_0, // SafeMultiChainSigAccountV1 for multi-chain
*   getAssertion: async (challenge) => {
*     const assertion = await navigator.credentials.get({
*       publicKey: { challenge, rpId, allowCredentials, userVerification },
*     });
*     return {
*       authenticatorData: assertion.response.authenticatorData,
*       clientDataFields: extractClientDataFields(assertion.response),
*       rs: extractSignature(assertion.response),
*     };
*   },
* });
* userOperation.signature = await safe.signUserOperationWithSigners(
*   userOperation, [signer], chainId,
* );
*/
function fromSafeWebauthn(params) {
	const { publicKey, isInit, getAssertion, accountClass, webAuthnSharedSigner, webAuthnSignerFactory, webAuthnSignerSingleton, webAuthnSignerProxyCreationCode, eip7212WebAuthnPrecompileVerifier, eip7212WebAuthnContractVerifier } = params;
	if (typeof publicKey?.x !== "bigint" || typeof publicKey?.y !== "bigint") throw new TypeError("fromSafeWebauthn: publicKey.x and publicKey.y must be bigint. If they round-tripped through JSON.parse, hydrate them back to bigint first (e.g. BigInt(value) for decimal strings, or use a JSON reviver).");
	return {
		address: isInit ? webAuthnSharedSigner ?? accountClass.DEFAULT_WEB_AUTHN_SHARED_SIGNER : SafeAccount.createWebAuthnSignerVerifierAddress(publicKey.x, publicKey.y, {
			webAuthnSignerFactory: webAuthnSignerFactory ?? accountClass.DEFAULT_WEB_AUTHN_SIGNER_FACTORY,
			webAuthnSignerSingleton: webAuthnSignerSingleton ?? accountClass.DEFAULT_WEB_AUTHN_SIGNER_SINGLETON,
			webAuthnSignerProxyCreationCode: webAuthnSignerProxyCreationCode ?? accountClass.DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE,
			eip7212WebAuthnPrecompileVerifier: eip7212WebAuthnPrecompileVerifier ?? accountClass.DEFAULT_WEB_AUTHN_PRECOMPILE,
			eip7212WebAuthnContractVerifier: eip7212WebAuthnContractVerifier ?? accountClass.DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER
		}),
		type: "contract",
		signHash: async (hash) => {
			const assertion = await getAssertion(getBytes(hash));
			return SafeAccount.createWebAuthnSignature(assertion);
		}
	};
}
/**
* Coerce a `{ x, y }` pair where each coord may be `bigint`, hex string
* (`"0x..."`), decimal string, or a safe-integer number into a canonical
* {@link WebauthnPublicKey} with bigint coords. Used internally by
* {@link pubkeyCoordinatesFromJson} — for non-JSON inputs (URL params,
* RPC responses), pass the pre-parsed object straight to that helper.
*
* @throws if either coordinate is missing, the wrong type, or an
* unparseable string.
*/
function toBigintPubkey(pubkey) {
	if (!pubkey || pubkey.x == null || pubkey.y == null) throw new Error("toBigintPubkey: pubkey must be `{ x, y }` with both coords set");
	return {
		x: coerceBigint(pubkey.x, "x"),
		y: coerceBigint(pubkey.y, "y")
	};
}
function coerceBigint(v, field) {
	let coerced;
	if (typeof v === "bigint") coerced = v;
	else if (typeof v === "string") try {
		coerced = BigInt(v);
	} catch {
		throw new Error(`toBigintPubkey: pubkey.${field} ("${v}") is not a valid bigint string. Accepted: non-negative bigint, decimal string, or 0x-prefixed hex string.`);
	}
	else if (typeof v === "number") {
		if (!Number.isSafeInteger(v)) throw new Error(`toBigintPubkey: pubkey.${field} is a Number but not a safe integer. Pass as bigint or hex string to avoid precision loss.`);
		coerced = BigInt(v);
	} else throw new Error(`toBigintPubkey: pubkey.${field} must be bigint, string, or number (got ${typeof v})`);
	if (coerced < 0n) throw new Error(`toBigintPubkey: pubkey.${field} must be non-negative (got ${coerced.toString()}). P-256 coordinates are non-negative field elements; negative values aren't valid and would break canonical JSON round-trip serialization.`);
	return coerced;
}
/**
* Serialize a WebAuthn pubkey to a JSON string with hex-encoded
* coordinates. Inverse of {@link pubkeyCoordinatesFromJson}.
*
* Any JSON-string persistence — localStorage, backend indexes, query
* strings, IPC payloads — eventually needs a custom replacer for
* `bigint` (which `JSON.stringify` can't serialize on its own). This
* helper ships the canonical version so the round-trip is consistent
* across call sites.
*
* @example
* ```ts
* localStorage.setItem("passkey", pubkeyCoordinatesToJson({ x: 0x7a..., y: 0x2e... }));
* // Stored as: {"x":"0x7a...","y":"0x2e..."}
* ```
*/
function pubkeyCoordinatesToJson(pubkey) {
	return JSON.stringify({
		x: `0x${pubkey.x.toString(16)}`,
		y: `0x${pubkey.y.toString(16)}`
	});
}
/**
* Parse a JSON string produced by {@link pubkeyCoordinatesToJson} (or
* any JSON object with `x` / `y` fields as bigint-compatible values)
* back into a {@link WebauthnPublicKey} with bigint coords.
*
* Lenient about input shape: accepts a JSON string, a pre-parsed object
* (skip `JSON.parse` if you already ran it), and either hex (`"0x..."`)
* or decimal-string coords. Same one-line cost regardless of where the
* string came from — localStorage, backend response, query parameter.
*
* @example
* ```ts
* const raw = localStorage.getItem("passkey");
* if (raw) {
*   const pubkey = pubkeyCoordinatesFromJson(raw);
*   // pubkey: { x: bigint, y: bigint }
* }
* ```
*/
function pubkeyCoordinatesFromJson(input) {
	return toBigintPubkey(typeof input === "string" ? JSON.parse(input) : input);
}
/**
* Turn a structural {@link AuthenticatorAssertionLike} into
* {@link WebauthnSignatureData}, ready to feed straight into
* `SafeAccount.createWebAuthnSignature` or the `getAssertion` callback
* of `fromSafeWebauthn`.
*
* Replaces the ~13-line manual pipeline every Safe-passkeys consumer
* has been writing — `JSON.parse` of `clientDataJSON`, destructure +
* re-serialize the non-`type` / non-`challenge` fields, hex-encode,
* normalize `authenticatorData`, parse DER signature → `(r, s)` —
* with a single call.
*
* @example Browser:
* ```ts
* const assertion = await navigator.credentials.get({...});
* return webauthnSignatureFromAssertion(assertion.response);
* ```
*
* @example `ox/WebAuthnP256`:
* ```ts
* const { metadata, signature } = await sign({ challenge, credentialId });
* return webauthnSignatureFromAssertion({
*   authenticatorData: metadata.authenticatorData, // hex string from ox
*   clientDataJSON: metadata.clientDataJSON,       // string from ox
*   signature,                                      // { r, s } from ox
* });
* ```
*/
function webauthnSignatureFromAssertion(response) {
	const authenticatorData = toArrayBuffer(response.authenticatorData);
	const clientDataJSON = toUtf8String(response.clientDataJSON);
	const rs = toRSPair(response.signature);
	return {
		authenticatorData,
		clientDataFields: extractClientDataFieldsHex(clientDataJSON),
		rs: [rs.r, rs.s]
	};
}
function toArrayBuffer(input) {
	if (input instanceof ArrayBuffer) return input;
	const bytes = getBytes(input);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function toUtf8String(input) {
	if (typeof input === "string") return input;
	return fromUtf8Bytes(input instanceof Uint8Array ? input : new Uint8Array(input));
}
function toRSPair(input) {
	if (input !== null && typeof input === "object" && "r" in input && "s" in input && typeof input.r === "bigint" && typeof input.s === "bigint") return {
		r: input.r,
		s: input.s
	};
	return parseDerP256Signature(input instanceof Uint8Array ? input : new Uint8Array(input));
}
/**
* Re-serialize every clientDataJSON field except `type` and `challenge`.
* Robust to authenticators adding or reordering keys (e.g. Safari's
* `crossOrigin`, future WebAuthn L3 fields) — parses JSON instead of
* using a regex, validates the shape is a plain object, and emits hex
* via the pure-JS `toUtf8Bytes` (works in browsers and React Native /
* Hermes; neither `Buffer` nor `TextEncoder` is defined there by default).
*/
function extractClientDataFieldsHex(clientDataJSON) {
	let parsed;
	try {
		parsed = JSON.parse(clientDataJSON);
	} catch (err) {
		throw new Error(`webauthnSignatureFromAssertion: clientDataJSON is not valid JSON (${err.message})`);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(`webauthnSignatureFromAssertion: clientDataJSON must parse to a plain object (got ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed})`);
	const { type: _type, challenge: _challenge, ...rest } = parsed;
	return hexlify(toUtf8Bytes(Object.entries(rest).map(([key, value]) => `"${key}":${JSON.stringify(value)}`).join(",")));
}
/**
* Parse a DER-encoded ECDSA P-256 signature into `(r, s)` bigints with
* low-S normalization. Defends against truncated / malformed DER: every
* length and tag is bounds-checked against the buffer before slicing,
* because `Uint8Array.subarray` silently clamps OOB indices and would
* otherwise produce attacker-controlled-length r/s.
*
* DER layout:
*   0x30 | total-len | 0x02 | r-len | r-bytes | 0x02 | s-len | s-bytes
*/
function parseDerP256Signature(der) {
	const malformed = () => /* @__PURE__ */ new Error("webauthnSignatureFromAssertion: malformed DER signature");
	if (der.length < 8 || der[0] !== 48) throw malformed();
	const headerLen = der[1] === 129 ? 3 : 2;
	const outerLen = der[1] === 129 ? der[2] : der[1];
	if (der.length !== headerLen + outerLen) throw malformed();
	let offset = headerLen;
	if (offset + 2 > der.length) throw malformed();
	if (der[offset] !== 2) throw malformed();
	const rLen = der[offset + 1];
	if (rLen <= 0 || offset + 2 + rLen > der.length) throw malformed();
	const rBytes = der.subarray(offset + 2, offset + 2 + rLen);
	offset += 2 + rLen;
	if (offset + 2 > der.length) throw malformed();
	if (der[offset] !== 2) throw malformed();
	const sLen = der[offset + 1];
	if (sLen <= 0 || offset + 2 + sLen > der.length) throw malformed();
	const sBytes = der.subarray(offset + 2, offset + 2 + sLen);
	if (offset + 2 + sLen !== der.length) throw malformed();
	const r = rBytes.length === 0 ? 0n : BigInt(hexlify(rBytes));
	let s = sBytes.length === 0 ? 0n : BigInt(hexlify(sBytes));
	const P256_N = 115792089210356248762697446949407573529996955224135760342422259061068512044369n;
	const P256_N_HALF = P256_N >> 1n;
	if (s > P256_N_HALF) s = P256_N - s;
	return {
		r,
		s
	};
}
//#endregion
//#region src/signer/adapters.ts
/**
* Build an ExternalSigner from a raw private-key hex string. Supports both raw-hash
* and typed-data signing, delegated to the internal `ethereUtils` helpers
* ({@link signHash}, {@link signTypedData}) — no extra packages needed.
* If you already hold a viem Account or ethers Wallet, use {@link fromViem}
* or {@link fromEthersWallet} instead.
*
* @example
* import { fromPrivateKey } from "abstractionkit";
* const signer = fromPrivateKey(process.env.PRIVATE_KEY!);
* userOp.signature = await safe.signUserOperationWithSigners(userOp, [signer], chainId);
*/
function fromPrivateKey(privateKey) {
	return {
		address: privateKeyToAddress(privateKey),
		signHash: (hash) => signHash$1(privateKey, hash).serialized,
		signTypedData: (td) => signTypedData(privateKey, td.domain, td.types, td.message)
	};
}
/**
* Adapt a viem Local Account (e.g. `privateKeyToAccount(pk)`) to an ExternalSigner.
* Supports both raw-hash and typed-data signing.
*
* @remarks Requires viem &gt;= 2.0.
*/
function fromViem(account) {
	return {
		address: account.address,
		signHash: (hash) => account.sign({ hash }),
		signTypedData: (td) => account.signTypedData({
			domain: td.domain,
			types: td.types,
			primaryType: td.primaryType,
			message: td.message
		})
	};
}
/**
* Adapt a viem `WalletClient` to an ExternalSigner. Only typed-data signing is
* exposed, because `WalletClient` drives browser/JSON-RPC wallets which
* can't sign raw hashes. Requires the client to have been constructed with
* an `account`; for local accounts, prefer `fromViem` so you also get
* raw-hash fallback.
*
* @remarks Requires viem &gt;= 2.0.
*/
function fromViemWalletClient(client) {
	if (!client.account) throw new Error("fromViemWalletClient: client has no `account` configured. Construct with `createWalletClient({ account, transport, chain })`.");
	const account = client.account;
	const signTypedData = client.signTypedData;
	return {
		address: account.address,
		signTypedData: (td) => signTypedData({
			account,
			domain: td.domain,
			types: td.types,
			primaryType: td.primaryType,
			message: td.message
		})
	};
}
/**
* Adapt an ethers `Wallet` / `HDNodeWallet` to an ExternalSigner. Supports both
* raw-hash and typed-data signing.
*
* @remarks Requires ethers &gt;= 6.0.
*/
function fromEthersWallet(wallet) {
	return {
		address: wallet.address,
		signHash: async (hash) => wallet.signingKey.sign(hash).serialized,
		signTypedData: async (td) => await wallet.signTypedData(td.domain, td.types, td.message)
	};
}
//#endregion
//#region src/userOperationRevert.ts
const REVERT_REASON_TOPIC = id("UserOperationRevertReason(bytes32,address,uint256,bytes)").toLowerCase();
const ERROR_SELECTOR = "0x08c379a0";
const PANIC_SELECTOR = "0x4e487b71";
/**
* Decode why a mined UserOperation reverted, using only its receipt.
*
* A receipt's `success: false` says the inner call reverted but not why. This
* reads the EntryPoint's `UserOperationRevertReason` log and decodes the revert
* data into a reason string, a panic code, or empty data (usually out-of-gas),
* with no extra RPC call.
*
* To be certain about out-of-gas (rather than a bare revert with no data), trace
* the bundle transaction with debug_traceTransaction or a simulation provider.
*
* @param receipt - A UserOperation receipt (non-null)
* @returns The decoded revert: reason string, panic code, or out-of-gas
*/
function decodeUserOperationRevertReason(receipt) {
	if (receipt.success) return {
		reverted: false,
		outOfGas: false,
		revertData: "0x"
	};
	const userOpHash = receipt.userOpHash?.toLowerCase();
	const log = collectLogs(receipt).find((l) => l?.topics?.[0]?.toLowerCase() === REVERT_REASON_TOPIC && (userOpHash == null || l?.topics?.[1]?.toLowerCase() === userOpHash));
	if (log == null) return {
		reverted: true,
		outOfGas: true,
		revertData: "0x"
	};
	let revertData;
	try {
		[, revertData] = decodeAbiParameters(["uint256", "bytes"], log.data);
	} catch {
		return {
			reverted: true,
			outOfGas: false,
			revertData: "0x"
		};
	}
	const data = revertData.toLowerCase();
	if (data === "0x" || data === "") return {
		reverted: true,
		outOfGas: true,
		revertData: "0x"
	};
	if (data.startsWith(ERROR_SELECTOR)) try {
		const [errorMessage] = decodeAbiParameters(["string"], "0x" + data.slice(10));
		return {
			reverted: true,
			outOfGas: false,
			errorMessage,
			revertData
		};
	} catch {
		return {
			reverted: true,
			outOfGas: false,
			revertData
		};
	}
	if (data.startsWith(PANIC_SELECTOR)) try {
		const [code] = decodeAbiParameters(["uint256"], "0x" + data.slice(10));
		return {
			reverted: true,
			outOfGas: false,
			panicCode: Number(code),
			revertData
		};
	} catch {
		return {
			reverted: true,
			outOfGas: false,
			revertData
		};
	}
	return {
		reverted: true,
		outOfGas: false,
		revertData
	};
}
/**
* Gather logs from the receipt. Logs are structured `Log[]`, but this also
* tolerates the legacy JSON-string form so it keeps working if a caller passes
* a receipt produced by an older SDK version.
*/
function collectLogs(receipt) {
	const out = [];
	const sources = [receipt.logs, receipt.receipt?.logs];
	for (const src of sources) if (Array.isArray(src)) out.push(...src);
	else if (typeof src === "string") try {
		out.push(...JSON.parse(src));
	} catch {}
	return out;
}
//#endregion
//#region src/abstractionkit.ts
var abstractionkit_exports = /* @__PURE__ */ __exportAll({
	ALLOWANCE_MODULE_V0_1_0_ADDRESS: () => ALLOWANCE_MODULE_V0_1_0_ADDRESS,
	AbstractionKitError: () => AbstractionKitError,
	AllowanceModule: () => AllowanceModule,
	BaseRpcTransport: () => BaseRpcTransport,
	BaseUserOperationDummyValues: () => BaseUserOperationDummyValues,
	Bundler: () => Bundler,
	CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS: () => CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS,
	Calibur7702Account: () => Calibur7702Account,
	CaliburKeyType: () => CaliburKeyType,
	CandidePaymaster: () => CandidePaymaster,
	DEFAULT_SECP256R1_PRECOMPILE_ADDRESS: () => DEFAULT_SECP256R1_PRECOMPILE_ADDRESS,
	EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE: () => EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE,
	EIP712_MULTI_CHAIN_OPERATIONS_TYPE: () => EIP712_MULTI_CHAIN_OPERATIONS_TYPE,
	EIP712_RECOVERY_MODULE_TYPE: () => EIP712_RECOVERY_MODULE_TYPE,
	EIP712_SAFE_OPERATION_PRIMARY_TYPE: () => EIP712_SAFE_OPERATION_PRIMARY_TYPE,
	EIP712_SAFE_OPERATION_V6_TYPE: () => EIP712_SAFE_OPERATION_V6_TYPE,
	EIP712_SAFE_OPERATION_V7_TYPE: () => EIP712_SAFE_OPERATION_V7_TYPE,
	ENTRYPOINT_V6: () => ENTRYPOINT_V6,
	ENTRYPOINT_V7: () => ENTRYPOINT_V7,
	ENTRYPOINT_V8: () => ENTRYPOINT_V8,
	ENTRYPOINT_V9: () => ENTRYPOINT_V9,
	EOADummySignerSignaturePair: () => EOADummySignerSignaturePair,
	EXECUTE_RECOVERY_PRIMARY_TYPE: () => EXECUTE_RECOVERY_PRIMARY_TYPE,
	Erc7677Paymaster: () => Erc7677Paymaster,
	ExperimentalAllowAllParallelPaymaster: () => ExperimentalAllowAllParallelPaymaster,
	GasOption: () => GasOption,
	HttpTransport: () => HttpTransport,
	JsonRpcNode: () => JsonRpcNode,
	Operation: () => Operation,
	PolygonChain: () => PolygonChain,
	SAFE_FALLBACK_HANDLER_STORAGE_SLOT: () => SAFE_FALLBACK_HANDLER_STORAGE_SLOT,
	SAFE_MESSAGE_MODULE_TYPE: () => SAFE_MESSAGE_MODULE_TYPE,
	SAFE_MESSAGE_PRIMARY_TYPE: () => SAFE_MESSAGE_PRIMARY_TYPE,
	SafeAccountFactory: () => SafeAccountFactory,
	SafeAccountV0_2_0: () => SafeAccountV0_2_0,
	SafeAccountV0_3_0: () => SafeAccountV0_3_0,
	SafeAccountV1_5_0_M_0_3_0: () => SafeAccountV1_5_0_M_0_3_0,
	SafeModuleExecutorFunctionSelector: () => SafeModuleExecutorFunctionSelector,
	SafeMultiChainSigAccountV1: () => SafeMultiChainSigAccountV1,
	SendUseroperationResponse: () => SendUseroperationResponse,
	Simple7702Account: () => Simple7702Account,
	Simple7702AccountV09: () => Simple7702AccountV09,
	SmartAccount: () => SmartAccount,
	SmartAccountFactory: () => SmartAccountFactory,
	SocialRecoveryModule: () => SocialRecoveryModule,
	SocialRecoveryModuleGracePeriodSelector: () => SocialRecoveryModuleGracePeriodSelector,
	TransportRpcError: () => TransportRpcError,
	WebauthnDummySignerSignaturePair: () => WebauthnDummySignerSignaturePair,
	WorldIdPermissionlessPaymaster: () => WorldIdPermissionlessPaymaster,
	ZeroAddress: () => ZeroAddress,
	calculateUserOperationMaxGasCost: () => calculateUserOperationMaxGasCost,
	callTenderlySimulateBundle: () => callTenderlySimulateBundle,
	createAndSignEip7702DelegationAuthorization: () => createAndSignEip7702DelegationAuthorization,
	createAndSignEip7702RawTransaction: () => createAndSignEip7702RawTransaction,
	createAndSignLegacyRawTransaction: () => createAndSignLegacyRawTransaction,
	createCallData: () => createCallData,
	createEip7702DelegationAuthorizationHash: () => createEip7702DelegationAuthorizationHash,
	createEip7702TransactionHash: () => createEip7702TransactionHash,
	createUserOperationHash: () => createUserOperationHash,
	createWorldIdSignal: () => createWorldIdSignal,
	decodeUserOperationRevertReason: () => decodeUserOperationRevertReason,
	fetchAccountNonce: () => fetchAccountNonce,
	fromEthersWallet: () => fromEthersWallet,
	fromPrivateKey: () => fromPrivateKey,
	fromSafeWebauthn: () => fromSafeWebauthn,
	fromViem: () => fromViem,
	fromViemWalletClient: () => fromViemWalletClient,
	getFunctionSelector: () => getFunctionSelector,
	getSafeMessageEip712Data: () => getSafeMessageEip712Data,
	isEventfulTransport: () => isEventfulTransport,
	isHttpTransport: () => isHttpTransport,
	parseAaCode: () => parseAaCode,
	pubkeyCoordinatesFromJson: () => pubkeyCoordinatesFromJson,
	pubkeyCoordinatesToJson: () => pubkeyCoordinatesToJson,
	sendJsonRpcRequest: () => sendJsonRpcRequest,
	shareTenderlySimulationAndCreateLink: () => shareTenderlySimulationAndCreateLink,
	signHash: () => signHash,
	simulateSenderCallDataWithTenderly: () => simulateSenderCallDataWithTenderly,
	simulateSenderCallDataWithTenderlyAndCreateShareLink: () => simulateSenderCallDataWithTenderlyAndCreateShareLink,
	simulateUserOperationCallDataWithTenderly: () => simulateUserOperationCallDataWithTenderly,
	simulateUserOperationCallDataWithTenderlyAndCreateShareLink: () => simulateUserOperationCallDataWithTenderlyAndCreateShareLink,
	simulateUserOperationWithTenderly: () => simulateUserOperationWithTenderly,
	simulateUserOperationWithTenderlyAndCreateShareLink: () => simulateUserOperationWithTenderlyAndCreateShareLink,
	webauthnSignatureFromAssertion: () => webauthnSignatureFromAssertion
});
//#endregion
exports.ALLOWANCE_MODULE_V0_1_0_ADDRESS = ALLOWANCE_MODULE_V0_1_0_ADDRESS;
exports.AbstractionKitError = AbstractionKitError;
exports.AllowanceModule = AllowanceModule;
exports.BaseRpcTransport = BaseRpcTransport;
exports.BaseUserOperationDummyValues = BaseUserOperationDummyValues;
exports.Bundler = Bundler;
exports.CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS = CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS;
exports.Calibur7702Account = Calibur7702Account;
exports.CaliburKeyType = CaliburKeyType;
exports.CandidePaymaster = CandidePaymaster;
exports.DEFAULT_SECP256R1_PRECOMPILE_ADDRESS = DEFAULT_SECP256R1_PRECOMPILE_ADDRESS;
exports.EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE = EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE;
exports.EIP712_MULTI_CHAIN_OPERATIONS_TYPE = EIP712_MULTI_CHAIN_OPERATIONS_TYPE;
exports.EIP712_RECOVERY_MODULE_TYPE = EIP712_RECOVERY_MODULE_TYPE;
exports.EIP712_SAFE_OPERATION_PRIMARY_TYPE = EIP712_SAFE_OPERATION_PRIMARY_TYPE;
exports.EIP712_SAFE_OPERATION_V6_TYPE = EIP712_SAFE_OPERATION_V6_TYPE;
exports.EIP712_SAFE_OPERATION_V7_TYPE = EIP712_SAFE_OPERATION_V7_TYPE;
exports.ENTRYPOINT_V6 = ENTRYPOINT_V6;
exports.ENTRYPOINT_V7 = ENTRYPOINT_V7;
exports.ENTRYPOINT_V8 = ENTRYPOINT_V8;
exports.ENTRYPOINT_V9 = ENTRYPOINT_V9;
exports.EOADummySignerSignaturePair = EOADummySignerSignaturePair;
exports.EXECUTE_RECOVERY_PRIMARY_TYPE = EXECUTE_RECOVERY_PRIMARY_TYPE;
exports.Erc7677Paymaster = Erc7677Paymaster;
exports.ExperimentalAllowAllParallelPaymaster = ExperimentalAllowAllParallelPaymaster;
exports.GasOption = GasOption;
exports.HttpTransport = HttpTransport;
exports.JsonRpcNode = JsonRpcNode;
exports.Operation = Operation;
exports.PolygonChain = PolygonChain;
exports.SAFE_FALLBACK_HANDLER_STORAGE_SLOT = SAFE_FALLBACK_HANDLER_STORAGE_SLOT;
exports.SAFE_MESSAGE_MODULE_TYPE = SAFE_MESSAGE_MODULE_TYPE;
exports.SAFE_MESSAGE_PRIMARY_TYPE = SAFE_MESSAGE_PRIMARY_TYPE;
exports.SafeAccountFactory = SafeAccountFactory;
exports.SafeAccountV0_2_0 = SafeAccountV0_2_0;
exports.SafeAccountV0_3_0 = SafeAccountV0_3_0;
exports.SafeAccountV1_5_0_M_0_3_0 = SafeAccountV1_5_0_M_0_3_0;
exports.SafeModuleExecutorFunctionSelector = SafeModuleExecutorFunctionSelector;
exports.SafeMultiChainSigAccountV1 = SafeMultiChainSigAccountV1;
exports.SendUseroperationResponse = SendUseroperationResponse;
exports.Simple7702Account = Simple7702Account;
exports.Simple7702AccountV09 = Simple7702AccountV09;
exports.SmartAccount = SmartAccount;
exports.SmartAccountFactory = SmartAccountFactory;
exports.SocialRecoveryModule = SocialRecoveryModule;
exports.SocialRecoveryModuleGracePeriodSelector = SocialRecoveryModuleGracePeriodSelector;
exports.TransportRpcError = TransportRpcError;
exports.WebauthnDummySignerSignaturePair = WebauthnDummySignerSignaturePair;
exports.WorldIdPermissionlessPaymaster = WorldIdPermissionlessPaymaster;
exports.ZeroAddress = ZeroAddress;
Object.defineProperty(exports, "abstractionkit", {
	enumerable: true,
	get: function() {
		return abstractionkit_exports;
	}
});
exports.calculateUserOperationMaxGasCost = calculateUserOperationMaxGasCost;
exports.callTenderlySimulateBundle = callTenderlySimulateBundle;
exports.createAndSignEip7702DelegationAuthorization = createAndSignEip7702DelegationAuthorization;
exports.createAndSignEip7702RawTransaction = createAndSignEip7702RawTransaction;
exports.createAndSignLegacyRawTransaction = createAndSignLegacyRawTransaction;
exports.createCallData = createCallData;
exports.createEip7702DelegationAuthorizationHash = createEip7702DelegationAuthorizationHash;
exports.createEip7702TransactionHash = createEip7702TransactionHash;
exports.createUserOperationHash = createUserOperationHash;
exports.createWorldIdSignal = createWorldIdSignal;
exports.decodeUserOperationRevertReason = decodeUserOperationRevertReason;
exports.fetchAccountNonce = fetchAccountNonce;
exports.fromEthersWallet = fromEthersWallet;
exports.fromPrivateKey = fromPrivateKey;
exports.fromSafeWebauthn = fromSafeWebauthn;
exports.fromViem = fromViem;
exports.fromViemWalletClient = fromViemWalletClient;
exports.getFunctionSelector = getFunctionSelector;
exports.getSafeMessageEip712Data = getSafeMessageEip712Data;
exports.isEventfulTransport = isEventfulTransport;
exports.isHttpTransport = isHttpTransport;
exports.parseAaCode = parseAaCode;
exports.pubkeyCoordinatesFromJson = pubkeyCoordinatesFromJson;
exports.pubkeyCoordinatesToJson = pubkeyCoordinatesToJson;
exports.sendJsonRpcRequest = sendJsonRpcRequest;
exports.shareTenderlySimulationAndCreateLink = shareTenderlySimulationAndCreateLink;
exports.signHash = signHash;
exports.simulateSenderCallDataWithTenderly = simulateSenderCallDataWithTenderly;
exports.simulateSenderCallDataWithTenderlyAndCreateShareLink = simulateSenderCallDataWithTenderlyAndCreateShareLink;
exports.simulateUserOperationCallDataWithTenderly = simulateUserOperationCallDataWithTenderly;
exports.simulateUserOperationCallDataWithTenderlyAndCreateShareLink = simulateUserOperationCallDataWithTenderlyAndCreateShareLink;
exports.simulateUserOperationWithTenderly = simulateUserOperationWithTenderly;
exports.simulateUserOperationWithTenderlyAndCreateShareLink = simulateUserOperationWithTenderlyAndCreateShareLink;
exports.webauthnSignatureFromAssertion = webauthnSignatureFromAssertion;
