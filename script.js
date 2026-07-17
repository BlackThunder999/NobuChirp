// ===================== КОНФИГ =====================
const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';
const ADMIN_PASS = 'NobuWaveAdmin2024';

// ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
let sb;
let user = null;
let admin = false;
let submitting = false;
let file = null;
let view = 'feed';
let profileId = null;
let commentPostId = null;
let reportPostId = null;
let commentChannel = null;
let feedChannel = null;
let selectedEmoji = '😊';
let timers = [];

// ===================== ЗАЩИТА ОТ БОТОВ =====================
const MAX_ACCOUNTS_PER_IP = 1; // Максимум аккаунтов с одного IP в сутки
const REGISTRATION_COOLDOWN_HOURS = 24; // Часов между регистрациями с одного IP

// ===================== УТИЛИТЫ =====================
function $(id) { return document.getElementById(id); }
function show(id) { $(id).style.display = 'flex'; }
function hide(id) { $(id).style.display = 'none'; }
function showBlock(id) { $(id).style.display = 'block'; }

function loading(on) {
    $('loading').style.display = on ? 'flex' : 'none';
}

function toast(msg, type = 'info') {
    const box = $('toastBox');
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function fmtTime(d) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 10) return 'только что';
    if (diff < 60) return Math.floor(diff) + 'с';
    if (diff < 3600) return Math.floor(diff / 60) + 'м';
    if (diff < 86400) return Math.floor(diff / 3600) + 'ч';
    return Math.floor(diff / 86400) + 'д';
}

function clearTimers() {
    timers.forEach(t => clearInterval(t));
    timers = [];
}

// Получить IP пользователя
async function getIP() {
    try {
        const r = await fetch('https://api.ipify.org?format=json');
        const d = await r.json();
        return d.ip;
    } catch {
        return 'unknown_' + Date.now();
    }
}

// ===================== СЕССИЯ =====================
function saveSession() {
    if (!user) return;
    localStorage.setItem('nc_v2', JSON.stringify({
        u: user,
        a: admin,
        exp: Date.now() + 7 * 86400000
    }));
}

function loadSession() {
    localStorage.removeItem('nc');
    localStorage.removeItem('nobuchirp_session');
    
    const raw = localStorage.getItem('nc_v2');
    if (!raw) return false;
    try {
        const d = JSON.parse(raw);
        if (Date.now() > d.exp) { localStorage.removeItem('nc_v2'); return false; }
        user = d.u;
        admin = d.a;
        return true;
    } catch { localStorage.removeItem('nc_v2'); return false; }
}

function logout() {
    localStorage.removeItem('nc');
    localStorage.removeItem('nobuchirp_session');
    localStorage.removeItem('nc_v2');
    user = null;
    admin = false;
    clearTimers();
    if (commentChannel) { sb.removeChannel(commentChannel); commentChannel = null; }
    if (feedChannel) { sb.removeChannel(feedChannel); feedChannel = null; }
    hide('appScreen'); hide('banScreen'); hide('warnScreen');
    show('authScreen');
    $('authNick').value = '';
    $('authPass').value = '';
}

