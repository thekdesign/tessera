/**
 * 照片在格子內的擺放：預設 cover 填滿，zoom ≥ 1 再放大，
 * pan 以「可移動範圍」的 -1 ~ 1 儲存，確保照片永遠蓋滿格子、不露底。
 */

export const MAX_ZOOM = 5;

export function rotatedSize(imgW, imgH, rotation) {
    return rotation % 180 === 0 ? {w: imgW, h: imgH} : {w: imgH, h: imgW};
}

export function computePlacement(cellW, cellH, imgW, imgH, {zoom = 1, panX = 0, panY = 0, rotation = 0} = {}) {
    const {w: rw, h: rh} = rotatedSize(imgW, imgH, rotation);
    const scale = Math.max(cellW / rw, cellH / rh) * zoom;
    const overflowX = Math.max(0, (rw * scale - cellW) / 2);
    const overflowY = Math.max(0, (rh * scale - cellH) / 2);
    return {
        scale,
        overflowX,
        overflowY,
        offsetX: panX * overflowX,
        offsetY: panY * overflowY,
    };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** 將像素位移換算成新的 pan 值 */
export function panBy(cell, deltaX, deltaY, placement) {
    return {
        panX: placement.overflowX > 0.5 ? clamp(cell.panX + deltaX / placement.overflowX, -1, 1) : 0,
        panY: placement.overflowY > 0.5 ? clamp(cell.panY + deltaY / placement.overflowY, -1, 1) : 0,
    };
}

export function clampZoom(zoom) {
    return clamp(zoom, 1, MAX_ZOOM);
}
