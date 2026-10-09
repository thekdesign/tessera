import {computeLayout} from './geometry.js';
import {computePlacement} from './placement.js';
import {resolveParams} from './adjust.js';
import {renderCollage} from './render.js';
import {waitForOverlayFonts} from './fonts.js';
import {exportSource, photoSize} from './photos.js';

// iOS Safari 的 canvas 面積上限約 16.7M 像素，超過會整張畫成空白
const MAX_AREA = 16_000_000;

export const EXPORT_SIZES = [
    {edge: 1080, label: '1080', hint: '社群貼文'},
    {edge: 2048, label: '2K', hint: '清晰'},
    {edge: 4096, label: '4K', hint: '印刷 / 原圖'},
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

export function exportFileName(format) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `tessera-${stamp}.${format === 'png' ? 'png' : 'jpg'}`;
}