// ===================== ПРОВЕРКА НИКНЕЙМА =====================
function validateNickname(nick) {
    // Запрещаем эмодзи
    if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}\u{2B55\u{200D}\u{200B}\u{200C}\u{200E}\u{200F}]/u.test(nick)) {
        return { valid: false, reason: 'Эмодзи в никнейме запрещены' };
    }
    
    // Запрещаем галочки и спецсимволы
    if (/[✓✔☑✅✗✘☐☒✕✖✕✖⭐🌟✨💫🔥💯🎯🏆👑💎🔷🔶🔸🔹◉◎●○◯□■△▲▽▼☆★♦♥♣♠•◘◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼!@#$%^&*()+=<>{}[\]|\\:;"'`,~]/.test(nick)) {
        return { valid: false, reason: 'Спецсимволы в никнейме запрещены' };
    }
    
    // Запрещаем Unicode-трюки (буквы из других алфавитов похожие на латиницу/кириллицу)
    if (/[αβγδεζηθικλμνξοπρστυφχψωςΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/.test(nick)) {
        return { valid: false, reason: 'Запрещённые символы в никнейме' };
    }
    
    // Только буквы, цифры, точка, подчёркивание, дефис
    if (/[^a-zA-Z0-9а-яА-ЯёЁ_.\-]/.test(nick)) {
        return { valid: false, reason: 'Разрешены только буквы, цифры, точка, дефис и подчёркивание' };
    }
    
    // Минимальная длина
    if (nick.length < 3) {
        return { valid: false, reason: 'Никнейм должен быть не менее 3 символов' };
    }
    
    // Максимальная длина
    if (nick.length > 30) {
        return { valid: false, reason: 'Никнейм должен быть не более 30 символов' };
    }
    
    // Запрещаем повторяющиеся символы (>5 подряд)
    if (/(.)\1{5,}/.test(nick)) {
        return { valid: false, reason: 'Слишком много повторяющихся символов' };
    }
    
    return { valid: true };
}

// Проверка IP лимита
async function checkIPLimit(ip) {
    const since = new Date(Date.now() - REGISTRATION_COOLDOWN_HOURS * 3600000).toISOString();
    
    // Считаем успешные регистрации с этого IP за последние 24 часа
    const { count } = await sb
        .from('registration_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .eq('success', true)
        .gte('created_at', since);
    
    return count < MAX_ACCOUNTS_PER_IP;
}

// ===================== ПРОВЕРКА БАНА/ПРЕДУПРЕЖДЕНИЯ =====================
async function checkStatus() {
    if (!user) return;
    try {
        const { data } = await sb.from('users').select('is_banned,ban_reason,ban_expires_at,has_warning,warning_message').eq('id', user.id).single();
        if (!data) return;
        if (data.is_banned) {
            user.is_banned = true;
            user.ban_reason = data.ban_reason;
            user.ban_expires_at = data.ban_expires_at;
            saveSession();
            showBan();
            return;
        }
        if (data.has_warning) {
            user.has_warning = true;
            user.warning_message = data.warning_message;
            saveSession();
            showWarning();
            return;
        }
        user.is_banned = false;
        user.has_warning = false;
    } catch {}
}

function startStatusCheck() {
    timers.push(setInterval(checkStatus, 10000));
}

// ===================== ЭКРАНЫ =====================
function showBan() {
    hide('appScreen'); hide('warnScreen'); hide('authScreen');
    show('banScreen');
    $('banReason').textContent = user.ban_reason || 'Нарушение правил';
    $('banExpires').textContent = user.ban_expires_at ? 'До: ' + new Date(user.ban_expires_at).toLocaleString('ru') : 'Навсегда';
}

function showWarning() {
    hide('appScreen'); hide('banScreen'); hide('authScreen');
    show('warnScreen');
    $('warnMsg').textContent = user.warning_message || 'Предупреждение';
    
    let sec = 180;
    const btn = $('warnAccept');
    btn.disabled = true;
    
    if (window._warnTimer) clearInterval(window._warnTimer);
    
    const update = () => {
        if (sec < 0) {
            btn.disabled = false;
            $('warnTimer').textContent = '0:00';
            clearInterval(window._warnTimer);
            return;
        }
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        $('warnTimer').textContent = m + ':' + String(s).padStart(2, '0');
        sec--;
    };
    
    update();
    window._warnTimer = setInterval(update, 1000);
    
    btn.onclick = async () => {
        clearInterval(window._warnTimer);
        await sb.from('users').update({ has_warning: false, warning_message: null, warning_expires_at: null }).eq('id', user.id);
        user.has_warning = false;
        user.warning_message = null;
        saveSession();
        showApp();
        toast('Предупреждение снято', 'ok');
    };
}

function showApp() {
    hide('authScreen'); hide('banScreen'); hide('warnScreen');
    showBlock('appScreen');
    $('btnAdmin').style.display = admin ? 'inline-block' : 'none';
    startStatusCheck();
    navTo('feed');
}

// ===================== АВТОРИЗАЦИЯ =====================
async function doAuth() {
    const nick = $('authNick').value.trim();
    const pass = $('authPass').value.trim();
    const isLogin = $('tabLogin').classList.contains('active');
    $('authError').textContent = '';
    
    if (!nick || !pass) { 
        $('authError').textContent = 'Заполните все поля'; 
        return; 
    }
    
    if (pass.length < 4) {
        $('authError').textContent = 'Пароль должен быть не менее 4 символов';
        return;
    }
    
    // Проверяем никнейм
    const validation = validateNickname(nick);
    if (!validation.valid) {
        $('authError').textContent = validation.reason;
        return;
    }
    
    loading(true);
    
    try {
        if (isLogin) {
            const { data, error } = await sb.from('users').select('*').eq('nickname', nick).eq('password', pass).single();
            if (error || !data) { 
                $('authError').textContent = 'Неверный никнейм или пароль'; 
                loading(false); 
                return; 
            }
            user = data;
            admin = data.is_admin;
            saveSession();
            if (data.is_banned) { showBan(); loading(false); return; }
            if (data.has_warning) { showWarning(); loading(false); return; }
            showApp();
            toast('С возвращением, ' + data.nickname + '!', 'ok');
        } else {
            // Проверка занятости ника
            const { data: exist } = await sb.from('users').select('id').eq('nickname', nick).single();
            if (exist) { 
                $('authError').textContent = 'Этот никнейм уже занят'; 
                loading(false); 
                return; 
            }
            
            // Получаем IP
            const ip = await getIP();
            
            // Логируем попытку
            await sb.from('registration_logs').insert({
                ip_address: ip,
                attempted_nickname: nick,
                success: false
            });
            
            // Проверяем IP лимит
            const canRegister = await checkIPLimit(ip);
            if (!canRegister) {
                $('authError').textContent = 'С вашего IP можно создать только 1 аккаунт в сутки';
                loading(false);
                return;
            }
            
            // Проверяем общее количество аккаунтов с этого IP
            const { data: ipUsers } = await sb.from('users').select('id').eq('ip_address', ip);
            if (ipUsers && ipUsers.length >= MAX_ACCOUNTS_PER_IP) {
                $('authError').textContent = 'Лимит аккаунтов для вашего IP исчерпан';
                loading(false);
                return;
            }
            
            // Создаём пользователя
            const { data: nu, error } = await sb.from('users').insert({ 
                nickname: nick, 
                password: pass, 
                emoji: '😊', 
                bio: '',
                is_verified: false,
                is_admin: false,
                is_banned: false,
                has_warning: false,
                streak: 0,
                ip_address: ip
            }).select().single();
            
            if (error) { 
                $('authError').textContent = 'Ошибка при регистрации. Попробуйте позже.'; 
                loading(false); 
                return; 
            }
            
            // Отмечаем успешную регистрацию
            await sb.from('registration_logs').insert({
                ip_address: ip,
                attempted_nickname: nick,
                success: true
            });
            
            user = nu;
            admin = false;
            saveSession();
            showApp();
            toast('Добро пожаловать в NobuChirp!', 'ok');
        }
    } catch (e) { 
        console.error('Auth error:', e);
        $('authError').textContent = 'Ошибка сервера. Попробуйте позже.'; 
    }
    loading(false);
}

// ===================== НАВИГАЦИЯ =====================
function navTo(v, param) {
    view = v;
    ['navFeed', 'navFollow', 'navTrends'].forEach(id => $(id).classList.remove('active'));
    if (v === 'feed') $('navFeed').classList.add('active');
    if (v === 'following') $('navFollow').classList.add('active');
    if (v === 'trends') $('navTrends').classList.add('active');
    loadView(v, param);
}

async function loadView(v, param) {
    const area = $('contentArea');
    area.innerHTML = '';
    if (v === 'feed') await loadPosts(area, false);
    else if (v === 'following') await loadPosts(area, true);
    else if (v === 'trends') await loadTrends(area);
    else if (v === 'profile') { profileId = param || user.id; await loadProfile(area, profileId); }
    else if (v === 'admin') await loadAdmin(area);
    else if (v === 'hashtag') await loadHashtag(area, param);
}

// ===================== ПОСТЫ =====================
async function loadPosts(area, following) {
    area.innerHTML = '';
    try {
        let query = sb.from('chirps').select('*, users!inner(id,nickname,emoji,is_verified,streak)').order('created_at', { ascending: false }).limit(50);
        if (following) {
            const { data: f } = await sb.from('follows').select('following_id').eq('follower_id', user.id);
            const ids = f ? f.map(x => x.following_id) : [];
            if (ids.length === 0) { area.innerHTML = '<div class="empty">Нет подписок</div>'; return; }
            query = query.in('user_id', ids);
        }
        const { data } = await query;
        if (!data || data.length === 0) { area.innerHTML = '<div class="empty">Пока тихо...</div>'; return; }
        for (const c of data) area.appendChild(await buildPost(c));
    } catch { area.innerHTML = '<div class="empty">Ошибка</div>'; }
    subscribeFeed();
}

async function buildPost(c) {
    const div = document.createElement('div');
    div.className = 'post' + (c.users?.streak >= 2 ? ' fire' : '');
    div.dataset.id = c.id;

    const [likes, dislikes, reps, coms, myLike, myDis, myRep] = await Promise.all([
        sb.from('likes').select('id', { count: 'exact', head: true }).eq('chirp_id', c.id),
        sb.from('dislikes').select('id', { count: 'exact', head: true }).eq('chirp_id', c.id),
        sb.from('rechirps').select('id', { count: 'exact', head: true }).eq('chirp_id', c.id),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('chirp_id', c.id),
        sb.from('likes').select('id').eq('chirp_id', c.id).eq('user_id', user.id).maybeSingle(),
        sb.from('dislikes').select('id').eq('chirp_id', c.id).eq('user_id', user.id).maybeSingle(),
        sb.from('rechirps').select('id').eq('chirp_id', c.id).eq('user_id', user.id).maybeSingle()
    ]);

    const txt = (c.content || '').replace(/(#[а-яё\w]+)/gi, '<span class="hash">$1</span>');
    div.innerHTML = `
        <div class="post-head">
            <div class="post-user">
                <span class="post-emoji">${c.users?.emoji||'😊'}</span>
                <span class="post-nick">${c.users?.nickname||'?'}</span>
                ${c.users?.is_verified?'<span class="post-verify">✓</span>':''}
                <span class="post-time">${fmtTime(c.created_at)}</span>
            </div>
            <span class="post-id">${c.id.slice(0,8)}</span>
        </div>
        <div class="post-text">${txt}</div>
        ${c.image_url?`<img class="post-img" src="${c.image_url}" loading="lazy">`:''}
        <div class="post-actions">
            <button class="act-btn like ${myLike.data?'liked':''}">❤️ ${likes.count||0}</button>
            <button class="act-btn dislike ${myDis.data?'disliked':''}">👎 ${dislikes.count||0}</button>
            <button class="act-btn repost ${myRep.data?'reposted':''}">🔄 ${reps.count||0}</button>
            <button class="act-btn comment">💬 ${coms.count||0}</button>
            <div style="position:relative;margin-left:auto;">
                <button class="menu-btn">⋮</button>
            </div>
        </div>
    `;

    div.querySelectorAll('.hash').forEach(h => h.onclick = () => navTo('hashtag', h.textContent));
    div.querySelector('.post-id').onclick = () => { navigator.clipboard.writeText(c.id).then(() => toast('ID скопирован', 'ok')).catch(() => {}); };
    div.querySelector('.like').onclick = () => toggleLike(c.id, div);
    div.querySelector('.dislike').onclick = () => toggleDislike(c.id, div);
    div.querySelector('.repost').onclick = () => doRepost(c.id, div);
    div.querySelector('.comment').onclick = () => openComments(c.id);
    
    const menuBtn = div.querySelector('.menu-btn');
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        const old = div.querySelector('.drop');
        if (old) { old.remove(); return; }
        const drop = document.createElement('div');
        drop.className = 'drop';
        drop.innerHTML = '<button>Пожаловаться</button>';
        drop.querySelector('button').onclick = () => { drop.remove(); openReport(c.id); };
        menuBtn.parentElement.appendChild(drop);
        setTimeout(() => document.addEventListener('click', function f(ev) { 
            if (!drop.contains(ev.target) && ev.target !== menuBtn) { 
                drop.remove(); 
                document.removeEventListener('click', f); 
            } 
        }), 0);
    };
    
    div.querySelector('.post-user').onclick = () => { if (c.users) navTo('profile', c.users.id); };

    return div;
}

async function refreshActions(postId, div) {
    const [likes, dislikes, reps, myLike, myDis, myRep] = await Promise.all([
        sb.from('likes').select('id', { count: 'exact', head: true }).eq('chirp_id', postId),
        sb.from('dislikes').select('id', { count: 'exact', head: true }).eq('chirp_id', postId),
        sb.from('rechirps').select('id', { count: 'exact', head: true }).eq('chirp_id', postId),
        sb.from('likes').select('id').eq('chirp_id', postId).eq('user_id', user.id).maybeSingle(),
        sb.from('dislikes').select('id').eq('chirp_id', postId).eq('user_id', user.id).maybeSingle(),
        sb.from('rechirps').select('id').eq('chirp_id', postId).eq('user_id', user.id).maybeSingle()
    ]);
    const likeBtn = div.querySelector('.like');
    const disBtn = div.querySelector('.dislike');
    const repBtn = div.querySelector('.repost');
    if (likeBtn) { likeBtn.innerHTML = `❤️ ${likes.count||0}`; likeBtn.classList.toggle('liked', !!myLike.data); }
    if (disBtn) { disBtn.innerHTML = `👎 ${dislikes.count||0}`; disBtn.classList.toggle('disliked', !!myDis.data); }
    if (repBtn) { repBtn.innerHTML = `🔄 ${reps.count||0}`; repBtn.classList.toggle('reposted', !!myRep.data); }
}

async function toggleLike(pid, div) {
    const { data: ex } = await sb.from('likes').select('id').eq('chirp_id', pid).eq('user_id', user.id).maybeSingle();
    if (ex) await sb.from('likes').delete().eq('id', ex.id);
    else {
        await sb.from('dislikes').delete().eq('chirp_id', pid).eq('user_id', user.id);
        await sb.from('likes').insert({ user_id: user.id, chirp_id: pid });
    }
    await refreshActions(pid, div);
}

async function toggleDislike(pid, div) {
    const { data: ex } = await sb.from('dislikes').select('id').eq('chirp_id', pid).eq('user_id', user.id).maybeSingle();
    if (ex) await sb.from('dislikes').delete().eq('id', ex.id);
    else {
        await sb.from('likes').delete().eq('chirp_id', pid).eq('user_id', user.id);
        await sb.from('dislikes').insert({ user_id: user.id, chirp_id: pid });
    }
    await refreshActions(pid, div);
}

async function doRepost(pid, div) {
    await sb.from('rechirps').insert({ user_id: user.id, chirp_id: pid });
    await refreshActions(pid, div);
    toast('Сделано!', 'ok');
}

// ===================== СОЗДАНИЕ ПОСТА =====================
async function createPost() {
    if (submitting) return;
    const text = $('postText').value.trim();
    if (!text && !file) { toast('Напишите или прикрепите фото', 'err'); return; }
    
    // Анти-спам: запрет ссылок для неверифицированных
    if (/(http:\/\/|https:\/\/|www\.|t\.me|discord\.gg|telegram\.me)/gi.test(text) && !user.is_verified) {
        toast('Ссылки запрещены для непроверенных пользователей', 'err');
        return;
    }
    
    // Анти-флуд: проверка на одинаковые посты подряд
    const { data: lastPost } = await sb.from('chirps')
        .select('content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (lastPost && lastPost.content === text) {
        toast('Нельзя отправлять одинаковые посты подряд', 'err');
        return;
    }
    
    submitting = true;
    $('submitPost').disabled = true;
    loading(true);
    let imgUrl = null;
    try {
        if (file) {
            const name = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const { error: upErr } = await sb.storage.from('images').upload(name, file);
            if (upErr) throw upErr;
            const { data: urlData } = sb.storage.from('images').getPublicUrl(name);
            imgUrl = urlData.publicUrl;
        }
        const { data: chirp, error: insErr } = await sb.from('chirps').insert({
            user_id: user.id, content: text, image_url: imgUrl, is_verified: user.is_verified
        }).select().single();
        if (insErr) throw insErr;

        const today = new Date().toISOString().split('T')[0];
        let st = user.streak || 0;
        if (!user.last_post_date) st = 1;
        else if (user.last_post_date === today) {}
        else {
            const yest = new Date(Date.now() - 864e5).toISOString().split('T')[0];
            st = user.last_post_date === yest ? st + 1 : 1;
        }
        await sb.from('users').update({ streak: st, last_post_date: today }).eq('id', user.id);
        user.streak = st;
        user.last_post_date = today;
        saveSession();

        const tags = text.match(/#[а-яё\w]+/gi);
        if (tags) for (const t of tags) {
            const tl = t.toLowerCase();
            const { data: tr } = await sb.from('trends').select('*').eq('hashtag', tl).maybeSingle();
            if (tr) await sb.from('trends').update({ count: tr.count + 1, updated_at: new Date() }).eq('id', tr.id);
            else await sb.from('trends').insert({ hashtag: tl, count: 1, updated_at: new Date() });
        }

        $('postText').value = '';
        $('charCount').textContent = '0/280';
        clearPreview();
        if (view === 'feed' || view === 'following') {
            const area = $('contentArea');
            const el = await buildPost({ ...chirp, users: user });
            area.insertBefore(el, area.firstChild);
        }
        toast('Опубликовано!', 'ok');
    } catch (e) { toast('Ошибка: ' + (e.message || '?'), 'err'); }
    submitting = false;
    $('submitPost').disabled = false;
    loading(false);
}

function clearPreview() {
    file = null;
    hide('previewBox');
    $('previewImg').src = '';
    $('fileInput').value = '';
}

// ==================== REALTIME ====================
function subscribeFeed() {
    if (feedChannel) sb.removeChannel(feedChannel);
    feedChannel = sb.channel('chirps-chan').on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chirps' 
    }, async (p) => {
        if (view === 'feed' || view === 'following') {
            const { data: u } = await sb.from('users').select('*').eq('id', p.new.user_id).single();
            const el = await buildPost({ ...p.new, users: u });
            $('contentArea').insertBefore(el, $('contentArea').firstChild);
        }
    }).subscribe();
}

// ===================== КОММЕНТАРИИ =====================
function openComments(pid) {
    commentPostId = pid;
    show('commentModal');
    $('commentList').innerHTML = '';
    $('commentInput').value = '';
    loadComments(pid);
    if (commentChannel) sb.removeChannel(commentChannel);
    commentChannel = sb.channel('comm-' + pid).on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments', 
        filter: 'chirp_id=eq.' + pid 
    }, async (p) => {
        const { data: u } = await sb.from('users').select('nickname').eq('id', p.new.user_id).single();
        addCommentItem(p.new, u?.nickname);
    }).subscribe();
}

