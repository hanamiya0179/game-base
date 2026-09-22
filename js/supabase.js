// js/supabase.js

const { createClient } = window.supabase;

const supabaseUrl = 'https://wqamlpbslnqksaqvpako.supabase.co';
const supabaseAnonKey = 'sb_publishable_bKgF1kT0qS3sxXYVnil73g_PCMRTvhy';

// Clientの初期化
window.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// 1. URLの末尾 (?group=xxx) からグループIDを取得する（指定がない場合は 'default'）
const urlParams = new URLSearchParams(window.location.search);
const currentGroupId = urlParams.get('group') || 'default';

// Discordログイン処理
async function handleDiscordLogin() {
    const { error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: window.location.origin,
        },
    });

    if (error) console.error('ログインエラー:', error.message);
}

// ログアウト処理
async function handleLogout() {
    await window.supabaseClient.auth.signOut();
    window.location.reload(); // 画面をリロードして初期状態に戻す
}

// ログイン状態を確認して画面表示を切り替える関数
async function checkUserSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');

    if (session) {
        // ログインしている場合
        const user = session.user;
        const meta = user.user_metadata; // Discordから引き継いだプロフィール情報

        if (userAvatar) userAvatar.src = meta.avatar_url || meta.picture || '';
        if (userName) userName.textContent = meta.full_name || meta.custom_claims?.global_name || 'ゲーマー';

        if (loginBtn) loginBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
    } else {
        // ログインしていない場合
        if (loginBtn) loginBtn.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// 2. ページ読み込み時にグループが存在しなければSupabaseに自動登録する
async function ensureGroupExists() {
  const { data } = await window.supabaseClient
    .from('groups')
    .select('id')
    .eq('id', currentGroupId)
    .maybeSingle();

  if (!data) {
    await window.supabaseClient
      .from('groups')
      .insert([{ id: currentGroupId }]);
  }
}

// グループに対応する投稿一覧を取得する関数
async function fetchGroupPosts() {
  const { data: posts, error } = await window.supabaseClient
    .from('posts')
    .select('*')
    .eq('group_id', currentGroupId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('投稿取得エラー:', error);
    return;
  }

  renderPosts(posts);
}

// 取得した投稿を画面に並べる関数
function renderPosts(posts) {
  const container = document.getElementById('posts-container');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '<p class="empty-msg">まだ投稿がありません。最初の投稿をしてみよう！</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="post-card">
      <div class="post-header">
        <img src="${post.user_avatar || 'img/default-avatar.png'}" class="avatar" alt="">
        <span class="user-name">${escapeHtml(post.user_name)}</span>
        <span class="post-date">${new Date(post.created_at).toLocaleString()}</span>
      </div>
      ${post.title ? `<h3>${escapeHtml(post.title)}</h3>` : ''}
      <p class="post-content">${escapeHtml(post.content)}</p>
      ${post.image_url ? `<img src="${post.image_url}" class="post-image" alt="">` : ''}
    </div>
  `).join('');
}

// XSS対策用
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// 新規投稿を送信する関数
async function createPost(title, content, imageUrl = null) {
  const { data: { user } } = await window.supabaseClient.auth.getUser();

  const newPost = {
    group_id: currentGroupId,
    user_id: user ? user.id : null,
    user_name: user ? (user.user_metadata.full_name || user.user_metadata.name) : 'ゲスト',
    user_avatar: user ? user.user_metadata.avatar_url : null,
    title: title,
    content: content,
    image_url: imageUrl
  };

  const { error } = await window.supabaseClient
    .from('posts')
    .insert([newPost]);

  if (error) {
    alert('投稿に失敗しました: ' + error.message);
    return;
  }

  fetchGroupPosts();
}

// ページ読み込み時の全初期化処理
document.addEventListener('DOMContentLoaded', async () => {
    await ensureGroupExists();
    checkUserSession();
    fetchGroupPosts();

    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', handleDiscordLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
});