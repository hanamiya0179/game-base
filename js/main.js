// js/main.js

// ---------------------------------------------------
// 1. タブ切り替え機能
// ---------------------------------------------------
function switchTab(e, tabName) {
    // すべてのタブコンテンツを非表示にする
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => {
        content.classList.remove('active');
    });

    // すべてのタブボタンの選択状態を解除する
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(button => {
        button.classList.remove('active');
    });

    // 選択されたタブを表示する
    const targetContent = document.getElementById(`tab-${tabName}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // クリックされたボタンをアクティブにする
    if (e && e.currentTarget) {
        e.currentTarget.classList.add('active');
    }
    changeBGMForTab(tabName);
}


// ---------------------------------------------------
// 2. Supabase データベース連携（スタンプ機能）
// ---------------------------------------------------

// 📥 画面を開いた時に Supabase から現在のスタンプ数を読み込む関数
async function loadStamps() {
    if (!window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
        .from('stamps')
        .select('*');

    if (error) {
        console.error("データの読み込みに失敗しました:", error.message);
        return;
    }

    if (data) {
        const buttons = document.querySelectorAll('.stamp-btn');
        buttons.forEach(button => {
            const currentText = button.innerText.trim();
            const emoji = currentText.split(' ')[0];

            const dbData = data.find(row => row.stamp_type === emoji);
            if (dbData) {
                button.innerText = emoji + ' ' + dbData.count;
            }
        });
    }
}

// 📤 スタンプボタンがクリックされたときに、カウントアップして Supabase に保存する関数
async function countUp(buttonElement) {
    const currentText = buttonElement.innerText.trim();
    const textParts = currentText.split(' ');
    const emoji = textParts[0];
    let count = parseInt(textParts[1]) || 0;

    count = count + 1;
    buttonElement.innerText = emoji + ' ' + count;

    if (window.supabaseClient) {
        const { error } = await window.supabaseClient
            .from('stamps')
            .upsert(
                { stamp_type: emoji, count: count },
                { onConflict: 'stamp_type' }
            );

        if (error) {
            console.error("Supabaseへの保存に失敗しました:", error.message);
            alert("保存に失敗しました。RLS（アクセス権限）の設定が必要かもしれません！");
        }
    }
}


// ---------------------------------------------------
// 3. 🏆 ランク判定＆テスト機能
// ---------------------------------------------------

// 投稿数に応じたランク情報を返す関数
function getRankInfo(postCount) {
    if (postCount >= 30) return { name: '御意見番', class: 'rank-legend' };
    if (postCount >= 20) return { name: '首領',     class: 'rank-boss' };
    if (postCount >= 10) return { name: '参謀',     class: 'rank-staff' };
    if (postCount >= 5)  return { name: '幹部',     class: 'rank-exec' };
    if (postCount >= 1)  return { name: '構成員',   class: 'rank-member' };
    return { name: '見習い', class: 'rank-apprentice' };
}

// 🧪 テスト用：投稿数を指定してランク表示をリアルタイムで切り替える関数
function setTestRank(postCount) {
    const rank = getRankInfo(postCount);
    const rankElement = document.getElementById('user-rank');

    if (rankElement) {
        rankElement.innerText = `[ ${rank.name} ]`;
        // クラス名を差し替えて発光エフェクトを変更
        rankElement.className = `rank-badge ${rank.class}`;
        console.log(`ランクを「${rank.name}」（投稿数: ${postCount}回）に切り替えました！`);
    } else {
        console.error('user-rank 要素が見つかりませんでした。HTMLのid="user-rank"を確認してください。');
    }
}

// ブラウザのコンソールからどこでも実行できるようにグローバル（window）に登録
window.setTestRank = setTestRank;


// ---------------------------------------------------
// 4. 画面読み込み完了時の初期化処理
// ---------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // スタンプデータの読み込みを実行
    loadStamps();
});

// 例：ポイントを 250 pt に書き換える処理
function updatePoints(newPoints) {
    const pointElement = document.getElementById('point-count');
    if (pointElement) {
        pointElement.innerText = newPoints;
    }
}

// ===================================================
// 🎵 タブごとのBGM切り替え & 音量調整処理 (Web Audio API対応版)
// ===================================================

// 1. 初期音量を 0.05 (5%) に設定
let currentVolume = 0.05;

// 各画面用のBGMを用意
const bgms = {
    main: new Audio('audio/bgm.mp3'),   // 通常タブ用
    gacha: new Audio('audio/gacha.mp3'), // ガチャ用
    shop: new Audio('audio/shop.mp3')    // ショップ用
};

// 🟢 Web Audio API の初期化（iOS音量調整用）
let audioCtx = null;
let gainNode = null;
const trackSources = {};

function initWebAudio() {
    if (audioCtx) return; // 既に初期化済みならスキップ

    // AudioContext の作成
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // 音量調整用の GainNode を作成
    gainNode = audioCtx.createGain();
    gainNode.gain.value = currentVolume; // 初期音量を設定
    gainNode.connect(audioCtx.destination); // スピーカーに接続

    // 各 Audio 要素を GainNode に接続
    Object.keys(bgms).forEach(key => {
        const audio = bgms[key];
        audio.loop = true;
        
        // Audio要素からソースノードを作成してGainNodeに接続
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(gainNode);
        trackSources[key] = source;
    });
}

let isBGMPlaying = false;
let currentBGMKey = 'main'; // 現在再生中のBGMキー

// 🟢 ユーザーがスライダーを動かした時に呼ばれる関数
function changeVolume(val) {
    currentVolume = parseFloat(val); // 0.0 〜 1.0 の数値に変換
    
    // Web Audio APIのGainNode経由で音量を変更（iOSでも効く）
    if (gainNode && audioCtx) {
        gainNode.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
    }

    // 従来のプロパティ変更もフォールバックとして残す
    Object.values(bgms).forEach(audio => {
        audio.volume = currentVolume;
    });
}

// 🟢 BGMのON/OFF切り替え（ヘッダーのボタン用）
function toggleBGM() {
    // 初回ユーザー操作時に Web Audio API を起動（iOSの自動再生・サスペンド対策）
    initWebAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const bgmBtn = document.getElementById('bgm-btn');

    if (isBGMPlaying) {
        // 再生中なら現在の曲を一時停止
        bgms[currentBGMKey].pause();
        isBGMPlaying = false;
        bgmBtn.innerText = '🔇 BGM: OFF';
        bgmBtn.classList.remove('playing');
    } else {
        // 停止中なら現在の曲を再生
        playCurrentBGM();
    }
}

// 🟢 指定されたBGMを再生する内部関数
function playCurrentBGM() {
    const bgmBtn = document.getElementById('bgm-btn');
    bgms[currentBGMKey].play().then(() => {
        isBGMPlaying = true;
        bgmBtn.innerText = '🔊 BGM: ON';
        bgmBtn.classList.add('playing');
    }).catch(err => {
        console.log('BGM再生エラー:', err);
    });
}

// 🟢 タブ切り替え時にBGMを変更する処理
function changeBGMForTab(tabName) {
    let targetBGMKey = 'main';
    if (tabName === 'gacha') {
        targetBGMKey = 'gacha';
    } else if (tabName === 'shop') {
        targetBGMKey = 'shop';
    }

    if (targetBGMKey === currentBGMKey) return;

    bgms[currentBGMKey].pause();
    bgms[currentBGMKey].currentTime = 0;

    currentBGMKey = targetBGMKey;

    if (isBGMPlaying) {
        playCurrentBGM();
    }
}