async function loadComments(pid) {
    const { data } = await sb.from('comments')
        .select('*, users(nickname)')
        .eq('chirp_id', pid)
        .order('created_at', { ascending: true });
    $('commentList').innerHTML = '';
    if (!data || data.length === 0) { 
        $('commentList').innerHTML = '<div class="empty">Пока нет</div>'; 
        return; 
    }
    data.forEach(c => addCommentItem(c, c.users?.nickname));
}

function addCommentItem(c, nick) {
    const list = $('commentList');
    if (list.querySelector('.empty')) list.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `<div class="comment-user">${nick||'?'}</div>
        <div class="comment-text">${c.content}</div>
        <div class="comment-time">${fmtTime(c.created_at)}</div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

async function sendComment() {
    const txt = $('commentInput').value.trim();
    if (!txt || !commentPostId) return;
    
    // Анти-спам в комментах
    if (/(http:\/\/|https:\/\/|www\.|t\.me|discord\.gg)/gi.test(txt) && !user.is_verified) {
        toast('Ссылки в комментариях запрещены', 'err');
        return;
    }
    
    await sb.from('comments').insert({ 
        user_id: user.id, 
        chirp_id: commentPostId, 
        content: txt 
    });
    $('commentInput').value = '';
}

function closeComments() {
    hide('commentModal');
    commentPostId = null;
    if (commentChannel) { sb.removeChannel(commentChannel); commentChannel = null; }
}

// ===================== ЖАЛОБА =====================
function openReport(pid) { 
    reportPostId = pid; 
    show('reportModal'); 
    $('reportText').value = ''; 
}

async function sendReport() {
    const txt = $('reportText').value.trim();
    if (!txt || !reportPostId) return;
    await sb.from('reports').insert({ 
        reporter_id: user.id, 
        chirp_id: reportPostId, 
        reason: txt, 
        status: 'pending' 
    });
    hide('reportModal');
    reportPostId = null;
    toast('Жалоба отправлена', 'ok');
}

// ===================== ПРОФИЛЬ =====================
async function loadProfile(area, uid) {
    area.innerHTML = '';
    const { data: u } = await sb.from('users').select('*').eq('id', uid).single();
    if (!u) { area.innerHTML = '<div class="empty">Не найден</div>'; return; }
    const [pCount, fersCount, fingCount, isF] = await Promise.all([
        sb.from('chirps').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        sb.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        sb.from('follows').select('id').eq('follower_id', user.id).eq('following_id', uid).maybeSingle()
    ]);
    const mine = uid === user.id;
    let html = `<div class="profile-card">
        <div class="profile-emoji">${u.emoji||'😊'}</div>
        <div class="profile-nick">${u.nickname} ${u.is_verified?'<span class="post-verify">✓</span>':''}</div>
        <div class="profile-bio">${u.bio||''}</div>
        <div class="profile-stats">
            <div><div class="stat-val">${pCount.count||0}</div><div class="stat-lbl">Постов</div></div>
            <div><div class="stat-val">${fersCount.count||0}</div><div class="stat-lbl">Подписчиков</div></div>
            <div><div class="stat-val">${fingCount.count||0}</div><div class="stat-lbl">Подписок</div></div>
        </div>
        ${mine ? '<button id="editProfBtn" class="btn btn-outline">Редактировать</button>' :
          `<button id="followBtn" class="btn ${isF.data?'btn-outline':'btn-white'}">${isF.data?'Отписаться':'Подписаться'}</button>`}
    </div><div id="profPosts" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;"></div>`;
    area.innerHTML = html;
    if (mine) $('editProfBtn').onclick = openEditProfile;
    else $('followBtn').onclick = async () => {
        if (isF.data) await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', uid);
        else await sb.from('follows').insert({ follower_id: user.id, following_id: uid });
        loadProfile(area, uid);
    };
    const { data: posts } = await sb.from('chirps')
        .select('*, users!inner(id,nickname,emoji,is_verified,streak)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
    const pp = $('profPosts');
    if (posts) for (const c of posts) pp.appendChild(await buildPost(c));
}

function openEditProfile() {
    show('editProfileModal');
    $('editBio').value = user.bio || '';
    selectedEmoji = user.emoji || '😊';
    document.querySelectorAll('.emoji').forEach(e => e.classList.toggle('sel', e.dataset.e === selectedEmoji));
}

async function saveProfile() {
    const bio = $('editBio').value.trim();
    await sb.from('users').update({ bio, emoji: selectedEmoji }).eq('id', user.id);
    user.bio = bio;
    user.emoji = selectedEmoji;
    saveSession();
    hide('editProfileModal');
    navTo('profile', user.id);
    toast('Сохранено', 'ok');
}

// ===================== ТРЕНДЫ =====================
async function loadTrends(area) {
    area.innerHTML = '<div class="trends-box"><h2>Тренды</h2><div id="trendList"></div></div>';
    const { data } = await sb.from('trends').select('*').order('count', { ascending: false }).limit(20);
    const tl = $('trendList');
    if (!data || data.length === 0) { tl.innerHTML = '<div class="empty">Пока нет</div>'; return; }
    data.forEach(t => {
        const row = document.createElement('div');
        row.className = 'trend-row';
        row.innerHTML = `<span>${t.hashtag}</span><span style="color:#555;">${t.count}</span>`;
        row.onclick = () => navTo('hashtag', t.hashtag);
        tl.appendChild(row);
    });
}

async function loadHashtag(area, tag) {
    area.innerHTML = `<h3 style="margin-bottom:12px;">#${tag}</h3><div id="htPosts" style="display:flex;flex-direction:column;gap:8px;"></div>`;
    const { data } = await sb.from('chirps')
        .select('*, users!inner(id,nickname,emoji,is_verified,streak)')
        .ilike('content', '%' + tag + '%')
        .order('created_at', { ascending: false })
        .limit(50);
    const box = $('htPosts');
    if (!data || data.length === 0) { box.innerHTML = '<div class="empty">Ничего нет</div>'; return; }
    for (const c of data) box.appendChild(await buildPost(c));
}

// ===================== АДМИНКА =====================
async function openAdmin() {
    const p = prompt('Пароль админа:');
    if (p !== ADMIN_PASS) { toast('Неверный пароль', 'err'); return; }
    navTo('admin');
}

async function loadAdmin(area) {
    area.innerHTML = `
        <div class="admin-box"><h2>Админ-панель</h2>
            <div class="admin-section">
                <h3>Поиск пользователя</h3>
                <div style="display:flex;gap:8px;">
                    <input id="admNick" class="input" placeholder="Никнейм">
                    <button id="admSearch" class="btn btn-white">Найти</button>
                </div>
                <div id="admUserInfo" class="admin-info" style="display:none;"></div>
                <div id="admActions" class="admin-row" style="display:none;"></div>
            </div>
            <div class="admin-section">
                <h3>Статистика IP</h3>
                <button id="admIPStats" class="btn btn-outline">Показать подозрительные IP</button>
                <div id="admIPList" style="margin-top:8px;"></div>
            </div>
            <div class="admin-section">
                <h3>Удалить пост по ID</h3>
                <div style="display:flex;gap:8px;">
                    <input id="admPostId" class="input" placeholder="ID поста">
                    <button id="admDelPost" class="btn btn-red">Удалить</button>
                </div>
            </div>
            <div class="admin-section">
                <h3>Жалобы</h3>
                <div id="admReports"></div>
            </div>
            <div class="admin-section">
                <h3>Экстренные меры</h3>
                <button id="admBanAllIP" class="btn btn-red">Забанить всех с одинаковых IP</button>
                <button id="admClearSessions" class="btn btn-red" style="margin-left:8px;">Сбросить все сессии</button>
            </div>
        </div>`;
    
    $('admSearch').onclick = searchUser;
    $('admDelPost').onclick = async () => {
        const id = $('admPostId').value.trim();
        if (!id) return;
        await sb.from('chirps').delete().eq('id', id);
        toast('Пост удалён', 'ok');
        $('admPostId').value = '';
    };
    $('admIPStats').onclick = showIPStats;
    $('admClearSessions').onclick = forceLogoutAll;
    $('admBanAllIP').onclick = banDuplicateIPs;
    loadReports();
}

// Показать статистику IP
async function showIPStats() {
    const { data } = await sb.from('users').select('ip_address, nickname, created_at').order('created_at', { ascending: false });
    if (!data) return;
    
    // Группируем по IP
    const ipMap = {};
    data.forEach(u => {
        if (!u.ip_address) return;
        if (!ipMap[u.ip_address]) ipMap[u.ip_address] = [];
        ipMap[u.ip_address].push(u.nickname);
    });
    
    const suspicious = Object.entries(ipMap).filter(([ip, users]) => users.length > 1);
    
    const list = $('admIPList');
    if (suspicious.length === 0) {
        list.innerHTML = '<div class="empty">Подозрительных IP не найдено</div>';
        return;
    }
    
    list.innerHTML = suspicious.map(([ip, users]) => 
        `<div class="admin-info" style="margin-bottom:4px;">
            <strong>IP:</strong> ${ip}<br>
            <strong>Аккаунтов:</strong> ${users.length}<br>
            <strong>Ники:</strong> ${users.join(', ')}
        </div>`
    ).join('');
}

// Забанить все дублирующиеся IP
async function banDuplicateIPs() {
    if (!confirm('Забанить ВСЕХ пользователей с одинаковых IP?')) return;
    
    const { data } = await sb.from('users').select('id, ip_address');
    if (!data) return;
    
    const ipMap = {};
    data.forEach(u => {
        if (!u.ip_address) return;
        if (!ipMap[u.ip_address]) ipMap[u.ip_address] = [];
        ipMap[u.ip_address].push(u.id);
    });
    
    let banned = 0;
    for (const [ip, ids] of Object.entries(ipMap)) {
        if (ids.length > 1) {
            // Баним всех кроме первого (оставляем самого старого)
            for (let i = 1; i < ids.length; i++) {
                await sb.from('users').update({
                    is_banned: true,
                    ban_reason: 'Мульти-аккаунтинг (одинаковый IP)',
                    ban_expires_at: null
                }).eq('id', ids[i]);
                banned++;
            }
        }
    }
    
    toast(`Забанено ${banned} мульти-аккаунтов`, 'ok');
}

// Принудительный выход всех
async function forceLogoutAll() {
    if (!confirm('ВСЕ пользователи будут разлогинены. Продолжить?')) return;
    const { data: users } = await sb.from('users').select('id');
    if (users) {
        for (const u of users) {
            await sb.from('users').update({ 
                password: 'force_logout_' + Math.random().toString(36).slice(2, 10) 
            }).eq('id', u.id);
        }
    }
    toast('Все сессии сброшены', 'ok');
}

// Остальные функции админки
async function searchUser() {
    const nick = $('admNick').value.trim();
    if (!nick) return;
    const { data: u } = await sb.from('users').select('*').eq('nickname', nick).single();
    const info = $('admUserInfo');
    const acts = $('admActions');
    if (!u) { 
        info.style.display = 'block'; 
        info.textContent = 'Не найден'; 
        acts.style.display = 'none'; 
        return; 
    }
    info.style.display = 'block';
    info.innerHTML = `
        ID: ${u.id}<br>
        Ник: ${u.nickname}<br>
        IP: ${u.ip_address || 'Неизвестен'}<br>
        Верифицирован: ${u.is_verified}<br>
        Забанен: ${u.is_banned}<br>
        Предупреждение: ${u.has_warning}<br>
        Дата регистрации: ${new Date(u.created_at).toLocaleString('ru')}
    `;
    acts.style.display = 'flex';
    acts.innerHTML = `
        <button class="btn btn-white btn-sm" data-a="verify" data-id="${u.id}">✓</button>
        <button class="btn btn-outline btn-sm" data-a="unverify" data-id="${u.id}">✗</button>
        <button class="btn btn-red btn-sm" data-a="banF" data-id="${u.id}">Бан навсегда</button>
        <button class="btn btn-sm" style="background:#0c6;color:#fff;" data-a="unban" data-id="${u.id}">Разбан</button>
        <button class="btn btn-orange btn-sm" data-a="warn" data-id="${u.id}">Пред</button>`;
    acts.querySelectorAll('button').forEach(b => b.onclick = () => adminAction(b.dataset.id, b.dataset.a));
}

async function adminAction(uid, action) {
    const now = new Date();
    const map = {
        verify: { is_verified: true },
        unverify: { is_verified: false },
        banF: { is_banned: true, ban_reason: 'Забанен администратором', ban_expires_at: null },
        unban: { is_banned: false, ban_reason: null, ban_expires_at: null },
        warn: { 
            has_warning: true, 
            warning_message: prompt('Текст предупреждения:') || 'Предупреждение', 
            warning_expires_at: new Date(now.getTime() + 180000).toISOString() 
        }
    };
    if (map[action]) await sb.from('users').update(map[action]).eq('id', uid);
    toast('Готово', 'ok');
    searchUser();
}

async function loadReports() {
    const box = $('admReports');
    const { data } = await sb.from('reports')
        .select('*, reporter:users!reports_reporter_id_fkey(nickname)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    if (!data || data.length === 0) { 
        box.innerHTML = '<div class="empty">Нет активных жалоб</div>'; 
        return; 
    }
    
    box.innerHTML = '';
    data.forEach(r => {
        const d = document.createElement('div');
        d.className = 'admin-info';
        d.style.marginBottom = '8px';
        d.innerHTML = `
            <strong>От:</strong> ${r.reporter?.nickname||'?'}<br>
            <strong>Пост:</strong> ${r.chirp_id.slice(0,8)}<br>
            <strong>Причина:</strong> ${r.reason}<br>
            <button class="btn btn-red btn-sm" data-del="${r.chirp_id}" data-rid="${r.id}">Удалить пост</button>
            <button class="btn btn-outline btn-sm" data-dis="${r.id}">Отклонить</button>`;
        
        d.querySelector('[data-del]').onclick = async function() {
            await sb.from('chirps').delete().eq('id', this.dataset.del);
            await sb.from('reports').update({ status: 'resolved' }).eq('id', this.dataset.rid);
            loadReports();
        };
        d.querySelector('[data-dis]').onclick = async function() {
            await sb.from('reports').update({ status: 'dismissed' }).eq('id', this.dataset.dis);
            loadReports();
        };
        box.appendChild(d);
    });
}

// ===================== ИНИЦИАЛИЗАЦИЯ =====================
function init() {
    localStorage.removeItem('nc');
    localStorage.removeItem('nobuchirp_session');
    
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { 
        auth: { persistSession: false } 
    });

    $('authBtn').onclick = doAuth;
    $('tabLogin').onclick = () => { 
        $('tabLogin').classList.add('active'); 
        $('tabRegister').classList.remove('active'); 
        $('authBtn').textContent = 'Войти'; 
        $('authError').textContent = '';
    };
    $('tabRegister').onclick = () => { 
        $('tabRegister').classList.add('active'); 
        $('tabLogin').classList.remove('active'); 
        $('authBtn').textContent = 'Зарегистрироваться'; 
        $('authError').textContent = '';
    };
    $('authPass').onkeydown = e => { if (e.key === 'Enter') doAuth(); };
    $('authNick').onkeydown = e => { if (e.key === 'Enter') $('authPass').focus(); };

    $('btnLogout').onclick = logout;
    $('banLogout').onclick = logout;

    $('goFeed').onclick = () => navTo('feed');
    $('navFeed').onclick = () => navTo('feed');
    $('navFollow').onclick = () => navTo('following');
    $('navTrends').onclick = () => navTo('trends');
    $('btnProfile').onclick = () => navTo('profile', user?.id);
    $('btnAdmin').onclick = openAdmin;

    $('submitPost').onclick = createPost;
    $('postText').oninput = () => $('charCount').textContent = $('postText').value.length + '/280';
    $('uploadBtn').onclick = () => $('fileInput').click();
    $('fileInput').onchange = e => {
        file = e.target.files[0];
        if (file && file.size > 5242880) {
            toast('Файл слишком большой (макс. 5 МБ)', 'err');
            file = null;
            return;
        }
        if (file) {
            const r = new FileReader();
            r.onload = ev => { $('previewImg').src = ev.target.result; showBlock('previewBox'); };
            r.readAsDataURL(file);
        }
    };
    $('removePreview').onclick = clearPreview;

    $('closeComments').onclick = closeComments;
    $('sendComment').onclick = sendComment;
    $('commentInput').onkeydown = e => { if (e.key === 'Enter') sendComment(); };
    $('commentModal').onclick = e => { if (e.target === $('commentModal')) closeComments(); };

    $('closeReport').onclick = () => hide('reportModal');
    $('sendReport').onclick = sendReport;
    $('reportModal').onclick = e => { if (e.target === $('reportModal')) hide('reportModal'); };

    $('closeEditProfile').onclick = () => hide('editProfileModal');
    $('saveProfile').onclick = saveProfile;
    $('editProfileModal').onclick = e => { if (e.target === $('editProfileModal')) hide('editProfileModal'); };
    
    document.querySelectorAll('.emoji').forEach(el => el.onclick = function() {
        document.querySelectorAll('.emoji').forEach(e => e.classList.remove('sel'));
        this.classList.add('sel');
        selectedEmoji = this.dataset.e;
    });

    document.onkeydown = e => {
        if (e.key === 'Escape') { 
            hide('commentModal'); 
            hide('reportModal'); 
            hide('editProfileModal'); 
            closeComments(); 
        }
    };

    if (loadSession()) {
        if (user.is_banned) showBan();
        else if (user.has_warning) showWarning();
        else showApp();
    } else {
        show('authScreen');
    }
}

document.addEventListener('DOMContentLoaded', init);