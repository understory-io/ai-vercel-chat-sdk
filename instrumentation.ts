import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({ serviceName: 'ai-chatbot' });

  // Node.js 22+ provides a broken global localStorage when --localstorage-file
  // is not properly configured. Libraries like next-themes detect it exists but
  // crash when calling getItem(). Remove it so they fall back to their SSR codepath.
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.getItem('__test');
    } catch {
      // @ts-ignore
      globalThis.localStorage = undefined;
    }
  }
}
