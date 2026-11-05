import {get, set, del} from 'idb-keyval';
import {isIdentity, paramsKey, processImage} from './adjust.js';

/**
 * 照片資產（Blob、解碼後的預覽圖、調色快取）都放在這個模組，
 * 不進 Pinia：大物件放進響應式系統只會拖慢效能。
 *
 * 影片也是一種照片資產：preview / thumb 是封面幀，所以濾鏡縮圖、照片匣都不必另外處理；
 * 多一個播放用的 video 元素，繪製時直接畫當下的畫面。
 */

const PREVIEW_EDGE = 1600;
const CACHE_LIMIT = 48;
// 調色要逐幀跑像素運算，預覽解析度壓低才跟得上播放
const VIDEO_PREVIEW_EDGE = 640;
const VIDEO_LOAD_TIMEOUT = 20_000;
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm)$/i;

const assets = new Map(); // id -> {blob, width, height, preview}
const processedCache = new Map(); // `${id}|${params}` -> canvas

let seq = 0;
const newId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

function loadImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('decode-failed'));
        };
        img.src = url;
    });
}

/** 有些來源（例如部分 Android 相簿）不帶 MIME，只能看副檔名 */
export function isVideoFile(file) {
    return file.type ? file.type.startsWith('video/') : VIDEO_EXTENSIONS.test(file.name || '');
}

export function isMediaFile(file) {
    return !file.type || file.type.startsWith('image/') || file.type.startsWith('video/');
}

function seek(video, time) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('decode-failed')), VIDEO_LOAD_TIMEOUT);
        video.addEventListener('seeked', () => {
            clearTimeout(timer);
            resolve();
        }, {once: true});
        video.currentTime = time;
    });
}

function closeVideo(video, url) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
}

/**
 * 建立靜音、循環的 video 元素，並停在封面幀。
 * 呼叫後到第一個 await 之前會同步呼叫 play()，所以在點擊事件裡呼叫就帶著使用者操作的授權
 */
async function openVideo(blob) {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    // iOS Safari 對不在 DOM 裡的影片可能不解碼畫面，所以掛上去但不顯示
    // 透明度留一點點：完全透明可能被 iOS 當成看不見，靜音自動播放會被暫停
    video.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none';
    document.body.append(video);

    let timer;
    const prepare = (async () => {
        await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(new Error('decode-failed'));
            video.src = url;
            // iOS Safari 不理 preload，影片要開始播放才會載入畫面；靜音內嵌播放平常不需要使用者操作，
            // 但低耗電模式會擋，這時直接回報，不必空等逾時
            video.play().catch((err) => {
                if (err?.name === 'NotAllowedError') reject(new Error('playback-blocked'));
            });
        });
        video.pause();
        if (!video.videoWidth) throw new Error('decode-failed');
        // MediaRecorder 錄的 WebM 沒有長度資訊，跳到尾端瀏覽器才算得出來
        if (!Number.isFinite(video.duration)) await seek(video, 1e9);
        if (!Number.isFinite(video.duration)) throw new Error('decode-failed');
        await seek(video, Math.min(0.1, video.duration / 2));
    })();
    try {
        await Promise.race([
            prepare,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('decode-failed')), VIDEO_LOAD_TIMEOUT);
            }),
        ]);
    } catch (err) {
        closeVideo(video, url);
        throw err;
    } finally {
        clearTimeout(timer);
    }
    return {video, url};
}

function downscale(img, maxEdge) {
    const srcW = img.naturalWidth || img.videoWidth;
    const srcH = img.naturalHeight || img.videoHeight;
    const ratio = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW * ratio);
    canvas.height = Math.round(srcH * ratio);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

async function registerVideo(id, blob, name) {
    const {video, url} = await openVideo(blob);
    const asset = {
        blob,
        video,
        url,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        preview: downscale(video, PREVIEW_EDGE),
    };
    asset.thumb = makeThumb(asset.preview);
    assets.set(id, asset);
    return {id, name, width: asset.width, height: asset.height, kind: 'video', duration: asset.duration};
}

async function registerBlob(id, blob, name) {
    if (isVideoFile(blob)) return registerVideo(id, blob, name);
    const img = await loadImage(blob);
    const asset = {
        blob,
        width: img.naturalWidth,
        height: img.naturalHeight,
        preview: downscale(img, PREVIEW_EDGE),
    };
    asset.thumb = makeThumb(asset.preview);
    assets.set(id, asset);
    return {id, name, width: asset.width, height: asset.height};
}

function makeThumb(canvas) {
    const ratio = 240 / Math.max(canvas.width, canvas.height);
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * ratio);
    c.height = Math.round(canvas.height * ratio);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
}

/**
 * 讀入使用者選的照片或影片；逐張解碼，每完成一張就呼叫 onPhoto，
 * 讓畫面可以一張一張出現，不必等全部解碼完。回傳 {photos, failed}
 */
export async function importFiles(files, onPhoto = () => {}) {
    const photos = [];
    let failed = 0;
    let blocked = 0;
    for (const file of files) {
        if (!isMediaFile(file)) {
            failed++;
            continue;
        }
        try {
            const id = newId();
            const meta = await registerBlob(id, file, file.name || '貼上的圖片');
            photos.push(meta);
            onPhoto(meta);
            set(`photo:${id}`, {blob: file, name: meta.name}).catch(() => {});
        } catch (err) {
            if (err?.message === 'playback-blocked') blocked++;
            else failed++;
        }
    }
    return {photos, failed, blocked};
}

