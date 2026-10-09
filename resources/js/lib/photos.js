import {get, set, del} from 'idb-keyval';
import {paramsKey, processImage} from './adjust.js';

/**
 * 照片資產（Blob、解碼後的預覽圖、調色快取）都放在這個模組，
 * 不進 Pinia：大物件放進響應式系統只會拖慢效能。
 */

const PREVIEW_EDGE = 1600;
const CACHE_LIMIT = 48;

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

function downscale(img, maxEdge) {
    const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

async function registerBlob(id, blob, name) {
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

/** 讀入使用者選的檔案；回傳 {photos, failed} */
export async function importFiles(files) {
    const photos = [];
    let failed = 0;
    for (const file of files) {
        if (file.type && !file.type.startsWith('image/')) {
            failed++;
            continue;
        }
        try {
            const id = newId();
            const meta = await registerBlob(id, file, file.name || '貼上的圖片');
            photos.push(meta);
            set(`photo:${id}`, {blob: file, name: meta.name}).catch(() => {});
        } catch {
            failed++;
        }
    }
    return {photos, failed};
}

export function photoSize(id) {
    return assets.get(id);
}

export function photoThumb(id) {
    return assets.get(id)?.thumb;
}

export function forgetPhoto(id) {
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
    const img = await loadImage(asset.blob);
    return processImage(img, img.naturalWidth, img.naturalHeight, params, Math.ceil(neededEdge));
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
        for (const meta of draft.photos) {
            const stored = await get(`photo:${meta.id}`);
            if (!stored) continue;
            try {
                photos.push(await registerBlob(meta.id, stored.blob, stored.name));
            } catch {
                // 單張壞掉就略過，不影響其他照片
            }
        }
        return {doc: draft.doc, photos};
    } catch {
        return undefined;
    }
}

export async function clearDraft(photoIds) {
    await del(DRAFT_KEY).catch(() => {});
    await Promise.allSettled(photoIds.map((id) => del(`photo:${id}`)));
    for (const id of photoIds) forgetPhoto(id);
}
