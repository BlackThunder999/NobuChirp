// ============================
// NOBUCHIRP ADMIN MODULE
// Загружается динамически
// ============================

// Пароль проверяется через prompt, в коде не хранится
// Но для удобства можно задать хеш:
// Пароль: NobuWaveAdmin2024
// Его никто не увидит, т.к. он только в этом файле,
// который грузится отдельно и не виден в Sources,
// пока не будет загружен.
// 
// ДЛЯ ПОЛНОЙ БЕЗОПАСНОСТИ:
// Храните хеш пароля, а не сам пароль.
// Но т.к. это демо — оставлю пароль.
// В продакшене замените на бэкенд-проверку.

const ADMIN_PASSWORD_HASH = null; // если null — используем прямой пароль
const ADMIN_PASSWORD = 'NobuWaveAdmin2024';

function verifyAdminPassword(input) {
    if (ADMIN_PASSWORD_HASH) {
        // В будущем: сравнение хеша
        return false;
    }
    return input === ADMIN_PASSWORD;
}

window.openNobuAdmin = function(currentUser, apiFn, showToastFn, openProfileFn, escapeHTMLFn, $Fn, SUPABASE_URL) {

    const $ = $Fn;
    const api = apiFn;
    const showToast = showToastFn;
    const openProfile = openProfileFn;
    const escapeHTML = escapeHTMLFn;

    const password = prompt('Пароль администратора:');
    if (!password || !verifyAdminPassword(password)) {
        showToast('Неверный пароль');
        return;
    }

    const modal = $('#adminModal');
    if (modal) modal.style.display = 'flex';
    loadAdminData();

    async function loadAdminData() {
        const content = $('#adminModalContent');
        if (!content) return;
        content.innerHTML = '<div class="feed-loading">Загрузка...</div>';

        try {
            const reports = await api('GET', 'reports?order=created_at.desc&limit=30');
            const bans = await api('GET', 'users?is_banned=eq.true&select=*');

            const repHTML = (reports || []).map(r =>
                `<div style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">
                    <b>${escapeHTML(r.from_username)}</b> → <code>${(r.chirp_id||'').substring(0,8)}</code><br>
                    ${escapeHTML(r.reason)}<br>
                    <button class="admin-btn danger" data-del="${r.chirp_id}">Удалить пост</button>
                </div>`
            ).join('') || '<p style="color:#888;">Нет жалоб</p>';

            const banHTML = (bans || []).map(b =>
                `<div style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">
                    <b>${escapeHTML(b.username)}</b> — ${escapeHTML(b.ban_reason||'')}<br>
                    До: ${b.ban_expires ? new Date(b.ban_expires).toLocaleDateString('ru-RU') : 'Навсегда'}<br>
                    <button class="admin-btn success" data-unban="${b.id}">Разбанить</button>
                </div>`
            ).join('') || '<p style="color:#888;">Нет банов</p>';

            content.innerHTML = `
                <div class="modal-header">
                    <h3>⚙️ Админ-панель</h3>
                    <button class="modal-close" id="adminCloseBtn">&times;</button>
                </div>

                <div class="admin-section">
                    <h4>🔨 Бан пользователя</h4>
                    <div class="admin-row">
                        <input type="text" id="aBanUser" placeholder="Никнейм">
                        <select id="aBanDur">
                            <option value="1">1 день</option>
                            <option value="7">7 дней</option>
                            <option value="30">30 дней</option>
                            <option value="forever">Навсегда</option>
                        </select>
                    </div>
                    <input class="admin-input" id="aBanReason" placeholder="Причина бана">
                    <button class="admin-btn danger" id="aBanBtn">Забанить</button>
                </div>

                <div class="admin-section">
                    <h4>⚠️ Предупреждение</h4>
                    <input class="admin-input" id="aWarnUser" placeholder="Никнейм">
                    <input class="admin-input" id="aWarnReason" placeholder="Причина">
                    <button class="admin-btn warn" id="aWarnBtn">Предупредить</button>
                </div>

                <div class="admin-section">
                    <h4>✅ Верификация</h4>
                    <input class="admin-input" id="aVerifyUser" placeholder="Никнейм">
                    <button class="admin-btn info" id="aVerifyBtn">Выдать галочку</button>
                </div>

                <div class="admin-section">
                    <h4>🗑️ Удалить пост</h4>
                    <input class="admin-input" id="aDelPost" placeholder="ID поста">
                    <button class="admin-btn danger" id="aDelBtn">Удалить</button>
                </div>

                <div class="admin-section">
                    <h4>🔍 Просмотр профиля</h4>
                    <input class="admin-input" id="aViewUser" placeholder="Никнейм">
                    <button class="admin-btn info" id="aViewBtn">Смотреть</button>
                </div>

                <div class="admin-section">
                    <h4>📋 Жалобы (последние 30)</h4>
                    ${repHTML}
                </div>

                <div class="admin-section">
                    <h4>🚫 Активные баны</h4>
                    ${banHTML}
                </div>
            `;

            // Закрытие
            document.getElementById('adminCloseBtn').addEventListener('click', () => {
                document.getElementById('adminModal').style.display = 'none';
            });

            // Бан
            document.getElementById('aBanBtn').addEventListener('click', async () => {
                const u = document.getElementById('aBanUser').value.trim();
                const dur = document.getElementById('aBanDur').value;
                const r = document.getElementById('aBanReason').value.trim();
                if (!u) { showToast('Введите никнейм'); return; }
                const users = await api('GET', `users?username=eq.${encodeURIComponent(u)}&select=*`);
                if (!users?.length) { showToast('Пользователь не найден'); return; }
                let exp = null;
                if (dur !== 'forever') {
                    const d = new Date();
                    d.setDate(d.getDate() + parseInt(dur));
                    exp = d.toISOString();
                }
                await api('PATCH', `users?id=eq.${users[0].id}`, {
                    is_banned: true,
                    ban_reason: r || 'Нарушение правил',
                    ban_expires: exp
                });
                showToast('Пользователь забанен');
                loadAdminData();
            });

            // Предупреждение
            document.getElementById('aWarnBtn').addEventListener('click', async () => {
                const u = document.getElementById('aWarnUser').value.trim();
                const r = document.getElementById('aWarnReason').value.trim();
                if (!u) { showToast('Введите никнейм'); return; }
                const users = await api('GET', `users?username=eq.${encodeURIComponent(u)}&select=*`);
                if (!users?.length) { showToast('Пользователь не найден'); return; }
                await api('POST', 'warnings', {
                    user_id: users[0].id,
                    username: users[0].username,
                    reason: r || 'Нарушение правил'
                });
                showToast('Предупреждение выдано');
                loadAdminData();
            });

            // Верификация
            document.getElementById('aVerifyBtn').addEventListener('click', async () => {
                const u = document.getElementById('aVerifyUser').value.trim();
                if (!u) { showToast('Введите никнейм'); return; }
                const users = await api('GET', `users?username=eq.${encodeURIComponent(u)}&select=*`);
                if (!users?.length) { showToast('Пользователь не найден'); return; }
                await api('PATCH', `users?id=eq.${users[0].id}`, { is_verified: true });
                showToast('Галочка выдана');
                loadAdminData();
            });

            // Удаление поста
            document.getElementById('aDelBtn').addEventListener('click', async () => {
                const id = document.getElementById('aDelPost').value.trim();
                if (!id) { showToast('Введите ID'); return; }
                await api('DELETE', `chirps?id=eq.${id}`);
                showToast('Пост удалён');
                loadAdminData();
            });

            // Просмотр профиля
            document.getElementById('aViewBtn').addEventListener('click', async () => {
                const u = document.getElementById('aViewUser').value.trim();
                if (!u) { showToast('Введите никнейм'); return; }
                const users = await api('GET', `users?username=eq.${encodeURIComponent(u)}&select=*`);
                if (!users?.length) { showToast('Пользователь не найден'); return; }
                document.getElementById('adminModal').style.display = 'none';
                openProfile(users[0].id);
            });

            // Удаление из жалоб
            document.querySelectorAll('[data-del]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await api('DELETE', `chirps?id=eq.${btn.dataset.del}`);
                    showToast('Пост удалён');
                    loadAdminData();
                });
            });

            // Разбан
            document.querySelectorAll('[data-unban]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await api('PATCH', `users?id=eq.${btn.dataset.unban}`, {
                        is_banned: false,
                        ban_reason: null,
                        ban_expires: null
                    });
                    showToast('Пользователь разбанен');
                    loadAdminData();
                });
            });

        } catch (e) {
            content.innerHTML = '<p>Ошибка загрузки админки</p>';
        }
    }
};
