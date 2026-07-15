// NobuTok — экстренное восстановление
const NobuTok = (() => {
    const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==================== ЛОКАЛЬНОЕ СОСТОЯНИЕ ====================
    const STORAGE_KEYS = {
        userId: 'nobutok_user_id',
        username: 'nobutok_username',
        displayName: 'nobutok_display_name',
        bio: 'nobutok_bio',
        avatarUrl: 'nobutok_avatar_url',
        isVerified: 'nobutok_verified'   // новое: храним верификацию
    };

    let localUser = {
        id: localStorage.getItem(STORAGE_KEYS.userId) || crypto.randomUUID(),
        username: localStorage.getItem(STORAGE_KEYS.username) || '',
        displayName: localStorage.getItem(STORAGE_KEYS.displayName) || '',
        bio: localStorage.getItem(STORAGE_KEYS.bio) || '',
        avatarUrl: localStorage.getItem(STORAGE_KEYS.avatarUrl) || '',
        isVerified: localStorage.getItem(STORAGE_KEYS.isVerified) === 'true'
    };

    // Сохраняем id, если только что сгенерировали
    if (!localStorage.getItem(STORAGE_KEYS.userId)) {
        localStorage.setItem(STORAGE_KEYS.userId, localUser.id);
    }

    // Функция сохранения всех полей
    const saveLocalUser = () => {
        localStorage.setItem(STORAGE_KEYS.userId, localUser.id);
        localStorage.setItem(STORAGE_KEYS.username, localUser.username);
        localStorage.setItem(STORAGE_KEYS.displayName, localUser.displayName);
        localStorage.setItem(STORAGE_KEYS.bio, localUser.bio);
        localStorage.setItem(STORAGE_KEYS.avatarUrl, localUser.avatarUrl);
        localStorage.setItem(STORAGE_KEYS.isVerified, localUser.isVerified);
    };

    // ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
    let activeTab = 'home';
    let videos = [];
    let currentVideoIndex = 0;
    let commentsSubscription = null;
    const app = document.getElementById('app');

    // ==================== УТИЛИТЫ ====================
    const html = (strings, ...values) => {
        let result = '';
        strings.forEach((str, i) => {
            result += str;
            if (i < values.length) {
                let val = values[i];
                if (val === null || val === undefined) val = '';
                else if (typeof val !== 'string') val = String(val);
                // Экранируем опасные символы
                val = val
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                result += val;
            }
        });
        return result;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const isProtectedUsername = (username) => ['NobuTok', 'SitikPlay', 'Nezely'].includes(username);

    const getVerifiedBadge = (username) => {
        return isProtectedUsername(username) ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : '';
    };

    // ==================== ЭКРАН ПРИВЕТСТВИЯ ====================
    const renderWelcome = () => {
        app.innerHTML = html`
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        <h1>Nobu<span>Tok</span></h1>
                    </div>
                    <div class="auth-form">
                        <div style="text-align:center;margin-bottom:10px">
                            <div class="profile-avatar-large" id="welcomeAvatar" style="background-image:url(${localUser.avatarUrl || ''})">${!localUser.avatarUrl ? '<i class="fa-solid fa-user"></i>' : ''}</div>
                        </div>
                        <input type="file" id="welcomeAvatarInput" accept="image/*" style="display:none">
                        <button class="profile-btn" id="welcomeAvatarBtn" style="margin-bottom:10px">Выбрать аватар</button>
                        <input type="text" id="welcomeUsername" class="auth-input" placeholder="Придумайте никнейм" maxlength="30" value="${localUser.username || ''}">
                        <button class="auth-btn" id="welcomeStartBtn">Начать</button>
                        <div class="auth-error" id="welcomeError"></div>
                    </div>
                </div>
            </div>
        `;

        // Загрузка аватара
        document.getElementById('welcomeAvatarBtn').addEventListener('click', () => document.getElementById('welcomeAvatarInput').click());
        document.getElementById('welcomeAvatarInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const path = `avatars/${localUser.id}_${Date.now()}`;
                await supabase.storage.from('avatars').upload(path, file);
                const { data } = supabase.storage.from('avatars').getPublicUrl(path);
                localUser.avatarUrl = data.publicUrl;
                document.getElementById('welcomeAvatar').style.backgroundImage = `url(${localUser.avatarUrl})`;
                document.getElementById('welcomeAvatar').innerHTML = '';
            } catch (err) {
                console.error(err);
                document.getElementById('welcomeError').textContent = 'Ошибка загрузки аватара';
            }
        });

        // Старт
        document.getElementById('welcomeStartBtn').addEventListener('click', async () => {
            const username = document.getElementById('welcomeUsername').value.trim();
            if (!username) {
                document.getElementById('welcomeError').textContent = 'Введите никнейм';
                return;
            }

            if (isProtectedUsername(username)) {
                const password = prompt('Введите пароль для этого никнейма:');
                const passwords = {
                    'NobuTok': 'NobuTok2024',
                    'SitikPlay': 'SitikPlay2024',
                    'Nezely': 'Nezely2024'
                };
                if (password !== passwords[username]) {
                    document.getElementById('welcomeError').innerHTML = 'Невозможно использовать этот никнейм без правильного пароля.';
                    return;
                }
                // Пароль верен – включаем верификацию
                localUser.isVerified = true;
            } else {
                localUser.isVerified = false;
            }

            localUser.username = username;
            localUser.displayName = username;
            saveLocalUser();
            renderApp();
        });
    };

    // ==================== ОСНОВНОЙ ИНТЕРФЕЙС ====================
    const renderApp = () => {
        app.innerHTML = `
            <div class="app-container">
                <div class="tab-content active" id="tab-home"></div>
                <div class="tab-content" id="tab-search"></div>
                <div class="tab-content" id="tab-profile"></div>
                <div class="tab-content" id="tab-following"></div>
                <nav class="bottom-nav">
                    <button class="nav-item active" data-tab="home"><i class="fa-solid fa-house"></i><span>Главная</span></button>
                    <button class="nav-item" data-tab="search"><i class="fa-solid fa-magnifying-glass"></i><span>Поиск</span></button>
                    <button class="nav-item" data-tab="upload"><i class="fa-solid fa-plus"></i><span>Загрузить</span></button>
                    <button class="nav-item" data-tab="profile"><i class="fa-solid fa-user"></i><span>Профиль</span></button>
                    <button class="nav-item" data-tab="following"><i class="fa-solid fa-users"></i><span>Подписки</span></button>
                </nav>
            </div>
            <div class="upload-overlay hidden" id="uploadOverlay">
                <div class="upload-card">
                    <h3>Новое видео</h3>
                    <input type="file" id="videoFile" accept="video/*" class="upload-input">
                    <textarea id="videoCaption" placeholder="Описание..." maxlength="200" class="upload-caption"></textarea>
                    <button class="upload-btn" id="uploadBtn">Опубликовать</button>
                    <button class="upload-cancel" id="uploadCancel">Отмена</button>
                    <div class="upload-progress hidden" id="uploadProgress">Загрузка...</div>
                </div>
            </div>
        `;

        setupNavigation();
        setupUpload();
        loadHomeFeed();
        setupRealtime();
    };

    // ==================== НАВИГАЦИЯ ====================
    const setupNavigation = () => {
        const tabs = document.querySelectorAll('.tab-content');
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                // Особый случай – загрузка видео
                if (tabName === 'upload') {
                    document.getElementById('uploadOverlay').classList.remove('hidden');
                    return;
                }

                // Скрываем все контентные вкладки
                tabs.forEach(t => t.classList.remove('active'));
                const target = document.getElementById(`tab-${tabName}`);
                if (target) target.classList.add('active');

                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                activeTab = tabName;

                if (tabName === 'home') loadHomeFeed();
                else if (tabName === 'search') renderSearch();
                else if (tabName === 'profile') renderProfile(localUser.id);
                else if (tabName === 'following') renderFollowingFeed();
            });
        });
    };

    const setupUpload = () => {
        document.getElementById('uploadCancel').addEventListener('click', () => {
            document.getElementById('uploadOverlay').classList.add('hidden');
        });

        document.getElementById('uploadBtn').addEventListener('click', async () => {
            const file = document.getElementById('videoFile').files[0];
            if (!file) return;

            if (file.size > 50 * 1024 * 1024) {
                document.getElementById('uploadProgress').textContent = 'Видео слишком большое (макс. 50 МБ)';
                document.getElementById('uploadProgress').classList.remove('hidden');
                return;
            }

            const progress = document.getElementById('uploadProgress');
            progress.classList.remove('hidden');
            progress.textContent = 'Загрузка...';
            document.getElementById('uploadBtn').disabled = true;

            try {
                const ext = file.name.split('.').pop();
                const path = `${localUser.id}_${Date.now()}.${ext}`;
                await supabase.storage.from('videos').upload(path, file);
                const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);

                await supabase.from('videos').insert({
                    user_id: localUser.id,
                    username: localUser.username,
                    display_name: localUser.displayName || localUser.username,
                    avatar_url: localUser.avatarUrl,
                    caption: document.getElementById('videoCaption').value || ''
                });

                progress.textContent = '✅ Опубликовано!';
                document.getElementById('videoCaption').value = '';
                document.getElementById('videoFile').value = '';

                setTimeout(() => {
                    document.getElementById('uploadOverlay').classList.add('hidden');
                    progress.classList.add('hidden');
                }, 1500);

                if (activeTab === 'home') loadHomeFeed();
            } catch (err) {
                progress.textContent = `Ошибка: ${err.message}`;
            } finally {
                document.getElementById('uploadBtn').disabled = false;
            }
        });
    };

    // ==================== ЛЕНТА ====================
    const loadHomeFeed = async () => {
        const tab = document.getElementById('tab-home');
        if (!tab) return;
        tab.innerHTML = '<div class="video-feed" id="videoFeed"></div>';
        const { data } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
        videos = data || [];
        currentVideoIndex = 0;
        renderVideoFeed();
    };

    const renderVideoFeed = () => {
        const feed = document.getElementById('videoFeed');
        if (!feed || videos.length === 0) {
            if (feed) feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Нет видео</div>';
            return;
        }

        feed.innerHTML = videos.map((video, index) => {
            const isOwn = video.user_id === localUser.id;
            return `
                <div class="video-item" data-index="${index}">
                    <video src="${video.video_url}" loop playsinline></video>
                    <div class="video-actions">
                        <button class="action-btn like-btn" data-video-id="${video.id}">
                            <i class="fa-heart fa-regular"></i>
                            <span>${video.likes_count || 0}</span>
                        </button>
                        <button class="action-btn comment-btn" data-video-id="${video.id}">
                            <i class="fa-regular fa-comment"></i>
                            <span>${video.comments_count || 0}</span>
                        </button>
                        ${isOwn ? `
                        <button class="action-btn delete-btn" data-video-id="${video.id}" style="color:#ef4444">
                            <i class="fa-solid fa-trash"></i>
                        </button>` : ''}
                    </div>
                    <div class="video-overlay">
                        <div class="video-user" data-user-id="${video.user_id}">
                            <div class="video-avatar" style="background-image:url(${video.avatar_url || ''})"></div>
                            <div>
                                <div class="video-username">${video.display_name || video.username} ${getVerifiedBadge(video.username)}</div>
                                <div class="video-caption">${video.caption || ''}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Обработчики
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLike(btn.dataset.videoId, btn);
            });
        });

        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCommentsPanel(btn.dataset.videoId);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Удалить видео?')) {
                    await supabase.from('videos').delete().eq('id', btn.dataset.videoId);
                    loadHomeFeed();
                }
            });
        });

        document.querySelectorAll('.video-user').forEach(el => {
            el.addEventListener('click', () => {
                const userId = el.dataset.userId;
                renderProfile(userId);
            });
        });

        playCurrentVideo();
        feed.addEventListener('scroll', handleScroll);
    };

    const playCurrentVideo = () => {
        const items = document.querySelectorAll('.video-item');
        items.forEach((item, index) => {
            const video = item.querySelector('video');
            if (!video) return;
            if (index === currentVideoIndex) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    };

    const handleScroll = () => {
        const feed = document.getElementById('videoFeed');
        if (!feed) return;
        const items = document.querySelectorAll('.video-item');
        if (items.length === 0) return;
        let closestIndex = 0;
        let minDistance = Infinity;
        const feedRect = feed.getBoundingClientRect();
        items.forEach((item, index) => {
            const rect = item.getBoundingClientRect();
            const distance = Math.abs(rect.top + rect.height/2 - feedRect.top - feedRect.height/2);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });
        if (closestIndex !== currentVideoIndex) {
            currentVideoIndex = closestIndex;
            playCurrentVideo();
        }
    };

    // ==================== ЛАЙКИ ====================
    const toggleLike = async (videoId, btn) => {
        const { data: existing } = await supabase.from('likes')
            .select('*')
            .eq('user_id', localUser.id)
            .eq('video_id', videoId)
            .single();

        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
            btn.classList.remove('liked');
            btn.querySelector('i').className = 'fa-regular fa-heart';
        } else {
            await supabase.from('likes').insert({ user_id: localUser.id, video_id: videoId });
            btn.classList.add('liked');
            btn.querySelector('i').className = 'fa-solid fa-heart';
        }
        const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('video_id', videoId);
        btn.querySelector('span').textContent = count || 0;
        await supabase.from('videos').update({ likes_count: count }).eq('id', videoId);
    };

    // ==================== КОММЕНТАРИИ ====================
    const openCommentsPanel = (videoId) => {
        const existing = document.getElementById('commentsPanel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'commentsPanel';
        panel.className = 'comments-panel open';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3>Комментарии</h3>
                <button id="closeCommentsBtn" style="background:none;border:none;color:var(--text);font-size:1.2rem;cursor:pointer"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="comments-list" id="commentsList"></div>
            <div class="comment-input-area">
                <input type="text" id="commentInput" placeholder="Написать комментарий...">
                <button class="comment-send-btn" id="sendCommentBtn"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        `;
        document.body.appendChild(panel);

        document.getElementById('closeCommentsBtn').addEventListener('click', () => panel.remove());
        loadComments(videoId);
        setupCommentRealtime(videoId);

        document.getElementById('sendCommentBtn').addEventListener('click', async () => {
            const content = document.getElementById('commentInput').value.trim();
            if (!content) return;
            await supabase.from('comments').insert({
                user_id: localUser.id,
                video_id: videoId,
                username: localUser.username,
                content: content
            });
            document.getElementById('commentInput').value = '';
        });
    };

    const loadComments = async (videoId) => {
        const { data } = await supabase.from('comments')
            .select('*')
            .eq('video_id', videoId)
            .order('created_at', { ascending: true });

        const list = document.getElementById('commentsList');
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center">Нет комментариев</div>';
            return;
        }
        list.innerHTML = data.map(c => {
            // Ищем аватар автора (можно хранить в самом комментарии или брать из локального юзера)
            return html`
                <div class="comment-item">
                    <div class="comment-avatar" style="background-image:url(${c.avatar_url || ''})"></div>
                    <div class="comment-body">
                        <div class="comment-username">${c.username} ${getVerifiedBadge(c.username)}</div>
                        <div class="comment-text">${c.content}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const setupCommentRealtime = (videoId) => {
        if (commentsSubscription) supabase.removeChannel(commentsSubscription);
        commentsSubscription = supabase
            .channel(`comments-${videoId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `video_id=eq.${videoId}` }, () => {
                loadComments(videoId);
            })
            .subscribe();
    };

    // ==================== ПРОФИЛЬ ====================
    const renderProfile = (userId) => {
        const tab = document.getElementById('tab-profile');
        if (!tab) return;
        tab.innerHTML = '<div style="text-align:center;padding:40px">Загрузка...</div>';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const profileNav = document.querySelector('[data-tab="profile"]');
        if (profileNav) profileNav.classList.add('active');

        const isOwn = userId === localUser.id;
        // Если профиль свой – используем localUser, иначе соберём из видео
        if (isOwn) {
            buildProfileDOM(userId, localUser);
        } else {
            // Найдём любое видео этого пользователя, чтобы взять базовую инфу
            supabase.from('videos').select('*').eq('user_id', userId).limit(1).single().then(({ data }) => {
                if (!data) {
                    tab.innerHTML = '<div style="text-align:center;padding:40px">Пользователь не найден</div>';
                    return;
                }
                const fakeProfile = {
                    id: userId,
                    username: data.username,
                    displayName: data.display_name || data.username,
                    bio: '',
                    avatarUrl: data.avatar_url || '',
                    isVerified: isProtectedUsername(data.username)
                };
                buildProfileDOM(userId, fakeProfile);
            });
        }
    };

    const buildProfileDOM = (userId, profileData) => {
        const tab = document.getElementById('tab-profile');
        const isOwn = userId === localUser.id;

        Promise.all([
            supabase.from('videos').select('*', { count: 'exact' }).eq('user_id', userId),
            supabase.from('videos').select('likes_count').eq('user_id', userId),
            supabase.from('followers').select('*', { count: 'exact' }).eq('following_id', userId),
            supabase.from('followers').select('*', { count: 'exact' }).eq('follower_id', userId)
        ]).then(([videosRes, likesRes, followersRes, followingRes]) => {
            const totalLikes = likesRes.data?.reduce((sum, v) => sum + (v.likes_count || 0), 0) || 0;
            const videosCount = videosRes.count || 0;
            const followersCount = followersRes.count || 0;
            const followingCount = followingRes.count || 0;

            tab.innerHTML = html`
                <div class="profile-header">
                    <div class="profile-avatar-large" style="background-image:url(${profileData.avatarUrl || ''})">${!profileData.avatarUrl ? '<i class="fa-solid fa-user"></i>' : ''}</div>
                    <div class="profile-name">${profileData.displayName || profileData.username} ${getVerifiedBadge(profileData.username)}</div>
                    ${isOwn ? `<div class="profile-username">@${localUser.username}</div>` : ''}
                    <div class="profile-bio">${profileData.bio || 'О себе'}</div>
                    <div class="profile-stats">
                        <div class="stat-item"><div class="stat-value">${videosCount}</div><div class="stat-label">видео</div></div>
                        <div class="stat-item"><div class="stat-value">${totalLikes}</div><div class="stat-label">лайков</div></div>
                        <div class="stat-item"><div class="stat-value">${followersCount}</div><div class="stat-label">подписчиков</div></div>
                        <div class="stat-item"><div class="stat-value">${followingCount}</div><div class="stat-label">подписок</div></div>
                    </div>
                    <div class="profile-actions">
                        ${isOwn ? `
                            <button class="profile-btn" id="editProfileBtn">Редактировать</button>
                            <button class="profile-btn" id="adminBtn">Админ</button>
                        ` : `
                            <button class="profile-btn primary" id="followBtn">Подписаться</button>
                        `}
                    </div>
                </div>
                <div class="profile-videos-grid" id="profileVideos"></div>
            `;

            // Заполняем сетку видео
            supabase.from('videos').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => {
                const grid = document.getElementById('profileVideos');
                if (grid) {
                    grid.innerHTML = data?.map(v => `
                        <div class="grid-video">
                            <video src="${v.video_url}" muted></video>
                            <div class="likes-overlay"><i class="fa-solid fa-heart"></i> ${v.likes_count || 0}</div>
                        </div>
                    `).join('') || '';
                }
            });

            // Обработчики кнопок
            if (isOwn) {
                document.getElementById('editProfileBtn')?.addEventListener('click', openProfileEditor);
                document.getElementById('adminBtn')?.addEventListener('click', openAdminPanel);
            } else {
                const followBtn = document.getElementById('followBtn');
                if (followBtn) {
                    // Проверим, подписан ли я
                    supabase.from('followers').select('*').eq('follower_id', localUser.id).eq('following_id', userId).single().then(({ data }) => {
                        const isFollowing = !!data;
                        followBtn.textContent = isFollowing ? 'Отписаться' : 'Подписаться';
                        followBtn.classList.toggle('primary', !isFollowing);
                        followBtn.addEventListener('click', () => {
                            if (isFollowing) {
                                supabase.from('followers').delete().eq('follower_id', localUser.id).eq('following_id', userId).then(() => renderProfile(userId));
                            } else {
                                supabase.from('followers').insert({ follower_id: localUser.id, following_id: userId }).then(() => renderProfile(userId));
                            }
                        });
                    });
                }
            }
        });
    };

    const openProfileEditor = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = html`
            <div class="modal-card">
                <h3>Редактировать профиль</h3>
                <input type="text" id="editDisplayName" class="auth-input" placeholder="Имя" value="${localUser.displayName || ''}">
                <textarea id="editBio" class="auth-input" placeholder="О себе" style="resize:none;height:60px">${localUser.bio || ''}</textarea>
                <input type="file" id="editAvatar" accept="image/*">
                <button class="profile-btn primary" id="saveProfileBtn">Сохранить</button>
                <button class="profile-btn" id="closeModalBtn">Отмена</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('saveProfileBtn').addEventListener('click', async () => {
            const newDisplayName = document.getElementById('editDisplayName').value.trim();
            const newBio = document.getElementById('editBio').value.trim();
            const avatarFile = document.getElementById('editAvatar').files[0];

            // Проверка защищённого ника
            if (newDisplayName && isProtectedUsername(newDisplayName) && newDisplayName !== localUser.username) {
                const password = prompt('Введите пароль для этого никнейма:');
                const passwords = { 'NobuTok': 'NobuTok2024', 'SitikPlay': 'SitikPlay2024', 'Nezely': 'Nezely2024' };
                if (password !== passwords[newDisplayName]) {
                    alert('Невозможно сменить никнейм на этот без правильного пароля.');
                    return;
                }
                localUser.isVerified = true;
            } else if (newDisplayName && !isProtectedUsername(newDisplayName)) {
                localUser.isVerified = false;
            }

            if (newDisplayName) {
                localUser.displayName = newDisplayName;
                localUser.username = newDisplayName;
            }
            localUser.bio = newBio;

            if (avatarFile) {
                try {
                    const path = `avatars/${localUser.id}_${Date.now()}`;
                    await supabase.storage.from('avatars').upload(path, avatarFile);
                    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
                    localUser.avatarUrl = data.publicUrl;
                } catch (err) {
                    console.error('Ошибка загрузки аватара:', err);
                }
            }

            saveLocalUser();
            overlay.remove();
            renderProfile(localUser.id);
            // Обновить аватар в своих видео (опционально, чтобы везде отобразился)
            supabase.from('videos').update({ avatar_url: localUser.avatarUrl, display_name: localUser.displayName, username: localUser.username }).eq('user_id', localUser.id).then(() => {
                if (activeTab === 'home') loadHomeFeed();
            });
        });
    };

    // ==================== АДМИНКА ====================
    const openAdminPanel = () => {
        const password = prompt('Введите пароль администратора:');
        if (password !== 'NobuTokAdmin') {
            alert('Неверный пароль');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-height:80vh;overflow-y:auto">
                <h3>Админ-панель</h3>
                <div id="adminBannedList"></div>
                <button class="profile-btn" id="closeAdminBtn" style="margin-top:10px;width:100%">Закрыть</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeAdminBtn').addEventListener('click', () => overlay.remove());

        // Загрузить список забаненных
        const loadBanned = () => {
            supabase.from('banned_users').select('*').then(({ data }) => {
                const list = document.getElementById('adminBannedList');
                list.innerHTML = '<h4>Заблокированные пользователи</h4>';
                if (!data || data.length === 0) {
                    list.innerHTML += '<p style="color:var(--text-muted)">Нет заблокированных</p>';
                    return;
                }
                data.forEach(user => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)';
                    row.innerHTML = `<span>${user.username || user.user_id}</span>`;
                    const unban = document.createElement('button');
                    unban.textContent = 'Разблокировать';
                    unban.className = 'profile-btn';
                    unban.addEventListener('click', async () => {
                        await supabase.from('banned_users').delete().eq('id', user.id);
                        loadBanned();
                    });
                    row.appendChild(unban);
                    list.appendChild(row);
                });
            });
        };
        loadBanned();
    };

    // ==================== ПОИСК ====================
    const renderSearch = () => {
        const tab = document.getElementById('tab-search');
        tab.innerHTML = `
            <div class="search-container">
                <input type="text" class="search-input" id="searchInput" placeholder="Поиск пользователей...">
            </div>
            <div class="search-results" id="searchResults"></div>
        `;
        document.getElementById('searchInput').addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 1) { document.getElementById('searchResults').innerHTML = ''; return; }
            const { data } = await supabase.from('videos').select('user_id, username, display_name, avatar_url').ilike('username', `%${query}%`).limit(20);
            const unique = data ? Object.values(data.reduce((acc, cur) => { if (!acc[cur.user_id]) acc[cur.user_id] = cur; return acc; }, {})).slice(0, 20) : [];
            document.getElementById('searchResults').innerHTML = unique.map(u => `
                <div class="user-result" data-user-id="${u.user_id}">
                    <div class="user-result-avatar" style="background-image:url(${u.avatar_url || ''})"></div>
                    <div>
                        <div class="user-result-name">${u.display_name || u.username} ${getVerifiedBadge(u.username)}</div>
                        <div class="user-result-username">@${u.username}</div>
                    </div>
                </div>
            `).join('') || '<div style="color:var(--text-muted);text-align:center">Никого не найдено</div>';
            document.querySelectorAll('.user-result').forEach(el => {
                el.addEventListener('click', () => renderProfile(el.dataset.userId));
            });
        });
    };

    // ==================== ЛЕНТА ПОДПИСОК ====================
    const renderFollowingFeed = () => {
        const tab = document.getElementById('tab-following');
        tab.innerHTML = '<div class="video-feed" id="followingFeed"></div>';
        supabase.from('followers').select('following_id').eq('follower_id', localUser.id).then(({ data: follows }) => {
            const ids = follows?.map(f => f.following_id) || [];
            if (ids.length === 0) {
                document.getElementById('followingFeed').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Вы ни на кого не подписаны</div>';
                return;
            }
            supabase.from('videos').select('*').in('user_id', ids).order('created_at', { ascending: false }).then(({ data }) => {
                const feed = document.getElementById('followingFeed');
                feed.innerHTML = data?.map(v => `
                    <div class="video-item">
                        <video src="${v.video_url}" loop playsinline></video>
                        <!-- Минимальная информация -->
                    </div>
                `).join('') || '';
            });
        });
    };

    // ==================== REALTIME ====================
    const setupRealtime = () => {
        supabase.channel('videos-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
                if (activeTab === 'home') loadHomeFeed();
            })
            .subscribe();
    };

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    const init = () => {
        if (localUser.username) {
            renderApp();
        } else {
            renderWelcome();
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => NobuTok.init());