import {computeLayout, unitOf} from './geometry.js';
import {computePlacement} from './placement.js';
import {drawOverlay} from './overlays.js';

/**
 * 預覽與匯出共用的繪製器，保證所見即所得。
 *
 * @param ctx CanvasRenderingContext2D
 * @param doc { tree, cells, border, gap, radius, background, overlays }
 * @param opts.getSource (cell, index, placement) => image | undefined
 *        image 為已調色的 canvas；placement 依原圖尺寸計算，所以來源解析度不影響構圖
 * @param opts.hideOverlayId 編輯中的文字先不畫（避免與輸入框重疊）
 * @param opts.rects 覆寫格子位置（形變動畫中的補間值）；省略則依版型計算
 * @param opts.cellFx (index) => {alpha, scale} | undefined，照片放入時的淡入效果
 */
export function renderCollage(ctx, width, height, doc, {getSource, photoSize, hideOverlayId, rects: rectsOverride, cellFx} = {}) {
    const rects = rectsOverride || computeLayout(doc.tree, width, height, doc).cells;
    const radius = doc.radius * unitOf(width, height);

    ctx.save();
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, width, height);

    rects.forEach((rect, index) => {
        const cell = doc.cells[index];
        if (!cell?.photoId || rect.w < 1 || rect.h < 1) return;
        const size = photoSize(cell.photoId);
        if (!size) return;
        const placement = computePlacement(rect.w, rect.h, size.width, size.height, cell);
        const image = getSource(cell, index, placement, size);
        if (!image) return;

        const fx = cellFx?.(index);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(radius, rect.w / 2, rect.h / 2));
        ctx.clip();
        ctx.translate(rect.x + rect.w / 2 + placement.offsetX, rect.y + rect.h / 2 + placement.offsetY);
        if (fx) {
            ctx.globalAlpha = fx.alpha;
            ctx.scale(fx.scale, fx.scale);
        }
        // 先翻轉再旋轉：「左右翻轉」永遠是畫面上的左右
        ctx.scale(cell.flipH ? -1 : 1, cell.flipV ? -1 : 1);
        ctx.rotate((cell.rotation * Math.PI) / 180);
        const dw = size.width * placement.scale;
        const dh = size.height * placement.scale;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    });

    for (const overlay of doc.overlays) {
        if (overlay.id === hideOverlayId) continue;
        drawOverlay(ctx, overlay, width, height);
    }
    ctx.restore();
    return rects;
}
