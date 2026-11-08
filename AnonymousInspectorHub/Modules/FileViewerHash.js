(function (Framework) {
    "use strict";
    class FileViewerHash extends Framework.BaseModule {
        static id = "FileViewerHash";
        async init() { this.available = true; }
        static async read(url) {
            const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            return { response, buffer: await response.arrayBuffer() };
        }
        static async digest(buffer) {
            const bytes = new Uint8Array(buffer);
            const sha = await crypto.subtle.digest("SHA-256", buffer);
            return {
                md5: this.md5(bytes),
                sha256: [...new Uint8Array(sha)].map(x => x.toString(16).padStart(2, "0")).join("")
            };
        }
        static md5(input) {
            const data = Array.from(input), bits = data.length * 8;
            data.push(128);
            while (data.length % 64 !== 56) data.push(0);
            for (let i = 0; i < 8; i++) data.push(Math.floor(bits / 2 ** (8 * i)) & 255);
            const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
            const k = Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
            const rol=(x,n)=>(x<<n)|(x>>>(32-n));
            let [a0,b0,c0,d0]=[0x67452301,0xefcdab89,0x98badcfe,0x10325476];
            for(let o=0;o<data.length;o+=64){
                const m=[];
                for(let i=0;i<16;i++){const p=o+i*4;m[i]=(data[p]|data[p+1]<<8|data[p+2]<<16|data[p+3]<<24)>>>0;}
                let [a,b,c,d]=[a0,b0,c0,d0];
                for(let i=0;i<64;i++){
                    let f,g;
                    if(i<16){f=b&c|~b&d;g=i;}
                    else if(i<32){f=d&b|~d&c;g=(5*i+1)%16;}
                    else if(i<48){f=b^c^d;g=(3*i+5)%16;}
                    else{f=c^(b|~d);g=7*i%16;}
                    [a,d,c,b]=[d,c,b,(b+rol((a+f+k[i]+m[g])>>>0,shifts[i]))>>>0];
                }
                a0=a0+a>>>0;b0=b0+b>>>0;c0=c0+c>>>0;d0=d0+d>>>0;
            }
            return [a0,b0,c0,d0].map(w=>[0,8,16,24].map(s=>((w>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
        }
    }
    globalThis.AnonymousInspectorFileViewerHash = FileViewerHash;
    Framework.register(FileViewerHash.id, FileViewerHash);
})(Framework);
