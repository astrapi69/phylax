/**
 * Polyfill globalThis.crypto for vitest workers.
 *
 * Node 18+ has crypto.webcrypto but vitest workers may not expose it
 * as globalThis.crypto. This setup file bridges the gap so that
 * src/crypto/ source code can use globalThis.crypto consistently
 * in both browser and test environments.
 */
/// <reference types="node" />
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node's webcrypto is API-compatible with the browser Crypto interface but types diverge
  globalThis.crypto = webcrypto as any;
}
