import type { Profile, RoleUI } from '@/types/profile';

type RawRole = 'domme' | 'sub' | 'submissive';
type RawProfile = Omit<Profile, 'role'> & { role: RawRole };

/** Helper: 'sub' -> 'submissive' */
function normalizeRole(r: RawRole): RoleUI {
  return r === 'sub' ? 'submissive' : r;
}

/** Deine Mock-Daten (Beispiel; passe sie nach Bedarf an) */
const RAW_PROFILES: RawProfile[] = [
  {
    id: 'u1',
    displayName: 'User1000',
    username: 'user1000',
    role: 'sub', // <= wird zu 'submissive'
    location: 'Graz, AT',
    stats: { followers: 650, following: 65, posts: 12 },
  },
  {
    id: 'u2',
    displayName: 'Evelin',
    username: 'evelin',
    role: 'domme',
    location: 'Vienna, AT',
    stats: { followers: 2_340, following: 120, posts: 87 },
  },
  {
    id: 'u3',
    displayName: 'Maya the bad ass',
    username: 'maya',
    role: 'domme',
    location: 'Berlin, DE',
    stats: { followers: 980, following: 44, posts: 33 },
  },
];

/** Export in das strikte UI-Profilformat */
export const PROFILES: Profile[] = RAW_PROFILES.map((p) => ({
  ...p,
  role: normalizeRole(p.role),
}));
