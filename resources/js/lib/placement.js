/**
 * 照片在格子內的擺放：預設 cover 填滿，zoom ≥ 1 再放大，
 * pan 以「可移動範圍」的 -1 ~ 1 儲存，確保照片永遠蓋滿格子、不露底。
 *
 * 支援任意角度旋轉：在照片自己的座標系（轉正後）看，格子是一個斜放的矩形，
 * 只要它的外接框落在照片內就保證蓋滿。所以 cover 縮放與 pan 範圍都在照片座標系計算，
 * pan 也存在照片座標系——旋轉時照片繞著格子中心轉，同一個點留在中央。
 */

export const MAX_ZOOM = 5;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** 角度收斂到 (-180, 180]，四捨五入到 0.1° */
export function normalizeAngle(deg) {
    let a = ((deg % 360) + 360) % 360;
    if (a > 180) a -= 360;
    return Math.round(a * 10) / 10 || 0;
}

const trig = (rotation) => {
    const t = (rotation * Math.PI) / 180;
    return {cos: Math.cos(t), sin: Math.sin(t)};
};

// 畫面 = 翻轉 · 旋轉 · 照片座標（與 render.js 的 ctx.scale → ctx.rotate 順序一致）
function toScreen(x, y, {rotation = 0, flipH = false, flipV = false}) {
    const {cos, sin} = trig(rotation);
    const sx = x * cos - y * sin;
    const sy = x * sin + y * cos;
    return {x: flipH ? -sx : sx, y: flipV ? -sy : sy};
}

function toLocal(x, y, {rotation = 0, flipH = false, flipV = false}) {
    const {cos, sin} = trig(rotation);
    const fx = flipH ? -x : x;
    const fy = flipV ? -y : y;
    return {x: fx * cos + fy * sin, y: -fx * sin + fy * cos};
}

export function computePlacement(cellW, cellH, imgW, imgH, cell = {}) {
    const {zoom = 1, panX = 0, panY = 0, rotation = 0} = cell;
    const {cos, sin} = trig(rotation);
    const c = Math.abs(cos);
    const s = Math.abs(sin);
    // 斜放時照片邊緣剛好穿過格子角落，反鋸齒會透出一點底色，多留 1px
    const bleed = c > 1e-6 && s > 1e-6 ? 1 : 0;
    const boxW = cellW * c + cellH * s + bleed;
    const boxH = cellW * s + cellH * c + bleed;
    const scale = Math.max(boxW / imgW, boxH / imgH) * zoom;
    const overflowX = Math.max(0, (imgW * scale - boxW) / 2);
    const overflowY = Math.max(0, (imgH * scale - boxH) / 2);
    const offset = toScreen(panX * overflowX, panY * overflowY, cell);
    return {scale, overflowX, overflowY, offsetX: offset.x, offsetY: offset.y};
}

/** 將畫面上的像素位移換算成新的 pan 值 */
export function panBy(cell, deltaX, deltaY, placement) {
    const d = toLocal(deltaX, deltaY, cell);
    return {
        panX: placement.overflowX > 0.5 ? clamp(cell.panX + d.x / placement.overflowX, -1, 1) : 0,
        panY: placement.overflowY > 0.5 ? clamp(cell.panY + d.y / placement.overflowY, -1, 1) : 0,
    };
}

export function clampZoom(zoom) {
    return clamp(zoom, 1, MAX_ZOOM);
}

/** 手勢旋轉時，接近 0 / 90 / 180 / 270 度就吸附 */
export function snapAngle(deg, threshold = 3) {
    const nearest = Math.round(deg / 90) * 90 || 0;
    return Math.abs(deg - nearest) <= threshold ? nearest : deg;
}
