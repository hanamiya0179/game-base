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
    if (postCount >= 20) return { name: '首領', class: 'rank-boss' };
    if (postCount >= 10) return { name: '参謀', class: 'rank-staff' };
    if (postCount >= 5) return { name: '幹部', class: 'rank-exec' };
    if (postCount >= 1) return { name: '構成員', class: 'rank-member' };
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
    // ハイライト一覧の読み込みを実行
    loadGalleries();
    // トリミング選択イベントの監視を初期化
    initImageCropper();
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
        if (bgmBtn) {
            bgmBtn.innerText = '🔇 BGM: OFF';
            bgmBtn.classList.remove('playing');
        }
    } else {
        // 停止中なら現在の曲を再生
        playCurrentBGM();
    }
}

// 🟢 指定されたBGMを再生する内部関数
function playCurrentBGM() {
    // iOS対策：停止している AudioContext を復帰させる
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const bgmBtn = document.getElementById('bgm-btn');
    
    // 一度すべてのAudioを一時停止してバグ（重なり）を防ぐ
    Object.values(bgms).forEach(audio => audio.pause());

    bgms[currentBGMKey].play().then(() => {
        isBGMPlaying = true;
        if (bgmBtn) {
            bgmBtn.innerText = '🔊 BGM: ON';
            bgmBtn.classList.add('playing');
        }
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

// ===================================================
// 📤 投稿機能の実装 (Supabase Data & Storage)
// ===================================================

// ---------------------------------------------------
// 1. 最強構成の投稿機能
// ---------------------------------------------------
const buildForm = document.getElementById('form-build');
if (buildForm) {
    buildForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const game = document.getElementById('build-game').value;
        const title = document.getElementById('build-title').value;
        const tag = document.getElementById('build-tag').value;
        const detail = document.getElementById('build-detail').value;

        if (!window.supabaseClient) {
            alert('Supabaseの初期化に失敗しています。');
            return;
        }

        // Supabase の builds テーブルへ保存
        const { data, error } = await window.supabaseClient
            .from('builds')
            .insert([{ game_title: game, title: title, tag: tag, detail: detail }]);

        if (error) {
            console.error('投稿エラー:', error.message);
            alert('投稿に失敗しました: ' + error.message);
        } else {
            alert('🎉 最強構成を投稿しました！');
            buildForm.reset();
        }
    });
}

// ---------------------------------------------------
// 2. ハイライト一覧の自動読み込み・表示関数
// ---------------------------------------------------
async function loadGalleries() {
    const galleryList = document.getElementById('gallery-list');
    if (!galleryList || !window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
        .from('galleries')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('読み込みエラー:', error.message);
        return;
    }

    if (data) {
        galleryList.innerHTML = ''; // 一旦リセット
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            // 💡 修正箇所：height: auto に変更し、画像を元の縦横比で見切れず表示させます
            card.innerHTML = `
                <div class="gallery-img">
                    <img src="${item.image_url}" alt="${item.title}" style="width:100%; height:auto; display:block; border-radius: 8px;">
                </div>
                <div class="gallery-content">
                    <div class="gallery-title">${item.title}</div>
                    <div class="stamp-area">
                        <button class="stamp-btn" onclick="countUp(this)">🎉 0</button>
                        <button class="stamp-btn" onclick="countUp(this)">😭 0</button>
                        <button class="stamp-btn" onclick="countUp(this)">🤣 0</button>
                    </div>
                </div>
            `;
            galleryList.appendChild(card);
        });
    }
}

// ---------------------------------------------------
// 🖼️ 画像トリミング編集機能の制御
// ---------------------------------------------------
let cropper = null;
let croppedBlob = null; // 切り抜かれた画像データを保持

