/* auth-gate.js — تسجيل الدخول المشترك لكل برامج الـ Apps hub (v1.0)
 *
 * كل برنامج بيستدعيه قبل ما يقرا أو يكتب في Firebase، مرة واحدة لكل جهاز (الدخول بيتحفظ):
 *   - SDK الجديد (modular v9/v10):   await AppAuth.modular(app, '10.12.0')
 *   - SDK compat أو v8 (window.firebase): await AppAuth.compat(firebase, app)   (بعد initializeApp؛ app لو التطبيق بالاسم)
 *   - طلبات REST مباشرة:              const t = await AppAuth.restToken();  url + '?auth=' + t
 * وكمان: AppAuth.user() (الاسم/الإيميل الحالي)، AppAuth.signOut().
 * الصلاحيات نفسها في قواعد Firebase (acl/<uid>): كل حساب يشوف برامجه بس.
 */
(function () {
  'use strict';
  var API_KEY = 'AIzaSyAp3pbA-jRE1IhgZiBGsC18s8XOC9lWATs';
  var REST_KEY = 'appauth.rest.v1';
  var current = null, signOutFn = null, pending = null, sdkUser = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('تعذر تحميل ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------- شاشة الدخول ---------- */
  function showLogin(tryLogin) {
    if (pending) return pending;
    pending = new Promise(function (resolve, reject) {
      var w = document.createElement('div');
      w.id = 'appauth-gate';
      w.setAttribute('dir', 'rtl');
      w.innerHTML =
        '<style>#appauth-gate{position:fixed;inset:0;z-index:2147483647;background:rgba(11,31,61,.97);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,-apple-system,"Segoe UI",Tahoma,sans-serif}' +
        '#appauth-gate form{background:#f7f2e8;border:1px solid #dfd3bb;border-top:4px solid #c9a24a;border-radius:16px;padding:22px 18px;width:100%;max-width:360px;color:#1b2a44;box-shadow:0 10px 40px rgba(0,0,0,.35)}' +
        '#appauth-gate h2{margin:0 0 4px;font-size:20px;color:#10294d}#appauth-gate p{margin:0 0 16px;font-size:13px;color:#6b7385}' +
        '#appauth-gate label{display:block;font-size:12px;font-weight:700;color:#10294d;margin:10px 0 4px}' +
        '#appauth-gate input{width:100%;box-sizing:border-box;min-height:46px;border:1px solid #dfd3bb;border-radius:10px;padding:10px;font:inherit;font-size:16px;background:#fffdf8;direction:ltr;text-align:left}' +
        '#appauth-gate button{margin-top:16px;width:100%;min-height:48px;border:0;border-radius:11px;background:#1f7a57;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}' +
        '#appauth-gate button:disabled{opacity:.6}#appauth-gate .err{color:#c0262d;font-size:13px;font-weight:700;margin-top:10px;min-height:18px}</style>' +
        '<form autocomplete="on"><h2>🔐 تسجيل الدخول</h2><p>مرة واحدة على الجهاز ده. البيانات محمية ومحدش يشوفها غير الحسابات المسموح لها.</p>' +
        '<label for="appauth-email">الإيميل</label><input id="appauth-email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" required>' +
        '<label for="appauth-pass">الباسورد</label><div style="position:relative"><input id="appauth-pass" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required style="padding-left:52px">' +
        '<button type="button" id="appauth-eye" aria-label="إظهار الباسورد" style="position:absolute;left:4px;top:4px;margin:0;width:44px;min-height:38px;background:#efe7d6;color:#10294d;font-size:18px;padding:0">👁</button></div>' +
        '<button type="submit">دخول</button><div class="err" id="appauth-err"></div>' +
        '<a href="#" id="appauth-skip" style="display:block;text-align:center;margin-top:6px;font-size:13px;color:#6b7385">استخدم البرنامج على الجهاز ده من غير مزامنة</a></form>';
      (document.body || document.documentElement).appendChild(w);
      var f = w.querySelector('form'), btn = w.querySelector('button'), err = w.querySelector('#appauth-err');
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        // المسافات اللي بتيجي مع النسخ واللصق بتبوّظ الباسورد: بتتشال (الباسوردات مفيهاش مسافات)
        var e = w.querySelector('#appauth-email').value.replace(/\s+/g, '').toLowerCase(), p = w.querySelector('#appauth-pass').value.replace(/\s+/g, '');
        btn.disabled = true; err.textContent = '';
        tryLogin(e, p).then(function (u) {
          w.remove(); pending = null; resolve(u);
        }).catch(function (x) {
          btn.disabled = false;
          var c = String((x && (x.code || x.message)) || x);
          err.textContent = /network|fetch|offline/i.test(c) ? 'مفيش إنترنت، جرّب تاني'
            : /too-many|TOO_MANY/i.test(c) ? 'محاولات كتير، استنى دقيقة'
            : 'الإيميل أو الباسورد غلط';
        });
      });
      w.querySelector('#appauth-eye').addEventListener('click', function () {
        var i = w.querySelector('#appauth-pass'); i.type = i.type === 'password' ? 'text' : 'password';
      });
      w.querySelector('#appauth-skip').addEventListener('click', function (ev) {
        ev.preventDefault(); w.remove(); pending = null; reject(new Error('appauth-skipped'));
      });
      setTimeout(function () { try { w.querySelector('#appauth-email').focus(); } catch (e) { } }, 50);
    });
    return pending;
  }

  function remember(u) {
    current = u ? { uid: u.uid || u.localId, email: u.email } : null;
    if (u && typeof u.getIdToken === 'function') sdkUser = u;   // البرامج اللي فيها SDK و REST مع بعض: نفس الدخول
    return u;
  }

  /* ---------- SDK الجديد (modular) ---------- */
  function modular(app, ver) {
    ver = ver || '10.12.0';
    return import('https://www.gstatic.com/firebasejs/' + ver + '/firebase-auth.js').then(function (A) {
      var auth = A.getAuth(app);
      signOutFn = function () { return A.signOut(auth); };
      return new Promise(function (r) { var un = A.onAuthStateChanged(auth, function (x) { un(); r(x); }); }).then(function (u) {
        if (u) return remember(u);
        return showLogin(function (e, p) { return A.signInWithEmailAndPassword(auth, e, p).then(function (c) { return remember(c.user); }); });
      });
    });
  }

  /* ---------- SDK compat / v8 (window.firebase) ---------- */
  function compat(fb, app) {   // app = تطبيق Firebase بالاسم (لو البرنامج عامل initializeApp(cfg, 'اسم'))
    fb = fb || window.firebase;
    var v = fb.SDK_VERSION || '9.23.0';
    var src = 'https://www.gstatic.com/firebasejs/' + v + '/firebase-auth' + (/^8\./.test(v) ? '' : '-compat') + '.js';
    return (typeof fb.auth === 'function' ? Promise.resolve() : loadScript(src)).then(function () {
      var auth = app && typeof app.auth === 'function' ? app.auth() : fb.auth();
      signOutFn = function () { return auth.signOut(); };
      return new Promise(function (r) { var un = auth.onAuthStateChanged(function (x) { un(); r(x); }); }).then(function (u) {
        if (u) return remember(u);
        return showLogin(function (e, p) { return auth.signInWithEmailAndPassword(e, p).then(function (c) { return remember(c.user); }); });
      });
    });
  }

  /* ---------- REST (برامج بتكلم القاعدة بـ fetch مباشرة) ---------- */
  function restSave(o) { try { localStorage.setItem(REST_KEY, JSON.stringify(o)); } catch (e) { } }
  function restLoad() { try { return JSON.parse(localStorage.getItem(REST_KEY) || 'null'); } catch (e) { return null; } }
  function post(url, body, form) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? body : JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); });
  }
  function restToken() {
    if (sdkUser) return sdkUser.getIdToken();
    if (pending) return pending.then(function () { return restToken(); });
    var s = restLoad();
    if (s && s.idToken && Date.now() < s.exp - 60000) { remember({ uid: s.uid, email: s.email }); return Promise.resolve(s.idToken); }
    if (s && s.refreshToken) {
      return post('https://securetoken.googleapis.com/v1/token?key=' + API_KEY,
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken), true).then(function (j) {
        var o = { idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in) * 1000, uid: j.user_id, email: s.email };
        restSave(o); remember(o); return o.idToken;
      }).catch(function (x) {
        if (/network|fetch/i.test(String(x))) throw x;   // من غير نت: مايطلبش الدخول تاني
        restSave(null); return restToken();
      });
    }
    return showLogin(function (e, p) {
      return post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
        { email: e, password: p, returnSecureToken: true }).then(function (j) {
        var o = { idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn) * 1000, uid: j.localId, email: j.email };
        restSave(o); return remember(o);
      });
    }).then(function () { return restLoad().idToken; });
  }

  window.AppAuth = {
    modular: modular,
    compat: compat,
    restToken: restToken,
    user: function () { return current; },
    signOut: function () {
      restSave(null);
      return Promise.resolve(signOutFn ? signOutFn() : null).then(function () { location.reload(); });
    }
  };
})();
