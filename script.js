(function() {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    // DOM
    const $ = (id) => document.getElementById(id);
    const dom = {
        nickDisplay: $('nicknameDisplay'), nickText: $('nicknameText'),
        avatarInit: $('avatarInitial'), avatarCircle: $('avatarCircle'),
        editBtn: $('editNicknameBtn'), editor: $('nicknameEditor'),
        nickInput: $('nicknameInput'), saveBtn: $('saveNicknameBtn'),
        cancelBtn: $('cancelNicknameBtn'), composerAvatar: document.querySelector('.composer-avatar'),
        composerAvatarInit: $('composerAvatarInitial'), composerNick: $('composerNickname'),
        textarea: $('postTextarea'), charCount: $('charCount'),
        publishBtn: $('publishBtn'), compError: $('composerError'),
        compErrorText: $('composerErrorText'), feed: $('postsFeed'),
        loading: $('feedLoading'), empty: $('feedEmpty'),
        error: $('feedError'), retryBtn: $('retryBtn')
    };

    let nick = '', uid = '', isPublishing = false, isAdmin = false;
    let likedPostIds = new Set(), bannedUserIds = new Set(), selectedImage = null;

    function esc(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }
    function genUid() {
        let id = localStorage.getItem('nobu_user_id');
        if (!id) { id = crypto.randomUUID(); localStorage.setItem('nobu_user_id', id); }
        return id;
    }
    function fmtDate(d) {
        if (!d) return '';
        const diff = Math.floor((Date.now() - new Date(d)) / 1000);
        if (diff < 60) return 'сейчас';
        if (diff < 3600) return Math.floor(diff/60) + 'м';
        if (diff < 86400) return Math.floor(diff/3600) + 'ч';
        return new Date(d).toLocaleDateString('ru-RU');
    }

    async function loadBans() {
        const { data } = await supabase.from('banned_users').select('user_id');
        bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
    }
    async function loadLikes() {
        if (!uid) return;
        const { data } = await supabase.from('likes').select('post_id').eq('user_id', uid);
        likedPostIds = new Set(data ? data.map(r => r.post_id) : []);
    }

    function updateUI() {
        const n = nick || 'Гость';
        dom.nickText.textContent = n; dom.composerNick.textContent = n;
        dom.avatarInit.textContent = n.charAt(0).toUpperCase();
        dom.composerAvatarInit.textContent = n.charAt(0).toUpperCase();
        dom.publishBtn.disabled = bannedUserIds.has(uid) || (!dom.textarea.value.trim() && !selectedImage) || !nick || isPublishing;
        if (bannedUserIds.has(uid)) {
            dom.compError.classList.remove('hidden');
            dom.compErrorText.textContent = 'Вы заблокированы';
        } else dom.compError.classList.add('hidden');
    }

    function createCard(post) {
        if (bannedUserIds.has(post.user_id)) return null;
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id; card.dataset.userId = post.user_id; card.dataset.nickname = post.nickname;
        card.innerHTML = `
            <div class="post-header">
                <div class="post-avatar">${esc(post.nickname?.charAt(0)||'?')}</div>
                <div class="post-author-info">
                    <span class="post-nickname">${esc(post.nickname||'Гость')}</span>
                    <span class="post-time">${fmtDate(post.created_at)}</span>
                </div>
            </div>
            ${post.content?`<div class="post-content">${esc(post.content)}</div>`:''}
            ${post.image_url?`<div class="post-image"><img src="${esc(post.image_url)}" loading="lazy"></div>`:''}
            <div class="post-actions">
                <button class="like-btn ${likedPostIds.has(post.id)?'liked':''}">
                    <i class="fas fa-heart"></i> <span>${post.likes||0}</span>
                </button>
            </div>`;
        card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card.querySelector('.like-btn')));
        return card;
    }

    async function toggleLike(postId, btn) {
        const liked = likedPostIds.has(postId);
        likedPostIds[liked?'delete':'add'](postId);
        btn.classList.toggle('liked', !liked);
        const s = btn.querySelector('span');
        s.textContent = parseInt(s.textContent) + (liked?-1:1);
        if (liked) await supabase.from('likes').delete().match({post_id:postId,user_id:uid});
        else await supabase.from('likes').insert({post_id:postId,user_id:uid});
    }

    async function loadPosts() {
        dom.loading.classList.remove('hidden'); dom.error.classList.add('hidden'); dom.empty.classList.add('hidden');
        const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false});
        dom.feed.querySelectorAll('.post-card').forEach(c=>c.remove());
        dom.loading.classList.add('hidden');
        if (!data||!data.length) { dom.empty.classList.remove('hidden'); return; }
        data.forEach(p => { const c = createCard(p); if(c) { dom.feed.appendChild(c); if(isAdmin) addAdminBtns(c); } });
    }

    async function publish() {
        if (isPublishing || bannedUserIds.has(uid)) return;
        const txt = dom.textarea.value.trim();
        if (!txt && !selectedImage) return;
        isPublishing = true; dom.publishBtn.disabled = true; dom.compError.classList.add('hidden');
        try {
            let img = null;
            if (selectedImage) {
                const path = `post-images/${uid}_${Date.now()}.${selectedImage.name.split('.').pop()}`;
                await supabase.storage.from('post-images').upload(path, selectedImage);
                img = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
            }
            await supabase.from('posts').insert({user_id:uid,nickname:nick,content:txt,likes:0,image_url:img});
            dom.textarea.value = ''; selectedImage = null; dom.charCount.textContent = '0';
            document.querySelector('.image-preview-container')?.classList.remove('active');
            loadPosts();
        } catch(e) { console.error(e); dom.compError.classList.remove('hidden'); dom.compErrorText.textContent = 'Ошибка'; }
        isPublishing = false; updateUI();
    }

    function setupImageUpload() {
        const body = document.querySelector('.composer-body');
        const tb = document.createElement('div'); tb.className = 'composer-toolbar';
        const ab = document.createElement('button'); ab.className = 'attach-btn'; ab.innerHTML = '<i class="fas fa-image"></i>';
        const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
        const pc = document.createElement('div'); pc.className = 'image-preview-container';
        const pi = document.createElement('img'); pi.className = 'image-preview';
        const rb = document.createElement('button'); rb.className = 'remove-image-btn'; rb.innerHTML = '<i class="fas fa-times"></i>';
        pc.appendChild(pi); pc.appendChild(rb); tb.appendChild(ab); tb.appendChild(fi);
        body.insertBefore(pc, body.querySelector('.composer-footer')); body.insertBefore(tb, pc);
        ab.addEventListener('click', (e) => { e.preventDefault(); fi.click(); });
        fi.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                selectedImage = e.target.files[0];
                const r = new FileReader();
                r.onload = (ev) => { pi.src = ev.target.result; pc.classList.add('active'); };
                r.readAsDataURL(e.target.files[0]); updateUI();
            }
        });
        rb.addEventListener('click', () => { selectedImage = null; pc.classList.remove('active'); updateUI(); });
    }

    function addAdminBtns(card) {
        const h = card.querySelector('.post-header');
        if (!card.querySelector('.delete-post-btn')) {
            const d = document.createElement('button'); d.className = 'delete-post-btn'; d.innerHTML = '<i class="fas fa-trash"></i>';
            d.addEventListener('click', async () => { if(confirm('Удалить?')) { await supabase.from('posts').delete().match({id:card.dataset.postId}); card.remove(); } });
            h.appendChild(d);
        }
        if (!card.querySelector('.block-user-btn')) {
            const b = document.createElement('button'); b.className = 'block-user-btn'; b.innerHTML = '<i class="fas fa-user-slash"></i>';
            b.addEventListener('click', async () => {
                if (confirm(`Заблокировать ${card.dataset.nickname}?`)) {
                    await supabase.from('banned_users').upsert({user_id:card.dataset.userId,nickname:card.dataset.nickname});
                    bannedUserIds.add(card.dataset.userId);
                    document.querySelectorAll(`.post-card[data-user-id="${card.dataset.userId}"]`).forEach(c=>c.remove());
                }
            });
            h.appendChild(b);
        }
    }

    function setupAdmin() {
        const tg = document.createElement('button'); tg.className = 'admin-toggle-btn'; tg.innerHTML = '<i class="fas fa-shield-haltered"></i>';
        document.body.appendChild(tg);
        const md = document.createElement('div'); md.className = 'admin-modal';
        md.innerHTML = `<h3>Админ-панель</h3><input type="password" id="adminPw" placeholder="Пароль"><button class="admin-btn" id="adminLogin">Войти</button><div class="admin-error" id="adminErr">Неверный</div><div class="banned-list" id="bannedList"></div>`;
        document.body.appendChild(md);
        tg.addEventListener('click', () => md.classList.toggle('active'));
        $('adminLogin').addEventListener('click', async () => {
            if ($('adminPw').value === 'nobuadmin2024') {
                isAdmin = true; tg.classList.add('active'); md.classList.remove('active');
                document.querySelectorAll('.post-card').forEach(c=>addAdminBtns(c));
                await renderBanned();
            } else $('adminErr').style.display = 'block';
        });
        async function renderBanned() {
            const { data } = await supabase.from('banned_users').select('*');
            const list = $('bannedList');
            list.innerHTML = '<h4>🚫 Заблокированные</h4>';
            if (!data||!data.length) { list.innerHTML += '<p style="color:#666;">Пусто</p>'; return; }
            data.forEach(e => {
                const row = document.createElement('div'); row.className = 'banned-item';
                row.innerHTML = `<span>${esc(e.nickname||'Без ника')}</span>`;
                const ub = document.createElement('button'); ub.className = 'unban-btn'; ub.textContent = 'Разбанить';
                ub.addEventListener('click', async () => {
                    await supabase.from('banned_users').delete().match({user_id:e.user_id});
                    bannedUserIds.delete(e.user_id);
                    await loadPosts();
                    await renderBanned();
                });
                row.appendChild(ub); list.appendChild(row);
            });
        }
    }

    async function init() {
        uid = genUid(); nick = localStorage.getItem('nobu_nickname')||'';
        await loadBans(); await loadLikes(); updateUI();
        if (!nick) { dom.nickDisplay.classList.add('hidden'); dom.editor.classList.remove('hidden'); }
        setupImageUpload(); setupAdmin();
        dom.editBtn.addEventListener('click', () => { dom.nickDisplay.classList.add('hidden'); dom.editor.classList.remove('hidden'); dom.nickInput.value = nick; });
        dom.saveBtn.addEventListener('click', () => {
            const n = dom.nickInput.value.trim(); if (!n) return;
            nick = n; localStorage.setItem('nobu_nickname', n);
            updateUI(); dom.editor.classList.add('hidden'); dom.nickDisplay.classList.remove('hidden');
        });
        dom.cancelBtn.addEventListener('click', () => { if(!nick)return; dom.editor.classList.add('hidden'); dom.nickDisplay.classList.remove('hidden'); });
        dom.textarea.addEventListener('input', () => { dom.charCount.textContent = dom.textarea.value.length; updateUI(); });
        dom.publishBtn.addEventListener('click', publish);
        dom.retryBtn.addEventListener('click', loadPosts);
        await loadPosts();
        supabase.channel('posts-chan').on('postgres_changes',{event:'INSERT',schema:'public',table:'posts'},()=>loadPosts()).subscribe();
        setInterval(loadPosts, 5000); setInterval(loadBans, 10000);
    }
    document.addEventListener('DOMContentLoaded', init);
})();