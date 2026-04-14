import type { Profile, BaseData, DoctorInfo } from '../../domain';

export function makeBaseData(overrides: Partial<BaseData> = {}): BaseData {
  return {
    name: 'Mein Profil',
    weightHistory: [],
    knownDiagnoses: [],
    currentMedications: [],
    relevantLimitations: [],
    profileType: 'self',
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    baseData: makeBaseData(),
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
    ...overrides,
  };
}

export function makeDoctor(overrides: Partial<DoctorInfo> = {}): DoctorInfo {
  return {
    name: 'Dr. Mira Beispiel',
    ...overrides,
  };
}
