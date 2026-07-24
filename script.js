var supabase;
var currentUser = null;
var adminHash = '';

(function init() {
  supabase = window.supabase.createClient(
    'https://iljsednetiogjtowlexo.supabase.co',
    'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
  );
  sha256('N0buSp@ce2024').then(function(h) { adminHash = h; });
  checkSession();
})();

function sha256(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    .then(function(h) { return Array.from(new Uint8Array(h)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join(''); });
}
function genSalt() {
  var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
  for (var i = 0; i < 16; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function checkSession() {
  var d = localStorage.getItem('ns');
  if (d) {
    try {
      var s = JSON.parse(d);
      if (s.uid && s.exp > Date.now()) { loadUser(s.uid); return; }
    } catch(e) {}
    localStorage.removeItem('ns');
  }
  showAuth();
}
function saveSession(uid) { localStorage.setItem('ns', JSON.stringify({ uid: uid, exp: Date.now() + 86400000 })); }
function showAuth() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app').style.display = 'none'; }
function showApp() { document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').style.display = 'flex'; switchTab('home'); }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchTab(t) {
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  document.getElementById('tab-' + t).classList.add('active');
  if (t === 'home') loadFeed();
}

// Регистрация + вход
function registerAndLogin() {
  if (!document.getElementById('agree-checkbox').checked) { alert('Согласитесь с правилами'); return; }
  var email = document.getElementById('reg-email').value.trim();
  var nick = document.getElementById('reg-nickname').value.trim();
  var pass = document.getElementById('reg-password').value;
  var bd = document.getElementById('reg-birthdate').value;
  if (!email || !nick || !pass || !bd) { alert('Заполните все поля'); return; }
  if (calcAge(bd) < 10) { alert('Минимум 10 лет'); return; }
  getIP(function(ip) {
    supabase.from('users').select('id').eq('email', email).single().then(function(r) {
      if (r.data) { alert('Email занят'); return; }
      var salt = genSalt();
      sha256(pass + salt).then(function(hp) {
        supabase.from('users').insert({ email: email, nickname: nick, password: hp, salt: salt, birth_date: bd, ip: ip }).then(function() {
          supabase.from('users').select('*').eq('email', email).single().then(function(ur) {
            currentUser = ur.data;
            saveSession(currentUser.id);
            closeModal('register-modal');
            showApp();
            loadFeed();
          });
        });
      });
    });
  });
}

function login() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-password').value;
  if (!email || !pass) return;
  supabase.from('users').select('*').eq('email', email).single().then(function(r) {
    if (r.error || !r.data) { alert('Неверно'); return; }
    sha256(pass + r.data.salt).then(function(hp) {
      if (hp !== r.data.password) { alert('Неверно'); return; }
      if (r.data.banned_until && new Date(r.data.banned_until) > new Date()) { alert('Аккаунт заблокирован'); return; }
      currentUser = r.data;
      saveSession(currentUser.id);
      closeModal('login-modal');
      showApp();
      loadFeed();
    });
  });
}

function logout() { localStorage.removeItem('ns'); currentUser = null; showAuth(); }

// Посты
function openPostModal() {
  if (!currentUser) return;
  document.getElementById('post-text').value = '';
  document.getElementById('post-preview').innerHTML = '';
  document.getElementById('post-warn').style.display = 'none';
  var ma = document.getElementById('media-area');
  if (calcAge(currentUser.birth_date) >= 18) {
    ma.innerHTML = '<div style="display:flex;gap:6px;"><label style="border:1px solid rgba(120,80,255,0.3);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;">Фото<input type="file" id="post-image" accept="image/*" onchange="previewMedia(\'image\')" style="display:none;"></label><label style="border:1px solid rgba(120,80,255,0.3);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;">Видео<input type="file" id="post-video" accept="video/*" onchange="previewMedia(\'video\')" style="display:none;"></label></div>';
  } else {
    ma.innerHTML = '<p style="color:#ffd700;font-size:0.75rem;">Медиа только с 18 лет</p>';
  }
  openModal('post-modal');
}
function previewMedia(t) {
  var inp = document.getElementById('post-' + t);
  if (inp && inp.files[0]) {
    var url = URL.createObjectURL(inp.files[0]);
    document.getElementById('post-preview').innerHTML = t === 'image'
      ? '<img src="' + url + '" style="max-width:100%;border-radius:10px;">'
      : '<video src="' + url + '" controls style="max-width:100%;border-radius:10px;"></video>';
  }
}
function createChirp() {
  if (!currentUser) return;
  var text = document.getElementById('post-text').value.trim();
  var img = document.getElementById('post-image') ? document.getElementById('post-image').files[0] : null;
  var vid = document.getElementById('post-video') ? document.getElementById('post-video').files[0] : null;
  if (!text && !img && !vid) return;
  var up = Promise.resolve({ image_url: null, video_url: null });
  if (img) up = uploadMedia(img, 'images');
  else if (vid) up = uploadMedia(vid, 'videos');
  up.then(function(urls) {
    supabase.from('chirps').insert({ user_id: currentUser.id, text: text, image_url: urls.image_url, video_url: urls.video_url }).then(function() {
      closeModal('post-modal');
      loadFeed();
    });
  });
}
function uploadMedia(file, bucket) {
  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).substring(2) + '.' + ext;
  return supabase.storage.from(bucket).upload(name, file, { cacheControl: '3600', upsert: false }).then(function(r) {
    if (r.error) throw r.error;
    var u = supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
    var o = {};
    if (bucket === 'images') o.image_url = u;
    else o.video_url = u;
    return o;
  });
}

// Лента
function loadFeed() {
  supabase.from('chirps').select('*, users!inner(nickname, verified)').order('created_at', { ascending: false }).then(function(r) {
    if (r.data) renderChirps(r.data, 'tab-home');
  });
}
function renderChirps(arr, cid) {
  var c = document.getElementById(cid);
  c.innerHTML = '';
  if (!arr || arr.length === 0) { c.innerHTML = '<p style="color:#5a5070;text-align:center;padding:30px;">Пока ничего нет</p>'; return; }
  for (var i = 0; i < arr.length; i++) {
    (function(ch) {
      var card = document.createElement('div');
      card.className = 'chirp';
      card.innerHTML = '<span class="id">' + ch.id.substring(0,8) + '</span>' +
        '<div class="head"><div class="ava">' + ch.users.nickname[0].toUpperCase() + '</div><span class="nick">' + ch.users.nickname + '</span>' + (ch.users.verified ? ' <span style="color:#ffd700;">✓</span>' : '') + '</div>' +
        '<div class="text">' + ch.text.replace(/#(\w+)/g, '<span style="color:#b388ff;cursor:pointer;" onclick="searchTag(\'$1\')">#$1</span>') + '</div>' +
        (ch.image_url ? '<div class="media"><img src="' + ch.image_url + '"></div>' : '') +
        (ch.video_url ? '<div class="media"><video src="' + ch.video_url + '" controls></video></div>' : '') +
        '<div class="acts"><span onclick="likeChirp(\'' + ch.id + '\',this)">❤️ <span class="lc">0</span></span><span onclick="openComments(\'' + ch.id + '\')">💬 0</span><span onclick="openReport(\'' + ch.id + '\')">⚠️</span></div>';
      c.appendChild(card);
      updCounts(ch.id, card);
    })(arr[i]);
  }
}
function updCounts(cid, card) {
  supabase.from('likes').select('id', { count: 'exact' }).eq('chirp_id', cid).then(function(r) { var s = card.querySelector('.lc'); if (s) s.textContent = r.count; });
  supabase.from('comments').select('id', { count: 'exact' }).eq('chirp_id', cid).then(function(r) { var s = card.querySelectorAll('.acts span')[1]; if (s) s.innerHTML = '💬 ' + r.count; });
}
function searchTag(t) { switchTab('search'); document.getElementById('search-input').value = '#' + t; onSearchInput(); }
function likeChirp(cid, el) {
  supabase.from('likes').select('*').eq('user_id', currentUser.id).eq('chirp_id', cid).single().then(function(r) {
    if (r.data) { supabase.from('likes').delete().eq('id', r.data.id).then(function() { updLike(cid, el); }); }
    else { supabase.from('likes').insert({ user_id: currentUser.id, chirp_id: cid }).then(function() { updLike(cid, el); }); }
  });
}
function updLike(cid, el) {
  supabase.from('likes').select('id', { count: 'exact' }).eq('chirp_id', cid).then(function(r) { el.querySelector('.lc').textContent = r.count; });
  supabase.from('likes').select('id').eq('user_id', currentUser.id).eq('chirp_id', cid).single().then(function(r) { if (r.data) el.classList.add('liked'); else el.classList.remove('liked'); });
}

// Комментарии
function openComments(cid) { window.ccid = cid; loadComments(cid); openModal('comments-modal'); }
function loadComments(cid) {
  supabase.from('comments').select('*, users(nickname)').eq('chirp_id', cid).order('created_at', { ascending: true }).then(function(r) {
    var l = document.getElementById('comments-list');
    l.innerHTML = '';
    if (r.data) for (var i = 0; i < r.data.length; i++) l.innerHTML += '<div style="margin-bottom:4px;"><b>' + r.data[i].users.nickname + '</b>: ' + r.data[i].text + '</div>';
  });
}
function submitComment() {
  var t = document.getElementById('comment-input').value.trim();
  if (!t) return;
  supabase.from('comments').insert({ chirp_id: window.ccid, user_id: currentUser.id, text: t }).then(function() {
    document.getElementById('comment-input').value = '';
    loadComments(window.ccid);
  });
}

// Жалобы
function openReport(cid) { window.rcid = cid; openModal('report-modal'); }
function submitReport() {
  var r = document.getElementById('report-reason').value.trim();
  if (!r) return;
  supabase.from('reports').insert({ chirp_id: window.rcid, reporter_id: currentUser.id, reason: r }).then(function() { alert('Отправлено'); closeModal('report-modal'); });
}

// Поиск
function onSearchInput() {
  var q = document.getElementById('search-input').value.trim();
  if (!q || !q.startsWith('#')) { document.getElementById('search-results').innerHTML = ''; return; }
  supabase.from('chirps').select('*, users!inner(nickname, verified)').ilike('text', '%' + q + '%').order('created_at', { ascending: false }).then(function(r) { if (r.data) renderChirps(r.data, 'search-results'); });
}

// Профиль
function showProfile(uid) {
  supabase.from('users').select('*').eq('id', uid).single().then(function(r) {
    if (!r.data) return;
    document.getElementById('tab-profile').innerHTML = '<div class="card" style="text-align:center;"><div class="ava" style="width:60px;height:60px;font-size:1.5rem;margin:0 auto 10px;">' + r.data.nickname[0].toUpperCase() + '</div><h2>' + r.data.nickname + '</h2><p class="muted">' + calcAge(r.data.birth_date) + ' лет</p></div><div id="profile-chirps"></div>';
    switchTab('profile');
    supabase.from('chirps').select('*, users!inner(nickname, verified)').eq('user_id', uid).order('created_at', { ascending: false }).then(function(cr) { renderChirps(cr.data, 'profile-chirps'); });
  });
}

// Админка
function openAdminLogin() { openModal('admin-login-modal'); }
function adminLogin() {
  sha256(document.getElementById('admin-pass-input').value).then(function(h) {
    if (h === adminHash) { closeModal('admin-login-modal'); openModal('admin-panel-modal'); adminTab('users'); }
    else alert('Неверный пароль');
  });
}
function adminTab(t) {
  var c = document.getElementById('admin-content');
  if (t === 'users') { c.innerHTML = '<input id="admin-user-search" placeholder="Поиск" oninput="adminSearchUsers()" style="margin-bottom:8px;"><div id="admin-users-list"></div>'; adminSearchUsers(); }
  else if (t === 'reports') { c.innerHTML = '<div id="admin-reports-list"></div>'; loadAdminReports(); }
  else { c.innerHTML = '<div id="admin-messages-list"></div>'; loadAdminMessages(); }
}
function adminSearchUsers() {
  var q = document.getElementById('admin-user-search') ? document.getElementById('admin-user-search').value.trim() : '';
  var rq = supabase.from('users').select('*').order('created_at');
  if (q) rq = rq.or('nickname.ilike.%' + q + '%,email.ilike.%' + q + '%');
  rq.then(function(r) {
    var l = document.getElementById('admin-users-list');
    l.innerHTML = '';
    if (r.data) for (var i = 0; i < r.data.length; i++) {
      var u = r.data[i];
      l.innerHTML += '<div style="border-bottom:1px solid rgba(120,80,255,0.1);padding:8px;"><b>' + u.nickname + '</b> (' + u.email + ') ' + calcAge(u.birth_date) + 'л <button class="btn-sm red" onclick="destroyAccount(\'' + u.id + '\')">Снос</button></div>';
    }
  });
}
function destroyAccount(uid) {
  if (!confirm('Уничтожить аккаунт?')) return;
  supabase.from('users').select('ip').eq('id', uid).single().then(function(r) {
    var ip = r.data ? r.data.ip : null;
    supabase.from('users').update({ banned_until: new Date('2099-01-01').toISOString() }).eq('id', uid).then(function() {
      if (ip) supabase.from('banned_ips').insert({ ip: ip, reason: 'Снос #' + uid, banned_until: new Date('2099-01-01').toISOString() }).then(function() {});
      supabase.from('chirps').delete().eq('user_id', uid).then(function() { alert('Готово'); adminSearchUsers(); });
    });
  });
}
function deleteChirpById() {
  var id = document.getElementById('delete-post-id').value.trim();
  if (!id) return;
  supabase.from('chirps').delete().eq('id', id).then(function() { alert('Удалён'); document.getElementById('delete-post-id').value = ''; });
}
function loadAdminReports() {
  supabase.from('reports').select('*, chirps(text, id), users!reporter_id(nickname)').order('created_at', { ascending: false }).then(function(r) {
    var l = document.getElementById('admin-reports-list');
    l.innerHTML = '';
    if (r.data) for (var i = 0; i < r.data.length; i++) {
      var x = r.data[i];
      l.innerHTML += '<div style="border-bottom:1px solid rgba(120,80,255,0.1);padding:8px;">' + x.users.nickname + ': ' + x.reason + ' <button class="btn-sm red" onclick="deleteChirp(\'' + x.chirp_id + '\')">Удалить</button></div>';
    }
  });
}
function deleteChirp(cid) { supabase.from('chirps').delete().eq('id', cid).then(function() { loadAdminReports(); }); }
function loadAdminMessages() {
  supabase.from('admin_messages').select('*, users(nickname)').order('created_at', { ascending: false }).then(function(r) {
    var l = document.getElementById('admin-messages-list');
    l.innerHTML = '';
    if (r.data) for (var i = 0; i < r.data.length; i++) l.innerHTML += '<div style="border-bottom:1px solid rgba(120,80,255,0.1);padding:8px;"><b>' + r.data[i].users.nickname + '</b>: ' + r.data[i].message + '</div>';
  });
}

// Документы
function openDoc(t) {
  var d = '';
  if (t === 'terms') d = '<h2>Условия</h2><p>Сервис 10+. Медиа с 18. За нарушения — бан. Администрация не несёт ответственности. Вы отказываетесь от исков.</p>';
  else if (t === 'privacy') d = '<h2>Политика</h2><p>Собираем email, ник, дату, IP. Пароль — SHA-256 с солью. Данные не передаём.</p>';
  else d = '<h2>Правила</h2><p>1. Без оскорблений. 2. Без 18+. 3. Без спама. 4. Обход бана = снос.</p>';
  document.getElementById('doc-text').innerHTML = d;
  openModal('doc-modal');
}

// Вспомогательные
function calcAge(b) { var bb = new Date(b), n = new Date(), a = n.getFullYear() - bb.getFullYear(); if (n.getMonth() < bb.getMonth() || (n.getMonth() === bb.getMonth() && n.getDate() < bb.getDate())) a--; return a; }
function getIP(cb) { fetch('https://api.ipify.org?format=json').then(function(r) { return r.json(); }).then(function(d) { cb(d.ip); }).catch(function() { cb('0.0.0.0'); }); }
function loadUser(uid) { supabase.from('users').select('*').eq('id', uid).single().then(function(r) { if (r.error || !r.data) { localStorage.removeItem('ns'); showAuth(); return; } currentUser = r.data; showApp(); loadFeed(); }); }

// Глобальные
window.openModal = openModal;
window.closeModal = closeModal;
window.registerAndLogin = registerAndLogin;
window.login = login;
window.logout = logout;
window.openPostModal = openPostModal;
window.previewMedia = previewMedia;
window.createChirp = createChirp;
window.likeChirp = likeChirp;
window.openComments = openComments;
window.submitComment = submitComment;
window.openReport = openReport;
window.submitReport = submitReport;
window.onSearchInput = onSearchInput;
window.searchTag = searchTag;
window.showProfile = showProfile;
window.openAdminLogin = openAdminLogin;
window.adminLogin = adminLogin;
window.adminTab = adminTab;
window.adminSearchUsers = adminSearchUsers;
window.destroyAccount = destroyAccount;
window.deleteChirpById = deleteChirpById;
window.deleteChirp = deleteChirp;
window.openDoc = openDoc;
window.switchTab = switchTab;