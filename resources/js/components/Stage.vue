<script setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {PhPlus} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {useImport} from '../composables/useImport.js';
import {computeLayout, nodeAtPath, pointInRect, shiftRatios, unitOf} from '../lib/geometry.js';
import {clampZoom, computePlacement, panBy} from '../lib/placement.js';
import {resolveParams} from '../lib/adjust.js';
import {renderCollage} from '../lib/render.js';
import {photoSize, photoThumb, previewSource} from '../lib/photos.js';
import {contrastOn} from '../lib/overlays.js';
import {requestOverlayFonts} from '../lib/fonts.js';
import CellToolbar from './CellToolbar.vue';
import OverlayBox from './OverlayBox.vue';

/**
 * 舞台 = canvas（畫面）+ 疊在上面的 DOM 互動層（命中區、把手、選取框）。
 * canvas 與匯出共用 renderCollage，所以畫面上看到的就是匯出結果。
 */

const store = useCollageStore();
const {addFiles, pickFiles} = useImport();

const wrap = ref();
const canvas = ref();
const avail = ref({w: 0, h: 0});
const fontTick = ref(0);
const dragOverIndex = ref(-1);
const swap = ref(undefined);
const gesturing = ref(false);

const size = computed(() => {
    const {w: aw, h: ah} = store.aspect;
    const k = Math.min(avail.value.w / aw, avail.value.h / ah);
    if (!Number.isFinite(k) || k <= 0) return {w: 0, h: 0};
    return {w: Math.floor(aw * k), h: Math.floor(ah * k)};
});

const geo = computed(() => computeLayout(store.doc.tree, size.value.w, size.value.h, store.doc));
const radiusPx = computed(() => store.doc.radius * unitOf(size.value.w, size.value.h));
const placeholderInk = computed(() => contrastOn(store.doc.background));

const pasteKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V';

const selectedIndex = computed(() => (store.selection.type === 'cell' ? store.selection.index : -1));
const showToolbar = computed(
    () => selectedIndex.value >= 0 && store.doc.cells[selectedIndex.value]?.photoId && !gesturing.value && !swap.value,
);

/* ---------- 繪製 ---------- */

let raf = 0;
function scheduleDraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
    });
}

function draw() {
    const el = canvas.value;
    const {w, h} = size.value;
    if (!el || !w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (el.width !== pw || el.height !== ph) {
        el.width = pw;
        el.height = ph;
    }
    requestOverlayFonts(store.doc.overlays, onFontsLoaded);
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderCollage(ctx, w, h, store.doc, {
        photoSize,
        getSource: (cell) => previewSource(cell.photoId, resolveParams(cell.filter, cell.adjust)),
    });
}

watch(() => [store.doc, size.value, store.photos.length], scheduleDraw, {deep: true});

function onFontsLoaded() {
    fontTick.value++;
    scheduleDraw();
}

let observer;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        const {width, height} = entry.contentRect;
        avail.value = {w: width, h: height};
    });
    observer.observe(wrap.value);
    document.fonts?.addEventListener('loadingdone', onFontsLoaded);
    scheduleDraw();
});

onBeforeUnmount(() => {
    observer?.disconnect();
    document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
    cancelAnimationFrame(raf);
});

/* ---------- 座標 ---------- */

const layer = ref();
function local(e) {
    const r = layer.value.getBoundingClientRect();
    return {x: e.clientX - r.left, y: e.clientY - r.top};
}

