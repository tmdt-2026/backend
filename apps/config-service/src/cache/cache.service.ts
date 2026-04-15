import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry>();

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPattern(pattern: string): void {
    const prefix = pattern.replace('*', '');
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
