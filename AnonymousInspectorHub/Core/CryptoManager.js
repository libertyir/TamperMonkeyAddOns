
(function (root) {
    "use strict";

    class CryptoManager {
        constructor(options = {}) {
            this.storageKey =
                options.storageKey || "aih_encryption_key";

            this.getValue = options.getValue;
            this.setValue = options.setValue;

            this.key = null;
            this.iv = new Uint8Array(16);

            this.initialized = false;
            this.initializePromise = null;

            this.algorithm = Object.freeze({
                encryption: "AES-128-CBC",
                keyLength: 128,
                ivLength: 128,
                iv: "00000000000000000000000000000000",
                padding: "PKCS7",
                encoding: "Base64",
                keyFormat: "Hex"
            });

            this.encoder = new TextEncoder();
            this.decoder = new TextDecoder();

            this.sbox = new Uint8Array(256);
            this.invSbox = new Uint8Array(256);

            this.createSBox();
        }

        // --------------------------------------------------
        // AES PRIMITIVES
        // --------------------------------------------------

        gfMultiply(a, b) {
            let result = 0;

            while (b) {
                if (b & 1) result ^= a;

                a = (a << 1) ^ ((a & 0x80) ? 0x11B : 0);
                b >>>= 1;
            }

            return result & 0xFF;
        }

        gfPower(value, power) {
            let result = 1;

            while (power > 0) {
                if (power & 1) {
                    result = this.gfMultiply(result, value);
                }

                value = this.gfMultiply(value, value);
                power >>>= 1;
            }

            return result;
        }

        rotateByte(value, count) {
            return (
                (value << count) |
                (value >>> (8 - count))
            ) & 0xFF;
        }

        createSBox() {
            for (let i = 0; i < 256; i++) {
                const inverse = i === 0
                    ? 0
                    : this.gfPower(i, 254);

                const value =
                    inverse ^
                    this.rotateByte(inverse, 1) ^
                    this.rotateByte(inverse, 2) ^
                    this.rotateByte(inverse, 3) ^
                    this.rotateByte(inverse, 4) ^
                    0x63;

                this.sbox[i] = value;
                this.invSbox[value] = i;
            }
        }

        // --------------------------------------------------
        // KEY GENERATION AND STORAGE
        // --------------------------------------------------

        generateKey() {
            if (
                !root.crypto ||
                typeof root.crypto.getRandomValues !== "function"
            ) {
                throw new Error(
                    "Secure random number generation is unavailable."
                );
            }

            const bytes = new Uint8Array(16);

            root.crypto.getRandomValues(bytes);

            return this.toHex(bytes);
        }

        async initialize() {
            if (this.initialized) {
                return this;
            }

            if (this.initializePromise) {
                return this.initializePromise;
            }

            this.initializePromise = this.initializeKey();

            try {
                await this.initializePromise;
                this.initialized = true;
                return this;
            } finally {
                this.initializePromise = null;
            }
        }

        async initializeKey() {
            if (typeof this.getValue !== "function") {
                throw new Error(
                    "Encryption key storage is unavailable: GM_getValue."
                );
            }

            if (typeof this.setValue !== "function") {
                throw new Error(
                    "Encryption key storage is unavailable: GM_setValue."
                );
            }

            const savedKey = await this.getValue(
                this.storageKey,
                null
            );

            if (savedKey !== null && savedKey !== undefined) {
                if (
                    typeof savedKey !== "string" ||
                    !/^[0-9a-fA-F]{32}$/.test(savedKey)
                ) {
                    throw new Error(
                        "Stored encryption key is invalid."
                    );
                }

                this.key = this.fromHex(savedKey);
                return;
            }

            const newKey = this.generateKey();

            await this.setValue(
                this.storageKey,
                newKey
            );

            this.key = this.fromHex(newKey);
        }

        fromHex(value) {
            if (
                typeof value !== "string" ||
                !/^[0-9a-fA-F]+$/.test(value) ||
                value.length % 2 !== 0
            ) {
                throw new Error("Invalid hexadecimal value.");
            }

            const bytes = new Uint8Array(value.length / 2);

            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(
                    value.slice(i * 2, i * 2 + 2),
                    16
                );
            }

            return bytes;
        }

        toHex(bytes) {
            return Array.from(
                bytes,
                byte => byte.toString(16).padStart(2, "0")
            ).join("");
        }

        // --------------------------------------------------
        // KEY EXPANSION
        // --------------------------------------------------

        expandKey(key) {
            const expanded = new Uint8Array(176);
            expanded.set(key);

            let generated = 16;
            let roundConstant = 1;
            const temp = new Uint8Array(4);

            while (generated < 176) {
                for (let i = 0; i < 4; i++) {
                    temp[i] = expanded[generated - 4 + i];
                }

                if (generated % 16 === 0) {
                    const first = temp[0];

                    temp[0] = this.sbox[temp[1]];
                    temp[1] = this.sbox[temp[2]];
                    temp[2] = this.sbox[temp[3]];
                    temp[3] = this.sbox[first];

                    temp[0] ^= roundConstant;
                    roundConstant = this.gfMultiply(
                        roundConstant,
                        2
                    );
                }

                for (let i = 0; i < 4; i++) {
                    expanded[generated] =
                        expanded[generated - 16] ^ temp[i];

                    generated++;
                }
            }

            return expanded;
        }

        addRoundKey(state, expandedKey, round) {
            const offset = round * 16;

            for (let i = 0; i < 16; i++) {
                state[i] ^= expandedKey[offset + i];
            }
        }

        // --------------------------------------------------
        // AES STATE OPERATIONS
        // --------------------------------------------------

        subBytes(state) {
            for (let i = 0; i < 16; i++) {
                state[i] = this.sbox[state[i]];
            }
        }

        invSubBytes(state) {
            for (let i = 0; i < 16; i++) {
                state[i] = this.invSbox[state[i]];
            }
        }

        shiftRows(state) {
            const copy = state.slice();

            for (let row = 1; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    state[row + 4 * col] =
                        copy[row + 4 * ((col + row) % 4)];
                }
            }
        }

        invShiftRows(state) {
            const copy = state.slice();

            for (let row = 1; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    state[row + 4 * col] =
                        copy[row + 4 * ((col - row + 4) % 4)];
                }
            }
        }

        mixColumns(state) {
            for (let col = 0; col < 4; col++) {
                const i = col * 4;

                const a = state[i];
                const b = state[i + 1];
                const c = state[i + 2];
                const d = state[i + 3];

                state[i] =
                    this.gfMultiply(a, 2) ^
                    this.gfMultiply(b, 3) ^ c ^ d;

                state[i + 1] =
                    a ^
                    this.gfMultiply(b, 2) ^
                    this.gfMultiply(c, 3) ^ d;

                state[i + 2] =
                    a ^ b ^
                    this.gfMultiply(c, 2) ^
                    this.gfMultiply(d, 3);

                state[i + 3] =
                    this.gfMultiply(a, 3) ^
                    b ^ c ^
                    this.gfMultiply(d, 2);
            }
        }

        invMixColumns(state) {
            for (let col = 0; col < 4; col++) {
                const i = col * 4;

                const a = state[i];
                const b = state[i + 1];
                const c = state[i + 2];
                const d = state[i + 3];

                state[i] =
                    this.gfMultiply(a, 14) ^
                    this.gfMultiply(b, 11) ^
                    this.gfMultiply(c, 13) ^
                    this.gfMultiply(d, 9);

                state[i + 1] =
                    this.gfMultiply(a, 9) ^
                    this.gfMultiply(b, 14) ^
                    this.gfMultiply(c, 11) ^
                    this.gfMultiply(d, 13);

                state[i + 2] =
                    this.gfMultiply(a, 13) ^
                    this.gfMultiply(b, 9) ^
                    this.gfMultiply(c, 14) ^
                    this.gfMultiply(d, 11);

                state[i + 3] =
                    this.gfMultiply(a, 11) ^
                    this.gfMultiply(b, 13) ^
                    this.gfMultiply(c, 9) ^
                    this.gfMultiply(d, 14);
            }
        }

        // --------------------------------------------------
        // AES BLOCK ENCRYPTION
        // --------------------------------------------------

        encryptBlock(block, expandedKey) {
            const state = block.slice();

            this.addRoundKey(state, expandedKey, 0);

            for (let round = 1; round < 10; round++) {
                this.subBytes(state);
                this.shiftRows(state);
                this.mixColumns(state);
                this.addRoundKey(state, expandedKey, round);
            }

            this.subBytes(state);
            this.shiftRows(state);
            this.addRoundKey(state, expandedKey, 10);

            return state;
        }

        // --------------------------------------------------
        // AES BLOCK DECRYPTION
        // --------------------------------------------------

        decryptBlock(block, expandedKey) {
            const state = block.slice();

            this.addRoundKey(state, expandedKey, 10);

            for (let round = 9; round > 0; round--) {
                this.invShiftRows(state);
                this.invSubBytes(state);
                this.addRoundKey(state, expandedKey, round);
                this.invMixColumns(state);
            }

            this.invShiftRows(state);
            this.invSubBytes(state);
            this.addRoundKey(state, expandedKey, 0);

            return state;
        }

        // --------------------------------------------------
        // CBC ENCRYPTION
        // --------------------------------------------------

        encryptBytes(plaintext) {
            const padding = 16 - (plaintext.length % 16);

            const padded = new Uint8Array(
                plaintext.length + padding
            );

            padded.set(plaintext);
            padded.fill(padding, plaintext.length);

            const expandedKey = this.expandKey(this.key);
            const output = new Uint8Array(padded.length);

            let previous = this.iv.slice();

            for (let offset = 0; offset < padded.length; offset += 16) {
                const block = padded.slice(offset, offset + 16);

                for (let i = 0; i < 16; i++) {
                    block[i] ^= previous[i];
                }

                const encrypted = this.encryptBlock(
                    block,
                    expandedKey
                );

                output.set(encrypted, offset);
                previous = encrypted;
            }

            return output;
        }

        // --------------------------------------------------
        // CBC DECRYPTION
        // --------------------------------------------------

        decryptBytes(ciphertext) {
            if (
                !(ciphertext instanceof Uint8Array) ||
                ciphertext.length === 0 ||
                ciphertext.length % 16 !== 0
            ) {
                throw new Error("Invalid ciphertext length.");
            }

            const expandedKey = this.expandKey(this.key);
            const output = new Uint8Array(ciphertext.length);

            let previous = this.iv.slice();

            for (let offset = 0; offset < ciphertext.length; offset += 16) {
                const block = ciphertext.slice(offset, offset + 16);

                const decrypted = this.decryptBlock(
                    block,
                    expandedKey
                );

                for (let i = 0; i < 16; i++) {
                    output[offset + i] =
                        decrypted[i] ^ previous[i];
                }

                previous = block;
            }

            const padding = output[output.length - 1];

            if (padding < 1 || padding > 16) {
                throw new Error("Invalid PKCS7 padding.");
            }

            for (
                let i = output.length - padding;
                i < output.length;
                i++
            ) {
                if (output[i] !== padding) {
                    throw new Error("Invalid PKCS7 padding.");
                }
            }

            return output.slice(
                0,
                output.length - padding
            );
        }

        // --------------------------------------------------
        // BASE64
        // --------------------------------------------------

        toBase64(bytes) {
            let binary = "";

            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }

            return btoa(binary);
        }

        fromBase64(value) {
            if (
                typeof value !== "string" ||
                !value.length ||
                value.length % 4 !== 0 ||
                !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
            ) {
                throw new Error("Invalid Base64 data.");
            }

            const binary = atob(value);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes;
        }

        // --------------------------------------------------
        // KEY ACCESS
        // --------------------------------------------------

        getKey() {
            this.ensureInitialized();
            return this.toHex(this.key);
        }

        getIV() {
            return this.toHex(this.iv);
        }

        getAlgorithm() {
            return {
                ...this.algorithm,
                key: this.getKey()
            };
        }

        ensureInitialized() {
            if (!this.initialized || !this.key) {
                throw new Error(
                    "CryptoManager has not been initialized."
                );
            }
        }

        // --------------------------------------------------
        // ENCRYPTION
        // --------------------------------------------------

        async encrypt(data) {
            this.ensureInitialized();

            const plaintext = this.encoder.encode(
                JSON.stringify(data)
            );

            const ciphertext = this.encryptBytes(plaintext);

            return {
                version: 1,
                algorithm: "AES-128-CBC",
                iv: this.getIV(),
                ciphertext: this.toBase64(ciphertext)
            };
        }

        // --------------------------------------------------
        // DECRYPTION
        // --------------------------------------------------

        async decrypt(payload) {
            this.ensureInitialized();

            if (
                !payload ||
                typeof payload !== "object" ||
                payload.version !== 1 ||
                payload.algorithm !== "AES-128-CBC" ||
                payload.iv !== this.getIV() ||
                typeof payload.ciphertext !== "string"
            ) {
                throw new Error(
                    "Invalid or unsupported encrypted data."
                );
            }

            const ciphertext = this.fromBase64(
                payload.ciphertext
            );

            const plaintext = this.decryptBytes(ciphertext);
            const decoded = this.decoder.decode(plaintext);

            return JSON.parse(decoded);
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                initialized: this.initialized,
                algorithm: this.algorithm,
                keyAvailable: Boolean(this.key)
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        destroy() {
            this.key = null;
            this.initialized = false;
            this.initializePromise = null;
        }
    }

    root.AnonymousInspectorCryptoManager = CryptoManager;

})(globalThis);
