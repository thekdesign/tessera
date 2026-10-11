/** 平台偵測：只放幾個介面文案、按鈕配置會用到的判斷 */

const nav = typeof navigator === 'undefined' ? undefined : navigator;
const ua = nav?.userAgent || '';

// iPadOS 13 起預設回報成 Mac，要靠觸控點數分辨
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints || 0) > 1);

export const isTouch = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

export const modKey = /Mac|iPhone|iPad/.test(nav?.platform || ua) ? '⌘' : 'Ctrl';

/** 能不能把圖片檔交給系統分享選單（iOS 15+、Android Chrome） */
export function canShareFiles() {
    if (typeof nav?.canShare !== 'function' || typeof File === 'undefined') return false;
    try {
        return nav.canShare({files: [new File([''], 'probe.jpg', {type: 'image/jpeg'})]});
    } catch {
        return false;
    }
}
