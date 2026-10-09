/**
 * 文字疊加可選字型。CSS 只在第一次用到文字功能時才載入，
 * Google Fonts 的 unicode-range 切片會讓中文字型只下載用到的字。
 */

const CJK_FALLBACK = '"Noto Sans TC", "PingFang TC", "Heiti TC", sans-serif';

export const FONTS = [
    {id: 'sans', label: '黑體', family: 'Noto Sans TC', weight: 700},
    {id: 'serif', label: '明體', family: 'Noto Serif TC', weight: 700},
    {id: 'kai', label: '文楷', family: 'LXGW WenKai TC', weight: 400},
    {id: 'round', label: '圓體', family: 'M PLUS Rounded 1c', weight: 800},
    {id: 'hand', label: 'Hand', family: 'Caveat', weight: 700},
    {id: 'display', label: 'POSTER', family: 'Anton', weight: 400},
];

const STYLESHEET =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&family=Noto+Serif+TC:wght@700'
    + '&family=LXGW+WenKai+TC&family=M+PLUS+Rounded+1c:wght@800&family=Caveat:wght@700&family=Anton&display=swap';

export function findFont(id) {
    return FONTS.find((f) => f.id === id) || FONTS[0];
}

export function fontStack(font) {
    return `"${font.family}", ${CJK_FALLBACK}`;
}

export function cssFont(font, px) {
    return `${font.weight} ${px}px ${fontStack(font)}`;
}

let injected = false;

export function ensureFontStylesheet() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLESHEET;
    document.head.appendChild(link);
}

/** 匯出前確保每段文字用到的字都已下載，否則 canvas 會畫成後備字型 */
export async function waitForOverlayFonts(overlays) {
    if (typeof document === 'undefined' || !document.fonts) return;
    const jobs = overlays
        .filter((o) => o.kind === 'text' && o.text)
        .flatMap((o) => {
            const font = findFont(o.font);
            return [
                document.fonts.load(`${font.weight} 48px "${font.family}"`, o.text),
                document.fonts.load('700 48px "Noto Sans TC"', o.text),
            ];
        });
    await Promise.allSettled(jobs);
}

const requested = new Set();

/**
 * canvas 不會主動觸發 web font 下載；繪製前檢查，沒載入就要求下載，
 * 下載完呼叫 onReady 重畫一次。
 */
export function requestOverlayFonts(overlays, onReady) {
    if (typeof document === 'undefined' || !document.fonts) return;
    for (const o of overlays) {
        if (o.kind !== 'text' || !o.text) continue;
        const font = findFont(o.font);
        const spec = `${font.weight} 48px "${font.family}"`;
        const key = `${spec}|${o.text}`;
        if (requested.has(key) || document.fonts.check(spec, o.text)) continue;
        requested.add(key);
        document.fonts.load(spec, o.text).then(onReady, () => {});
    }
}
