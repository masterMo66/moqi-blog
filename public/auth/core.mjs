// This is a convenience gate, not server-side access control.
export const account = Object.freeze({
  username: "moqi",
  salt: "51f82dce7ec80922d7eaf0688e7bd08a",
  iterations: 600000,
  verifier: "13acab66085b194f141fab3b8de97ff8cf7e653bdf82ee569e7a6179a6947cb5",
});
export const SESSION_KEY = "moqilog.gate.v1";
export const SESSION_MS = 8 * 60 * 60 * 1000;

export async function verifyCredentials(username, password, config = account) {
  if (username !== config.username || !password) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: Uint8Array.from(config.salt.match(/../g), (byte) => parseInt(byte, 16)),
    iterations: config.iterations,
  }, key, 256);
  const hex = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex === config.verifier;
}

export function validSession(raw, now = Date.now()) {
  try {
    const session = JSON.parse(raw);
    return session?.username === account.username &&
      session.version === account.verifier &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > now && session.expiresAt <= now + SESSION_MS;
  } catch {
    return false;
  }
}
