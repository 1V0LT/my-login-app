declare module 'tesseract.js' {
  export function recognize(image: Buffer | ArrayBuffer | string, lang: string, options?: Record<string, unknown>): Promise<{ data: { text: string } }>;
  const _default: { recognize: typeof recognize };
  export default _default;
}
