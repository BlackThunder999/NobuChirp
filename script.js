const NobuWave = (() => {
    const supabase = window.supabase.createClient('https://iljsednetiogjtowlexo.supabase.co', 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O');
    let currentUser = null, activeChat = null, realtimeChannel = null;
    let mediaRecorder = null, audioChunks = [], isRecording = false, voiceStartTime = 0;
    const app = document.getElementById('app');
    const ADMIN_PASSWORD = 'NobuWaveAdmin2024';

    const esc = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    const generateId = () => '#' + Math.random().toString(36).substring(2, 10);

    const checkBan = async () => {
        if (!currentUser) return null;
        const { data: ban } = await supabase.from('bans').select('*').eq('user_id', currentUser.id).maybeSingle();
        if (ban && new Date(ban.expires_at) > new Date()) return ban;
        if (ban) await supabase.from('bans').delete().eq('id', ban.id);
        return null;
    };

    const showBanScreen = (ban) => {
        const until = new Date(ban.expires_at), diff = Math.floor((until - new Date()) / 60000);
        const dur = diff < 60 ? `${diff} мин` : diff < 1440 ? `${Math.floor(diff/60)} ч` : `${Math.floor(diff/1440)} дн`;
        app.innerHTML = `<div class="auth-container"><div class="auth-card" style="max-width:480px"><div style="font-size:4rem">🚫</div><h2 style="color:var(--danger);margin:12px 0">Вы заблокированы</h2><p style="color:var(--text-secondary)">Причина: <strong>${esc(ban.reason||'нарушение')}</strong></p><div style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:var(--radius-sm);padding:12px;margin:12px 0"><p>⏰ Блокировка на <strong>${dur}</strong></p><p style="font-size:0.85rem">До: ${until.toLocaleString('ru-RU')}</p></div><button class="modal-btn secondary" id="showRulesBtn">📋 Правила</button></div></div>`;
        document.getElementById('showRulesBtn').addEventListener('click', () => showRules('ban'));
    };

    const showRules = (from) => {
        const isLoggedIn = !!currentUser;
        app.innerHTML = `<div class="auth-container"><div class="auth-card rules-card"><h2 style="text-align:center;margin-bottom:20px">📋 Правила NobuWave</h2><div class="rules-content"><h3 style="color:var(--danger)">🚫 ЗАПРЕЩЕНО:</h3><ul><li><strong style="color:var(--danger)">Хейтинг и травля</strong></li><li><strong>Спам</strong></li><li><strong>Угрозы</strong></li><li><strong>Дискриминация</strong></li><li><strong>Контент 18+</strong></li><li><strong>Мошенничество</strong></li><li><strong>Чужая личность</strong></li><li><strong>Вредоносные ссылки</strong></li></ul><h3 style="color:var(--success)">✅ Рекомендуется:</h3><ul><li>Быть вежливым</li><li>Сообщать о нарушениях</li></ul><h3 style="color:var(--accent-light)">⚖️ Наказания:</h3><ul><li>Хейтинг — бан от 1 часа</li><li>Спам — 6 часов</li><li>Угрозы — навсегда</li></ul></div><button class="modal-btn secondary" id="backFromRulesBtn" style="margin-top:20px">${from==='ban'?'← Назад':(isLoggedIn?'← На главную':'← Назад')}</button></div></div>`;
        document.getElementById('backFromRulesBtn').addEventListener('click', () => {
            if (from === 'ban') { checkBan().then(b => b ? showBanScreen(b) : renderApp()); }
            else if (isLoggedIn) { renderApp(); }
            else { renderAuth(); }
        });
    };

    const renderAuth = () => {
        app.innerHTML = `<div class="auth-container"><div class="auth-card"><div class="auth-logo"><div class="logo-icon"><i class="fa-solid fa-feather"></i></div><h1>Nobu<span>Wave</span></h1></div><div class="auth-tabs"><button class="auth-tab active" data-tab="login">Вход</button><button class="auth-tab" data-tab="register">Регистрация</button></div><form id="loginForm" class="auth-form"><input type="text" id="loginUsername" class="auth-input" placeholder="Никнейм" autocomplete="off"><input type="password" id="loginPassword" class="auth-input" placeholder="Пароль"><div id="loginError" style="color:var(--danger);font-size:0.85rem;display:none"></div><button type="submit" class="auth-btn">Войти</button></form><form id="registerForm" class="auth-form hidden"><input type="text" id="regUsername" class="auth-input" placeholder="Придумайте никнейм" autocomplete="off"><input type="password" id="regPassword" class="auth-input" placeholder="Придумайте пароль"><div id="regError" style="color:var(--danger);font-size:0.85rem;display:none"></div><button type="submit" class="auth-btn">Зарегистрироваться</button></form><button class="modal-btn secondary" id="authRulesBtn" style="margin-top:8px">📋 Правила</button></div></div>`;

        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
                document.getElementById('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
            });
        });

        document.getElementById('authRulesBtn').addEventListener('click', () => showRules('auth'));

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPassword').value.trim(), err = document.getElementById('loginError');
            if (!u || !p) { err.textContent = 'Заполните все поля'; err.style.display = 'block'; return; }
            const { data: user, error } = await supabase.from('users').select('*').eq('username', u).eq('password', p).single();
            if (error || !user) { err.textContent = 'Неверный никнейм или пароль'; err.style.display = 'block'; return; }
            currentUser = user; const ban = await checkBan(); if (ban) { showBanScreen(ban); return; }
            localStorage.setItem('nobu_user', JSON.stringify(user)); await supabase.from('users').update({ is_online: true }).eq('id', user.id); renderApp();
        });

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('regUsername').value.trim(), p = document.getElementById('regPassword').value.trim(), err = document.getElementById('regError');
            if (!u || !p) { err.textContent = 'Заполните все поля'; err.style.display = 'block'; return; }
            if (p.length < 4) { err.textContent = 'Пароль минимум 4 символа'; err.style.display = 'block'; return; }
            const { data: exist } = await supabase.from('users').select('id').eq('username', u).single();
            if (exist) { err.textContent = 'Никнейм занят'; err.style.display = 'block'; return; }
            const id = generateId();
            const { data: newUser, error } = await supabase.from('users').insert({ username: u, display_name: u, password: p, unique_id: id, avatar_emoji: '👤', role: 'user', is_verified: false }).select().single();
            if (error) { err.textContent = 'Ошибка'; err.style.display = 'block'; return; }
            currentUser = newUser; localStorage.setItem('nobu_user', JSON.stringify(newUser)); await supabase.from('users').update({ is_online: true }).eq('id', newUser.id); renderApp();
        });
    };

    const renderApp = async () => {
        const ban = await checkBan(); if (ban) { showBanScreen(ban); return; }
        app.innerHTML = `<div class="app-container"><div class="header"><div class="header-title"><div class="logo-icon"><i class="fa-solid fa-feather"></i></div>NobuWave</div><div class="header-actions"><button class="icon-btn" id="rulesBtn"><i class="fa-solid fa-book"></i></button><button class="icon-btn" id="newChatBtn"><i class="fa-solid fa-plus"></i></button><button class="icon-btn" id="profileBtn"><i class="fa-solid fa-user"></i></button><button class="icon-btn" id="adminBtn"><i class="fa-solid fa-shield-halved"></i></button></div></div><div class="chat-list" id="chatList"></div></div>`;
        loadChats();
        document.getElementById('rulesBtn').addEventListener('click', () => showRules('menu'));
        document.getElementById('newChatBtn').addEventListener('click', showNewChatModal);
        document.getElementById('profileBtn').addEventListener('click', showProfileModal);
        document.getElementById('adminBtn').addEventListener('click', showAdminLogin);
    };

    const loadChats = async () => {
        const c = document.getElementById('chatList');
        const { data: m } = await supabase.from('chat_members').select('chat_id').eq('user_id', currentUser.id);
        const ids = m?.map(x => x.chat_id) || [];
        if (!ids.length) { c.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">Нет чатов.</div>'; return; }
        const { data: chats } = await supabase.from('chats').select('*').in('id', ids).order('created_at', { ascending: false });
        c.innerHTML = chats.map(chat => { const other = esc(chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат'); return `<div class="chat-item" data-chat-id="${chat.id}"><div class="chat-avatar">${chat.is_group?'👥':'👤'}</div><div class="chat-info"><div class="chat-name">${other}</div></div></div>`; }).join('');
        document.querySelectorAll('.chat-item').forEach(el => el.addEventListener('click', () => openChat(el.dataset.chatId)));
    };

    const openChat = async (chatId) => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single(); if (!chat) return; activeChat = chat;
        const other = esc(chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат');
        app.innerHTML = `<div class="chat-view"><div class="chat-header"><button class="back-btn" id="backBtn"><i class="fa-solid fa-arrow-left"></i></button><div class="chat-avatar" style="width:36px;height:36px;font-size:1.2rem">${chat.is_group?'👥':'👤'}</div><div style="flex:1;font-weight:600">${other}</div><button class="icon-btn" id="reportBtn" style="color:var(--danger)"><i class="fa-solid fa-flag"></i></button></div><div class="messages-list" id="messagesList"></div><div class="input-area"><input type="text" id="messageInput" placeholder="Сообщение..." autocomplete="off"><button class="icon-btn" id="attachImageBtn"><i class="fa-solid fa-image"></i></button><button class="voice-record-btn" id="voiceRecordBtn"><i class="fa-solid fa-microphone"></i></button><input type="file" id="imageInput" accept="image/*" hidden><button class="send-btn" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button></div></div>`;
        document.getElementById('backBtn').addEventListener('click', () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel); renderApp(); });
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        document.getElementById('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
        document.getElementById('reportBtn').addEventListener('click', () => showReportModal(chat));
        document.getElementById('attachImageBtn').addEventListener('click', () => document.getElementById('imageInput').click());
        document.getElementById('imageInput').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; const path = `chats/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`; await supabase.storage.from('images').upload(path, file); const { data } = supabase.storage.from('images').getPublicUrl(path); await supabase.from('messages').insert({ chat_id: activeChat.id, user_id: currentUser.id, username: currentUser.username, unique_id: currentUser.unique_id, content: '', image_url: data.publicUrl, is_verified: currentUser.is_verified || false }); });
        
        // Голосовые
        document.getElementById('voiceRecordBtn').addEventListener('click', async () => {
            if (isRecording) {
                mediaRecorder.stop(); isRecording = false;
                document.getElementById('voiceRecordBtn').classList.remove('recording');
                document.getElementById('voiceRecordBtn').innerHTML = '<i class="fa-solid fa-microphone"></i>';
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream); audioChunks = [];
                mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                mediaRecorder.onstop = async () => {
                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    const path = `voices/${currentUser.id}_${Date.now()}.webm`;
                    const dur = Math.round((Date.now() - voiceStartTime) / 1000);
                    const durStr = `${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
                    await supabase.storage.from('images').upload(path, blob);
                    const { data } = supabase.storage.from('images').getPublicUrl(path);
                    await supabase.from('messages').insert({ chat_id: activeChat.id, user_id: currentUser.id, username: currentUser.username, unique_id: currentUser.unique_id, content: '', voice_url: data.publicUrl, voice_duration: durStr, is_verified: currentUser.is_verified || false });
                    stream.getTracks().forEach(t => t.stop());
                };
                voiceStartTime = Date.now();
                mediaRecorder.start(); isRecording = true;
                document.getElementById('voiceRecordBtn').classList.add('recording');
                document.getElementById('voiceRecordBtn').innerHTML = '<i class="fa-solid fa-stop"></i>';
            } catch (err) { alert('Нет доступа к микрофону'); }
        });

        await loadMessages(chatId);
        realtimeChannel = supabase.channel(`chat-${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => loadMessages(chatId)).subscribe();
    };

    const loadMessages = async (chatId) => {
        const list = document.getElementById('messagesList'); if (!list) return;
        const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        list.innerHTML = data?.map(msg => {
            const isMine = msg.user_id === currentUser.id;
            let html = '';
            if (!isMine) html += `<div class="message-sender">${esc(msg.username||'?')} <span style="color:var(--text-secondary);font-size:0.7rem">${esc(msg.unique_id||'')}</span></div>`;
            if (msg.content) html += `<div>${esc(msg.content)}</div>`;
            if (msg.image_url) html += `<img src="${esc(msg.image_url)}" style="max-width:200px;border-radius:10px;margin-top:4px">`;
            if (msg.voice_url) html += `<div class="voice-message"><button class="voice-play-btn" data-url="${esc(msg.voice_url)}"><i class="fa-solid fa-play"></i></button><div class="voice-wave">${Array(15).fill('<div class="voice-wave-bar"></div>').join('')}</div><span class="voice-duration">${msg.voice_duration||'0:00'}</span></div>`;
            html += `<div class="message-time">${new Date(msg.created_at).toLocaleTimeString().slice(0,5)}</div>`;
            return `<div class="message ${isMine?'mine':'theirs'}">${html}</div>`;
        }).join('') || '<div style="text-align:center;color:var(--text-secondary);padding:20px">Нет сообщений</div>';
        
        // Обработчики для голосовых
        list.querySelectorAll('.voice-play-btn').forEach(btn => {
            let audio = null;
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (audio && !audio.paused) { audio.pause(); btn.innerHTML = '<i class="fa-solid fa-play"></i>'; return; }
                if (audio) { audio.pause(); }
                audio = new Audio(url);
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                audio.play();
                audio.onended = () => { btn.innerHTML = '<i class="fa-solid fa-play"></i>'; };
            });
        });
        
        setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
    };

    const sendMessage = async () => {
        const input = document.getElementById('messageInput'), content = input?.value.trim();
        if (!content || !activeChat) return;
        const { error } = await supabase.from('messages').insert({ chat_id: activeChat.id, user_id: currentUser.id, username: currentUser.username, unique_id: currentUser.unique_id, content, is_verified: currentUser.is_verified || false });
        if (error) { alert('Ошибка'); return; }
        input.value = ''; input.focus();
    };

    const showNewChatModal = () => {
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card"><h3>Новый чат</h3><p style="color:var(--text-secondary);text-align:center;margin-bottom:12px">Введите ID собеседника</p><input type="text" id="newChatUserId" class="modal-input" placeholder="#id"><button class="modal-btn" id="createChatBtn">Создать</button><button class="modal-btn secondary" id="closeModalBtn">Отмена</button><div id="createChatError" style="color:var(--danger);font-size:0.85rem;display:none;margin-top:8px"></div></div>`;
        document.body.appendChild(overlay); document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('createChatBtn').addEventListener('click', async () => { const inputId = document.getElementById('newChatUserId').value.trim(), err = document.getElementById('createChatError'); if (!inputId) { err.textContent = 'Введите ID'; err.style.display = 'block'; return; } const { data: other } = await supabase.from('users').select('*').eq('unique_id', inputId).single(); if (!other) { err.textContent = 'Не найден'; err.style.display = 'block'; return; } if (other.id === currentUser.id) { err.textContent = 'Нельзя с собой'; err.style.display = 'block'; return; } const name = [currentUser.username, other.username].sort().join(' & '); const { data: exist } = await supabase.from('chats').select('*').eq('name', name).eq('is_group', false).single(); if (exist) { overlay.remove(); openChat(exist.id); return; } const { data: chat } = await supabase.from('chats').insert({ name }).select().single(); await supabase.from('chat_members').insert([{ chat_id: chat.id, user_id: currentUser.id }, { chat_id: chat.id, user_id: other.id }]); overlay.remove(); openChat(chat.id); });
    };

    const showProfileModal = () => {
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card"><h3>Профиль</h3><p style="font-size:1.2rem;font-weight:600;text-align:center">${esc(currentUser.username)} ${currentUser.is_verified?'<span class="verified-badge"><i class="fa-solid fa-check"></i></span>':''}</p><p style="color:var(--text-secondary);text-align:center;margin:8px 0">ID: <strong>${esc(currentUser.unique_id)}</strong></p><p style="color:var(--text-secondary);text-align:center">Эмодзи:</p><div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0">${['👤','😀','😎','🤖','👽','🦊','🐼','🎃','💎','🔥','🌈','⚡','🌟','🍕','🎉'].map(e => `<span style="font-size:2rem;cursor:pointer" class="emoji-opt">${e}</span>`).join('')}</div><button class="modal-btn secondary" id="changeNameBtn">✏️ Изменить никнейм</button><button class="modal-btn secondary" id="logoutBtn" style="color:var(--danger);margin-top:8px">Выйти</button><button class="modal-btn secondary" id="closeProfileBtn">Закрыть</button></div>`;
        document.body.appendChild(overlay); document.getElementById('closeProfileBtn').addEventListener('click', () => overlay.remove()); document.getElementById('logoutBtn').addEventListener('click', () => { supabase.from('users').update({ is_online: false }).eq('id', currentUser.id); localStorage.removeItem('nobu_user'); location.reload(); }); document.getElementById('changeNameBtn').addEventListener('click', () => { overlay.remove(); showChangeNameModal(); }); overlay.querySelectorAll('.emoji-opt').forEach(el => el.addEventListener('click', async () => { await supabase.from('users').update({ avatar_emoji: el.textContent }).eq('id', currentUser.id); currentUser.avatar_emoji = el.textContent; localStorage.setItem('nobu_user', JSON.stringify(currentUser)); overlay.remove(); }));
    };

    const showChangeNameModal = () => {
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card"><h3>✏️ Изменить никнейм</h3><p style="color:var(--text-secondary);text-align:center;margin-bottom:8px">ID: <strong>${esc(currentUser.unique_id)}</strong> (не меняется)</p><input type="text" id="newUsername" class="modal-input" placeholder="Новый никнейм" value="${esc(currentUser.username)}"><div id="changeNameError" style="color:var(--danger);font-size:0.85rem;display:none"></div><button class="modal-btn" id="saveNameBtn">Сохранить</button><button class="modal-btn secondary" id="closeChangeNameBtn">Отмена</button></div>`;
        document.body.appendChild(overlay); document.getElementById('closeChangeNameBtn').addEventListener('click', () => overlay.remove()); document.getElementById('saveNameBtn').addEventListener('click', async () => { const newName = document.getElementById('newUsername').value.trim(), err = document.getElementById('changeNameError'); if (!newName) { err.textContent = 'Введите никнейм'; err.style.display = 'block'; return; } if (newName === currentUser.username) { overlay.remove(); return; } const { data: exists } = await supabase.from('users').select('id').eq('username', newName).single(); if (exists) { err.textContent = 'Занят'; err.style.display = 'block'; return; } await supabase.from('users').update({ username: newName, display_name: newName }).eq('id', currentUser.id); currentUser.username = newName; localStorage.setItem('nobu_user', JSON.stringify(currentUser)); overlay.remove(); showProfileModal(); });
    };

    const showAdminLogin = () => {
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card"><h3>🛡️ Доступ</h3><input type="password" id="adminPassword" class="modal-input" placeholder="Пароль"><button class="modal-btn" id="adminLoginBtn">Войти</button><button class="modal-btn secondary" id="closeAdminLoginBtn">Отмена</button></div>`;
        document.body.appendChild(overlay); document.getElementById('closeAdminLoginBtn').addEventListener('click', () => overlay.remove()); document.getElementById('adminLoginBtn').addEventListener('click', () => { if (document.getElementById('adminPassword').value === ADMIN_PASSWORD) { overlay.remove(); showAdminPanel(); } else alert('Неверный пароль'); });
    };

    const showAdminPanel = () => {
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card" style="max-height:85vh;overflow-y:auto"><h3>🛡️ Админ</h3><h4>🔨 Бан</h4><input type="text" id="banUsername" class="modal-input" placeholder="Никнейм"><select id="banDuration" class="modal-input"><option value="10">10 мин</option><option value="60">1 час</option><option value="360">6 ч</option><option value="1440">24 ч</option><option value="10080">7 дн</option></select><input type="text" id="banReason" class="modal-input" placeholder="Причина"><button class="modal-btn" id="banUserBtn" style="background:var(--danger)">Заблокировать</button><h4>✅ Верификация</h4><input type="text" id="verifyUsername" class="modal-input" placeholder="Никнейм"><button class="modal-btn" id="verifyUserBtn">Выдать ✅</button><h4>👤 Профиль</h4><input type="text" id="lookupUsername" class="modal-input" placeholder="Никнейм"><button class="modal-btn" id="lookupUserBtn">Посмотреть</button><h4>🔓 Разбан</h4><input type="text" id="unbanUsername" class="modal-input" placeholder="Никнейм"><button class="modal-btn" id="unbanUserBtn" style="background:var(--success)">Разблокировать</button><h4>📋 Баны</h4><div id="banList"></div><h4>⚠️ Жалобы</h4><div id="reportsList"></div><button class="modal-btn secondary" id="closeAdminBtn" style="margin-top:12px">Закрыть</button></div>`;
        document.body.appendChild(overlay); document.getElementById('closeAdminBtn').addEventListener('click', () => overlay.remove());
        const lb = async () => { const { data } = await supabase.from('bans').select('*').order('created_at', { ascending: false }); document.getElementById('banList').innerHTML = data?.length ? data.map(b => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem"><strong>${esc(b.username)}</strong> — до ${new Date(b.expires_at).toLocaleString('ru-RU')}<br><small>${esc(b.reason||'')}</small></div>`).join('') : '<p style="color:var(--text-secondary);font-size:0.8rem">Нет</p>'; };
        const lr = async () => { const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(20); document.getElementById('reportsList').innerHTML = data?.length ? data.map(r => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem"><strong>${esc(r.from_username)}</strong> — чат «${esc(r.chat_name)}»<br><small style="color:var(--danger)">${esc(r.reason)}</small></div>`).join('') : '<p style="color:var(--text-secondary);font-size:0.8rem">Нет</p>'; };
        lb(); lr();
        document.getElementById('banUserBtn').addEventListener('click', async () => { const u = document.getElementById('banUsername').value.trim(), m = parseInt(document.getElementById('banDuration').value), r = document.getElementById('banReason').value.trim()||'нарушение'; if(!u)return; const{data:user}=await supabase.from('users').select('id').eq('username',u).single(); if(!user){alert('Не найден');return;} await supabase.from('bans').upsert({user_id:user.id,username:u,reason:r,expires_at:new Date(Date.now()+m*60000).toISOString()}); alert(`${u} заблокирован`); lb(); });
        document.getElementById('verifyUserBtn').addEventListener('click', async () => { const u = document.getElementById('verifyUsername').value.trim(); if(!u)return; const { error } = await supabase.from('users').update({is_verified:true}).eq('username',u); if(error){alert('Ошибка: '+error.message);return;} alert(`${u} верифицирован ✅`); });
        document.getElementById('lookupUserBtn').addEventListener('click', async () => { const u = document.getElementById('lookupUsername').value.trim(); if(!u)return; const { data: user } = await supabase.from('users').select('*').eq('username',u).single(); if(!user){alert('Не найден');return;} alert(`Профиль ${user.username}:\nID: ${user.unique_id}\nВерифицирован: ${user.is_verified?'Да':'Нет'}\nРоль: ${user.role}`); });
        document.getElementById('unbanUserBtn').addEventListener('click', async () => { const u = document.getElementById('unbanUsername').value.trim(); if(!u)return; await supabase.from('bans').delete().eq('username',u); alert(`${u} разблокирован`); lb(); });
    };

    const showReportModal = (chat) => { const other = esc(chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат'); const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.innerHTML = `<div class="modal-card"><h3>⚠️ Жалоба</h3><p style="color:var(--text-secondary);text-align:center;margin-bottom:12px">Чат с: <strong>${other}</strong></p><textarea id="reportReason" class="modal-input" placeholder="Причина..." style="height:100px;resize:none"></textarea><button class="modal-btn" id="sendReportBtn" style="background:var(--danger)">Отправить</button><button class="modal-btn secondary" id="closeReportBtn">Отмена</button></div>`; document.body.appendChild(overlay); document.getElementById('closeReportBtn').addEventListener('click', () => overlay.remove()); document.getElementById('sendReportBtn').addEventListener('click', async () => { const r = document.getElementById('reportReason').value.trim(); if(!r)return; await supabase.from('reports').insert({from_user:currentUser.id,from_username:currentUser.username,chat_id:chat.id,chat_name:chat.name,reason:r}); alert('Жалоба отправлена'); overlay.remove(); }); };

    const init = async () => {
        const saved = localStorage.getItem('nobu_user');
        if (saved) { try { currentUser = JSON.parse(saved); const ban = await checkBan(); if (ban) { showBanScreen(ban); return; } await supabase.from('users').update({ is_online: true }).eq('id', currentUser.id); renderApp(); } catch (e) { localStorage.removeItem('nobu_user'); renderAuth(); } }
        else { renderAuth(); }
        window.addEventListener('beforeunload', () => { if (currentUser) supabase.from('users').update({ is_online: false }).eq('id', currentUser.id); });
    };

    return { init };
})();
document.addEventListener('DOMContentLoaded', () => NobuWave.init());