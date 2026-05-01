import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  deriveKeyFromPassword,
  generateSalt,
  unlockWithKey,
  lock,
  getLockState,
  decrypt,
} from '../crypto';
import { setupCompletedOnboarding } from './test-helpers';
import { readMeta } from './meta';
import { db } from './schema';
import { decodeMetaPayload } from './settings';
import {
  ObservationRepository,
  LabReportRepository,
  LabValueRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileRepository,
  ProfileVersionRepository,
  TimelineEntryRepository,
} from './repositories';
import { reencryptVault } from './reencrypt';

const OLD_PASSWORD = 'old-password-12';
const NEW_PASSWORD = 'new-password-34';

async function deriveKeyFor(password: string): Promise<CryptoKey> {
  const meta = await readMeta();
  if (!meta) throw new Error('meta missing');
  return deriveKeyFromPassword(password, new Uint8Array(meta.salt));
}

async function metaSalt(): Promise<Uint8Array> {
  const meta = await readMeta();
  if (!meta) throw new Error('meta missing');
  return new Uint8Array(meta.salt);
}

async function unlockWith(password: string): Promise<CryptoKey> {
  const key = await deriveKeyFor(password);
  if (getLockState() === 'unlocked') lock();
  unlockWithKey(key);
  return key;
}

async function seedFixture(profileId: string): Promise<void> {
  const obsRepo = new ObservationRepository();
  await obsRepo.create({
    profileId,
    theme: 'Knee',
    fact: 'Pain on load.',
    pattern: 'After running.',
    selfRegulation: 'Paused running.',
    status: 'Stable',
    source: 'user',
    extraSections: {},
  });
  await obsRepo.create({
    profileId,
    theme: 'Sleep',
    fact: 'Falls asleep within 5 minutes.',
    pattern: 'Consistent.',
    selfRegulation: 'Maintain.',
    status: 'Optimal',
    source: 'user',
    extraSections: {},
  });

  const reportRepo = new LabReportRepository(new LabValueRepository());
  const report = await reportRepo.create({
    profileId,
    reportDate: '2025-09-01',
    labName: 'Test Lab',
    categoryAssessments: {},
  });

  const valueRepo = new LabValueRepository();
  await valueRepo.create({
    profileId,
    reportId: report.id,
    category: 'Stoffwechsel',
    parameter: 'Vitamin D',
    result: '40',
    unit: 'ng/ml',
    referenceRange: '30-100',
    assessment: 'normal',
  });

  const suppRepo = new SupplementRepository();
  await suppRepo.create({
    profileId,
    name: 'Vitamin D3',
    category: 'daily',
    recommendation: 'Morgens mit Frühstück',
    rationale: '',
  });

  const openRepo = new OpenPointRepository();
  await openRepo.create({
    profileId,
    text: 'Discuss next blood draw.',
    context: 'Beim nächsten Arztbesuch',
    resolved: false,
    priority: 'medium',
  });

  const versionRepo = new ProfileVersionRepository();
  await versionRepo.create({
    profileId,
    version: '1.0',
    changeDescription: 'Initial profile.',
    changeDate: '2025-09-01',
  });

  const timelineRepo = new TimelineEntryRepository();
  await timelineRepo.create({
    profileId,
    period: '2025-09',
    title: 'September check-in',
    content: 'All stable.',
    source: 'user',
  });
}

