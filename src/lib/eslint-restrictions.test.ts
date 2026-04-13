import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

async function lintText(code: string, filePath: string) {
  const eslint = new ESLint();
  const results = await eslint.lintText(code, { filePath });
  return results[0]?.messages ?? [];
}

describe('ESLint import boundary rules', () => {
  describe('crypto global restriction', () => {
    it('flags crypto.subtle usage outside src/crypto/', async () => {
      const messages = await lintText(
        'const key = crypto.subtle.generateKey("AES-GCM", true, ["encrypt"]);\n',
        'src/features/onboarding/Unlock.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-globals');
      expect(violation).toBeDefined();
      expect(violation?.message).toContain('src/crypto/');
    });

    it('allows crypto.subtle usage inside src/crypto/', async () => {
      const messages = await lintText(
        'const key = crypto.subtle.generateKey("AES-GCM", true, ["encrypt"]);\n',
        'src/crypto/aesGcm.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-globals');
      expect(violation).toBeUndefined();
    });

    it('flags crypto.getRandomValues outside src/crypto/', async () => {
      const messages = await lintText(
        'const iv = crypto.getRandomValues(new Uint8Array(12));\n',
        'src/lib/utils.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-globals');
      expect(violation).toBeDefined();
    });

    it('flags crypto.randomUUID outside src/crypto/', async () => {
      const messages = await lintText(
        'const id = crypto.randomUUID();\n',
        'src/domain/observation/types.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-globals');
      expect(violation).toBeDefined();
    });
  });

  describe('dexie import restriction', () => {
    it('flags dexie import outside src/db/', async () => {
      const messages = await lintText(
        'import Dexie from "dexie";\n',
        'src/features/entries/EntryList.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(violation).toBeDefined();
      expect(violation?.message).toContain('src/db/');
    });

    it('allows dexie import inside src/db/', async () => {
      const messages = await lintText('import Dexie from "dexie";\n', 'src/db/schema.ts');
      const violation = messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(violation).toBeUndefined();
    });

    it('allows dexie import inside src/db/repositories/', async () => {
      const messages = await lintText(
        'import Dexie from "dexie";\n',
        'src/db/repositories/entryRepository.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(violation).toBeUndefined();
    });

    it('flags dexie sub-path import outside src/db/', async () => {
      const messages = await lintText(
        'import { liveQuery } from "dexie";\n',
        'src/features/entries/Timeline.ts',
      );
      const violation = messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(violation).toBeDefined();
    });
  });
});
