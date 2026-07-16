const NobuWave = (() => {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    let currentUser = null;
    let activeChat = null;
    let realtimeChannel = null;
    const app = document.getElementById('app');
    const ADMIN_PASSWORD = 'NobuWaveAdmin2024';

    // Утилиты
    const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[m]);

    const generateUniqueId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 8; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return '#' + id;
    };

    const formatTime = (dateStr) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    // Проверка бана
    const checkBan = async () => {
        if (!currentUser) return null;
        const { data: ban } = await supabase
            .from('bans')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (ban && new Date(ban.expires_at) > new Date()) {
            return ban;
        }
        if (ban) {
            await supabase.from('bans').delete().eq('id', ban.id);
        }
        return null;
    };

    // Экран блокировки
    const showBanScreen = (ban) => {
        const until = new Date(ban.expires_at);
        const diffMinutes = Math.floor((until - new Date()) / 60000);
        let durationText = '';
        if (diffMinutes < 60) {
            durationText = `${diffMinutes} минут`;
        } else if (diffMinutes < 1440) {
            durationText = `${Math.floor(diffMinutes / 60)} часов`;
        } else {
            durationText = `${Math.floor(diffMinutes / 1440)} дней`;
        }

        app.innerHTML = `
            <div class="auth-container">
                <div class="auth-card" style="max-width:480px">
                    <div style="font-size:4rem">🚫</div>
                    <h2 style="color:var(--danger);margin:12px 0">Вы заблокированы</h2>
                    <p style="color:var(--text-secondary)">Причина: <strong style="color:var(--text)">${esc(ban.reason || 'нарушение правил')}</strong></p>
                    <div style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:var(--radius-sm);padding:12px;margin:12px 0">
                        <p style="color:var(--accent-light);font-weight:600">⏰ Блокировка на <strong>${durationText}</strong></p>
                        <p style="color:var(--text-secondary);font-size:0.85rem">До: ${until.toLocaleString('ru-RU')}</p>
                    </div>
                    <button class="modal-btn secondary" id="showRulesBtn">📋 Правила поведения</button>
                </div>
            </div>`;

        document.getElementById('showRulesBtn').addEventListener('click', () => {
            showRules('ban');
        });
    };

    // Правила
    const showRules = (from) => {
        const isLoggedIn = !!currentUser;

        app.innerHTML = `
            <div class="auth-container">
                <div class="auth-card rules-card">
                    <h2 style="text-align:center;margin-bottom:20px">📋 Правила NobuWave</h2>
                    <div class="rules-content">
                        <h3 style="color:var(--danger)">🚫 СТРОГО ЗАПРЕЩЕНО:</h3>
                        <ul>
                            <li><strong style="color:var(--danger)">Хейтинг и травля</strong> — оскорбления, насмешки, унижение, буллинг. Самая серьёзная причина для бана.</li>
                            <li><strong>Спам</strong> — массовая рассылка, реклама, флуд</li>
                            <li><strong>Угрозы</strong> — запугивание, шантаж, угрозы</li>
                            <li><strong>Дискриминация</strong> — расизм, сексизм, гомофобия</li>
                            <li><strong>Контент для взрослых</strong> — любые материалы неприемлемого содержания строго запрещены</li>
                            <li><strong>Мошенничество</strong> — обман, фишинг</li>
                            <li><strong>Чужая личность</strong> — выдача себя за другого человека</li>
                            <li><strong>Вредоносные ссылки</strong> — вирусы, фишинг</li>
                        </ul>
                        <h3 style="color:var(--success)">✅ Рекомендуется:</h3>
                        <ul>
                            <li>Быть вежливым и уважительным</li>
                            <li>Помогать новым пользователям</li>
                            <li>Сообщать о нарушениях через кнопку ⚠️ в чате</li>
                        </ul>
                        <h3 style="color:var(--accent-light)">⚖️ Наказания:</h3>
                        <ul>
                            <li><strong>Хейтинг</strong> — бан от 1 часа до навсегда</li>
                            <li><strong>Спам</strong> — бан на 6 часов</li>
                            <li><strong>Угрозы</strong> — бан навсегда</li>
                            <li><strong>Дискриминация</strong> — бан навсегда</li>
                            <li>Повторные нарушения увеличивают срок бана</li>
                        </ul>
                    </div>
                    <button class="modal-btn secondary" id="backFromRulesBtn" style="margin-top:20px">
                        ${from === 'ban' ? '← Назад' : (isLoggedIn ? '← На главную' : '← Назад')}
                    </button>
                </div>
            </div>`;

        document.getElementById('backFromRulesBtn').addEventListener('click', () => {
            if (from === 'ban') {
                checkBan().then((b) => {
                    if (b) {
                        showBanScreen(b);
                    } else {
                        renderApp();
                    }
                });
            } else if (isLoggedIn) {
                renderApp();
            } else {
                renderAuth();
            }
        });
    };

    // Экран авторизации
    const renderAuth = () => {
        app.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        <h1>Nobu<span>Wave</span></h1>
                        <p>Волна общения</p>
                    </div>
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login">Вход</button>
                        <button class="auth-tab" data-tab="register">Регистрация</button>
                    </div>
                    <form id="loginForm" class="auth-form">
                        <input type="text" id="loginUsername" class="auth-input" placeholder="Никнейм" autocomplete="off">
                        <input type="password" id="loginPassword" class="auth-input" placeholder="Пароль">
                        <div id="loginError" style="color:var(--danger);font-size:0.85rem;display:none"></div>
                        <button type="submit" class="auth-btn">Войти</button>
                    </form>
                    <form id="registerForm" class="auth-form hidden">
                        <input type="text" id="regUsername" class="auth-input" placeholder="Придумайте никнейм" autocomplete="off">
                        <input type="password" id="regPassword" class="auth-input" placeholder="Придумайте пароль">
                        <input type="password" id="regPassword2" class="auth-input" placeholder="Повторите пароль">
                        <div id="regError" style="color:var(--danger);font-size:0.85rem;display:none"></div>
                        <button type="submit" class="auth-btn">Зарегистрироваться</button>
                    </form>
                    <button class="modal-btn secondary" id="authRulesBtn" style="margin-top:8px">📋 Прочитать правила</button>
                </div>
            </div>`;

        // Переключение табов
        document.querySelectorAll('.auth-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
                document.getElementById('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
            });
        });

        // Кнопка правил
        document.getElementById('authRulesBtn').addEventListener('click', () => {
            showRules('auth');
        });

        // Вход
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const errorEl = document.getElementById('loginError');

            if (!username || !password) {
                errorEl.textContent = 'Заполните все поля';
                errorEl.style.display = 'block';
                return;
            }

            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !user) {
                errorEl.textContent = 'Неверный никнейм или пароль';
                errorEl.style.display = 'block';
                return;
            }

            currentUser = user;

            const ban = await checkBan();
            if (ban) {
                showBanScreen(ban);
                return;
            }

            localStorage.setItem('nobu_user', JSON.stringify(user));
            await supabase.from('users').update({ is_online: true }).eq('id', user.id);
            renderApp();
        });

        // Регистрация
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const password1 = document.getElementById('regPassword').value.trim();
            const password2 = document.getElementById('regPassword2').value.trim();
            const errorEl = document.getElementById('regError');

            if (!username || !password1 || !password2) {
                errorEl.textContent = 'Заполните все поля';
                errorEl.style.display = 'block';
                return;
            }

            if (password1 !== password2) {
                errorEl.textContent = 'Пароли не совпадают';
                errorEl.style.display = 'block';
                return;
            }

            if (password1.length < 4) {
                errorEl.textContent = 'Пароль должен быть минимум 4 символа';
                errorEl.style.display = 'block';
                return;
            }

            // Проверка занятости никнейма
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (existingUser) {
                errorEl.textContent = 'Этот никнейм уже занят';
                errorEl.style.display = 'block';
                return;
            }

            const uniqueId = generateUniqueId();

            const { data: newUser, error } = await supabase
                .from('users')
                .insert({
                    username: username,
                    display_name: username,
                    password: password1,
                    unique_id: uniqueId,
                    avatar_emoji: '👤',
                    role: 'user',
                    is_verified: false
                })
                .select()
                .single();

            if (error) {
                errorEl.textContent = 'Ошибка регистрации. Попробуйте снова.';
                errorEl.style.display = 'block';
                return;
            }

            currentUser = newUser;
            localStorage.setItem('nobu_user', JSON.stringify(newUser));
            await supabase.from('users').update({ is_online: true }).eq('id', newUser.id);
            renderApp();
        });
    };

    // Главный экран
    const renderApp = async () => {
        const ban = await checkBan();
        if (ban) {
            showBanScreen(ban);
            return;
        }

        app.innerHTML = `
            <div class="app-container">
                <div class="header">
                    <div class="header-title">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        NobuWave
                    </div>
                    <div class="header-actions">
                        <button class="icon-btn" id="rulesBtn"><i class="fa-solid fa-book"></i></button>
                        <button class="icon-btn" id="newChatBtn"><i class="fa-solid fa-plus"></i></button>
                        <button class="icon-btn" id="profileBtn"><i class="fa-solid fa-user"></i></button>
                        <button class="icon-btn" id="adminBtn"><i class="fa-solid fa-shield-halved"></i></button>
                    </div>
                </div>
                <div class="chat-list" id="chatList"></div>
            </div>`;

        loadChats();

        document.getElementById('rulesBtn').addEventListener('click', () => showRules('menu'));
        document.getElementById('newChatBtn').addEventListener('click', showNewChatModal);
        document.getElementById('profileBtn').addEventListener('click', showProfileModal);
        document.getElementById('adminBtn').addEventListener('click', showAdminLogin);
    };

    // Загрузка чатов
    const loadChats = async () => {
        const container = document.getElementById('chatList');

        const { data: memberships } = await supabase
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', currentUser.id);

        const chatIds = (memberships || []).map((m) => m.chat_id);

        if (chatIds.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">
                    Нет чатов.<br>Нажмите <b>+</b> чтобы создать новый
                </div>`;
            return;
        }

        const { data: chats } = await supabase
            .from('chats')
            .select('*')
            .in('id', chatIds)
            .order('created_at', { ascending: false });

        container.innerHTML = '';

        chats.forEach((chat) => {
            const otherName = chat.name
                ?.replace(` & ${currentUser.username}`, '')
                .replace(`${currentUser.username} & `, '')
                || 'Чат';

            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.setAttribute('data-chat-id', chat.id);
            chatItem.innerHTML = `
                <div class="chat-avatar">${chat.is_group ? '👥' : '👤'}</div>
                <div class="chat-info">
                    <div class="chat-name">${esc(otherName)}</div>
                </div>`;

            chatItem.addEventListener('click', () => {
                openChat(chat.id);
            });

            container.appendChild(chatItem);
        });
    };

    // Открытие чата
    const openChat = async (chatId) => {
        // Отключаем предыдущий Realtime
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }

        const { data: chat } = await supabase
            .from('chats')
            .select('*')
            .eq('id', chatId)
            .single();

        if (!chat) return;

        activeChat = chat;

        const otherName = esc(
            chat.name
                ?.replace(` & ${currentUser.username}`, '')
                .replace(`${currentUser.username} & `, '')
                || 'Чат'
        );

        app.innerHTML = `
            <div class="chat-view">
                <div class="chat-header">
                    <button class="back-btn" id="backBtn"><i class="fa-solid fa-arrow-left"></i></button>
                    <div class="chat-avatar" style="width:36px;height:36px;font-size:1.2rem">${chat.is_group ? '👥' : '👤'}</div>
                    <div style="flex:1;font-weight:600">${otherName}</div>
                    <button class="icon-btn" id="reportBtn" style="color:var(--danger)" title="Пожаловаться">
                        <i class="fa-solid fa-flag"></i>
                    </button>
                </div>
                <div class="messages-list" id="messagesList"></div>
                <div class="input-area">
                    <input type="text" id="messageInput" placeholder="Сообщение..." autocomplete="off">
                    <button class="icon-btn" id="attachImageBtn" title="Фото"><i class="fa-solid fa-image"></i></button>
                    <button class="icon-btn" id="attachVideoBtn" title="Видео"><i class="fa-solid fa-video"></i></button>
                    <input type="file" id="imageInput" accept="image/*" hidden>
                    <input type="file" id="videoInput" accept="video/*" hidden>
                    <button class="send-btn" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>`;

        // Кнопка назад
        document.getElementById('backBtn').addEventListener('click', () => {
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
            renderApp();
        });

        // Отправка текстового сообщения
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Жалоба
        document.getElementById('reportBtn').addEventListener('click', () => {
            showReportModal(chat);
        });

        // Загрузка фото
        document.getElementById('attachImageBtn').addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });
        document.getElementById('imageInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const path = `chats/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('images').upload(path, file);
            if (error) {
                alert('Ошибка загрузки фото');
                return;
            }

            const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);

            await supabase.from('messages').insert({
                chat_id: activeChat.id,
                user_id: currentUser.id,
                username: currentUser.username,
                unique_id: currentUser.unique_id,
                content: '',
                image_url: urlData.publicUrl,
                is_verified: currentUser.is_verified || false
            });
        });

        // Загрузка видео
        document.getElementById('attachVideoBtn').addEventListener('click', () => {
            document.getElementById('videoInput').click();
        });
        document.getElementById('videoInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const path = `chats/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('images').upload(path, file);
            if (error) {
                alert('Ошибка загрузки видео');
                return;
            }

            const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);

            await supabase.from('messages').insert({
                chat_id: activeChat.id,
                user_id: currentUser.id,
                username: currentUser.username,
                unique_id: currentUser.unique_id,
                content: '',
                video_url: urlData.publicUrl,
                is_verified: currentUser.is_verified || false
            });
        });

        // Загрузка сообщений
        await loadMessages(chatId);

        // Realtime подписка
        realtimeChannel = supabase
            .channel(`chat-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`
                },
                () => {
                    loadMessages(chatId);
                }
            )
            .subscribe();
    };

    // Загрузка сообщений
    const loadMessages = async (chatId) => {
        const list = document.getElementById('messagesList');
        if (!list) return;

        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (!messages || messages.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px">Нет сообщений</div>';
            return;
        }

        list.innerHTML = '';

        messages.forEach((msg) => {
            const isMine = msg.user_id === currentUser.id;
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isMine ? 'mine' : 'theirs'}`;

            let html = '';

            // Имя отправителя (для чужих)
            if (!isMine) {
                html += `<div class="message-sender">
                    ${esc(msg.username || 'Пользователь')}
                    <span style="color:var(--text-secondary);font-size:0.7rem">${esc(msg.unique_id || '')}</span>
                    ${msg.is_verified ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}
                </div>`;
            }

            // Текст
            if (msg.content) {
                html += `<div>${esc(msg.content)}</div>`;
            }

            // Фото
            if (msg.image_url) {
                html += `<img src="${esc(msg.image_url)}" style="max-width:200px;border-radius:10px;margin-top:6px" alt="Фото">`;
            }

            // Видео
            if (msg.video_url) {
                html += `<video src="${esc(msg.video_url)}" controls style="max-width:200px;border-radius:10px;margin-top:6px"></video>`;
            }

            // Время
            html += `<div class="message-time">${formatTime(msg.created_at)}</div>`;

            messageDiv.innerHTML = html;
            list.appendChild(messageDiv);
        });

        // Прокрутка вниз
        setTimeout(() => {
            list.scrollTop = list.scrollHeight;
        }, 100);
    };

    // Отправка сообщения
    const sendMessage = async () => {
        const input = document.getElementById('messageInput');
        const content = input?.value.trim();

        if (!content || !activeChat) return;

        const { error } = await supabase.from('messages').insert({
            chat_id: activeChat.id,
            user_id: currentUser.id,
            username: currentUser.username,
            unique_id: currentUser.unique_id,
            content: content,
            is_verified: currentUser.is_verified || false
        });

        if (error) {
            alert('Ошибка отправки сообщения');
            return;
        }

        input.value = '';
        input.focus();
    };

    // Модальное окно: новый чат
    const showNewChatModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>Новый чат</h3>
                <p style="color:var(--text-secondary);text-align:center;margin-bottom:12px">Введите ID собеседника (например #abc12345)</p>
                <input type="text" id="newChatUserId" class="modal-input" placeholder="#id собеседника">
                <button class="modal-btn" id="createChatBtn">Создать чат</button>
                <button class="modal-btn secondary" id="closeModalBtn">Отмена</button>
                <div id="createChatError" style="color:var(--danger);font-size:0.85rem;text-align:center;margin-top:8px;display:none"></div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());

        document.getElementById('createChatBtn').addEventListener('click', async () => {
            const inputId = document.getElementById('newChatUserId').value.trim();
            const errorEl = document.getElementById('createChatError');

            if (!inputId) {
                errorEl.textContent = 'Введите ID';
                errorEl.style.display = 'block';
                return;
            }

            const { data: otherUser } = await supabase
                .from('users')
                .select('*')
                .eq('unique_id', inputId)
                .single();

            if (!otherUser) {
                errorEl.textContent = 'Пользователь с таким ID не найден';
                errorEl.style.display = 'block';
                return;
            }

            if (otherUser.id === currentUser.id) {
                errorEl.textContent = 'Нельзя создать чат с самим собой';
                errorEl.style.display = 'block';
                return;
            }

            const chatName = [currentUser.username, otherUser.username].sort().join(' & ');

            // Проверка существующего чата
            const { data: existingChat } = await supabase
                .from('chats')
                .select('*')
                .eq('name', chatName)
                .eq('is_group', false)
                .single();

            if (existingChat) {
                overlay.remove();
                openChat(existingChat.id);
                return;
            }

            // Создание нового чата
            const { data: newChat } = await supabase
                .from('chats')
                .insert({ name: chatName })
                .select()
                .single();

            if (!newChat) {
                errorEl.textContent = 'Ошибка создания чата';
                errorEl.style.display = 'block';
                return;
            }

            await supabase.from('chat_members').insert([
                { chat_id: newChat.id, user_id: currentUser.id },
                { chat_id: newChat.id, user_id: otherUser.id }
            ]);

            overlay.remove();
            openChat(newChat.id);
        });
    };

    // Модальное окно: профиль
    const showProfileModal = () => {
        const verifiedBadge = currentUser.is_verified
            ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>'
            : '';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>Профиль</h3>
                <p style="font-size:1.2rem;font-weight:600;text-align:center">
                    ${esc(currentUser.username)} ${verifiedBadge}
                </p>
                <p style="color:var(--text-secondary);text-align:center;font-size:0.9rem;margin-bottom:8px">
                    Ваш ID: <strong style="color:var(--text)">${esc(currentUser.unique_id)}</strong>
                </p>
                <p style="color:var(--text-secondary);text-align:center;margin:10px 0">Выберите эмодзи:</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                    ${['👤','😀','😎','🤖','👽','🦊','🐼','🎃','💎','🔥','🌈','⚡','🌟','🍕','🎉']
                        .map((e) => `<span style="font-size:2rem;cursor:pointer" class="emoji-opt">${e}</span>`)
                        .join('')}
                </div>
                <button class="modal-btn secondary" id="changeNameBtn" style="margin-top:12px">✏️ Изменить никнейм</button>
                <button class="modal-btn secondary" id="logoutBtn" style="margin-top:8px;color:var(--danger)">Выйти</button>
                <button class="modal-btn secondary" id="closeProfileBtn">Закрыть</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeProfileBtn').addEventListener('click', () => overlay.remove());

        document.getElementById('logoutBtn').addEventListener('click', () => {
            supabase.from('users').update({ is_online: false }).eq('id', currentUser.id);
            localStorage.removeItem('nobu_user');
            location.reload();
        });

        document.getElementById('changeNameBtn').addEventListener('click', () => {
            overlay.remove();
            showChangeNameModal();
        });

        overlay.querySelectorAll('.emoji-opt').forEach((el) => {
            el.addEventListener('click', async () => {
                await supabase.from('users').update({ avatar_emoji: el.textContent }).eq('id', currentUser.id);
                currentUser.avatar_emoji = el.textContent;
                localStorage.setItem('nobu_user', JSON.stringify(currentUser));
                overlay.remove();
            });
        });
    };

    // Модальное окно: смена никнейма
    const showChangeNameModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>✏️ Изменить никнейм</h3>
                <p style="color:var(--text-secondary);text-align:center;margin-bottom:8px">
                    Ваш ID: <strong>${esc(currentUser.unique_id)}</strong> (нельзя изменить)
                </p>
                <input type="text" id="newUsername" class="modal-input" placeholder="Новый никнейм" value="${esc(currentUser.username)}">
                <div id="changeNameError" style="color:var(--danger);font-size:0.85rem;text-align:center;margin-bottom:8px;display:none"></div>
                <button class="modal-btn" id="saveNameBtn">Сохранить</button>
                <button class="modal-btn secondary" id="closeChangeNameBtn">Отмена</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeChangeNameBtn').addEventListener('click', () => overlay.remove());

        document.getElementById('saveNameBtn').addEventListener('click', async () => {
            const newName = document.getElementById('newUsername').value.trim();
            const errorEl = document.getElementById('changeNameError');

            if (!newName) {
                errorEl.textContent = 'Введите никнейм';
                errorEl.style.display = 'block';
                return;
            }

            if (newName === currentUser.username) {
                overlay.remove();
                return;
            }

            const { data: exists } = await supabase
                .from('users')
                .select('id')
                .eq('username', newName)
                .single();

            if (exists) {
                errorEl.textContent = 'Этот никнейм уже занят';
                errorEl.style.display = 'block';
                return;
            }

            await supabase.from('users').update({
                username: newName,
                display_name: newName
            }).eq('id', currentUser.id);

            currentUser.username = newName;
            currentUser.display_name = newName;
            localStorage.setItem('nobu_user', JSON.stringify(currentUser));

            overlay.remove();
            showProfileModal();
        });
    };

    // Админка: вход
    const showAdminLogin = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>🛡️ Доступ администратора</h3>
                <input type="password" id="adminPassword" class="modal-input" placeholder="Введите пароль администратора">
                <button class="modal-btn" id="adminLoginBtn">Войти</button>
                <button class="modal-btn secondary" id="closeAdminLoginBtn">Отмена</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeAdminLoginBtn').addEventListener('click', () => overlay.remove());

        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            if (document.getElementById('adminPassword').value === ADMIN_PASSWORD) {
                overlay.remove();
                showAdminPanel();
            } else {
                alert('Неверный пароль');
            }
        });
    };

    // Админ-панель
    const showAdminPanel = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-height:85vh;overflow-y:auto">
                <h3>🛡️ Админ-панель</h3>
                
                <h4>🔨 Заблокировать пользователя</h4>
                <input type="text" id="banUsername" class="modal-input" placeholder="Никнейм">
                <select id="banDuration" class="modal-input">
                    <option value="10">10 минут</option>
                    <option value="60">1 час</option>
                    <option value="360">6 часов</option>
                    <option value="1440">24 часа</option>
                    <option value="10080">7 дней</option>
                    <option value="43200">30 дней</option>
                </select>
                <input type="text" id="banReason" class="modal-input" placeholder="Причина бана">
                <button class="modal-btn" id="banUserBtn" style="background:var(--danger)">Заблокировать</button>
                
                <h4>✅ Верификация</h4>
                <input type="text" id="verifyUsername" class="modal-input" placeholder="Никнейм для верификации">
                <button class="modal-btn" id="verifyUserBtn">Выдать галочку ✅</button>
                
                <h4>👤 Просмотр профиля</h4>
                <input type="text" id="lookupUsername" class="modal-input" placeholder="Никнейм">
                <button class="modal-btn" id="lookupUserBtn">Посмотреть профиль</button>
                
                <h4>🔓 Разблокировать</h4>
                <input type="text" id="unbanUsername" class="modal-input" placeholder="Никнейм">
                <button class="modal-btn" id="unbanUserBtn" style="background:var(--success)">Разблокировать</button>
                
                <h4>📋 Активные баны</h4>
                <div id="banList"></div>
                
                <h4>⚠️ Жалобы</h4>
                <div id="reportsList"></div>
                
                <button class="modal-btn secondary" id="closeAdminBtn" style="margin-top:12px">Закрыть</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeAdminBtn').addEventListener('click', () => overlay.remove());

        // Загрузка банов
        const loadBans = async () => {
            const { data } = await supabase.from('bans').select('*').order('created_at', { ascending: false });
            const list = document.getElementById('banList');
            if (!data || data.length === 0) {
                list.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem">Нет активных банов</p>';
                return;
            }
            list.innerHTML = data.map((b) => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
                    <strong>${esc(b.username)}</strong> — до ${new Date(b.expires_at).toLocaleString('ru-RU')}<br>
                    <small>${esc(b.reason || 'Без причины')}</small>
                </div>
            `).join('');
        };

        // Загрузка жалоб
        const loadReports = async () => {
            const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(20);
            const list = document.getElementById('reportsList');
            if (!data || data.length === 0) {
                list.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem">Нет жалоб</p>';
                return;
            }
            list.innerHTML = data.map((r) => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
                    <strong>${esc(r.from_username)}</strong> жалуется на чат «${esc(r.chat_name)}»<br>
                    <small style="color:var(--danger)">${esc(r.reason)}</small><br>
                    <small style="color:var(--text-secondary)">${new Date(r.created_at).toLocaleString('ru-RU')}</small>
                </div>
            `).join('');
        };

        loadBans();
        loadReports();

        // Бан
        document.getElementById('banUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('banUsername').value.trim();
            const minutes = parseInt(document.getElementById('banDuration').value);
            const reason = document.getElementById('banReason').value.trim() || 'нарушение правил';

            if (!username) return;

            const { data: user } = await supabase.from('users').select('id').eq('username', username).single();
            if (!user) {
                alert('Пользователь не найден');
                return;
            }

            await supabase.from('bans').upsert({
                user_id: user.id,
                username: username,
                reason: reason,
                expires_at: new Date(Date.now() + minutes * 60000).toISOString()
            });

            alert(`${username} заблокирован на ${minutes} минут`);
            loadBans();
        });

        // Верификация
        document.getElementById('verifyUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('verifyUsername').value.trim();
            if (!username) return;

            const { error } = await supabase.from('users').update({ is_verified: true }).eq('username', username);

            if (error) {
                alert('Ошибка: ' + error.message);
                return;
            }

            alert(`${username} верифицирован ✅`);
        });

        // Просмотр профиля
        document.getElementById('lookupUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('lookupUsername').value.trim();
            if (!username) return;

            const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
            if (!user) {
                alert('Пользователь не найден');
                return;
            }

            alert(
                `Профиль пользователя:\n\n` +
                `Никнейм: ${user.username}\n` +
                `ID: ${user.unique_id}\n` +
                `Верифицирован: ${user.is_verified ? 'Да ✅' : 'Нет'}\n` +
                `Роль: ${user.role}\n` +
                `Эмодзи: ${user.avatar_emoji}`
            );
        });

        // Разбан
        document.getElementById('unbanUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('unbanUsername').value.trim();
            if (!username) return;

            await supabase.from('bans').delete().eq('username', username);
            alert(`${username} разблокирован`);
            loadBans();
        });
    };

    // Жалоба
    const showReportModal = (chat) => {
        const otherName = esc(
            chat.name
                ?.replace(` & ${currentUser.username}`, '')
                .replace(`${currentUser.username} & `, '')
                || 'Чат'
        );

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>⚠️ Жалоба</h3>
                <p style="color:var(--text-secondary);margin-bottom:12px;text-align:center">
                    Чат с: <strong>${otherName}</strong>
                </p>
                <textarea id="reportReason" class="modal-input" placeholder="Опишите причину жалобы..." style="height:100px;resize:none"></textarea>
                <button class="modal-btn" id="sendReportBtn" style="background:var(--danger)">Отправить жалобу</button>
                <button class="modal-btn secondary" id="closeReportBtn">Отмена</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('closeReportBtn').addEventListener('click', () => overlay.remove());

        document.getElementById('sendReportBtn').addEventListener('click', async () => {
            const reason = document.getElementById('reportReason').value.trim();
            if (!reason) return;

            await supabase.from('reports').insert({
                from_user: currentUser.id,
                from_username: currentUser.username,
                chat_id: chat.id,
                chat_name: chat.name,
                reason: reason
            });

            alert('Жалоба отправлена. Администратор рассмотрит её.');
            overlay.remove();
        });
    };

    // Инициализация
    const init = async () => {
        const saved = localStorage.getItem('nobu_user');

        if (saved) {
            try {
                currentUser = JSON.parse(saved);

                const ban = await checkBan();
                if (ban) {
                    showBanScreen(ban);
                    return;
                }

                await supabase.from('users').update({ is_online: true }).eq('id', currentUser.id);
                renderApp();
            } catch (e) {
                localStorage.removeItem('nobu_user');
                renderAuth();
            }
        } else {
            renderAuth();
        }

        window.addEventListener('beforeunload', () => {
            if (currentUser) {
                supabase.from('users').update({ is_online: false }).eq('id', currentUser.id);
            }
        });
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => NobuWave.init());