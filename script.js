(function() {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    const $ = (id) => document.getElementById(id);
    // Auth DOM
    const authOverlay = $('authOverlay');
    const appContainer = $('appContainer');
    const loginForm = $('loginForm');
    const registerForm = $('registerForm');
    const loginEmail = $('loginEmail');
    const loginPassword = $('loginPassword');
    const loginError = $('loginError');
    const regNickname = $('regNickname');
    const regEmail = $('regEmail');
    const regPassword = $('regPassword');
    const regError = $('regError');
    // Screens & feeds
    const screenFeed = $('screenFeed');
    const screenFollowing = $('screenFollowing');
    const videoFeed = $('videoFeed');
    const followingFeed = $('followingFeed');
    // Upload
    const uploadOverlay = $('uploadOverlay');
    const uploadBtn = $('uploadBtn');
    const uploadCancel = $('uploadCancel');
    const uploadProgress = $('uploadProgress');
    const videoFile = $('videoFile');
    const videoCaption = $('videoCaption');
    // Profile (own)
    const profileOverlay = $('profileOverlay');
    const profileNickname = $('profileNickname');
    const profileAvatar = $('profileAvatar');
    const profileFollowers = $('profileFollowers');
    const profileFollowing = $('profileFollowing');
    const profileVideoCount = $('profileVideoCount');
    const logoutBtn = $('logoutBtn');
    // User profile (other)
    const userProfileOverlay = $('userProfileOverlay');
    const userProfileAvatar = $('userProfileAvatar');
    const userProfileNickname = $('userProfileNickname');
    const userProfileFollowers = $('userProfileFollowers');
    const userProfileVideoCount = $('userProfileVideoCount');
    const userFollowBtn = $('userFollowBtn');
    const closeUserProfile = $('closeUserProfile');
    // Comments
    const commentsOverlay = $('commentsOverlay');
    const commentsList = $('commentsList');
    const commentInput = $('commentInput');
    const sendCommentBtn = $('sendCommentBtn');
    const closeComments = $('closeComments');
    // Nav
    const navItems = document.querySelectorAll('.nav-item');

    let currentUser = null;
    let profile = null;
    let currentVideoId = null; // для комментариев

    // ===================== AUTH =====================
    async function checkSession() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { currentUser = user; await loadProfile(); showApp(); }
        else showAuth();
    }

    async function loadProfile() {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        profile = data || { nickname: currentUser.email?.split('@')[0] || 'Гость' };
        updateOwnProfileUI();
    }

    function updateOwnProfileUI() {
        profileNickname.textContent = profile.nickname;
        profileAvatar.textContent = profile.nickname.charAt(0).toUpperCase();
    }

    function showApp() { authOverlay.classList.add('hidden'); appContainer.classList.remove('hidden'); loadMainFeed(); }
    function showAuth() { authOverlay.classList.remove('hidden'); appContainer.classList.add('hidden'); }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signUp({ email: regEmail.value, password: regPassword.value });
        if (error) { regError.textContent = error.message; return; }
        if (data.user) {
            await supabase.from('profiles').insert({ id: data.user.id, nickname: regNickname.value || regEmail.value.split('@')[0] });
            regError.style.color = '#22c55e';
            regError.textContent = '✅ Готово! Теперь войдите.';
            registerForm.reset();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.value, password: loginPassword.value });
        if (error) loginError.textContent = error.message;
        else checkSession();
    });

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loginForm.classList.toggle('hidden', tab.dataset.tab !== 'login');
            registerForm.classList.toggle('hidden', tab.dataset.tab !== 'register');
        });
    });

    logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); showAuth(); profileOverlay.classList.add('hidden'); });

    // ===================== NAVIGATION =====================
    function switchScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screen === 'feed') screenFeed.classList.add('active');
        else if (screen === 'following') screenFollowing.classList.add('active');
        uploadOverlay.classList.add('hidden');
        profileOverlay.classList.add('hidden');
        userProfileOverlay.classList.add('hidden');
        commentsOverlay.classList.add('hidden');
        navItems.forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-screen="${screen}"]`);
        if (activeNav) activeNav.classList.add('active');
        if (screen === 'feed') loadMainFeed();
        else if (screen === 'following') loadFollowingFeed();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => switchScreen(item.dataset.screen));
    });

    // ===================== FEED =====================
    async function loadMainFeed() {
        const { data } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
        renderVideoCards(videoFeed, data);
    }

    async function loadFollowingFeed() {
        if (!currentUser) return;
        const { data: follows } = await supabase.from('followers').select('following_id').eq('follower_id', currentUser.id);
        const ids = follows?.map(f => f.following_id) || [];
        if (ids.length === 0) {
            followingFeed.innerHTML = '<div class="feed-state" style="color:#888;text-align:center;padding:40px;">Вы ни на кого не подписаны</div>';
            return;
        }
        const { data } = await supabase.from('videos').select('*').in('user_id', ids).order('created_at', { ascending: false });
        renderVideoCards(followingFeed, data);
    }

    function renderVideoCards(container, videos) {
        container.innerHTML = '';
        if (!videos || videos.length === 0) {
            container.innerHTML = '<div class="feed-state" style="color:#888;text-align:center;padding:40px;">Нет видео</div>';
            return;
        }
        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.innerHTML = `
                <video src="${video.video_url}" loop muted playsinline></video>
                <div class="video-info">
                    <div class="video-nickname" data-user-id="${video.user_id}">${esc(video.nickname)}</div>
                    <div class="video-caption">${esc(video.caption || '')}</div>
                </div>
                <div class="video-actions">
                    <div class="video-action" id="like-${video.id}">
                        <i class="fa-regular fa-heart"></i>
                        <span>${video.likes || 0}</span>
                    </div>
                    <div class="video-action" id="comment-${video.id}">
                        <i class="fa-regular fa-comment"></i>
                        <span>Ком.</span>
                    </div>
                </div>`;
            card.querySelector('.video-nickname').addEventListener('click', () => openUserProfile(video.user_id));
            card.querySelector('.video-action[id^="like-"]').addEventListener('click', () => likeVideo(video.id));
            card.querySelector('.video-action[id^="comment-"]').addEventListener('click', () => openComments(video.id));
            container.appendChild(card);
        });
        // Автовоспроизведение первого видео
        const firstVideo = container.querySelector('video');
        if (firstVideo) firstVideo.play();
        // Переключение по скроллу
        container.addEventListener('scroll', () => {
            const videos = container.querySelectorAll('video');
            videos.forEach(v => v.pause());
            const mid = container.scrollTop + container.clientHeight / 2;
            let closest = videos[0];
            let minDist = Infinity;
            videos.forEach(v => {
                const rect = v.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const dist = Math.abs(rect.top + rect.height/2 - containerRect.top - container.clientHeight/2);
                if (dist < minDist) { minDist = dist; closest = v; }
            });
            if (closest) closest.play();
        });
    }

    // ===================== LIKES =====================
    async function likeVideo(videoId) {
        if (!currentUser) return;
        const { data } = await supabase.from('videos').select('likes').eq('id', videoId).single();
        const newLikes = (data.likes || 0) + 1;
        await supabase.from('videos').update({ likes: newLikes }).eq('id', videoId);
        const btn = document.getElementById(`like-${videoId}`);
        if (btn) {
            btn.querySelector('i').className = 'fa-solid fa-heart';
            btn.querySelector('span').textContent = newLikes;
            btn.style.color = '#ef4444';
        }
    }

    // ===================== COMMENTS =====================
    async function openComments(videoId) {
        currentVideoId = videoId;
        commentsOverlay.classList.remove('hidden');
        await loadComments();
    }

    async function loadComments() {
        const { data } = await supabase.from('comments').select('*').eq('video_id', currentVideoId).order('created_at', { ascending: true });
        commentsList.innerHTML = data?.map(c => `
            <div class="comment-item">
                <div class="comment-nickname">${esc(c.nickname)}</div>
                <div class="comment-text">${esc(c.content)}</div>
            </div>
        `).join('') || '<p style="color:#888;">Нет комментариев</p>';
    }

    sendCommentBtn.addEventListener('click', async () => {
        const content = commentInput.value.trim();
        if (!content || !currentUser) return;
        await supabase.from('comments').insert({
            video_id: currentVideoId,
            user_id: currentUser.id,
            nickname: profile.nickname,
            content: content
        });
        commentInput.value = '';
        loadComments();
    });

    closeComments.addEventListener('click', () => commentsOverlay.classList.add('hidden'));

    // ===================== UPLOAD =====================
    uploadCancel.addEventListener('click', () => uploadOverlay.classList.add('hidden'));
    uploadBtn.addEventListener('click', async () => {
        const file = videoFile.files[0];
        if (!file) return;
        uploadProgress.classList.remove('hidden');
        const path = `tok/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('post-images').upload(path, file);
        if (error) { uploadProgress.textContent = 'Ошибка'; return; }
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path);
        await supabase.from('videos').insert({
            user_id: currentUser.id,
            nickname: profile.nickname,
            video_url: urlData.publicUrl,
            caption: videoCaption.value
        });
        uploadProgress.classList.add('hidden');
        videoCaption.value = '';
        videoFile.value = '';
        uploadOverlay.classList.add('hidden');
        loadMainFeed();
    });

    // ===================== PROFILE (OWN) =====================
    navItems.forEach(item => {
        if (item.dataset.screen === 'profile') {
            item.addEventListener('click', async () => {
                // Показать свой профиль вместо скрытия? Надо открыть profileOverlay и обновить статистику
                profileOverlay.classList.remove('hidden');
                // Обновить статистику
                await updateOwnProfileStats();
            });
        }
    });

    async function updateOwnProfileStats() {
        if (!currentUser) return;
        // Количество видео
        const { count: videoCnt } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        // Подписчики и подписки
        const { count: followersCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id);
        const { count: followingCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id);
        profileVideoCount.textContent = `${videoCnt || 0} видео`;
        profileFollowers.textContent = `${followersCnt || 0} подписчиков`;
        profileFollowing.textContent = `${followingCnt || 0} подписок`;
    }

    // ===================== USER PROFILE (OTHER) =====================
    async function openUserProfile(userId) {
        if (userId === currentUser.id) {
            // Открыть свой профиль
            profileOverlay.classList.remove('hidden');
            await updateOwnProfileStats();
            return;
        }
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!data) return;
        userProfileNickname.textContent = data.nickname || 'Гость';
        userProfileAvatar.textContent = data.nickname.charAt(0).toUpperCase();
        // Подписчики
        const { count: followersCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
        // Количество видео
        const { count: videoCnt } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        userProfileFollowers.textContent = `${followersCnt || 0} подписчиков`;
        userProfileVideoCount.textContent = `${videoCnt || 0} видео`;
        // Проверить подписку
        const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', currentUser.id).eq('following_id', userId).maybeSingle();
        const isFollowing = !!followData;
        userFollowBtn.textContent = isFollowing ? 'Отписаться' : 'Подписаться';
        userFollowBtn.classList.toggle('is-following', isFollowing);
        userFollowBtn.onclick = () => toggleFollowUser(userId, userFollowBtn);
        userProfileOverlay.classList.remove('hidden');
    }

    closeUserProfile.addEventListener('click', () => userProfileOverlay.classList.add('hidden'));

    async function toggleFollowUser(userId, btn) {
        const isFollowing = btn.classList.contains('is-following');
        if (isFollowing) {
            await supabase.from('followers').delete().match({ follower_id: currentUser.id, following_id: userId });
            btn.textContent = 'Подписаться';
            btn.classList.remove('is-following');
        } else {
            await supabase.from('followers').insert({ follower_id: currentUser.id, following_id: userId });
            btn.textContent = 'Отписаться';
            btn.classList.add('is-following');
        }
        // Обновить счётчики
        const { count: followersCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
        userProfileFollowers.textContent = `${followersCnt || 0} подписчиков`;
    }

    // Utility
    const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);

    // Запуск
    checkSession();
})();