function initImageCropper() {
    const galleryFileInput = document.getElementById('gallery-image');
    if (!galleryFileInput) return;

    galleryFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                const cropImg = document.getElementById('crop-target-image');
                if (!cropImg) return;
                
                cropImg.src = e.target.result;

                // モーダルを表示
                const cropModal = document.getElementById('crop-modal');
                if (cropModal) {
                    cropModal.style.display = 'flex';
                }

                // 既存の Cropper インスタンスがあれば破棄
                if (cropper) cropper.destroy();

                // Cropper ライブラリの初期化
                if (typeof Cropper !== 'undefined') {
                    cropper = new Cropper(cropImg, {
                        viewMode: 1,
                        autoCropArea: 0.9,
                        responsive: true,
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// 「決定する」ボタン（モーダル用）
function applyCrop() {
    if (!cropper) {
        document.getElementById('crop-modal').style.display = 'none';
        return;
    }

    // 切り抜き結果を Blob に変換
    cropper.getCroppedCanvas().toBlob((blob) => {
        croppedBlob = blob;
        document.getElementById('crop-modal').style.display = 'none';
    }, 'image/jpeg', 0.85);
}

// 「キャンセル」ボタン（モーダル用）
function cancelCrop() {
    const cropModal = document.getElementById('crop-modal');
    if (cropModal) cropModal.style.display = 'none';
    if (cropper) cropper.destroy();
    
    croppedBlob = null;
    const fileInput = document.getElementById('gallery-image');
    if (fileInput) fileInput.value = '';
}


// ---------------------------------------------------
// 3. ハイライト（画像＋タイトル）の投稿機能
// ---------------------------------------------------
const galleryForm = document.getElementById('form-gallery');

if (galleryForm) {
    galleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!window.supabaseClient) {
            alert('⚠️ エラー: Supabaseが初期化されていません。\nindex.html側のURLやAPIキーの記述、スクリプトの読み込み順を確認してください。');
            return;
        }

        const titleInput = document.getElementById('gallery-title');
        const fileInput = document.getElementById('gallery-image');

        if (!titleInput || !fileInput) {
            alert('⚠️ エラー: タイトル(id="gallery-title") または 画像選択(id="gallery-image") の入力欄が見つかりません。');
            return;
        }

        const title = titleInput.value;
        // 💡 修正箇所：切り抜かれたデータがあればそれを優先、なければ元ファイルを使用
        const file = croppedBlob || fileInput.files[0];

        if (!file) {
            alert('画像を選択してください。');
            return;
        }

        try {
            const fileName = `${Date.now()}.jpg`;
            const filePath = `uploads/${fileName}`;

            // ① ストレージへ画像アップロード
            const { data: uploadData, error: uploadError } = await window.supabaseClient
                .storage
                .from('gallery-images')
                .upload(filePath, file);

            if (uploadError) {
                alert('🚨 【画像送信失敗】\nStorageの設定（バケット名や権限）に問題があります:\n' + uploadError.message);
                return;
            }

            // ② 画像URLを取得
            const { data: urlData } = window.supabaseClient
                .storage
                .from('gallery-images')
                .getPublicUrl(filePath);

            // ③ データベースへ保存
            const { data: dbData, error: dbError } = await window.supabaseClient
                .from('galleries')
                .insert([{ title: title, image_url: urlData.publicUrl }])
                .select();

            if (dbError) {
                alert('🚨 【DB保存失敗】\n' + dbError.message + '\n\nヒント: ' + (dbError.hint || 'なし'));
                return;
            }

            alert('🎉 ハイライトを正常に投稿しました！');
            galleryForm.reset();
            croppedBlob = null; // リセット
            loadGalleries(); // 投稿後に一覧を再読み込み

        } catch (err) {
            alert('🚨 【予期せぬエラー】\n' + err.message);
        }
    });
}

// ---------------------------------------------------
// 🎰 ガチャ実行＆モーダル表示処理（iOS完全対応版）
// ---------------------------------------------------
function playGacha() {
    // ボタンを押した瞬間に Web Audio API をアクティブ化
    initWebAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // 表示メッセージの設定
    const modalMsg = document.getElementById('gacha-modal-msg');
    if (modalMsg) {
        modalMsg.innerText = '🎉 SSR称号［神引きの主］を獲得しました！';
    }

    // オリジナルダイアログを表示（alertを使わないのでBGMが止まらない）
    const modal = document.getElementById('gacha-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// 🟢 ダイアログを閉じる処理
function closeGachaModal() {
    const modal = document.getElementById('gacha-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}