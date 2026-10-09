<script setup>
import {computed} from 'vue';
import {PhArrowsClockwise, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {measureOverlay} from '../lib/overlays.js';

/**
 * 文字 / 貼圖的選取框。內容本身由 canvas 畫，這裡只負責命中範圍與操作把手：
 * 拖曳本體移動、右下把手同時縮放與旋轉。
 */
const props = defineProps({
    overlay: {type: Object, required: true},
    stageW: {type: Number, required: true},
    stageH: {type: Number, required: true},
    selected: {type: Boolean, default: false},
    fontTick: {type: Number, default: 0},
});

const store = useCollageStore();

const box = computed(() => {
    // fontTick 變動代表字型剛載入，寬度需要重新量
    void props.fontTick;
    return measureOverlay(props.overlay, props.stageW, props.stageH);
});

const style = computed(() => ({
    left: `${props.overlay.x * props.stageW}px`,
    top: `${props.overlay.y * props.stageH}px`,
    width: `${box.value.w}px`,
    height: `${box.value.h}px`,
    transform: `translate(-50%, -50%) rotate(${props.overlay.rotation}deg)`,
}));

let drag;

function local(e) {
    const r = e.currentTarget.closest('[data-layer]').getBoundingClientRect();
    return {x: e.clientX - r.left, y: e.clientY - r.top};
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function onBodyDown(e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    store.select({type: 'overlay', id: props.overlay.id});
    const p = local(e);
    drag = {mode: 'move', start: p, x0: props.overlay.x, y0: props.overlay.y};
}

function onHandleDown(e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    const cx = props.overlay.x * props.stageW;
    const cy = props.overlay.y * props.stageH;
    drag = {
        mode: 'transform',
        cx,
        cy,
        d0: Math.hypot(p.x - cx, p.y - cy) || 1,
        a0: Math.atan2(p.y - cy, p.x - cx),
        size0: props.overlay.size,
        rot0: props.overlay.rotation,
    };
}

function onMove(e) {
    if (!drag) return;
    const p = local(e);
    if (drag.mode === 'move') {
        store.updateOverlay(props.overlay.id, {
            x: clamp(drag.x0 + (p.x - drag.start.x) / props.stageW, 0, 1),
            y: clamp(drag.y0 + (p.y - drag.start.y) / props.stageH, 0, 1),
        });
        return;
    }
    const d = Math.hypot(p.x - drag.cx, p.y - drag.cy);
    const a = Math.atan2(p.y - drag.cy, p.x - drag.cx);
    let rotation = drag.rot0 + ((a - drag.a0) * 180) / Math.PI;
    rotation = ((rotation + 540) % 360) - 180;
    // 接近水平 / 垂直時吸附
    for (const snap of [-180, -90, 0, 90, 180]) {
        if (Math.abs(rotation - snap) < 4) rotation = snap;
    }
    store.updateOverlay(props.overlay.id, {
        size: clamp((drag.size0 * d) / drag.d0, 0.02, 0.8),
        rotation: Math.round(rotation),
    });
}

function onUp() {
    drag = undefined;
}

function edit() {
    if (props.overlay.kind !== 'text') return;
    store.editingOverlayId = props.overlay.id;
    store.activeTool = 'decor';
}
</script>

<template>
    <div
        class="absolute touch-none select-none"
        :class="selected ? 'cursor-move' : 'cursor-pointer'"
        :style="style"
        role="button"
        :aria-label="overlay.kind === 'text' ? `文字：${overlay.text}` : `貼圖 ${overlay.emoji}`"
        @pointerdown="onBodyDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @dblclick="edit"
    >
        <template v-if="selected">
            <div class="pointer-events-none absolute -inset-1 rounded-md border-[1.5px] border-accent" />
            <button
                type="button"
                class="absolute -top-3.5 -right-3.5 grid size-7 place-items-center rounded-full bg-ink text-white shadow-float"
                aria-label="刪除"
                @pointerdown.stop
                @click.stop="store.removeOverlay(overlay.id)"
            >
                <PhX :size="14" weight="bold" />
            </button>
            <div
                class="absolute -right-3.5 -bottom-3.5 grid size-7 cursor-nwse-resize place-items-center rounded-full border border-line bg-surface text-accent shadow-float"
                aria-label="縮放與旋轉"
                @pointerdown="onHandleDown"
                @pointermove="onMove"
                @pointerup="onUp"
                @pointercancel="onUp"
            >
                <PhArrowsClockwise :size="14" weight="bold" />
            </div>
        </template>
    </div>
</template>