export function photoSize(id) {
    return assets.get(id);
}

export function photoThumb(id) {
    return assets.get(id)?.thumb;
}

export function isVideoAsset(id) {
    return Boolean(assets.get(id)?.video);
}

/**
 * 讓播放狀態跟上畫面：在格子裡的影片才播放，其餘暫停。
 * 瀏覽器沒收到使用者操作前不准有聲自動播放，這時先靜音播，下次操作時再同步一次
 */
export function syncPlayback(videoCells, playing) {
    const allowSound = navigator.userActivation?.hasBeenActive ?? true;
    for (const [id, asset] of assets) {
        if (!asset.video) continue;
        const cell = videoCells.find((c) => c.photoId === id);
        if (!cell || !playing) {
            asset.video.pause();
            continue;
        }
        asset.video.muted = Boolean(cell.muted) || !allowSound;
        asset.video.play().catch((err) => {
            // pause() 打斷 play() 也會 reject，那不是被擋，不能重新播放
            if (err?.name !== 'NotAllowedError') return;
            asset.video.muted = true;
            asset.video.play().catch(() => {});
        });
    }
}

export function forgetPhoto(id) {
    const asset = assets.get(id);
    if (asset?.video) closeVideo(asset.video, asset.url);
    assets.delete(id);
    for (const cache of [processedCache, filterThumbs]) {
        for (const key of cache.keys()) {
            if (key.startsWith(`${id}|`)) cache.delete(key);
        }
    }
    del(`photo:${id}`).catch(() => {});
}

/** 預覽用：預覽圖 + 調色，結果快取 */
export function previewSource(id, params) {
    const asset = assets.get(id);
    if (!asset) return undefined;
    if (asset.video && asset.video.readyState >= 2) {
        if (isIdentity(params)) return asset.video;
        asset.frame = processImage(asset.video, asset.width, asset.height, params, VIDEO_PREVIEW_EDGE, asset.frame);
        return asset.frame;
    }
    const key = `${id}|${paramsKey(params)}`;
    let canvas = processedCache.get(key);
    if (!canvas) {
        canvas = processImage(asset.preview, asset.preview.width, asset.preview.height, params);
        processedCache.set(key, canvas);
        if (processedCache.size > CACHE_LIMIT) {
            processedCache.delete(processedCache.keys().next().value);
        }
    } else {
        // 重新插入，維持 LRU 順序
        processedCache.delete(key);
        processedCache.set(key, canvas);
    }
    return canvas;
}

const filterThumbs = new Map();

/** 濾鏡選單的小縮圖 */
export function filterThumb(id, filterKey, params) {
    const asset = assets.get(id);
    if (!asset) return undefined;
    const key = `${id}|${filterKey}`;
    if (!filterThumbs.has(key)) {
        const canvas = processImage(asset.preview, asset.preview.width, asset.preview.height, params, 160);
        filterThumbs.set(key, canvas.toDataURL('image/jpeg', 0.82));
    }
    return filterThumbs.get(key);
}

/** 匯出用：從原圖解碼，縮到剛好需要的解析度再調色 */
export async function exportSource(id, params, neededEdge) {
    const asset = assets.get(id);
    if (!asset) return undefined;
    // 影片匯出成圖片時用畫面上正在顯示的那一幀
    if (asset.video) {
        const source = asset.video.readyState >= 2 ? asset.video : asset.preview;
        return processImage(source, asset.width, asset.height, params, Math.ceil(neededEdge));
    }
    const img = await loadImage(asset.blob);
    return processImage(img, img.naturalWidth, img.naturalHeight, params, Math.ceil(neededEdge));
}

/** 草稿裡被擋下的影片，等使用者點一下畫面後在點擊事件裡重新載入 */
export function registerPending({id, blob, name}) {
    return registerBlob(id, blob, name);
}

/** 匯出影片用：開一個獨立的 video 從頭播，不影響預覽 */
export async function openExportVideo(id) {
    const asset = assets.get(id);
    const {video, url} = await openVideo(asset.blob);
    try {
        await seek(video, 0);
    } catch (err) {
        closeVideo(video, url);
        throw err;
    }
    return {video, duration: asset.duration, close: () => closeVideo(video, url)};
}

/* ---------- 草稿持久化 ---------- */

const DRAFT_KEY = 'tessera:draft';

export function saveDraft(doc, photos) {
    return set(DRAFT_KEY, {doc, photos, savedAt: Date.now()}).catch(() => {});
}

export async function loadDraft() {
    try {
        const draft = await get(DRAFT_KEY);
        if (!draft) return undefined;
        const photos = [];
        const pending = [];
        for (const meta of draft.photos) {
            const stored = await get(`photo:${meta.id}`);
            if (!stored) continue;
            try {
                photos.push(await registerBlob(meta.id, stored.blob, stored.name));
            } catch (err) {
                // 被擋下的影片先留著，其餘壞掉的單張就略過，不影響其他照片
                if (err?.message === 'playback-blocked') pending.push({id: meta.id, blob: stored.blob, name: stored.name});
            }
        }
        return {doc: draft.doc, photos, pending};
    } catch {
        return undefined;
    }
}

export async function clearDraft(photoIds) {
    await del(DRAFT_KEY).catch(() => {});
    await Promise.allSettled(photoIds.map((id) => del(`photo:${id}`)));
    for (const id of photoIds) forgetPhoto(id);
}
