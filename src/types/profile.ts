// src/types/profile.ts
export type RoleUI = 'domme' | 'sub';

export type Stats = {
  posts: number;
  followers: number;
  following: number;
};

export type Profile = {
  id: string;
  username: string;         // handle (ohne @)
  displayName: string;
  role: RoleUI;             // 'domme' | 'sub' (UI)
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  createdAt?: string | Date | null;
  nsfwDefault?: boolean | null;
  ageVerifiedAt?: string | Date | null;
  websiteUrl?: string | null; // ⇐ neu
  stats: Stats;
};
