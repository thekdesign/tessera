<script setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useCollageStore} from './stores/collage.js';
import {useImport} from './composables/useImport.js';
import {useToast} from './composables/useToast.js';
import {ensureFontStylesheet} from './lib/fonts.js';
import {TOOLS} from './lib/tools.js';
import TopBar from './components/TopBar.vue';
import ToolNav from './components/ToolNav.vue';
import Stage from './components/Stage.vue';
import ToastHost from './components/ToastHost.vue';
import ExportDialog from './components/ExportDialog.vue';
import PhotosPanel from './components/panels/PhotosPanel.vue';
import LayoutPanel from './components/panels/LayoutPanel.vue';
import FramePanel from './components/panels/FramePanel.vue';
import TonePanel from './components/panels/TonePanel.vue';
import DecorPanel from './components/panels/DecorPanel.vue';

const PANELS = {photos: PhotosPanel, layout: LayoutPanel, frame: FramePanel, tone: TonePanel, decor: DecorPanel};

const store = useCollageStore();
const {addFiles} = useImport();
const {toast} = useToast();
const exporting = ref(false);

const tool = computed(() => TOOLS.find((t) => t.id === store.activeTool));
const panelScroll = ref();

// 換工具時面板捲回頂端
watch(() => store.activeTool, () => {
    if (panelScroll.value) panelScroll.value.scrollTop = 0;
});

// 點到畫布上的文字或貼圖時，自動打開對應面板
watch(() => store.selection, (sel) => {
    if (sel.type === 'overlay') store.activeTool = 'decor';
});

watch(() => store.doc.overlays.some((o) => o.kind === 'text'), (hasText) => hasText && ensureFontStylesheet(), {immediate: true});

async function startOver() {
    if (store.photos.length && !window.confirm('要清空目前的作品重新開始嗎？照片匣也會一併清空。')) return;
    await store.startOver();
}

/* ---------- 全域：貼上、拖放、快捷鍵 ---------- */

const isTyping = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text') || el.isContentEditable);

function onPaste(e) {
    if (isTyping(document.activeElement)) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const sel = store.selection;
    addFiles(files, sel.type === 'cell' ? sel.index : undefined);
}

function onDragOver(e) {
    e.preventDefault();
}

function onDrop(e) {
    e.preventDefault();
    if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
}

function onKeydown(e) {
    if (isTyping(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z') {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
        return;
    }
    if (mod && key === 'y') {
        e.preventDefault();
        store.redo();
        return;
    }
    if (exporting.value) return;

    const sel = store.selection;
    if (e.key === 'Escape') {
        store.clearSelection();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel.type === 'overlay') store.removeOverlay(sel.id);
        else if (sel.type === 'cell' && store.doc.cells[sel.index]?.photoId) store.clearCell(sel.index);
        else return;
        e.preventDefault();
    } else if (sel.type === 'overlay' && e.key.startsWith('Arrow')) {
        const step = e.shiftKey ? 0.02 : 0.004;
        const o = store.selectedOverlay;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        store.updateOverlay(o.id, {x: Math.min(1, Math.max(0, o.x + dx)), y: Math.min(1, Math.max(0, o.y + dy))});
        e.preventDefault();
    }
}

onMounted(async () => {
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKeydown);
    if (await store.init()) toast('已還原上次的作品');
});

onBeforeUnmount(() => {
    window.removeEventListener('paste', onPaste);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
    window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <div class="flex h-full flex-col">
        <TopBar @export="exporting = true" @start-over="startOver" />

        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
            <Stage class="order-1 lg:order-3" />

            <Transition name="drawer">
                <aside
                    v-if="tool"
                    class="order-2 flex shrink-0 flex-col overflow-hidden border-line bg-surface max-lg:h-[min(42vh,380px)] max-lg:border-t lg:w-[320px] lg:border-r"
                    :aria-label="tool.title"
                >
                    <h2 class="hidden h-12 shrink-0 items-center border-b border-line px-4 text-sm font-semibold lg:flex">
                        {{ tool.title }}
                    </h2>
                    <div ref="panelScroll" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                        <Transition name="panel" mode="out-in">
                            <component :is="PANELS[tool.id]" :key="tool.id" />
                        </Transition>
                    </div>
                </aside>
            </Transition>

            <ToolNav class="order-3 lg:order-1" />
        </div>

        <Transition name="modal">
            <ExportDialog v-if="exporting" @close="exporting = false" />
        </Transition>
        <ToastHost />
    </div>
</template>
