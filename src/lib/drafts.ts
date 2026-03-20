// src/lib/drafts.ts
const DRAFT_KEY = 'compose:draft';
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

export type Draft = {
  text: string;
  mediaFiles?: Array<{ name: string; size: number; type: string }>;
  savedAt: number;
};

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}