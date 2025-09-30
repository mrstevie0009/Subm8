// src/lib/webauthn.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  AuthenticatorDevice,
} from '@simplewebauthn/types';
import { prisma } from '@/lib/prisma';

const RP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Subm8';
const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';

const enc = new TextEncoder();

/** Registrierung: Optionen erzeugen */
export async function getRegistrationOptions(userId: string, userName: string) {
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId } });

  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName,
    userID: enc.encode(userId), // Uint8Array
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId, // Base64URL-String (OK für v10)
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
}

/** Registrierung: Verify */
export async function verifyRegistration(
  userId: string,
  resp: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const verification = await verifyRegistrationResponse({
    response: resp,
    expectedRPID: RP_ID,
    expectedOrigin: ORIGIN,
    expectedChallenge,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      // credentialID ist in v10 meist bereits Base64URL-String; falls doch Bytes, konvertieren
      credentialId: toBase64url(credentialID),
      // credentialPublicKey ist Uint8Array -> in Base64URL wandeln
      publicKey: toBase64url(credentialPublicKey),
      counter,
      transports: JSON.stringify(resp.response.transports ?? []),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorType: 'WEBAUTHN' },
  });

  return { verified: true };
}

/** Login: Optionen erzeugen */
export async function getAuthenticationOptions(userId: string) {
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });

  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId, // Base64URL-String
    })),
    userVerification: 'preferred',
  });
}

/** Login: Verify */
export async function verifyAuthentication(
  userId: string,
  resp: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const db = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: resp.id }, // resp.id ist Base64URL-String
  });
  if (!db) return { verified: false };

  const transports = safeParseJSON<AuthenticatorTransportFuture[]>(db.transports);

  const authenticator: AuthenticatorDevice = {
    credentialID: db.credentialId, // Base64URL-String
    credentialPublicKey: base64urlToBytes(db.publicKey), // Uint8Array
    counter: db.counter,
    transports: transports ?? undefined,
  };

  const verification = await verifyAuthenticationResponse({
    response: resp,
    expectedRPID: RP_ID,
    expectedOrigin: ORIGIN,
    expectedChallenge,
    authenticator,
  });

  if (verification.verified) {
    await prisma.webAuthnCredential.update({
      where: { credentialId: db.credentialId },
      data: { counter: verification.authenticationInfo.newCounter },
    });
  }

  return { verified: verification.verified };
}

/* ----------------- Helpers ----------------- */
function toBase64url(input: Uint8Array | ArrayBuffer | string): string {
  if (typeof input === 'string') return input;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return Buffer.from(bytes).toString('base64url');
}
function base64urlToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'));
}
function safeParseJSON<T>(s?: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
