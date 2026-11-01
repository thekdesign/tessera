<script setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {PhDownloadSimple, PhFolderSimple, PhImageSquare, PhShareNetwork, PhSpinnerGap, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {useToast} from '../composables/useToast.js';
import {EXPORT_SIZES, VIDEO_SIZES, exportCollage, exportCollageVideo, exportDimensions, exportFileName, pickVideoMime, videoDimensions} from '../lib/exporter.js';
import {canShareFiles, isIOS} from '../lib/platform.js';
import RangeField from './ui/RangeField.vue';
import SectionTitle from './ui/SectionTitle.vue';
import SegmentedControl from './ui/SegmentedControl.vue';

const emit = defineEmits(['close']);
const store = useCollageStore();
const {toast} = useToast();

const hasVideo = store.videoCells.length > 0;
const canRecord = hasVideo && Boolean(pickVideoMime());
const kind = ref(canRecord ? 'video' : 'image');
const isVideoOutput = computed(() => kind.value === 'video');
const word = computed(() => (isVideoOutput.value ? '影片' : '圖片'));

const format = ref('jpg');
const imageEdge = ref(2048);
const videoEdge = ref(1920);
const quality = ref(92);
const progress = ref(0);
const sizes = computed(() => (isVideoOutput.value ? VIDEO_SIZES : EXPORT_SIZES));
const edge = computed({
    get: () => (isVideoOutput.value ? videoEdge.value : imageEdge.value),
    set: (v) => {
        (isVideoOutput.value ? videoEdge : imageEdge).value = v;
    },
});
const dimensionsOf = (longEdge) => (isVideoOutput.value ? videoDimensions : exportDimensions)(store.aspect, longEdge);
const durationLabel = computed(() => `${Math.max(1, Math.round(store.videoDuration))} 秒`);
// idle → busy → done；done 時按鈕轉成打勾，停留片刻再關閉。
// ready：圖已做好但瀏覽器擋下分享（轉檔太久，點擊的授權過期），要使用者再點一次
const phase = ref('idle');
const running = ref(undefined); // 'share' | 'download'
const busy = computed(() => phase.value === 'busy' || phase.value === 'done');
const doneLabel = ref('');
const dialog = ref();

const emptyCount = computed(() => store.doc.cells.filter((c) => !c.photoId).length);
const canShare = canShareFiles();
// 網頁沒辦法直接寫進 iPhone 的「照片」，要透過分享選單的「儲存影像 / 影片」；
// 直接下載只會進「檔案」App，所以在 iPhone 上把分享當成主要動作
const toPhotos = isIOS && canShare;

const actions = computed(() => {
    const share = toPhotos
        ? {id: 'share', label: '儲存到相片', icon: PhImageSquare}
        : {id: 'share', label: '分享', icon: PhShareNetwork};
    const download = toPhotos
        ? {id: 'download', label: '存到檔案', icon: PhFolderSimple}
        : {id: 'download', label: `下載${word.value}`, icon: PhDownloadSimple};
    if (!canShare) return {primary: download};
    return toPhotos ? {primary: share, secondary: download} : {primary: download, secondary: share};
});

// 對話框開著時暫停預覽：圖片匯出就是停住的這一幀，錄影也不用和預覽搶解碼器
const wasPlaying = store.playing;
const controller = new AbortController();

onMounted(() => {
    dialog.value?.focus();
    store.playing = false;
});

onBeforeUnmount(() => {
    controller.abort();
    store.playing = wasPlaying;
});

/* ---------- 產生檔案：同樣的設定只轉一次，「再點一次」時可以立刻分享 ---------- */

let prepared;
const settingsKey = () => `${kind.value}|${format.value}|${edge.value}|${quality.value}`;

watch([kind, format, edge, quality], () => {
    prepared = undefined;
    if (phase.value === 'ready') phase.value = 'idle';
});

async function getFile() {
    const key = settingsKey();
    if (prepared?.key === key) return prepared.file;
    if (isVideoOutput.value) {
        progress.value = 0;
        const {blob, format: videoFormat} = await exportCollageVideo(store.doc, store.aspect, {
            longEdge: edge.value,
            signal: controller.signal,
            onProgress: (p) => (progress.value = p),
        });
        const file = new File([blob], exportFileName(videoFormat), {type: blob.type});
        prepared = {key, file};
        return file;
    }
    const {blob} = await exportCollage(store.doc, store.aspect, {
        longEdge: edge.value,
        format: format.value,
        quality: quality.value / 100,
    });
    const file = new File([blob], exportFileName(format.value), {type: blob.type});
    prepared = {key, file};
    return file;
}

function finish(label) {
    doneLabel.value = label;
    phase.value = 'done';
    setTimeout(() => emit('close'), 900);
}

async function share() {
    const file = await getFile();
    try {
        await navigator.share({files: [file], title: 'Tessera 組圖'});
    } catch (err) {
        // 使用者自己關掉分享選單
        if (err?.name === 'AbortError') {
            phase.value = 'idle';
            return;
        }
        if (err?.name === 'NotAllowedError') {
            phase.value = 'ready';
            return;
        }
        throw err;
    }
    finish('完成');
}

async function download() {
    const file = await getFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast(toPhotos ? `已存到「檔案」：${file.name}` : `已下載 ${file.name}`);
    finish(toPhotos ? '已存檔' : '已下載');
}

async function run(action) {
    if (busy.value) return;
    running.value = action;
    phase.value = 'busy';
    // 按鈕 disabled 後焦點會掉到 body，移回對話框 Esc 才能取消
    dialog.value?.focus();
    try {
        await (action === 'share' ? share() : download());
    } catch (err) {
        phase.value = 'idle';
        if (err?.name === 'AbortError') return;
        if (err?.message === 'page-hidden') {
            toast('錄製時離開了頁面，所以中斷了。請留在這個頁面再試一次', {tone: 'error', duration: 4000});
            return;
        }
        toast('匯出失敗，試試看較小的尺寸', {tone: 'error'});
    }
}

const stateOf = (id) => (running.value === id ? phase.value : 'idle');
const busyLabel = computed(() => (isVideoOutput.value ? `錄製中 ${Math.round(progress.value * 100)}%` : '處理中…'));
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" @click.self="emit('close')">
        <div
            ref="dialog"
            tabindex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            class="modal-sheet pb-safe w-full max-w-md rounded-t-2xl bg-surface shadow-sheet outline-none sm:rounded-2xl"
            @keydown.esc="emit('close')"
        >
            <header class="flex items-center justify-between px-5 pt-5">
                <h2 id="export-title" class="text-base font-semibold">匯出{{ word }}</h2>
                <button type="button" class="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-desk" aria-label="關閉" @click="emit('close')">
                    <PhX :size="18" />
                </button>
            </header>

            <div class="space-y-5 px-5 py-4">
                <section v-if="canRecord">
                    <SectionTitle>輸出</SectionTitle>
                    <SegmentedControl v-model="kind" :options="[{id: 'video', label: '影片'}, {id: 'image', label: '圖片・目前畫面'}]" />
                </section>

                <section>
                    <SectionTitle>尺寸</SectionTitle>
                    <div class="grid gap-2" :class="isVideoOutput ? 'grid-cols-2' : 'grid-cols-3'">
                        <button
                            v-for="s in sizes"
                            :key="s.edge"
                            type="button"
                            class="rounded-xl border px-2 py-2.5 text-center transition-colors"
                            :class="edge === s.edge ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line-strong'"
                            :aria-pressed="String(edge === s.edge)"
                            @click="edge = s.edge"
                        >
                            <span class="block text-sm font-semibold">{{ s.label }}</span>
                            <span class="block text-[11px] tabular-nums opacity-70">
                                {{ dimensionsOf(s.edge).width }} × {{ dimensionsOf(s.edge).height }}
                            </span>
                            <span class="block text-[11px] opacity-70">{{ s.hint }}</span>
                        </button>
                    </div>
                </section>

                <section v-if="!isVideoOutput">
                    <SectionTitle>格式</SectionTitle>
                    <SegmentedControl v-model="format" :options="[{id: 'jpg', label: 'JPG・檔案小'}, {id: 'png', label: 'PNG・無損'}]" />
                </section>

                <RangeField v-if="!isVideoOutput && format === 'jpg'" v-model="quality" label="JPG 品質" :min="60" :max="100" />

                <p v-if="isVideoOutput" class="rounded-lg bg-desk px-3 py-2 text-xs leading-relaxed text-ink-2">
                    影片長 {{ durationLabel }}，較短的影片會循環。錄製要花一樣長的時間，請留在這個頁面；關閉視窗會取消。
                </p>
                <p v-else-if="hasVideo" class="rounded-lg bg-desk px-3 py-2 text-xs leading-relaxed text-ink-2">
                    {{ canRecord ? '影片格會輸出目前畫面。' : '這個瀏覽器不支援錄製影片，影片格會輸出目前畫面。' }}想換畫面可以先關閉視窗，播放後再按暫停。
                </p>

                <p v-if="emptyCount" class="rounded-lg bg-desk px-3 py-2 text-xs text-ink-2">
                    還有 {{ emptyCount }} 格沒有照片，匯出時會顯示成背景色。
                </p>
            </div>

            <footer class="px-5 pb-5">
                <div class="flex gap-2">
                    <button
                        v-if="actions.secondary"
                        type="button"
                        class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 font-medium text-ink-2 transition-[background-color,transform] hover:bg-desk active:scale-[0.98] disabled:opacity-50"
                        :disabled="busy"
                        @click="run(actions.secondary.id)"
                    >
                        <Transition name="swap" mode="out-in">
                            <span :key="stateOf(actions.secondary.id)" class="flex items-center gap-2">
                                <template v-if="stateOf(actions.secondary.id) === 'busy'"><PhSpinnerGap :size="18" class="animate-spin" /><span class="tabular-nums">{{ busyLabel }}</span></template>
                                <template v-else-if="stateOf(actions.secondary.id) === 'done'">{{ doneLabel }}</template>
                                <template v-else><component :is="actions.secondary.icon" :size="18" />{{ actions.secondary.label }}</template>
                            </span>
                        </Transition>
                    </button>
                    <button
                        type="button"
                        class="flex flex-[2] items-center justify-center rounded-xl py-3 font-semibold text-white transition-[background-color,transform] duration-300 active:scale-[0.98]"
                        :class="stateOf(actions.primary.id) === 'done' ? 'bg-[#18A76B]' : 'bg-accent hover:bg-accent-strong'"
                        :disabled="busy"
                        @click="run(actions.primary.id)"
                    >
                        <Transition name="swap" mode="out-in">
                            <span :key="stateOf(actions.primary.id)" class="flex items-center gap-2">
                                <template v-if="stateOf(actions.primary.id) === 'busy'"><PhSpinnerGap :size="18" class="animate-spin" /><span class="tabular-nums">{{ busyLabel }}</span></template>
                                <template v-else-if="stateOf(actions.primary.id) === 'done'">
                                    <svg viewBox="0 0 24 24" class="size-[18px]" aria-hidden="true">
                                        <path d="M5 12.5l4.5 4.5L19 7.5" class="check-draw" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                    {{ doneLabel }}
                                </template>
                                <template v-else-if="stateOf(actions.primary.id) === 'ready'">
                                    <component :is="actions.primary.icon" :size="18" />{{ word }}好了，點我{{ actions.primary.label }}
                                </template>
                                <template v-else><component :is="actions.primary.icon" :size="18" />{{ actions.primary.label }}</template>
                            </span>
                        </Transition>
                    </button>
                </div>

                <Transition name="fade" mode="out-in">
                    <p v-if="phase === 'ready'" key="ready" class="mt-3 text-center text-xs text-ink-2" role="status">
                        轉檔花了一點時間，瀏覽器需要你再點一次才能開啟分享選單。
                    </p>
                    <p v-else-if="toPhotos" key="hint" class="mt-3 text-center text-xs leading-relaxed text-ink-3">
                        會打開分享選單，點選<b class="font-semibold text-ink-2">「{{ isVideoOutput ? '儲存影片' : '儲存影像' }}」</b>就會存進「照片」App。
                    </p>
                </Transition>
            </footer>
        </div>
    </div>
</template>
