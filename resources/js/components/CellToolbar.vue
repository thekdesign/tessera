<script setup>
import {computed} from 'vue';
import {
    PhArrowClockwise,
    PhArrowsOutSimple,
    PhFlipHorizontal,
    PhFlipVertical,
    PhImage,
    PhSliders,
    PhTrash,
} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';

const props = defineProps({
    index: {type: Number, required: true},
    rect: {type: Object, required: true},
    stageW: {type: Number, required: true},
});

const emit = defineEmits(['replace']);
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
    {label: '旋轉 90°', icon: PhArrowClockwise, run: () => store.updateCell(props.index, {rotation: (cell.value.rotation + 90) % 360})},
    {label: '左右翻轉', icon: PhFlipHorizontal, run: () => store.updateCell(props.index, {flipH: !cell.value.flipH}), on: cell.value.flipH},
    {label: '上下翻轉', icon: PhFlipVertical, run: () => store.updateCell(props.index, {flipV: !cell.value.flipV}), on: cell.value.flipV},
    {label: '重設縮放與位置', icon: PhArrowsOutSimple, run: () => store.updateCell(props.index, {zoom: 1, panX: 0, panY: 0})},
    {label: '調色', icon: PhSliders, run: () => (store.activeTool = 'tone')},
    {label: '從格子移除', icon: PhTrash, run: () => store.clearCell(props.index), danger: true},
]);
</script>

<template>
    <div
        class="anim-sheet absolute z-30 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-float"
        :style="style"
        role="toolbar"
        aria-label="照片工具"
        @pointerdown.stop
    >
        <button
            v-for="a in actions"
            :key="a.label"
            type="button"
            class="grid size-9 place-items-center rounded-lg transition-colors hover:bg-desk"
            :class="[a.danger ? 'text-danger' : a.on ? 'bg-accent-soft text-accent' : 'text-ink-2']"
            :title="a.label"
            :aria-label="a.label"
            :aria-pressed="a.on === undefined ? undefined : String(a.on)"
            @click="a.run"
        >
            <component :is="a.icon" :size="18" />
        </button>
    </div>
</template>
