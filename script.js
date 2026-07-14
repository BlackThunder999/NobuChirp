(function() {
    const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const STORAGE_NICKNAME_KEY = 'nobu_nickname';
    const STORAGE_USER_ID_KEY = 'nobu_user_id';
    const STORAGE_VERIFIED_KEY = 'nobu_verified';
    const STORAGE_AVATAR_KEY = 'nobu_avatar';
    const STORAGE_LAST_POST_TIME = 'nobu_last_post_time';

    // DOM
    const nicknameDisplay = document.getElementById('nicknameDisplay');
    const nicknameText = document.getElementById('nicknameText');
    const avatarInitial = document.getElementById('avatarInitial');
    const avatarCircle = document.getElementById('avatarCircle');
    const editNicknameBtn = document.getElementById('editNicknameBtn');
    const nicknameEditor = document.getElementById('nicknameEditor');
    const nicknameInput = document.getElementById('nicknameInput');
    const saveNicknameBtn = document.getElementById('saveNicknameBtn');
    const cancelNicknameBtn = document.getElementById('cancelNicknameBtn');
    const composerAvatar = document.querySelector('.composer-avatar');
    const composerAvatarInitial = document.getElementById('composerAvatarInitial');
    const composerNickname = document.getElementById('composerNickname');
    const postTextarea = document.getElementById('postTextarea');
    const charCount = document.getElementById('charCount');
    const publishBtn = document.getElementById('publishBtn');
    const composerError = document.getElementById('composerError');
    const composerErrorText = document.getElementById('composerErrorText');
    const postsFeed = document.getElementById('postsFeed');
    const feedLoading = document.getElementById('feedLoading');
    const feedEmpty = document.getElementById('feedEmpty');
    const feedError = document.getElementById('feedError');
    const feedErrorText = document.getElementById('feedErrorText');
    const retryBtn = document.getElementById('retryBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    let currentNickname = '';
    let currentUserId = '';
    let isPublishing = false;
    let isAdmin = false;
    let isVerified = false;
    let currentAvatarUrl = null;
    let likedPostIds = new Set();
    let bannedUserIds = new Set();
    let selectedImageFile = null;
    let realtimeSubscription = null;
    let postsRefreshInterval = null;

    // ==== БАЗОВЫЕ ФУНКЦИИ (как были) ====
    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    function generateUserId() {
        return crypto.randomUUID();
    }
    function getUserId() {
        let userId = localStorage.getItem(STORAGE_USER_ID_KEY);
        if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            userId = generateUserId();
            localStorage.setItem(STORAGE_USER_ID_KEY, userId);
        }
        return userId;
    }
    function loadBannedUsers() {
        supabase.from('banned_users').select('user_id').then(({ data }) => {
            bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
            updatePublishButtonState();
        });
    }
    function updatePublishButtonState() {
        const blocked = bannedUserIds.has(currentUserId);
        const hasContent = postTextarea.value.trim().length > 0 || selectedImageFile;
        const canPost = Date.now() - parseInt(localStorage.getItem(STORAGE_LAST_POST_TIME)||'0') >= 5000;
        publishBtn.disabled = blocked || !hasContent || !currentNickname || isPublishing || !canPost;
        if (blocked) showComposerError('Вы заблокированы');
        else if (!canPost && hasContent) showComposerError('Подождите 5 секунд');
    }
    function showComposerError(msg) {
        composerError.classList.toggle('hidden', !msg);
        if (msg) composerErrorText.textContent = msg;
    }
    function formatDate(d) {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date)) return '';
        const diff = Math.floor((Date.now() - date) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff/60)} мин. назад`;
        if (diff < 86400) return `${Math.floor(diff/3600)} ч. назад`;
        return date.toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    }

    // ==== КОМПОЗЕР ФОТО (как был) ====
    const composerBody = document.querySelector('.composer-body');
    const toolbar = document.createElement('div');
    toolbar.className = 'composer-toolbar';
    const attachBtn = document.createElement('button');
    attachBtn.className = 'attach-btn';
    attachBtn.innerHTML = '<i class="fas fa-image"></i>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    const imagePreviewContainer = document.createElement('div');
    imagePreviewContainer.className = 'image-preview-container';
    const imagePreview = document.createElement('img');
    imagePreview.className = 'image-preview';
    const removeImageBtn = document.createElement('button');
    removeImageBtn.className = 'remove-image-btn';
    removeImageBtn.innerHTML = '<i class="fas fa-times"></i>';
    imagePreviewContainer.appendChild(imagePreview);
    imagePreviewContainer.appendChild(removeImageBtn);
    toolbar.appendChild(attachBtn);
    composerBody.insertBefore(imagePreviewContainer, composerBody.querySelector('.composer-footer'));
    composerBody.insertBefore(toolbar, imagePreviewContainer);

    // ==== ПУБЛИКАЦИЯ (как была) ====
    async function publishPost() {
        if (isPublishing || bannedUserIds.has(currentUserId)) return;
        const content = postTextarea.value.trim();
        if (!content && !selectedImageFile) return;
        if (!Date.now() - parseInt(localStorage.getItem(STORAGE_LAST_POST_TIME)||'0') >= 5000) {
            showComposerError('Подождите 5 секунд');
            return;
        }
        isPublishing = true;
        publishBtn.disabled = true;
        showComposerError('');
        try {
            let imageUrl = null;
            if (selectedImageFile) {
                const path = `post-images/${currentUserId}_${Date.now()}.${selectedImageFile.name.split('.').pop()}`;
                await supabase.storage.from('post-images').upload(path, selectedImageFile);
                const { data } = supabase.storage.from('post-images').getPublicUrl(path);
                imageUrl = data.publicUrl;
            }
            const { error } = await supabase.from('posts').insert({
                user_id: currentUserId,
                nickname: currentNickname,
                content: content,
                likes: 0,
                verified: isVerified,
                image_url: imageUrl
            });
            if (error) throw error;
            localStorage.setItem(STORAGE_LAST_POST_TIME, Date.now().toString());
            postTextarea.value = '';
            selectedImageFile = null;
            imagePreviewContainer.classList.remove('active');
            loadPosts();
        } catch (e) {
            console.error(e);
            showComposerError('Ошибка публикации');
        }
        isPublishing = false;
        updatePublishButtonState();
    }

    // ==== КАРТОЧКИ ПОСТОВ ====
    function createPostCard(post) {
        if (bannedUserIds.has(post.user_id)) return null;
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.dataset.userId = post.user_id;
        card.dataset.nickname = post.nickname;
        const verifiedHtml = post.verified ? '<span class="verified-badge"><i class="fas fa-check"></i></span>' : '';
        const liked = likedPostIds.has(post.id);
        card.innerHTML = `
            <div class="post-header">
                <div class="post-avatar">${escapeHtml(post.nickname?.charAt(0) || '?')}</div>
                <div class="post-author-info">
                    <span class="post-nickname">${escapeHtml(post.nickname||'Гость')}${verifiedHtml}</span>
                    <span class="post-time">${formatDate(post.created_at)}</span>
                </div>
            </div>
            ${post.content?`<div class="post-content">${escapeHtml(post.content)}</div>`:''}
            ${post.image_url?`<div class="post-image"><img src="${escapeHtml(post.image_url)}"></div>`:''}
            <div class="post-actions">
                <button class="like-btn ${liked?'liked':''}">
                    <i class="fas fa-heart"></i> <span class="like-count">${post.likes||0}</span>
                </button>
            </div>`;
        card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card.querySelector('.like-btn')));
        return card;
    }
    async function toggleLike(postId, btn) {
        const liked = likedPostIds.has(postId);
        const countEl = btn.querySelector('.like-count');
        let count = parseInt(countEl.textContent) || 0;
        btn.classList.toggle('liked', !liked);
        countEl.textContent = liked ? Math.max(0, count-1) : count+1;
        likedPostIds[liked ? 'delete' : 'add'](postId);
        try {
            if (liked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
            else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
        } catch (e) { console.error(e); }
    }
    async function loadUserLikes() {
        if (!currentUserId) return;
        const { data } = await supabase.from('likes').select('post_id').eq('user_id', currentUserId);
        likedPostIds = new Set(data ? data.map(r => r.post_id) : []);
    }
    async function loadPosts() {
        feedLoading.classList.remove('hidden');
        feedError.classList.add('hidden');
        feedEmpty.classList.add('hidden');
        const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        postsFeed.querySelectorAll('.post-card').forEach(c => c.remove());
        feedLoading.classList.add('hidden');
        if (!data || data.length === 0) { feedEmpty.classList.remove('hidden'); return; }
        data.forEach(post => {
            const card = createPostCard(post);
            if (card) postsFeed.appendChild(card);
        });
    }

    // ==== АВАТАРКА ====
    function createAvatarUI() {
        const editor = nicknameEditor;
        const area = document.createElement('div');
        area.className = 'avatar-upload-area';
        area.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
        area.innerHTML = `
            <div class="current-avatar-preview" id="avatarPreviewInEditor" style="width:50px;height:50px;border-radius:50%;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;background-size:cover;background-position:center;border:2px solid #333;"></div>
            <input type="file" id="avatarFileInput" accept="image/*" style="display:none">
            <button class="avatar-upload-btn" id="avatarUploadBtn" style="background:#1a1a1a;border:1px solid #333;color:#999;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:0.8rem;"><i class="fas fa-camera"></i> Сменить аватар</button>
        `;
        editor.insertBefore(area, editor.querySelector('.save-nickname-btn').parentNode);
        document.getElementById('avatarUploadBtn').addEventListener('click', () => document.getElementById('avatarFileInput').click());
        document.getElementById('avatarFileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                const path = `avatars/${currentUserId}_avatar.${file.name.split('.').pop()}`;
                await supabase.storage.from('post-images').upload(path, file, { upsert: true });
                const { data } = supabase.storage.from('post-images').getPublicUrl(path);
                currentAvatarUrl = data.publicUrl;
                localStorage.setItem(STORAGE_AVATAR_KEY, currentAvatarUrl);
                applyAvatar();
            }
        });
    }
    function applyAvatar() {
        if (currentAvatarUrl) {
            avatarCircle.style.backgroundImage = `url(${currentAvatarUrl})`;
            avatarCircle.classList.add('has-image');
            avatarInitial.textContent = '';
            composerAvatar.style.backgroundImage = `url(${currentAvatarUrl})`;
            composerAvatar.style.backgroundSize = 'cover';
            composerAvatarInitial.textContent = '';
        } else {
            avatarCircle.style.backgroundImage = '';
            avatarCircle.classList.remove('has-image');
            avatarInitial.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
            composerAvatar.style.backgroundImage = '';
            composerAvatarInitial.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
        }
        const preview = document.getElementById('avatarPreviewInEditor');
        if (preview) {
            if (currentAvatarUrl) {
                preview.style.backgroundImage = `url(${currentAvatarUrl})`;
                preview.classList.add('has-image');
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-image');
                preview.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
            }
        }
    }

    // ==== АДМИНКА С РАЗБАНОМ ====
    function createAdminUI() {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'admin-toggle-btn';
        toggleBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:44px;height:44px;border-radius:50%;background:#1a1a1a;border:1px solid #333;color:#666;cursor:pointer;z-index:200;display:flex;align-items:center;justify-content:center;font-size:1.1rem;';
        toggleBtn.innerHTML = '<i class="fas fa-shield-haltered"></i>';
        document.body.appendChild(toggleBtn);

        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:18px;z-index:200;width:280px;display:none;max-height:300px;overflow-y:auto;';
        modal.innerHTML = `
            <h3 style="margin-bottom:10px;color:#fff;"><i class="fas fa-crown"></i> Админ-панель</h3>
            <input type="password" id="adminPasswordInput" placeholder="Пароль..." style="width:100%;padding:8px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;outline:none;margin-bottom:8px;">
            <button id="adminLoginBtn" style="width:100%;padding:8px;background:#fff;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Войти</button>
            <div id="adminError" style="color:#ff4444;font-size:0.8rem;margin-top:6px;display:none;">Неверный пароль</div>
            <div id="bannedList" style="margin-top:12px;display:none;"></div>
        `;
        document.body.appendChild(modal);

        toggleBtn.addEventListener('click', () => {
            modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('adminLoginBtn').addEventListener('click', async () => {
            if (document.getElementById('adminPasswordInput').value === 'nobuadmin2024') {
                isAdmin = true;
                toggleBtn.style.background = '#fff';
                toggleBtn.style.color = '#000';
                modal.style.display = 'none';
                document.getElementById('adminPasswordInput').value = '';
                document.getElementById('adminError').style.display = 'none';
                await renderBannedList();
                document.getElementById('bannedList').style.display = 'block';
                modal.style.display = 'block';
            } else {
                document.getElementById('adminError').style.display = 'block';
            }
        });

        async function renderBannedList() {
            const container = document.getElementById('bannedList');
            const { data } = await supabase.from('banned_users').select('*').order('created_at', { ascending: false });
            container.innerHTML = '<h4 style="color:#fff;margin-bottom:8px;">🚫 Заблокированные</h4>';
            if (!data || data.length === 0) {
                container.innerHTML += '<p style="color:#666;">Нет заблокированных</p>';
                return;
            }
            data.forEach(entry => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;color:#fff;border-bottom:1px solid #222;';
                row.innerHTML = `<span>${escapeHtml(entry.nickname || 'Без ника')}</span>`;
                const unblockBtn = document.createElement('button');
                unblockBtn.textContent = 'Разблокировать';
                unblockBtn.style.cssText = 'background:#888;border:none;color:#000;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:600;';
                unblockBtn.addEventListener('click', async () => {
                    await supabase.from('banned_users').delete().match({ user_id: entry.user_id });
                    bannedUserIds.delete(entry.user_id);
                    await loadPosts();
                    await renderBannedList();
                });
                row.appendChild(unblockBtn);
                container.appendChild(row);
            });
        }
    }

    // ==== ИНИЦИАЛИЗАЦИЯ ====
    async function init() {
        currentUserId = getUserId();
        currentNickname = localStorage.getItem(STORAGE_NICKNAME_KEY) || '';
        isVerified = localStorage.getItem(STORAGE_VERIFIED_KEY) === 'true';
        currentAvatarUrl = localStorage.getItem(STORAGE_AVATAR_KEY);
        await loadBannedUsers();
        await loadUserLikes();
        updateNicknameUI(currentNickname);
        if (!currentNickname) { nicknameDisplay.classList.add('hidden'); nicknameEditor.classList.remove('hidden'); }

        createAvatarUI();
        createAdminUI();

        editNicknameBtn.addEventListener('click', () => {
            nicknameDisplay.classList.add('hidden');
            nicknameEditor.classList.remove('hidden');
            nicknameInput.value = currentNickname;
            applyAvatar();
        });
        saveNicknameBtn.addEventListener('click', () => {
            const nick = nicknameInput.value.trim();
            if (!nick) return;
            if (nick === 'NobuSocial') {
                const pw = prompt('Пароль верификации:');
                if (pw === 'NobuSocialAdmin2024') {
                    isVerified = true;
                    localStorage.setItem(STORAGE_VERIFIED_KEY, 'true');
                } else {
                    isVerified = false;
                    localStorage.setItem(STORAGE_VERIFIED_KEY, 'false');
                    alert('Неверный пароль!');
                }
            } else {
                isVerified = false;
                localStorage.setItem(STORAGE_VERIFIED_KEY, 'false');
            }
            currentNickname = nick;
            localStorage.setItem(STORAGE_NICKNAME_KEY, nick);
            updateNicknameUI(nick);
            nicknameEditor.classList.add('hidden');
            nicknameDisplay.classList.remove('hidden');
        });
        cancelNicknameBtn.addEventListener('click', () => {
            if (!currentNickname) return;
            nicknameEditor.classList.add('hidden');
            nicknameDisplay.classList.remove('hidden');
        });
        function updateNicknameUI(nick) {
            nicknameText.textContent = nick || 'Гость';
            composerNickname.textContent = nick || 'Гость';
            // обновить галочку
            const badge = composerNickname.querySelector('.verified-badge');
            if (isVerified && !badge) {
                const span = document.createElement('span');
                span.className = 'verified-badge';
                span.innerHTML = '<i class="fas fa-check"></i>';
                composerNickname.appendChild(span);
            } else if (!isVerified && badge) badge.remove();
            applyAvatar();
            updatePublishButtonState();
        }

        postTextarea.addEventListener('input', () => {
            charCount.textContent = postTextarea.value.length;
            updatePublishButtonState();
        });
        publishBtn.addEventListener('click', publishPost);
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => {
            if (e.target.files[0]) {
                selectedImageFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = ev => { imagePreview.src = ev.target.result; imagePreviewContainer.classList.add('active'); };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
        removeImageBtn.addEventListener('click', () => {
            selectedImageFile = null;
            imagePreviewContainer.classList.remove('active');
        });
        retryBtn.addEventListener('click', loadPosts);

        await loadPosts();

        realtimeSubscription = supabase.channel('posts-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
                const card = createPostCard(payload.new);
                if (card) { postsFeed.insertBefore(card, postsFeed.firstChild); feedEmpty.classList.add('hidden'); }
            })
            .subscribe();

        postsRefreshInterval = setInterval(loadPosts, 5000);
        setInterval(loadBannedUsers, 10000);

        window.addEventListener('beforeunload', () => {
            clearInterval(postsRefreshInterval);
            if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();