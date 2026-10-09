import {cssFont, findFont} from './fonts.js';

/**
 * 文字 / 貼圖疊加。位置 x, y 為畫布中心的 0 ~ 1 比例，
 * size 為「字級 / 畫布短邊」，所以任何輸出尺寸都等比例。
 */

export const TEXT_STYLES = [
    {id: 'plain', label: '純文字'},
    {id: 'shadow', label: '陰影'},
    {id: 'outline', label: '描邊'},
    {id: 'label', label: '標籤'},
];

export const TEXT_COLORS = ['#FFFFFF', '#111318', '#2E55FF', '#FF5A36', '#FFC531', '#18A76B', '#F06BA8', '#8B5CF6'];

export const STICKER_SETS = [
    {label: '心情', items: ['😍', '🥹', '😂', '😎', '🥳', '😴', '🤤', '🫶', '❤️', '💕', '✨', '🔥']},
    {label: '生活', items: ['☕️', '🍰', '🍜', '🍣', '🍓', '🍺', '🌷', '🌿', '🐶', '🐱', '📸', '🎧']},
    {label: '旅行', items: ['✈️', '🗺️', '🏝️', '⛰️', '🌅', '🌙', '⭐️', '🌈', '☀️', '❄️', '📍', '🎒']},
    {label: '節慶', items: ['🎂', '🎉', '🎁', '🎈', '🎄', '🧧', '💐', '🏆', '💯', '👑', '🎀', '🪩']},
];

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function contrastOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111318' : '#FFFFFF';
}

let measureCtx;
function getMeasureCtx() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    return measureCtx;
}

/** 回傳未旋轉時的外框尺寸（像素），供 DOM 選取框與 canvas 共用 */
export function measureOverlay(overlay, width, height) {
    const px = overlay.size * Math.min(width, height);
    if (overlay.kind === 'sticker') return {w: px * 1.2, h: px * 1.2, px};

    const ctx = getMeasureCtx();
    ctx.font = cssFont(findFont(overlay.font), px);
    const lines = (overlay.text || ' ').split('\n');
    const textW = Math.max(...lines.map((line) => ctx.measureText(line || ' ').width));
    const lineH = px * 1.25;
    const padX = overlay.style === 'label' ? px * 0.5 : px * 0.15;
    const padY = overlay.style === 'label' ? px * 0.3 : px * 0.1;
    return {w: textW + padX * 2, h: lineH * lines.length + padY * 2, px, lineH, lines};
}

export function drawOverlay(ctx, overlay, width, height) {
    const box = measureOverlay(overlay, width, height);
    ctx.save();
    ctx.translate(overlay.x * width, overlay.y * height);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (overlay.kind === 'sticker') {
        ctx.font = `${box.px}px ${EMOJI_FONT}`;
        ctx.fillText(overlay.emoji, 0, box.px * 0.05);
        ctx.restore();
        return;
    }

    const {px, lineH, lines} = box;
    ctx.font = cssFont(findFont(overlay.font), px);
    let fill = overlay.color;

    if (overlay.style === 'label') {
        ctx.fillStyle = overlay.color;
        ctx.beginPath();
        ctx.roundRect(-box.w / 2, -box.h / 2, box.w, box.h, px * 0.35);
        ctx.fill();
        fill = contrastOn(overlay.color);
    }
    if (overlay.style === 'shadow') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
        ctx.shadowBlur = px * 0.18;
        ctx.shadowOffsetY = px * 0.05;
    }

    const top = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
        const y = top + i * lineH;
        if (overlay.style === 'outline') {
            ctx.lineJoin = 'round';
            ctx.lineWidth = px * 0.16;
            ctx.strokeStyle = contrastOn(overlay.color);
            ctx.strokeText(line, 0, y);
        }
        ctx.fillStyle = fill;
        ctx.fillText(line, 0, y);
    });
    ctx.restore();
}
