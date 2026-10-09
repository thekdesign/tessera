/** 小型補間工具：舞台形變、照片淡入共用 */

export const reducedMotion = () =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export const easeOutQuart = (t) => 1 - (1 - t) ** 4;

export const lerp = (a, b, t) => a + (b - a) * t;

export function lerpRect(from, to, t) {
    return {x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), w: lerp(from.w, to.w, t), h: lerp(from.h, to.h, t)};
}

/** 以 easeOutQuart 跑 0 → 1，回傳取消函式 */
export function animate(duration, onUpdate, onDone) {
    let raf;
    const start = performance.now();
    const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        onUpdate(easeOutQuart(t));
        if (t < 1) raf = requestAnimationFrame(tick);
        else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
}
