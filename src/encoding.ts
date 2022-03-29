import * as lzutf8 from 'lzutf8';
import * as vscode from 'vscode';

export async function decode(b64: string, logger?: vscode.OutputChannel): Promise<string> {
    const result = await lzutf8.decompress(b64, { inputEncoding: "Base64", outputEncoding: "String" });
    return decodeURIComponent(result);
}

export async function encode(str: string, logger?: vscode.OutputChannel): Promise<string> {

    const escaped = encodeURIComponent(str);
    const result = await lzutf8.compress(escaped, { outputEncoding: "Base64" });
    return result;
}