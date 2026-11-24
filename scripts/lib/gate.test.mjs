import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { account, SESSION_MS, validSession, verifyCredentials } from "../../public/auth/core.mjs";

test("only the configured username and matching password are accepted", async () => {
  const fixture = { username: "moqi", salt: "00112233445566778899aabbccddeeff", iterations: 1000 };
  fixture.verifier = pbkdf2Sync("test-only-password", Buffer.from(fixture.salt, "hex"), fixture.iterations, 32, "sha256").toString("hex");
  assert.equal(await verifyCredentials("moqi", "test-only-password", fixture), true);
  assert.equal(await verifyCredentials("other", "test-only-password", fixture), false);
  assert.equal(await verifyCredentials("moqi", "wrong", fixture), false);
  assert.equal(await verifyCredentials("moqi", "", fixture), false);
});

test("sessions reject expired, forged-shape, wrong-user and obsolete-version data", () => {
  const now = Date.now();
  const session = { username: account.username, version: account.verifier, expiresAt: now + SESSION_MS };
  assert.equal(validSession(JSON.stringify(session), now), true);
  for (const changed of [
    { expiresAt: now }, { expiresAt: now + SESSION_MS + 1 },
    { username: "other" }, { version: "obsolete" }, { expiresAt: "never" },
  ]) assert.equal(validSession(JSON.stringify({ ...session, ...changed }), now), false);
  for (const raw of [null, "bad json", "{}", "null"]) assert.equal(validSession(raw, now), false);
});

test("all generated page types use a locked shell before scripts load", async () => {
  const source = await readFile(new URL("../build.mjs", import.meta.url), "utf8");
  assert.match(source, /<html lang="zh-CN" class="gate-locked">/);
  assert.match(source, /gate-locked main\{display:none!important\}/);
  assert.match(source, /type="password" autocomplete="current-password"/);
  assert.match(source, /<noscript>/);
});
