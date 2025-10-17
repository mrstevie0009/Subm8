// scripts/split-i18n.ts
// Usage:
//   npx ts-node scripts/split-i18n.ts path/to/common.json ./locales
//
// Ergebnis: locales/{de,en,es,fr}/*.json
// Alle nicht zugeordneten Keys landen in shared.json (nichts geht verloren).
// Für en/es/fr werden zunächst die deutschen Strings 1:1 kopiert (Platzhalter).

import * as fs from "fs";
import * as path from "path";

// --- Strikte JSON-Typen (ohne 'any') ---
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue }
export type JSONArray = JSONValue[]; 

type Buckets = Record<string, JSONObject>;
type FileMap = Record<string, string>;

const LOCALES = ["de", "en", "es", "fr"] as const;

// Mapping: top-level unter "common" -> Zieldatei (ohne .json)
const FILE_MAP: FileMap = {
  // Seiten
  auth: "auth",
  paymentsPage: "payments",
  bookmarksPage: "home",
  monetizationPage: "monetization",
  comments: "comments",
  post: "post",
  settings: "settings",
  profile: "profile",
  settingsPage: "settings",
  profileSettings: "settings",
  links: "settings",
  securityPage: "settings",
  notificationsPage: "notifications",
  notifications: "notifications",
  legalPage: "legal",
  legal: "legal",
  communities: "communities",
  communitiesPage: "communities",
  search: "search",
  chat: "chat",
  chatHeader: "chat",
  chatComposer: "chat",
  chatThread: "chat",
  compose: "communities",
  gifPicker: "communities",
  community: "communities",

  // Profile/Ownership/Offer
  editProfileForm: "profile",
  editTabs: "profile",
  ownershipTab: "profile",
  ownershipRequest: "ownership",
  ownershipRequestAcceptModal: "ownership",
  offerViewer: "offer",
  offerEditor: "offer",

  // Tips / Autodrain / Modals
  tipRequest: "payments",
  tipModal: "payments",
  tipRequestAcceptModal: "payments",
  autoDrain: "payments",
  autoDrainAcceptModal: "payments",

  // Verifikation
  verify: "verify",

  // Feed/Toasts/Allgemeines
  toast: "home",
  feedFilter: "home",
  accountSheet: "auth",

  // Basis
  nav: "common",
  brand: "common",
  time: "common",
  actions: "common",
};

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sortKeysRecursive(value: JSONValue): JSONValue {
  if (Array.isArray(value)) {
    return (value as JSONArray).map(sortKeysRecursive) as JSONArray;
  }
  if (value && typeof value === "object") {
    const obj = value as JSONObject;
    const out: JSONObject = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysRecursive(obj[key]);
    }
    return out;
  }
  return value;
}

function writeJsonPretty(filepath: string, data: JSONObject): void {
  const sorted = sortKeysRecursive(data) as JSONObject;
  fs.writeFileSync(filepath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function isJSONObject(x: unknown): x is JSONObject {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function splitCommon(commonRoot: JSONObject): Buckets {
  const buckets: Buckets = {};
  const shared: JSONObject = {};

  const srcCandidate = (commonRoot as JSONObject).common ?? commonRoot;
  if (!isJSONObject(srcCandidate)) {
    throw new Error("Eingabedatei enthält nicht die erwartete Struktur { common: { ... } }");
  }
  const src = srcCandidate as JSONObject;

  const assignTo = (file: string, key: string, value: JSONValue): void => {
    if (!buckets[file]) buckets[file] = {};
    (buckets[file] as JSONObject)[key] = value;
  };

  for (const [key, value] of Object.entries(src)) {
    const target = FILE_MAP[key];
    if (target) {
      assignTo(target, key, value as JSONValue);
    } else {
      // Unbekannt -> shared
      shared[key] = value as JSONValue;
    }
  }

  if (Object.keys(shared).length > 0) {
    buckets["shared"] = shared;
  }

  return buckets;
}

function main(): void {
  const input = process.argv[2];
  const outDir = process.argv[3] ?? "./locales";

  if (!input) {
    console.error("Usage: npx ts-node scripts/split-i18n.ts path/to/common.json ./locales");
    process.exit(1);
  }

  const raw = fs.readFileSync(input, "utf8");
  let dataUnknown: unknown;
  try {
    dataUnknown = JSON.parse(raw);
  } catch (e) {
    console.error("⚠️ Konnte JSON nicht parsen:", e);
    process.exit(1);
  }

  if (!isJSONObject(dataUnknown)) {
    console.error("⚠️ Erwartet ein JSON-Objekt an der Wurzel.");
    process.exit(1);
  }

  const deBuckets = splitCommon(dataUnknown);

  const expectedFiles = [
    "auth","home","search","settings","profile","notifications","communities","chat",
    "post","comments","payments","monetization","offer","ownership","verify","legal","common","shared"
  ];

  for (const locale of LOCALES) {
    const basePath = path.join(outDir, locale);
    ensureDir(basePath);

    // Schreibe vorhandene Buckets
    for (const [file, content] of Object.entries(deBuckets)) {
      const filepath = path.join(basePath, `${file}.json`);
      // de = Original; andere Sprachen: zunächst Kopie (Platzhalter, damit vollständig)
      const payload = content;
      writeJsonPretty(filepath, payload);
    }

    // Stelle sicher, dass alle erwarteten Dateien existieren
    for (const f of expectedFiles) {
      const fp = path.join(basePath, `${f}.json`);
      if (!fs.existsSync(fp)) writeJsonPretty(fp, {});
    }
  }

  // Zusätzlich: lege pro Sprache eine kleine common.json an, falls nicht aus FILE_MAP erzeugt
  for (const locale of LOCALES) {
    const fp = path.join(outDir, locale, "common.json");
    if (!fs.existsSync(fp)) writeJsonPretty(fp, {});
  }

  // Fertig
  console.log("✅ Fertig. Dateien geschrieben nach:", path.resolve(outDir));
}

main();
