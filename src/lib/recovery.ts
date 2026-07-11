import { IS_MOCK } from "./config";

const CODE_LENGTH = 16;
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateRecoveryCode(): Promise<{ plainText: string; hash: string }> {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let plainText = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    plainText += CHARS[bytes[i] % CHARS.length];
  }
  const hash = await hashCode(plainText);
  return { plainText, hash };
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToHex(hashBuffer);
}

export async function verifyCode(code: string, storedHash: string): Promise<boolean> {
  const hash = await hashCode(code.toUpperCase());
  return hash === storedHash;
}

const MOCK_STORAGE_KEY = "mock_recovery_code";

interface MockRecoveryData {
  userId: string;
  hash: string;
  created_at: string;
  last_used_at: string | null;
}

export function getMockRecoveryData(): MockRecoveryData | null {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setMockRecoveryData(data: MockRecoveryData): void {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
}

export function clearMockRecoveryData(): void {
  localStorage.removeItem(MOCK_STORAGE_KEY);
}

export async function storeRecoveryCode(userId: string, hash: string): Promise<void> {
  if (IS_MOCK) {
    setMockRecoveryData({ userId, hash, created_at: new Date().toISOString(), last_used_at: null });
    return;
  }
  try {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.from("recovery_codes").upsert(
      { user_id: userId, code_hash: hash, created_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) console.error("storeRecoveryCode error:", error);
  } catch (err) {
    console.error("storeRecoveryCode failed:", err);
  }
}



export async function logRecoveryAttempt(userId: string, success: boolean): Promise<void> {
  if (IS_MOCK) return;
  try {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.from("recovery_code_logs").insert({
      user_id: userId,
      attempted_at: new Date().toISOString(),
      success,
    });
    if (error) console.error("logRecoveryAttempt error:", error);
  } catch (err) {
    console.error("logRecoveryAttempt failed:", err);
  }
}