describe('reencryptVault', () => {
  let profileId: string;

  beforeEach(async () => {
    await setupCompletedOnboarding(OLD_PASSWORD);
    await unlockWith(OLD_PASSWORD);
    const profileRepo = new ProfileRepository();
    const p = await profileRepo.create({
      baseData: {
        name: 'Test',
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    });
    profileId = p.id;
    await seedFixture(profileId);
  });

  it('happy path: every row decrypts under newKey, none under oldKey', async () => {
    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());

    await reencryptVault(oldKey, newKey);

    // After Phase 3, the keyStore holds newKey. All repository reads
    // succeed because the singleton key matches the on-disk encryption.
    const obsRepo = new ObservationRepository();
    const observations = await obsRepo.listByProfile(profileId);
    expect(observations).toHaveLength(2);
    expect(observations.map((o) => o.theme).sort()).toEqual(['Knee', 'Sleep']);

    // Spot-check meta payload decrypts via decryptWithStoredKey path.
    const meta = await readMeta();
    expect(meta).not.toBeNull();
    if (!meta) throw new Error('meta missing');
    const decrypted = await decrypt(newKey, new Uint8Array(meta.payload));
    const decoded = decodeMetaPayload(decrypted);
    expect(decoded.verificationToken).toBeTruthy();
  });

  it('every encrypted table is re-encrypted (not just one)', async () => {
    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());
    await reencryptVault(oldKey, newKey);

    // Sample one row from every encrypted table; decrypt with newKey
    // directly via crypto primitives (bypassing the keyStore singleton)
    // to assert the on-disk payload is under newKey, not just that the
    // current store happens to read it.
    const tables = [
      db.profiles,
      db.observations,
      db.labValues,
      db.labReports,
      db.supplements,
      db.openPoints,
      db.profileVersions,
      db.timelineEntries,
    ];
    for (const table of tables) {
      const rows = await table.toArray();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        // Decrypt with newKey: must succeed.
        await expect(decrypt(newKey, new Uint8Array(row.payload))).resolves.toBeTruthy();
        // Decrypt with oldKey: must fail (auth tag mismatch).
        await expect(decrypt(oldKey, new Uint8Array(row.payload))).rejects.toThrow();
      }
    }
  });

  it('after re-encryption, lock + unlock with new password works', async () => {
    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());
    await reencryptVault(oldKey, newKey);

    lock();
    expect(getLockState()).toBe('locked');

    const reDerived = await deriveKeyFor(NEW_PASSWORD);
    unlockWithKey(reDerived);
    expect(getLockState()).toBe('unlocked');

    const obsRepo = new ObservationRepository();
    const observations = await obsRepo.listByProfile(profileId);
    expect(observations).toHaveLength(2);
  });

  it('after re-encryption, unlock with old password fails (decrypt mismatch)', async () => {
    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());
    await reencryptVault(oldKey, newKey);

    lock();
    const oldKeyAgain = await deriveKeyFor(OLD_PASSWORD);
    unlockWithKey(oldKeyAgain);

    // Repositories will throw / reject on decrypt because the on-disk
    // payload was re-encrypted under newKey and the user is trying to
    // read it with oldKey. Either listByProfile rejects or returns
    // garbage; assert rejection.
    const obsRepo = new ObservationRepository();
    await expect(obsRepo.listByProfile(profileId)).rejects.toThrow();
  });

  it('throws when meta row is missing', async () => {
    await db.meta.clear();
    const oldKey = await deriveKeyFromPassword(OLD_PASSWORD, generateSalt());
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, generateSalt());
    await expect(reencryptVault(oldKey, newKey)).rejects.toThrow(/meta row missing/);
  });

  it('handles an empty vault (no rows in any encrypted table)', async () => {
    // Reset to a fresh onboarded state with zero entities.
    await setupCompletedOnboarding(OLD_PASSWORD);
    await unlockWith(OLD_PASSWORD);
    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());

    await expect(reencryptVault(oldKey, newKey)).resolves.toBeUndefined();

    // Meta is the only thing that needed re-encrypting; verify it is
    // under newKey now.
    const meta = await readMeta();
    if (!meta) throw new Error('meta missing');
    await expect(decrypt(newKey, new Uint8Array(meta.payload))).resolves.toBeTruthy();
  });

  it('preserves multi-provider AI config across master-password change (AI Commit 2)', async () => {
    // Multi-AI config rides along on the existing meta.payload blob
    // (Q11 from the AI multi-provider spec: no TABLES_TO_REENCRYPT
    // change needed). This test pins the contract: configure two
    // providers under OLD_PASSWORD, re-encrypt the vault, then read
    // the multi config back. Expectation: every provider entry,
    // model field, and the activeProviderId survive the migration.
    const { saveMultiAIConfig, readMultiAIConfig } = await import('./aiConfig');
    await saveMultiAIConfig({
      providers: [
        {
          provider: 'anthropic',
          apiKey: 'sk-ant-survives-rotation',
          model: 'claude-sonnet-4-6',
        },
        {
          provider: 'google',
          apiKey: 'gsk-survives-rotation',
          model: 'gemini-2.0-flash',
        },
      ],
      activeProviderId: 'google',
    });

    const oldKey = await deriveKeyFor(OLD_PASSWORD);
    const newKey = await deriveKeyFromPassword(NEW_PASSWORD, await metaSalt());
    await reencryptVault(oldKey, newKey);

    if (getLockState() === 'unlocked') lock();
    unlockWithKey(newKey);

    const multi = await readMultiAIConfig();
    expect(multi).toEqual({
      providers: [
        {
          provider: 'anthropic',
          apiKey: 'sk-ant-survives-rotation',
          model: 'claude-sonnet-4-6',
        },
        {
          provider: 'google',
          apiKey: 'gsk-survives-rotation',
          model: 'gemini-2.0-flash',
        },
      ],
      activeProviderId: 'google',
    });
  });
});
