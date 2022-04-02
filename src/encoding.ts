import * as lzutf8 from 'lzutf8';
import * as vscode from 'vscode';

// export async function decodeAsync(b64: string, logger?: vscode.OutputChannel): Promise<string> {
//     const result = await lzutf8.decompress(b64, { inputEncoding: "Base64", outputEncoding: "String" });
//     return decodeURIComponent(result);
// }

export function decode(b64: string, logger?: vscode.OutputChannel): string {
    const result = lzutf8.decompress(b64, { inputEncoding: "Base64", outputEncoding: "String" }) as string;
    return decodeURIComponent(result);
}

// export async function encodeAsync(str: string, logger?: vscode.OutputChannel): Promise<string> {

//     const escaped = encodeURIComponent(str);
//     const result = await lzutf8.compress(escaped, { outputEncoding: "Base64" });
//     return result;
// }

export function encode(str: string, logger?: vscode.OutputChannel): string {
    const escaped = encodeURIComponent(str);
    const result = lzutf8.compress(escaped, { outputEncoding: "Base64" }) as string;
    return result;
}