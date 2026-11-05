import {computeLayout} from './geometry.js';
import {computePlacement} from './placement.js';
import {isIdentity, processImage, resolveParams} from './adjust.js';
import {renderCollage} from './render.js';
import {waitForOverlayFonts} from './fonts.js';
import {exportSource, isVideoAsset, openExportVideo, photoSize} from './photos.js';

// iOS Safari 的 canvas 面積上限約 16.7M 像素，超過會整張畫成空白
const MAX_AREA = 16_000_000;

export const EXPORT_SIZES = [
    {edge: 1080, label: '1080', hint: '社群貼文'},
    {edge: 2048, label: '2K', hint: '清晰'},
    {edge: 4096, label: '4K', hint: '印刷 / 原圖'},
];

export const VIDEO_SIZES = [
    {edge: 1280, label: '720p', hint: '檔案小、較順暢'},
    {edge: 1920, label: '1080p', hint: '清晰'},
];

const VIDEO_FPS = 30;
// 依序嘗試：MP4 相容性最好，Firefox 等不支援的瀏覽器退回 WebM。
// H.264 指定 Level 5.0：1:1 的 1920×1920 超過 Level 4.0 的畫面上限
const VIDEO_MIMES = [
    'video/mp4;codecs=avc1.640032,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
];

export function exportDimensions(aspect, longEdge) {
    let w = aspect.w >= aspect.h ? longEdge : Math.round((longEdge * aspect.w) / aspect.h);
    let h = aspect.w >= aspect.h ? Math.round((longEdge * aspect.h) / aspect.w) : longEdge;
    if (w * h > MAX_AREA) {
        const k = Math.sqrt(MAX_AREA / (w * h));
        w = Math.floor(w * k);
        h = Math.floor(h * k);
    }
    return {width: w, height: h};
}

export async function exportCollage(doc, aspect, {longEdge, format, quality}) {
    const {width, height} = exportDimensions(aspect, longEdge);
    const {cells: rects} = computeLayout(doc.tree, width, height, doc);

    // 每格只解碼到需要的解析度（照片在格子內的實際繪製尺寸）；
    // 逐張處理而非平行，手機上同時解碼多張 12MP 原圖容易爆記憶體
    const sources = [];
    for (const [i, rect] of rects.entries()) {
        const cell = doc.cells[i];
        const size = cell?.photoId && photoSize(cell.photoId);
        if (!size) {
            sources.push(undefined);
            continue;
        }
        const placement = computePlacement(rect.w, rect.h, size.width, size.height, cell);
        const needed = Math.max(size.width, size.height) * Math.min(1, placement.scale);
        sources.push(await exportSource(cell.photoId, resolveParams(cell.filter, cell.adjust), needed));
    }

    await waitForOverlayFonts(doc.overlays);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    renderCollage(ctx, width, height, doc, {
        photoSize,
        getSource: (_cell, index) => sources[index],
    });

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    canvas.width = 0; // 盡快釋放大畫布的記憶體
    if (!blob) throw new Error('encode-failed');
    return {blob, width, height};
}

/** 影片編碼器要求長寬都是偶數 */
export function videoDimensions(aspect, longEdge) {
    const {width, height} = exportDimensions(aspect, longEdge);
    return {width: width - (width % 2), height: height - (height % 2)};
}

export function pickVideoMime() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return undefined;
    return VIDEO_MIMES.find((mime) => MediaRecorder.isTypeSupported(mime));
}

function playAll(players) {
    return Promise.all(players.map(({video}) => video.play().catch(() => {
        video.muted = true;
        return video.play();
    })));
}

/**
 * 把舞台即時錄成影片：長度取最長的影片，較短的循環播放。
 * 用 MediaRecorder 錄 canvas，所以要花的時間等於影片長度，錄製中頁面不能離開。
 */
