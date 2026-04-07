declare module 'next-pwa' {
  import { NextConfig } from 'next';
  
  interface Expiration {
    maxEntries?: number;
    maxAgeSeconds?: number;
  }

  interface CacheOptions {
    cacheName?: string;
    expiration?: Expiration;
    networkTimeoutSeconds?: number;
  }

  interface RuntimeCachingEntry {
    urlPattern: RegExp | string;
    handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
    method?: string;
    options?: CacheOptions;
  }
  
  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    swDest?: string;
    swSrc?: string;
    cacheFrontendUrl?: boolean;
    dynamicStartUrl?: boolean;
    publicExcludes?: string[];
    extendDefaultRuntimeCaching?: (config: RuntimeCachingEntry[]) => RuntimeCachingEntry[];
    runtimeCaching?: RuntimeCachingEntry[];
    importScripts?: string[];
    buildExcludes?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    scope?: string;
    subdomainPrefix?: string;
    customWorkerDir?: string;
  }
  
  export default function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export function withPWA(config: NextConfig): NextConfig;
}
