import crypto from "crypto";

export function make6DigitCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}