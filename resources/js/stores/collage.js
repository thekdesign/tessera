import {defineStore} from 'pinia';
import {computed, reactive, ref, watch} from 'vue';
import {cloneTree, countLeaves, DEFAULT_LAYOUT_ID, findLayout} from '../lib/layouts.js';
import {nodeAtPath} from '../lib/geometry.js';
import {EMPTY_ADJUST} from '../lib/adjust.js';
import {clearDraft, forgetPhoto, importFiles, loadDraft, saveDraft} from '../lib/photos.js';

export const ASPECTS = [
    {id: '1:1', w: 1, h: 1, hint: '正方形'},
    {id: '4:5', w: 4, h: 5, hint: 'IG 貼文'},
    {id: '9:16', w: 9, h: 16, hint: '限動'},
    {id: '3:4', w: 3, h: 4, hint: '直式'},
    {id: '2:3', w: 2, h: 3, hint: '相片直'},
    {id: '4:3', w: 4, h: 3, hint: '橫式'},
    {id: '3:2', w: 3, h: 2, hint: '相片橫'},
    {id: '16:9', w: 16, h: 9, hint: '寬螢幕'},
];

export const BACKGROUNDS = ['#FFFFFF', '#F3F1EC', '#111318', '#2E55FF', '#FFD9CF', '#D9F0E3', '#FFE9A8', '#E9DDFB'];

export const newCell = (photoId) => ({
    photoId,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    filter: 'none',
    adjust: {...EMPTY_ADJUST},
});

function freshDoc() {
    const tree = cloneTree(findLayout(DEFAULT_LAYOUT_ID).tree);
    return {
        layoutId: DEFAULT_LAYOUT_ID,
        tree,
        cells: Array.from({length: countLeaves(tree)}, () => newCell(undefined)),
        aspect: '1:1',
        border: 24,
        gap: 16,
        radius: 0,
        background: '#FFFFFF',
        overlays: [],
    };
}

