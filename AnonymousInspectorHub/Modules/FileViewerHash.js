(function (Framework) {
    "use strict";

    class FileViewerHash extends Framework.BaseModule {
        static id = "FileViewerHash";

        async init() {
            this.available = true;
        }

        static async read(url) {
            const responseData = await Framework.requestArrayBuffer(url);
            let buffer;

            if (Object.prototype.toString.call(responseData) === "[object ArrayBuffer]") {
                buffer = new Uint8Array(responseData).slice().buffer;
            } else if (ArrayBuffer.isView(responseData)) {
                buffer = new Uint8Array(
                    responseData.buffer,
                    responseData.byteOffset,
                    responseData.byteLength
                ).slice().buffer;
            } else {
                throw new Error("The file response is not binary data.");
            }

            const extension = new URL(url).pathname.split(".").pop().toLowerCase();
            const mimeTypes = {
                txt: "text/plain", css: "text/css", js: "text/javascript",
                mjs: "text/javascript", json: "application/json",
                xml: "application/xml", svg: "image/svg+xml",
                png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
                gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
                bmp: "image/bmp", avif: "image/avif", tif: "image/tiff",
                tiff: "image/tiff"
            };

            return {
                response: {
                    headers: {
                        get(name) {
                            return String(name).toLowerCase() === "content-type"
                                ? mimeTypes[extension] || "application/octet-stream"
                                : null;
                        }
                    }
                },
                buffer
            };
        }

        static async digest(buffer) {
            const bytes = new Uint8Array(buffer);
            const sha = await crypto.subtle.digest("SHA-256", buffer);

            return {
                md5: this.md5(bytes),
                sha256: [...new Uint8Array(sha)]
                    .map(value => value.toString(16).padStart(2, "0"))
                    .join("")
            };
        }

        static md5(input) {
            const data = Array.from(input);
            const bitLength = data.length * 8;

            data.push(0x80);
            while (data.length % 64 !== 56) data.push(0);

            for (let i = 0; i < 8; i++) {
                data.push(Math.floor(bitLength / (2 ** (8 * i))) & 255);
            }

            const shifts = [
                7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
                5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
                4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
                6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
            ];
            const constants = Array.from({ length: 64 }, (_, i) =>
                Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
            );
            const rotate = (value, amount) =>
                (value << amount) | (value >>> (32 - amount));

            let a0 = 0x67452301;
            let b0 = 0xefcdab89;
            let c0 = 0x98badcfe;
            let d0 = 0x10325476;

            for (let offset = 0; offset < data.length; offset += 64) {
                const words = [];

                for (let i = 0; i < 16; i++) {
                    const p = offset + i * 4;
                    words[i] = (
                        data[p] | data[p + 1] << 8 |
                        data[p + 2] << 16 | data[p + 3] << 24
                    ) >>> 0;
                }

                let a = a0, b = b0, c = c0, d = d0;

                for (let i = 0; i < 64; i++) {
                    let f, g;

                    if (i < 16) {
                        f = (b & c) | (~b & d);
                        g = i;
                    } else if (i < 32) {
                        f = (d & b) | (~d & c);
                        g = (5 * i + 1) % 16;
                    } else if (i < 48) {
                        f = b ^ c ^ d;
                        g = (3 * i + 5) % 16;
                    } else {
                        f = c ^ (b | ~d);
                        g = (7 * i) % 16;
                    }

                    const next = d;
                    d = c;
                    c = b;
                    b = (b + rotate(
                        (a + f + constants[i] + words[g]) >>> 0,
                        shifts[i]
                    )) >>> 0;
                    a = next;
                }

                a0 = (a0 + a) >>> 0;
                b0 = (b0 + b) >>> 0;
                c0 = (c0 + c) >>> 0;
                d0 = (d0 + d) >>> 0;
            }

            return [a0, b0, c0, d0].map(word =>
                [0, 8, 16, 24].map(shift =>
                    ((word >>> shift) & 255).toString(16).padStart(2, "0")
                ).join("")
            ).join("");
        }
    }

    globalThis.AnonymousInspectorFileViewerHash = FileViewerHash;
    Framework.register(FileViewerHash.id, FileViewerHash);
})(Framework);
