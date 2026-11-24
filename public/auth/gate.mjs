import { account, SESSION_KEY, SESSION_MS, validSession, verifyCredentials } from "./core.mjs";

const root = document.documentElement;
const form = document.getElementById("login-form");
const username = document.getElementById("login-username");
const password = document.getElementById("login-password");
const error = document.getElementById("login-error");
const submit = document.getElementById("login-submit");
let expiryTimer;

function lock() {
  clearTimeout(expiryTimer);
  root.classList.add("gate-locked");
  password.value = "";
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be blocked. */ }
  username.focus();
}

function restore() {
  clearTimeout(expiryTimer);
  let raw;
  try { raw = sessionStorage.getItem(SESSION_KEY); } catch { /* Fail closed. */ }
  if (!validSession(raw)) {
    lock();
    return;
  }
  root.classList.remove("gate-locked");
  expiryTimer = setTimeout(lock, JSON.parse(raw).expiresAt - Date.now());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  submit.textContent = "正在登录…";
  error.textContent = "";
  try {
    const accepted = await verifyCredentials(username.value.trim(), password.value);
    password.value = "";
    if (!accepted) {
      error.textContent = "用户名或密码错误。";
      password.focus();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: account.username,
      version: account.verifier,
      expiresAt: Date.now() + SESSION_MS,
    }));
    restore();
    document.getElementById("logout-button").focus();
  } catch {
    password.value = "";
    error.textContent = "无法完成登录，请确认浏览器允许此网站使用会话存储，并通过 HTTPS 访问。";
  } finally {
    submit.disabled = false;
    submit.textContent = "登录";
  }
});

document.getElementById("logout-button").addEventListener("click", () => {
  error.textContent = "";
  lock();
});
window.addEventListener("pageshow", restore);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) restore();
});

if (!globalThis.crypto?.subtle) {
  error.textContent = "请使用支持安全连接的浏览器，通过 HTTPS 打开本站。";
  submit.textContent = "暂时无法登录";
} else {
  submit.disabled = false;
  submit.textContent = "登录";
  restore();
}
