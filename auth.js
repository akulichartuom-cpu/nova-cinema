/*
 * NOVA CINEMA — вход по логину/паролю для служебных страниц (admin.html, operator.html).
 *
 * ВАЖНО: это лёгкий заслон от случайного гостя, а не настоящая защита.
 * Сайт статический и открытый (репозиторий публичный) — весь код, включая
 * хэш пароля ниже, виден любому в исходниках. Проверка происходит целиком
 * в браузере, так что человек, который откроет консоль разработчика или
 * посмотрит исходный код страницы, может обойти вход. Не используйте здесь
 * пароль, которым пользуетесь где-то ещё, и не полагайтесь на это как на
 * защиту реальных персональных данных или платежей.
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "nova_staff_session";
  var CRED_KEY = "nova_staff_cred";

  // Пароль по умолчанию: nova2026 (логин: nova). Меняется через
  // NovaAuth.changePassword(...) — форма "Сменить пароль" есть в admin.html.
  var DEFAULT_USERNAME = "nova";
  var DEFAULT_PASSWORD_HASH = "46cde98529630458a95bb5974210c1b1a0a76debaf8f4024301dd84782024db2";

  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function getCred() {
    try {
      var raw = JSON.parse(localStorage.getItem(CRED_KEY) || "null");
      if (raw && raw.username && raw.hash) return raw;
    } catch (e) {}
    return { username: DEFAULT_USERNAME, hash: DEFAULT_PASSWORD_HASH };
  }

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === "1" || localStorage.getItem(SESSION_KEY) === "1";
  }

  function login(username, password, remember) {
    var cred = getCred();
    return sha256Hex(password || "").then(function (hash) {
      var ok = (username || "").trim().toLowerCase() === cred.username.toLowerCase() && hash === cred.hash;
      if (ok) {
        if (remember) localStorage.setItem(SESSION_KEY, "1");
        else sessionStorage.setItem(SESSION_KEY, "1");
      }
      return ok;
    });
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function changePassword(newUsername, newPassword) {
    return sha256Hex(newPassword).then(function (hash) {
      localStorage.setItem(CRED_KEY, JSON.stringify({ username: newUsername.trim(), hash: hash }));
    });
  }

  function currentUsername() {
    return getCred().username;
  }

  var GATE_CSS =
    "#novaAuthGate{position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;" +
    "background:var(--bg,#0b0d12);font-family:'Montserrat',sans-serif;}" +
    "#novaAuthGate .box{width:340px;max-width:90vw;background:var(--card,#171a22);" +
    "border:1px solid var(--border,rgba(212,175,55,.18));border-radius:12px;padding:30px 26px;}" +
    "#novaAuthGate .eyebrow{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.14em;" +
    "font-size:11px;color:var(--gold,#d4af37);margin-bottom:8px;}" +
    "#novaAuthGate h1{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.04em;" +
    "font-size:20px;color:var(--text,#f1f0ec);margin-bottom:20px;}" +
    "#novaAuthGate label{display:block;font-family:'Oswald',sans-serif;text-transform:uppercase;" +
    "letter-spacing:.05em;font-size:11px;color:var(--muted,#9a9ba3);margin-bottom:6px;}" +
    "#novaAuthGate input{width:100%;font-family:'Montserrat',sans-serif;font-size:14px;" +
    "background:var(--bg-soft,#12151c);border:1px solid var(--border,rgba(212,175,55,.18));" +
    "border-radius:7px;padding:10px 12px;color:var(--text,#f1f0ec);margin-bottom:14px;}" +
    "#novaAuthGate input:focus{outline:none;border-color:var(--gold,#d4af37);}" +
    "#novaAuthGate .row{display:flex;align-items:center;gap:8px;margin-bottom:18px;font-size:12.5px;color:var(--muted,#9a9ba3);}" +
    "#novaAuthGate button{width:100%;padding:13px;font-family:'Oswald',sans-serif;text-transform:uppercase;" +
    "letter-spacing:.05em;font-size:13px;font-weight:600;border:none;border-radius:6px;cursor:pointer;" +
    "background:linear-gradient(135deg,var(--gold-soft,#e8c766),var(--gold,#d4af37));color:#141414;}" +
    "#novaAuthGate .err{font-size:12px;color:#e08a7c;margin-top:12px;min-height:1.4em;}" +
    "#novaAuthGate .hint{font-size:11px;color:var(--muted,#9a9ba3);margin-top:16px;line-height:1.5;}";

  function renderGate(onSuccess) {
    var style = document.createElement("style");
    style.textContent = GATE_CSS;
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "novaAuthGate";
    overlay.innerHTML =
      '<div class="box">' +
        '<div class="eyebrow">NOVA CINEMA · для персонала</div>' +
        '<h1>Вход в панель</h1>' +
        '<form id="novaAuthForm">' +
          '<label>Логин</label><input type="text" id="novaAuthUser" autocomplete="username" autofocus>' +
          '<label>Пароль</label><input type="password" id="novaAuthPass" autocomplete="current-password">' +
          '<div class="row"><input type="checkbox" id="novaAuthRemember" checked style="width:auto;margin:0;">' +
            '<span>Запомнить на этом устройстве</span></div>' +
          '<button type="submit">Войти</button>' +
          '<div class="err" id="novaAuthErr"></div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById("novaAuthForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var user = document.getElementById("novaAuthUser").value;
      var pass = document.getElementById("novaAuthPass").value;
      var remember = document.getElementById("novaAuthRemember").checked;
      login(user, pass, remember).then(function (ok) {
        if (ok) {
          overlay.remove();
          style.remove();
          onSuccess();
        } else {
          document.getElementById("novaAuthErr").textContent = "Неверный логин или пароль.";
          document.getElementById("novaAuthPass").value = "";
          document.getElementById("novaAuthPass").focus();
        }
      });
    });
  }

  // Запускает onReady(), только если уже залогинен; иначе сперва показывает
  // форму входа. Ничего из содержимого страницы не строится до успешного входа.
  function guard(onReady) {
    if (isLoggedIn()) { onReady(); return; }
    renderGate(onReady);
  }

  global.NovaAuth = {
    guard: guard,
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    changePassword: changePassword,
    currentUsername: currentUsername
  };
})(window);
