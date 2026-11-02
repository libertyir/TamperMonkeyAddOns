
(function (root) {
    "use strict";

    class CryptoManager {
        constructor(options = {}) {
            this.storageKey = options.storageKey || "aih_encryption_key";

            this.getValue = options.getValue;
            this.setValue = options.setValue;

            this.iterations = 600000;

            this.algorithm = Object.freeze({
                encryption: "AES-256-GCM",
                keyDerivation: "PBKDF2",
                hash: "SHA-256",
                iterations: this.iterations,
                keyLength: 256,
                keyCharacters: 12
            });

            this.key = null;
            this.initialized = false;
            this.initializePromise = null;

            this.encoder = new TextEncoder();
            this.decoder = new TextDecoder();
        }

        // --------------------------------------------------
        // CRYPTO AVAILABILITY
        // --------------------------------------------------

        getCrypto() {
            if (
                !root.crypto ||
                !root.crypto.subtle ||
                typeof root.crypto.getRandomValues !== "function"
            ) {
                throw new Error(
                    "Web Crypto API is unavailable."
                );
            }

            return root.crypto;
        }

        // --------------------------------------------------
        // RANDOM GENERATION
        // --------------------------------------------------

        randomBytes(length) {
            const crypto = this.getCrypto();
            const bytes = new Uint8Array(length);

            crypto.getRandomValues(bytes);

            return bytes;
        }

        generateKey() {
            const alphabet =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                "abcdefghijklmnopqrstuvwxyz" +
                "0123456789-_";

            const bytes = this.randomBytes(12);

            let key = "";

            for (const byte of bytes) {
                key += alphabet[byte & 63];
            }

            return key;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

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
                return this;
            } finally {
                this.initializePromise = null;
            }
        }

        async initializeKey() {
            this.getCrypto();

            if (typeof this.getValue !== "function") {
                throw new Error(
                    "Encryption key storage is unavailable."
                );
            }

            if (typeof this.setValue !== "function") {
                throw new Error(
                    "Encryption key storage is unavailable."
                );
            }

            let savedKey = await this.getValue(
                this.storageKey,
                null
            );

            if (savedKey !== null && savedKey !== undefined) {
                if (
                    typeof savedKey !== "string" ||
                    !/^[A-Za-z0-9_-]{12}$/.test(savedKey)
                ) {
                    throw new Error(
                        "Stored encryption key is invalid."
                    );
                }

                this.key = savedKey;
                this.initialized = true;

                return;
            }

            const newKey = this.generateKey();

            await this.setValue(
                this.storageKey,
                newKey
            );

            this.key = newKey;
            this.initialized = true;
        }

        // --------------------------------------------------
        // KEY ACCESS
        // --------------------------------------------------

        getKey() {
            this.ensureInitialized();

            return this.key;
        }

        getAlgorithm() {
            return { ...this.algorithm };
        }

        ensureInitialized() {
            if (!this.initialized || !this.key) {
                throw new Error(
                    "CryptoManager has not been initialized."
                );
            }
        }

        // --------------------------------------------------
        // BASE64 UTILITIES
        // --------------------------------------------------

        toBase64(bytes) {
            let binary = "";

            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }

            return btoa(binary);
        }

        fromBase64(value) {
            const binary = atob(value);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes;
        }

        // --------------------------------------------------
        // KEY DERIVATION
        // --------------------------------------------------

        async deriveKey(salt) {
            this.ensureInitialized();

            const crypto = this.getCrypto();

            const passwordMaterial = await crypto.subtle.importKey(
                "raw",
                this.encoder.encode(this.key),
                "PBKDF2",
                false,
                ["deriveKey"]
            );

            return crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt,
                    iterations: this.iterations,
                    hash: "SHA-256"
                },
                passwordMaterial,
                {
                    name: "AES-GCM",
                    length: 256
                },
                false,
                ["encrypt", "decrypt"]
            );
        }

        // --------------------------------------------------
        // ENCRYPTION
        // --------------------------------------------------

        async encrypt(data) {
            this.ensureInitialized();

            const crypto = this.getCrypto();

            const salt = this.randomBytes(16);
            const iv = this.randomBytes(12);

            const encryptionKey = await this.deriveKey(salt);

            const plaintext = this.encoder.encode(
                JSON.stringify(data)
            );

            const encrypted = await crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv,
                    tagLength: 128
                },
                encryptionKey,
                plaintext
            );

            return {
                version: 1,
                algorithm: "AES-256-GCM",
                kdf: "PBKDF2-SHA256",
                iterations: this.iterations,
                salt: this.toBase64(salt),
                iv: this.toBase64(iv),
                ciphertext: this.toBase64(
                    new Uint8Array(encrypted)
                )
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
                payload.algorithm !== "AES-256-GCM" ||
                payload.kdf !== "PBKDF2-SHA256" ||
                !Number.isInteger(payload.iterations) ||
                payload.iterations < 1 ||
                payload.iterations > 2000000 ||
                typeof payload.salt !== "string" ||
                typeof payload.iv !== "string" ||
                typeof payload.ciphertext !== "string"
            ) {
                throw new Error(
                    "Invalid or unsupported encrypted data."
                );
            }

            const crypto = this.getCrypto();

            const salt = this.fromBase64(payload.salt);
            const iv = this.fromBase64(payload.iv);
            const ciphertext = this.fromBase64(
                payload.ciphertext
            );

            if (salt.length !== 16 || iv.length !== 12) {
                throw new Error(
                    "Invalid encryption parameters."
                );
            }

            const originalIterations = this.iterations;

            try {
                this.iterations = payload.iterations;

                const encryptionKey = await this.deriveKey(salt);

                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv,
                        tagLength: 128
                    },
                    encryptionKey,
                    ciphertext
                );

                const plaintext = this.decoder.decode(decrypted);

                return JSON.parse(plaintext);

            } finally {
                this.iterations = originalIterations;
            }
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                initialized: this.initialized,
                algorithm: this.getAlgorithm(),
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
