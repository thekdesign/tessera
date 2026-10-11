<script setup>
import {computed, ref, watch} from 'vue';
import {
    PhAngle,
    PhArrowClockwise,
    PhArrowCounterClockwise,
    PhArrowsOutSimple,
    PhFlipHorizontal,
    PhFlipVertical,
    PhImage,
    PhSliders,
    PhTrash,
} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {normalizeAngle} from '../lib/placement.js';

const props = defineProps({
    index: {type: Number, required: true},
    rect: {type: Object, required: true},
    stageW: {type: Number, required: true},
});

const emit = defineEmits(['replace', 'straighten']);
const store = useCollageStore();
const cell = computed(() => store.doc.cells[props.index]);

const BAR_HALF = 136;
const style = computed(() => {
    const cx = props.rect.x + props.rect.w / 2;
    const left = props.stageW > BAR_HALF * 2 ? Math.min(props.stageW - BAR_HALF, Math.max(BAR_HALF, cx)) : props.stageW / 2;
    // 格子太靠上就把工具列放進格子裡
    const above = props.rect.y > 52;
    return {
        left: `${left}px`,
        top: above ? `${props.rect.y - 10}px` : `${props.rect.y + 10}px`,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    };
});

const actions = computed(() => [
    {label: '換照片', icon: PhImage, run: () => emit('replace', props.index)},
    {
        label: '旋轉角度',
        icon: PhAngle,
        run: () => (store.rotateRuler = !store.rotateRuler),
        on: store.rotateRuler,
        expands: true,
        tour: 'cell-rotate',
    },
    {label: '左右翻轉', icon: PhFlipHorizontal, run: () => store.updateCell(props.index, {flipH: !cell.value.flipH}), on: cell.value.flipH},
    {label: '上下翻轉', icon: PhFlipVertical, run: () => store.updateCell(props.index, {flipV: !cell.value.flipV}), on: cell.value.flipV},
    {label: '重設縮放與位置', icon: PhArrowsOutSimple, run: () => store.updateCell(props.index, {zoom: 1, panX: 0, panY: 0})},
    {label: '調色', icon: PhSliders, run: () => (store.activeTool = 'tone')},
    {label: '從格子移除', icon: PhTrash, run: () => store.clearCell(props.index), danger: true},
]);

/* ---------- 角度尺：以最接近的直角為基準，左右各 45° 微調 ---------- */

// 基準在拖曳過程中固定，跨過 ±45° 時滑桿才不會跳到另一端
const base = ref(0);
watch(() => [props.index, cell.value?.rotation], () => {
    const r = cell.value?.rotation ?? 0;
    if (Math.abs(normalizeAngle(r - base.value)) > 45) base.value = normalizeAngle(Math.round(r / 90) * 90);
}, {immediate: true});

const rotation = computed(() => normalizeAngle(cell.value?.rotation ?? 0));
const fine = computed({
    get: () => normalizeAngle(rotation.value - base.value),
    set: (v) => store.updateCell(props.index, {rotation: normalizeAngle(base.value + Number(v))}),
});

function turn(step) {
    base.value = normalizeAngle(base.value + step);
    store.updateCell(props.index, {rotation: normalizeAngle(rotation.value + step)});
}

function resetAngle() {
    base.value = 0;
    store.updateCell(props.index, {rotation: 0});
}

const angleLabel = computed(() => `${rotation.value}°`);
</script>

<template>
    <div
        class="anim-sheet absolute z-30 rounded-xl border border-line bg-surface p-1 shadow-float"
        :style="style"
        role="toolbar"
        aria-label="照片工具"
        data-tour="cell-toolbar"
        @pointerdown.stop
    >
        <div class="flex items-center gap-0.5">
            <button
                v-for="a in actions"
                :key="a.label"
                type="button"
                class="grid size-9 place-items-center rounded-lg transition-colors hover:bg-desk"
                :class="[a.danger ? 'text-danger' : a.on ? 'bg-accent-soft text-accent' : 'text-ink-2']"
                :title="a.label"
                :aria-label="a.label"
                :aria-pressed="a.on === undefined || a.expands ? undefined : String(a.on)"
                :aria-expanded="a.expands ? String(a.on) : undefined"
                :data-tour="a.tour"
                @click="a.run"
            >
                <component :is="a.icon" :size="18" />
            </button>
        </div>

        <div class="ruler-reveal grid" :class="store.rotateRuler && 'is-open'">
            <div class="min-h-0 overflow-hidden" :inert="!store.rotateRuler">
                <div class="mt-1 flex items-center gap-1 border-t border-line px-0.5 pt-1.5 pb-0.5" data-tour="cell-ruler">
                    <button
                        type="button"
                        class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-desk active:scale-95"
                        title="向左轉 90°"
                        aria-label="向左轉 90°"
                        @click="turn(-90)"
                    >
                        <PhArrowCounterClockwise :size="18" />
                    </button>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-center gap-1.5 text-[11px] leading-none">
                            <span class="font-semibold text-ink tabular-nums">{{ angleLabel }}</span>
                            <Transition name="swap">
                                <button
                                    v-if="rotation !== 0"
                                    type="button"
                                    class="rounded px-1 py-0.5 font-medium text-accent hover:bg-accent-soft"
                                    @click="resetAngle"
                                >歸零</button>
                            </Transition>
                        </div>
                        <div class="ruler relative mt-1 h-6">
                            <span class="ruler-ticks pointer-events-none absolute inset-x-[9px] top-1/2 h-3 -translate-y-1/2" aria-hidden="true" />
                            <input
                                v-model.number="fine"
                                type="range"
                                class="ruler-input absolute inset-0 w-full"
                                min="-45"
                                max="45"
                                step="0.5"
                                :aria-label="`微調角度，目前 ${angleLabel}`"
                                @pointerdown="emit('straighten', true)"
                                @pointerup="emit('straighten', false)"
                                @pointercancel="emit('straighten', false)"
                                @keydown="emit('straighten', true)"
                                @keyup="emit('straighten', false)"
                                @blur="emit('straighten', false)"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-desk active:scale-95"
                        title="向右轉 90°"
                        aria-label="向右轉 90°"
                        @click="turn(90)"
                    >
                        <PhArrowClockwise :size="18" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
