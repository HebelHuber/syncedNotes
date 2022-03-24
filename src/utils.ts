
export const decode = (b64: string): string => decodeURIComponent(Buffer.from(b64, 'base64').toString('binary'));

export const encode = (str: string): string => Buffer.from(encodeURIComponent(str), 'binary').toString('base64');