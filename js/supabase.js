// js/supabase.js

const { createClient } = window.supabase;

const supabaseUrl = 'https://wqamlpbslnqksaqvpako.supabase.co';
const supabaseAnonKey = 'sb_publishable_bKgF1kT0qS3sxXYVnil73g_PCMRTvhy';

window.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

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

        // アイコンと名前をセット
        userAvatar.src = meta.avatar_url || meta.picture || '';
        userName.textContent = meta.full_name || meta.custom_claims?.global_name || 'ゲーマー';

        // 表示の切り替え
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
    } else {
        // ログインしていない場合
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();

    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', handleDiscordLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
});