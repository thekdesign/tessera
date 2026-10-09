/**
 * 把分割樹攤平成實際像素位置。
 * 所有尺寸參數（border / gap / radius）在 state 中以「短邊的千分比」儲存，
 * 這樣預覽與 4096px 匯出能得到一致的比例。
 */

export const MIN_RATIO = 0.08;

export function unitOf(width, height) {
    return Math.min(width, height) / 1000;
}

/**
 * @returns {{cells: Array<{x,y,w,h}>, dividers: Array<{path:number[], index:number, dir:string, x:number, y:number, length:number, avail:number}>}}
 */
export function computeLayout(tree, width, height, {border = 0, gap = 0} = {}) {
    const unit = unitOf(width, height);
    const pad = border * unit;
    const gapPx = gap * unit;
    const cells = [];
    const dividers = [];

    const walk = (node, rect, path) => {
        if (node.type === 'leaf') {
            cells.push(rect);
            return;
        }
        const horizontal = node.dir === 'row';
        const n = node.children.length;
        const length = horizontal ? rect.w : rect.h;
        const avail = Math.max(0, length - gapPx * (n - 1));
        let cursor = horizontal ? rect.x : rect.y;

        node.children.forEach((child, i) => {
            const size = avail * node.ratios[i];
            const childRect = horizontal
                ? {x: cursor, y: rect.y, w: size, h: rect.h}
                : {x: rect.x, y: cursor, w: rect.w, h: size};
            walk(child, childRect, [...path, i]);
            cursor += size;
            if (i < n - 1) {
                // 分隔線位於兩格之間的 gap 正中央
                const mid = cursor + gapPx / 2;
                dividers.push({
                    path,
                    index: i,
                    dir: node.dir,
                    x: horizontal ? mid : rect.x + rect.w / 2,
                    y: horizontal ? rect.y + rect.h / 2 : mid,
                    length: horizontal ? rect.h : rect.w,
                    avail,
                });
                cursor += gapPx;
            }
        });
    };

    walk(tree, {x: pad, y: pad, w: Math.max(0, width - pad * 2), h: Math.max(0, height - pad * 2)}, []);
    return {cells, dividers};
}

export function nodeAtPath(tree, path) {
    return path.reduce((node, i) => node.children[i], tree);
}

/**
 * 拖曳分隔線：delta 為像素位移，回傳新的 ratios（不改動原陣列）
 */
export function shiftRatios(ratios, index, deltaPx, avail) {
    if (!avail) return ratios;
    const next = [...ratios];
    const pair = next[index] + next[index + 1];
    let left = next[index] + deltaPx / avail;
    left = Math.min(pair - MIN_RATIO, Math.max(MIN_RATIO, left));
    next[index] = left;
    next[index + 1] = pair - left;
    return next;
}

export function pointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
