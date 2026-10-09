/**
 * 調色：濾鏡預設 + 使用者滑桿疊加，以像素運算實作。
 * 不用 ctx.filter，因為 Safari 支援不穩，會造成預覽與匯出不一致。
 */

export const ADJUST_KEYS = [
    {key: 'brightness', label: '亮度'},
    {key: 'contrast', label: '對比'},
    {key: 'saturation', label: '飽和度'},
    {key: 'warmth', label: '色溫'},
    {key: 'fade', label: '褪色', min: 0},
];

export const EMPTY_ADJUST = Object.freeze({brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0});

/** 數值皆為 -100 ~ 100（fade 0 ~ 100） */
export const FILTERS = [
    {id: 'none', label: '原圖', params: {}},
    {id: 'clear', label: '清透', params: {brightness: 10, contrast: 6, saturation: 10}},
    {id: 'vivid', label: '鮮豔', params: {contrast: 16, saturation: 32}},
    {id: 'warm', label: '暖陽', params: {warmth: 30, brightness: 4, saturation: 6}},
    {id: 'cool', label: '冷調', params: {warmth: -28, contrast: 6}},
    {id: 'film', label: '底片', params: {fade: 30, warmth: 12, saturation: -14, contrast: -6, tint: [0, 6, 2]}},
    {id: 'retro', label: '復古', params: {fade: 22, warmth: 36, saturation: -28, contrast: 8}},
    {id: 'mono', label: '黑白', params: {saturation: -100, contrast: 10}},
    {id: 'noir', label: '高反差', params: {saturation: -100, contrast: 45, brightness: -6}},
];

export function findFilter(id) {
    return FILTERS.find((f) => f.id === id) || FILTERS[0];
}

/** 合併濾鏡與滑桿數值 */
export function resolveParams(filterId, adjust = EMPTY_ADJUST) {
    const base = findFilter(filterId).params;
    const pick = (k) => (base[k] || 0) + (adjust[k] || 0);
    return {
        brightness: pick('brightness'),
        contrast: pick('contrast'),
        saturation: Math.max(-100, pick('saturation')),
        warmth: pick('warmth'),
        fade: Math.max(0, pick('fade')),
        tint: base.tint || [0, 0, 0],
    };
}

export function isIdentity(p) {
    return !p.brightness && !p.contrast && !p.saturation && !p.warmth && !p.fade && !p.tint.some(Boolean);
}

export function paramsKey(p) {
    return [p.brightness, p.contrast, p.saturation, p.warmth, p.fade, ...p.tint].join(',');
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** 逐通道可預先算的部分（亮度、對比、色溫）做成 LUT */
function buildLuts(p) {
    const b = (p.brightness / 100) * 70;
    const c = p.contrast / 100;
    const factor = c >= 0 ? 1 + c * 1.2 : 1 + c * 0.8;
    const warm = (p.warmth / 100) * 28;
    const make = (shift) => {
        const lut = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            lut[i] = (i + b - 128) * factor + 128 + shift;
        }
        return lut;
    };
    return {r: make(warm), g: make(warm * 0.15), b: make(-warm)};
}

/** 就地修改 ImageData.data */
export function applyToPixels(data, p) {
    if (isIdentity(p)) return data;
    const luts = buildLuts(p);
    const sat = 1 + p.saturation / 100;
    const f = p.fade / 100;
    const fadeLift = f * 42;
    const fadeKeep = 1 - f * 0.28;
    const [tr, tg, tb] = p.tint;

    for (let i = 0; i < data.length; i += 4) {
        let r = luts.r[data[i]];
        let g = luts.g[data[i + 1]];
        let bl = luts.b[data[i + 2]];
        if (sat !== 1) {
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
            r = lum + (r - lum) * sat;
            g = lum + (g - lum) * sat;
            bl = lum + (bl - lum) * sat;
        }
        if (f) {
            r = fadeLift + r * fadeKeep;
            g = fadeLift + g * fadeKeep;
            bl = fadeLift + bl * fadeKeep;
        }
        data[i] = clamp255(r + tr);
        data[i + 1] = clamp255(g + tg);
        data[i + 2] = clamp255(bl + tb);
    }
    return data;
}

/**
 * 產生調色後的畫布。source 可為 HTMLImageElement / Canvas / ImageBitmap。
 * maxEdge 用來把來源縮到需要的大小再運算，避免對 12MP 原圖逐像素處理。
 */
export function processImage(source, srcW, srcH, params, maxEdge = Infinity) {
    const ratio = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * ratio));
    const h = Math.max(1, Math.round(srcH * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    if (!isIdentity(params)) {
        const img = ctx.getImageData(0, 0, w, h);
        applyToPixels(img.data, params);
        ctx.putImageData(img, 0, 0);
    }
    return canvas;
}
