
import LZString = require('./lz-string');

export function decode(str: string, compressed = true): string {
    if (compressed)
        return LZString.decompressFromUTF16(str) as string;

    return Buffer.from(str, 'base64').toString('binary');
}

export function encode(str: string, compressed = true): string {
    if (compressed)
        return LZString.compressToUTF16(str);

    return Buffer.from(str, 'binary').toString('base64');
}