export async function exportCollageVideo(liveDoc, aspect, {longEdge, onProgress = () => {}, signal}) {
    const mime = pickVideoMime();
    if (!mime) throw new Error('video-unsupported');
    // 錄製時間長，用快照避免中途的狀態變動跑進影片
    const doc = JSON.parse(JSON.stringify(liveDoc));
    const {width, height} = videoDimensions(aspect, longEdge);
    const {cells: rects} = computeLayout(doc.tree, width, height, doc);

    // 必須在任何 await 之前建立，Safari 要在使用者點擊的當下才允許發聲
    const hasSound = doc.cells.some((c) => c.photoId && isVideoAsset(c.photoId) && !c.muted);
    const audioCtx = hasSound ? new AudioContext() : undefined;
    audioCtx?.resume();

    // 同樣要趁點擊的當下開好所有影片：iPhone 低耗電模式下，離開點擊事件後就不准播放
    const opening = doc.cells.map((c) => (c.photoId && isVideoAsset(c.photoId) ? openExportVideo(c.photoId) : undefined));
    const opened = opening.filter(Boolean);
    // 失敗的會在下面 await 時拋出；先接住，免得其他還沒輪到的被當成未處理的錯誤
    opened.forEach((p) => p.catch(() => {}));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const players = [];
    let stream;

    try {
        const sources = [];
        for (const [i, rect] of rects.entries()) {
            signal?.throwIfAborted();
            const cell = doc.cells[i];
            const size = cell?.photoId && photoSize(cell.photoId);
            if (!size) {
                sources.push(undefined);
                continue;
            }
            const placement = computePlacement(rect.w, rect.h, size.width, size.height, cell);
            const needed = Math.max(size.width, size.height) * Math.min(1, placement.scale);
            const params = resolveParams(cell.filter, cell.adjust);
            if (!isVideoAsset(cell.photoId)) {
                const still = await exportSource(cell.photoId, params, needed);
                sources.push(() => still);
                continue;
            }
            const player = await opening[i];
            player.muted = Boolean(cell.muted);
            players.push(player);
            let frame;
            sources.push(() => {
                if (isIdentity(params)) return player.video;
                frame = processImage(player.video, size.width, size.height, params, Math.ceil(needed), frame);
                return frame;
            });
        }
        await waitForOverlayFonts(doc.overlays);

        const draw = () => renderCollage(ctx, width, height, doc, {
            photoSize,
            getSource: (_cell, index) => sources[index]?.(),
        });
        draw();

        stream = canvas.captureStream(VIDEO_FPS);
        if (audioCtx) {
            const destination = audioCtx.createMediaStreamDestination();
            for (const player of players) {
                if (player.muted) continue;
                player.video.muted = false;
                audioCtx.createMediaElementSource(player.video).connect(destination);
            }
            stream.addTrack(destination.stream.getAudioTracks()[0]);
        }

        const duration = Math.max(...players.map((p) => p.duration));
        const recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: Math.round(width * height * VIDEO_FPS * 0.15),
        });
        const chunks = [];
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

        let failure;
        const stop = (reason) => {
            failure = reason;
            if (recorder.state !== 'inactive') recorder.stop();
        };
        const onAbort = () => stop(new DOMException('Aborted', 'AbortError'));
        // 背景分頁的 requestAnimationFrame 會停，繼續錄只會錄到定格畫面，不如中斷
        const onVisibility = () => document.hidden && stop(new Error('page-hidden'));
        // 準備階段（載入影片、等字型）按的取消，要在這裡接住
        signal?.throwIfAborted();
        signal?.addEventListener('abort', onAbort);
        document.addEventListener('visibilitychange', onVisibility);
        try {
            await new Promise((resolve, reject) => {
                recorder.onstop = resolve;
                recorder.onerror = (e) => reject(e.error || new Error('encode-failed'));
                // 先開始錄才播放，影片開頭才不會被吃掉；計時從全部開播後算
                recorder.start(1000);
                playAll(players).then(() => {
                    const startedAt = performance.now();
                    const tick = () => {
                        if (recorder.state !== 'recording') return;
                        try {
                            const elapsed = (performance.now() - startedAt) / 1000;
                            if (elapsed >= duration) {
                                recorder.stop();
                                return;
                            }
                            // 循環回跳或卡頓時還沒有畫面可畫，維持上一幀，才不會閃背景色或重複調色
                            if (players.every((p) => p.video.readyState >= 2)) draw();
                            onProgress(elapsed / duration);
                            requestAnimationFrame(tick);
                        } catch (err) {
                            stop(err);
                        }
                    };
                    tick();
                }, stop);
            });
        } finally {
            signal?.removeEventListener('abort', onAbort);
            document.removeEventListener('visibilitychange', onVisibility);
        }
        if (failure) throw failure;
        if (!chunks.length) throw new Error('encode-failed');
        // 分享選單只認不帶 codecs 的 MIME
        const baseType = mime.split(';')[0];
        return {blob: new Blob(chunks, {type: baseType}), width, height, format: baseType === 'video/mp4' ? 'mp4' : 'webm'};
    } finally {
        stream?.getTracks().forEach((t) => t.stop());
        for (const result of await Promise.allSettled(opened)) {
            if (result.status === 'fulfilled') result.value.close();
        }
        audioCtx?.close();
        canvas.width = 0;
    }
}

export function exportFileName(format) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `tessera-${stamp}.${format}`;
}
