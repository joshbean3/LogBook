import { defineConfig } from 'vitest/config';

// Password hashing is deliberately slow (scrypt at OWASP's floor), and many tests sign several accounts up.
export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 20_000 } });