const HISTORY_LIMIT = 80;
const debounce = (fn, ms) => {
    let t;
    const wrapped = (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = () => {
        clearTimeout(t);
        fn();
    };
    return wrapped;
};

let overlaySeq = 0;

export const useCollageStore = defineStore('collage', () => {
    const doc = reactive(freshDoc());
    const photos = ref([]);
    const selection = ref({type: undefined});
    const activeTool = ref('layout');
    const editingOverlayId = ref(undefined);
    const ready = ref(false);

    const aspect = computed(() => ASPECTS.find((a) => a.id === doc.aspect) || ASPECTS[0]);
    const usedPhotoIds = computed(() => new Set(doc.cells.map((c) => c.photoId).filter(Boolean)));
    const unusedPhotos = computed(() => photos.value.filter((p) => !usedPhotoIds.value.has(p.id)));
    const filledCount = computed(() => doc.cells.filter((c) => c.photoId).length);
    const selectedCell = computed(() => (selection.value.type === 'cell' ? doc.cells[selection.value.index] : undefined));
    const selectedOverlay = computed(() =>
        selection.value.type === 'overlay' ? doc.overlays.find((o) => o.id === selection.value.id) : undefined,
    );

    /* ---------- 復原 / 重做：狀態穩定 350ms 後記一筆 ---------- */

    const past = ref([]);
    const future = ref([]);
    let current = JSON.stringify(doc);

    const commit = debounce(() => {
        const snap = JSON.stringify(doc);
        if (snap === current) return;
        past.value.push(current);
        if (past.value.length > HISTORY_LIMIT) past.value.shift();
        future.value = [];
        current = snap;
    }, 350);

    function restore(snap) {
        Object.assign(doc, JSON.parse(snap));
        current = snap;
        if (selection.value.type === 'cell' && selection.value.index >= doc.cells.length) clearSelection();
        if (selection.value.type === 'overlay' && !selectedOverlay.value) clearSelection();
    }

    function undo() {
        commit.flush();
        if (!past.value.length) return;
        future.value.push(current);
        restore(past.value.pop());
    }

    function redo() {
        commit.flush();
        if (!future.value.length) return;
        past.value.push(current);
        restore(future.value.pop());
    }

    const canUndo = computed(() => past.value.length > 0);
    const canRedo = computed(() => future.value.length > 0);

    /* ---------- 草稿自動保存 ---------- */

    const autosave = debounce(() => {
        saveDraft(JSON.parse(JSON.stringify(doc)), photos.value.map((p) => ({id: p.id})));
    }, 600);

    watch(doc, () => {
        commit();
        if (ready.value) autosave();
    }, {deep: true});
    watch(photos, () => ready.value && autosave(), {deep: true});

    async function init() {
        const draft = await loadDraft();
        if (draft) {
            const known = new Set(draft.photos.map((p) => p.id));
            photos.value = draft.photos;
            Object.assign(doc, draft.doc);
            // 找不到原圖的格子清空，避免畫出空洞
            doc.cells.forEach((cell, i) => {
                if (cell.photoId && !known.has(cell.photoId)) doc.cells[i] = newCell(undefined);
            });
            current = JSON.stringify(doc);
        }
        ready.value = true;
        return Boolean(draft && draft.photos.length);
    }

    /* ---------- 照片 ---------- */

    function autoFill() {
        const queue = [...unusedPhotos.value];
        doc.cells.forEach((cell, i) => {
            if (!cell.photoId && queue.length) doc.cells[i] = newCell(queue.shift().id);
        });
    }

    async function addFiles(files, targetIndex) {
        const result = await importFiles([...files]);
        if (!result.photos.length) return result;
        photos.value.push(...result.photos);
        if (targetIndex !== undefined && doc.cells[targetIndex]) {
            doc.cells[targetIndex] = newCell(result.photos[0].id);
            selection.value = {type: 'cell', index: targetIndex};
        }
        autoFill();
        return result;
    }

    function placePhoto(index, photoId) {
        const from = doc.cells.findIndex((c) => c.photoId === photoId);
        if (from === index) return;
        if (from >= 0) {
            swapCells(from, index);
            return;
        }
        doc.cells[index] = newCell(photoId);
        selection.value = {type: 'cell', index};
    }

    function swapCells(a, b) {
        if (a === b) return;
        const tmp = doc.cells[a];
        doc.cells[a] = doc.cells[b];
        doc.cells[b] = tmp;
        selection.value = {type: 'cell', index: b};
    }

    function clearCell(index) {
        doc.cells[index] = newCell(undefined);
    }

    function removePhoto(id) {
        doc.cells.forEach((cell, i) => {
            if (cell.photoId === id) doc.cells[i] = newCell(undefined);
        });
        photos.value = photos.value.filter((p) => p.id !== id);
        forgetPhoto(id);
    }

    function updateCell(index, patch) {
        Object.assign(doc.cells[index], patch);
    }

    function applyToneToAll(index) {
        const {filter, adjust} = doc.cells[index];
        doc.cells.forEach((cell) => {
            cell.filter = filter;
            cell.adjust = {...adjust};
        });
    }

    /* ---------- 版型 ---------- */

    function setLayout(id) {
        const layout = findLayout(id);
        if (!layout) return;
        doc.layoutId = id;
        doc.tree = cloneTree(layout.tree);
        const n = countLeaves(doc.tree);
        doc.cells = Array.from({length: n}, (_, i) => doc.cells[i] || newCell(undefined));
        autoFill();
        if (selection.value.type === 'cell' && selection.value.index >= n) clearSelection();
    }

    function setRatios(path, ratios) {
        nodeAtPath(doc.tree, path).ratios = ratios;
    }

    function resetRatios() {
        doc.tree = cloneTree(findLayout(doc.layoutId).tree);
    }

    /* ---------- 文字 / 貼圖 ---------- */

    function addOverlay(overlay) {
        const id = `o${Date.now().toString(36)}${overlaySeq++}`;
        // 連續新增時錯開位置，免得疊在一起
        const shift = (doc.overlays.length % 5) * 0.04;
        doc.overlays.push({id, x: 0.5 + shift, y: 0.5 + shift, rotation: 0, ...overlay});
        selection.value = {type: 'overlay', id};
        return id;
    }

    function addText() {
        const id = addOverlay({kind: 'text', text: '輸入文字', font: 'sans', color: '#FFFFFF', style: 'shadow', size: 0.09});
        editingOverlayId.value = id;
        activeTool.value = 'decor';
        return id;
    }

    function addSticker(emoji) {
        return addOverlay({kind: 'sticker', emoji, size: 0.16});
    }

    function updateOverlay(id, patch) {
        const overlay = doc.overlays.find((o) => o.id === id);
        if (overlay) Object.assign(overlay, patch);
    }

    function removeOverlay(id) {
        doc.overlays = doc.overlays.filter((o) => o.id !== id);
        if (selection.value.id === id) clearSelection();
        if (editingOverlayId.value === id) editingOverlayId.value = undefined;
    }

    function duplicateOverlay(id) {
        const src = doc.overlays.find((o) => o.id === id);
        if (!src) return;
        const {id: _ignored, ...rest} = JSON.parse(JSON.stringify(src));
        addOverlay({...rest, x: Math.min(0.95, src.x + 0.04), y: Math.min(0.95, src.y + 0.04)});
    }

    function bringToFront(id) {
        const i = doc.overlays.findIndex((o) => o.id === id);
        if (i < 0 || i === doc.overlays.length - 1) return;
        const [item] = doc.overlays.splice(i, 1);
        doc.overlays.push(item);
    }

    /* ---------- 其他 ---------- */

    function select(next) {
        selection.value = next;
        if (next.type !== 'overlay') editingOverlayId.value = undefined;
    }

    function clearSelection() {
        selection.value = {type: undefined};
        editingOverlayId.value = undefined;
    }

    async function startOver() {
        await clearDraft(photos.value.map((p) => p.id));
        photos.value = [];
        Object.assign(doc, freshDoc());
        clearSelection();
    }

    return {
        doc, photos, selection, activeTool, editingOverlayId, ready,
        aspect, unusedPhotos, filledCount, selectedCell, selectedOverlay,
        canUndo, canRedo, undo, redo, init,
        addFiles, placePhoto, swapCells, clearCell, removePhoto, updateCell, applyToneToAll,
        setLayout, setRatios, resetRatios,
        addText, addSticker, updateOverlay, removeOverlay, duplicateOverlay, bringToFront,
        select, clearSelection, startOver,
    };
});
