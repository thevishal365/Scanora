// Shared vitest setup (jsdom environment).
// jsdom/vitest shims of object-URL APIs cannot handle test Blobs,
// so always replace them: previews only need an opaque string.
URL.createObjectURL = () => 'blob:mock-preview-url'
URL.revokeObjectURL = () => {}
// Fallback only; Node/jsdom normally provide webcrypto already.
if (
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  globalThis.crypto.randomUUID = () =>
    `mock-uuid-${Math.random().toString(36).slice(2)}`
}