const inflate = (r, m) => ({x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- 格子手勢：拖曳平移 / 雙指縮放 / 拖出格子交換 ---------- */

const pointers = new Map();
let gesture;

function onCellDown(index, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    store.select({type: 'cell', index});
    const cell = store.doc.cells[index];

    if (pointers.size === 2 && gesture && cell.photoId) {
        const [a, b] = [...pointers.values()];
        gesture = {mode: 'pinch', index: gesture.index, dist0: dist(a, b) || 1, zoom0: store.doc.cells[gesture.index].zoom};
        swap.value = undefined;
        return;
    }
    gesture = {mode: cell.photoId ? 'pan' : 'tap', index, start: p, last: p};
}

function onCellMove(e) {
    if (!gesture || !pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    const {index} = gesture;
    const cell = store.doc.cells[index];
    const rect = geo.value.cells[index];
    if (!cell || !rect) return;

    if (gesture.mode === 'pinch') {
        if (pointers.size < 2) return;
        const [a, b] = [...pointers.values()];
        store.updateCell(index, {zoom: clampZoom((gesture.zoom0 * dist(a, b)) / gesture.dist0)});
        return;
    }
    if (gesture.mode === 'tap') return;

    const dx = p.x - gesture.last.x;
    const dy = p.y - gesture.last.y;
    gesture.last = p;
    if (dist(p, gesture.start) > 3) gesturing.value = true;

    // 拖出原本的格子 → 改成交換模式
    if (gesture.mode === 'pan' && !pointInRect(p.x, p.y, inflate(rect, 12)) && geo.value.cells.length > 1) {
        gesture.mode = 'swap';
    }
    if (gesture.mode === 'swap') {
        const to = geo.value.cells.findIndex((r) => pointInRect(p.x, p.y, r));
        swap.value = {from: index, to, x: p.x, y: p.y, thumb: photoThumb(cell.photoId)};
        return;
    }

    const photo = photoSize(cell.photoId);
    if (!photo) return;
    const placement = computePlacement(rect.w, rect.h, photo.width, photo.height, cell);
    store.updateCell(index, panBy(cell, dx, dy, placement));
}

function onCellUp(e) {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
        if (pointers.size === 1) {
            // 放開一指後，剩下那指繼續平移
            const p = [...pointers.values()][0];
            gesture = {mode: 'pan', index: gesture.index, start: p, last: p};
            return;
        }
    } else if (gesture.mode === 'swap' && e.type === 'pointerup') {
        const s = swap.value;
        if (s && s.to >= 0 && s.to !== s.from) store.swapCells(s.from, s.to);
    }
    if (!pointers.size) {
        gesture = undefined;
        swap.value = undefined;
        gesturing.value = false;
    }
}

function onCellClick(index) {
    if (!store.doc.cells[index]?.photoId) pickFiles(index);
}

function onCellDblClick(index) {
    if (store.doc.cells[index]?.photoId) store.updateCell(index, {zoom: 1, panX: 0, panY: 0});
}

function onWheel(index, e) {
    const cell = store.doc.cells[index];
    if (!cell?.photoId) return;
    e.preventDefault();
    store.select({type: 'cell', index});
    // 觸控板雙指縮放會帶 ctrlKey，靈敏度放大
    const k = e.ctrlKey ? 0.01 : 0.0018;
    store.updateCell(index, {zoom: clampZoom(cell.zoom * Math.exp(-e.deltaY * k))});
}

/* ---------- 拖放：系統檔案 / 照片匣 ---------- */

function onCellDragOver(index, e) {
    e.preventDefault();
    dragOverIndex.value = index;
}

function onCellDrop(index, e) {
    e.preventDefault();
    e.stopPropagation();
    dragOverIndex.value = -1;
    const photoId = e.dataTransfer.getData('application/x-tessera-photo');
    if (photoId) {
        store.placePhoto(index, photoId);
        return;
    }
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, index);
}

/* ---------- 分隔線 ---------- */

let divDrag;

function dividerStyle(d) {
    const hit = 22;
    return d.dir === 'row'
        ? {left: `${d.x - hit / 2}px`, top: `${d.y - d.length / 2}px`, width: `${hit}px`, height: `${d.length}px`}
        : {left: `${d.x - d.length / 2}px`, top: `${d.y - hit / 2}px`, width: `${d.length}px`, height: `${hit}px`};
}

function onDividerDown(d, e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    divDrag = {d, start: local(e), ratios: [...nodeAtPath(store.doc.tree, d.path).ratios]};
    gesturing.value = true;
}

function onDividerMove(e) {
    if (!divDrag) return;
    const p = local(e);
    const {d} = divDrag;
    const delta = d.dir === 'row' ? p.x - divDrag.start.x : p.y - divDrag.start.y;
    store.setRatios(d.path, shiftRatios(divDrag.ratios, d.index, delta, d.avail));
}

function onDividerUp() {
    divDrag = undefined;
    gesturing.value = false;
}

function replace(index) {
    pickFiles(index, {multiple: false});
}
</script>

<template>
    <div
        ref="wrap"
        class="stage mat relative min-h-0 min-w-0 flex-1 p-4 sm:p-8"
        @pointerdown.self="store.clearSelection()"
    >
        <div
            v-if="size.w"
            ref="layer"
            data-layer
            class="anim-stage absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-sheet"
            :style="{width: `${size.w}px`, height: `${size.h}px`}"
            @pointerdown.self="store.clearSelection()"
        >
            <canvas ref="canvas" class="block size-full" :aria-label="`組圖預覽，共 ${geo.cells.length} 格`" role="img" />

            <!-- 格子命中區 -->
            <div
                v-for="(rect, i) in geo.cells"
                :key="`c${i}`"
                class="absolute touch-none select-none"
                :class="store.doc.cells[i]?.photoId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'"
                :style="{left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`}"
                @pointerdown="onCellDown(i, $event)"
                @pointermove="onCellMove"
                @pointerup="onCellUp"
                @pointercancel="onCellUp"
                @click="onCellClick(i)"
                @dblclick="onCellDblClick(i)"
                @wheel="onWheel(i, $event)"
                @dragover="onCellDragOver(i, $event)"
                @dragleave="dragOverIndex = -1"
                @drop="onCellDrop(i, $event)"
            >
                <div
                    v-if="!store.doc.cells[i]?.photoId"
                    class="absolute inset-0 grid place-items-center border-[1.5px] border-dashed transition-colors"
                    :class="dragOverIndex === i ? 'border-accent bg-accent-soft/80' : ''"
                    :style="{
                        borderRadius: `${Math.min(radiusPx, rect.w / 2, rect.h / 2)}px`,
                        color: placeholderInk,
                        borderColor: dragOverIndex === i ? undefined : `${placeholderInk}33`,
                        backgroundColor: dragOverIndex === i ? undefined : `${placeholderInk}0d`,
                    }"
                >
                    <span class="flex flex-col items-center gap-1.5 opacity-70" :class="dragOverIndex === i && 'text-accent opacity-100'">
                        <span class="grid size-9 place-items-center rounded-full bg-current/10">
                            <PhPlus :size="18" weight="bold" />
                        </span>
                        <span v-if="rect.w > 96 && rect.h > 80" class="text-xs font-medium">加入照片</span>
                    </span>
                </div>
                <div
                    v-else-if="dragOverIndex === i"
                    class="pointer-events-none absolute inset-0 border-2 border-accent bg-accent/15"
                    :style="{borderRadius: `${Math.min(radiusPx, rect.w / 2, rect.h / 2)}px`}"
                />
            </div>

            <!-- 選取框 / 交換目標 -->
            <div
                v-if="selectedIndex >= 0 && geo.cells[selectedIndex] && !swap"
                class="pointer-events-none absolute outline-2 outline-offset-1 outline-accent"
                :style="{
                    left: `${geo.cells[selectedIndex].x}px`,
                    top: `${geo.cells[selectedIndex].y}px`,
                    width: `${geo.cells[selectedIndex].w}px`,
                    height: `${geo.cells[selectedIndex].h}px`,
                    borderRadius: `${Math.min(radiusPx, geo.cells[selectedIndex].w / 2, geo.cells[selectedIndex].h / 2)}px`,
                    outlineStyle: 'solid',
                }"
            />
            <template v-if="swap">
                <div
                    v-if="swap.to >= 0 && swap.to !== swap.from"
                    class="pointer-events-none absolute border-2 border-accent bg-accent/20"
                    :style="{
                        left: `${geo.cells[swap.to].x}px`,
                        top: `${geo.cells[swap.to].y}px`,
                        width: `${geo.cells[swap.to].w}px`,
                        height: `${geo.cells[swap.to].h}px`,
                    }"
                />
                <img
                    v-if="swap.thumb"
                    :src="swap.thumb"
                    alt=""
                    class="pointer-events-none absolute z-40 size-16 -translate-x-1/2 -translate-y-1/2 rounded-lg object-cover opacity-90 shadow-float ring-2 ring-white"
                    :style="{left: `${swap.x}px`, top: `${swap.y}px`}"
                />
            </template>

            <!-- 分隔線把手 -->
            <div
                v-for="d in geo.dividers"
                :key="`d${d.path.join('-')}-${d.index}`"
                class="divider-hit absolute z-10 grid touch-none place-items-center"
                :class="d.dir === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'"
                :style="dividerStyle(d)"
                :aria-label="d.dir === 'row' ? '拖曳調整左右比例' : '拖曳調整上下比例'"
                @pointerdown="onDividerDown(d, $event)"
                @pointermove="onDividerMove"
                @pointerup="onDividerUp"
                @pointercancel="onDividerUp"
            >
                <span
                    class="divider-pill block rounded-full border border-line-strong bg-surface shadow-float"
                    :style="d.dir === 'row'
                        ? {width: '8px', height: `${Math.min(36, d.length * 0.4)}px`}
                        : {height: '8px', width: `${Math.min(36, d.length * 0.4)}px`}"
                />
            </div>

            <!-- 文字 / 貼圖 -->
            <div class="pointer-events-none absolute inset-0 z-20 overflow-visible">
                <OverlayBox
                    v-for="o in store.doc.overlays"
                    :key="o.id"
                    class="pointer-events-auto"
                    :overlay="o"
                    :stage-w="size.w"
                    :stage-h="size.h"
                    :font-tick="fontTick"
                    :selected="store.selection.type === 'overlay' && store.selection.id === o.id"
                />
            </div>

            <CellToolbar
                v-if="showToolbar"
                :index="selectedIndex"
                :rect="geo.cells[selectedIndex]"
                :stage-w="size.w"
                @replace="replace"
            />
        </div>

        <p
            v-if="store.ready && !store.photos.length"
            class="pointer-events-none absolute inset-x-0 bottom-3 hidden text-center text-xs text-ink-3 lg:block"
        >
            把照片拖進來、點空格選檔，或直接 {{ pasteKey }} 貼上
        </p>
    </div>
</template>
