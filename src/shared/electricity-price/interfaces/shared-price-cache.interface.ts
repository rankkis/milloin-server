/**
 * Injection token for the cache that shares prices between server instances.
 */
export const SHARED_PRICE_CACHE = Symbol('SHARED_PRICE_CACHE');

/**
 * Key-value cache shared by every server instance and kept across deploys.
 * On Vercel this is the runtime cache; elsewhere it lives in process memory.
 * Entries may disappear at any time, so it only saves upstream fetches.
 */
export interface ISharedPriceCache {
  /** Resolves to null when the key is missing. */
  get(key: string): Promise<unknown | null>;

  /** ttl in seconds. */
  set(key: string, value: unknown, options?: { ttl?: number }): Promise<void>;
}
