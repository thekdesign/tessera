import {nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';

/**
 * 分頁選中底色滑動：量測容器內 [data-active="true"] 的位置，
 * 回傳給底色元素的 style。第一次量測不播動畫，避免載入時從左上角飛進來。
 *
 * @param pick (activeEl) => 實際要對齊的元素（例如手機版只框住圖示）
 */
export function useSlidingIndicator(container, activeKey, pick = (el) => el) {
    const style = ref({opacity: 0});
    let measured = false;

    function measure() {
        const root = container.value;
        const active = root?.querySelector('[data-active="true"]');
        const el = active && pick(active);
        if (!el) {
            style.value = {opacity: 0};
            return;
        }
        const r = el.getBoundingClientRect();
        const c = root.getBoundingClientRect();
        style.value = {
            opacity: 1,
            width: `${r.width}px`,
            height: `${r.height}px`,
            transform: `translate(${r.left - c.left}px, ${r.top - c.top}px)`,
            transition: measured ? undefined : 'none',
        };
        measured = true;
    }

    watch(activeKey, () => nextTick(measure));

    let observer;
    onMounted(() => {
        measure();
        observer = new ResizeObserver(() => {
            measured = false;
            measure();
        });
        observer.observe(container.value);
    });
    onBeforeUnmount(() => observer?.disconnect());

    return style;
}
