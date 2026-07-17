import { createHmac, timingSafeEqual } from "crypto";

import {
  type OfflineAuthorizationRecord,
} from "./offlineAccess";

type OfflineAuthorizationPayload = {
  accountId: string;
  deviceId: string;
  expiresAt: string;
  id: string;
  issuedAt: string;
  planId: string | null;
  startsAt: string;
  userId: string;
};

export function buildOfflineAuthorizationRecord(
  payload: OfflineAuthorizationPayload
): OfflineAuthorizationRecord {
  return {
    authorization: signOfflineAuthorization(payload),
    deviceId: payload.deviceId,
    expiresAt: payload.expiresAt,
    id: payload.id,
    issuedAt: payload.issuedAt,
    startsAt: payload.startsAt,
    status: "active",
  };
}

export function signOfflineAuthorization(payload: OfflineAuthorizationPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", offlineAuthorizationSigningSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyOfflineAuthorization(
  authorization: string
): OfflineAuthorizationPayload | null {
  const [encodedPayload, signature] = authorization.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac(
    "sha256",
    offlineAuthorizationSigningSecret()
  )
    .update(encodedPayload)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    return payload && typeof payload === "object"
      ? (payload as OfflineAuthorizationPayload)
      : null;
  } catch {
    return null;
  }
}

function offlineAuthorizationSigningSecret() {
  const explicitSecret = process.env.OFFLINE_AUTHORIZATION_SIGNING_SECRET?.trim();
  if (explicitSecret) return explicitSecret;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) return serviceRoleKey;

  throw new Error("Missing offline authorization signing secret.");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
