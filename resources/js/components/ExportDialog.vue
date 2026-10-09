<script setup>
import {computed, onMounted, ref} from 'vue';
import {PhDownloadSimple, PhShareNetwork, PhSpinnerGap, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {useToast} from '../composables/useToast.js';
import {EXPORT_SIZES, exportCollage, exportDimensions, exportFileName} from '../lib/exporter.js';
import RangeField from './ui/RangeField.vue';
import SectionTitle from './ui/SectionTitle.vue';
import SegmentedControl from './ui/SegmentedControl.vue';

const emit = defineEmits(['close']);
const store = useCollageStore();
const {toast} = useToast();

const format = ref('jpg');
const edge = ref(2048);
const quality = ref(92);
// idle → busy → done；done 時按鈕轉成打勾，停留片刻再關閉
const phase = ref('idle');
const busy = computed(() => phase.value !== 'idle');
const doneLabel = ref('');
const dialog = ref();

const emptyCount = computed(() => store.doc.cells.filter((c) => !c.photoId).length);
const canShare = typeof navigator !== 'undefined' && Boolean(navigator.canShare);

onMounted(() => dialog.value?.focus());

async function produce() {
    const {blob} = await exportCollage(store.doc, store.aspect, {
        longEdge: edge.value,
        format: format.value,
        quality: quality.value / 100,
    });
    return new File([blob], exportFileName(format.value), {type: blob.type});
}

async function run(action) {
    if (busy.value) return;
    phase.value = 'busy';
    try {
        const file = await produce();
        if (action === 'share' && navigator.canShare?.({files: [file]})) {
            try {
                await navigator.share({files: [file], title: 'Tessera 組圖'});
            } catch (err) {
                if (err?.name !== 'AbortError') throw err;
                phase.value = 'idle';
                return;
            }
            doneLabel.value = '已分享';
        } else {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            doneLabel.value = '已下載';
            toast(`已下載 ${file.name}`);
        }
        phase.value = 'done';
        setTimeout(() => emit('close'), 900);
    } catch {
        phase.value = 'idle';
        toast('匯出失敗，試試看較小的尺寸', {tone: 'error'});
    }
}
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
                <h2 id="export-title" class="text-base font-semibold">匯出圖片</h2>
                <button type="button" class="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-desk" aria-label="關閉" @click="emit('close')">
                    <PhX :size="18" />
                </button>
            </header>

            <div class="space-y-5 px-5 py-4">
                <section>
                    <SectionTitle>尺寸</SectionTitle>
                    <div class="grid grid-cols-3 gap-2">
                        <button
                            v-for="s in EXPORT_SIZES"
                            :key="s.edge"
                            type="button"
                            class="rounded-xl border px-2 py-2.5 text-center transition-colors"
                            :class="edge === s.edge ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line-strong'"
                            :aria-pressed="String(edge === s.edge)"
                            @click="edge = s.edge"
                        >
                            <span class="block text-sm font-semibold">{{ s.label }}</span>
                            <span class="block text-[11px] tabular-nums opacity-70">
                                {{ exportDimensions(store.aspect, s.edge).width }} × {{ exportDimensions(store.aspect, s.edge).height }}
                            </span>
                            <span class="block text-[11px] opacity-70">{{ s.hint }}</span>
                        </button>
                    </div>
                </section>

                <section>
                    <SectionTitle>格式</SectionTitle>
                    <SegmentedControl v-model="format" :options="[{id: 'jpg', label: 'JPG・檔案小'}, {id: 'png', label: 'PNG・無損'}]" />
                </section>

                <RangeField v-if="format === 'jpg'" v-model="quality" label="JPG 品質" :min="60" :max="100" />

                <p v-if="emptyCount" class="rounded-lg bg-desk px-3 py-2 text-xs text-ink-2">
                    還有 {{ emptyCount }} 格沒有照片，匯出時會顯示成背景色。
                </p>
            </div>

            <footer class="flex gap-2 px-5 pb-5">
                <button
                    v-if="canShare"
                    type="button"
                    class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 font-medium text-ink-2 transition-colors hover:bg-desk disabled:opacity-50"
                    :disabled="busy"
                    @click="run('share')"
                >
                    <PhShareNetwork :size="18" />分享
                </button>
                <button
                    type="button"
                    class="flex flex-[2] items-center justify-center rounded-xl py-3 font-semibold text-white transition-colors duration-300"
                    :class="phase === 'done' ? 'bg-[#18A76B]' : 'bg-accent hover:bg-accent-strong'"
                    :disabled="busy"
                    @click="run('download')"
                >
                    <Transition name="swap" mode="out-in">
                        <span :key="phase" class="flex items-center gap-2">
                            <template v-if="phase === 'busy'"><PhSpinnerGap :size="18" class="animate-spin" />處理中…</template>
                            <template v-else-if="phase === 'done'">
                                <svg viewBox="0 0 24 24" class="size-[18px]" aria-hidden="true">
                                    <path d="M5 12.5l4.5 4.5L19 7.5" class="check-draw" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                {{ doneLabel }}
                            </template>
                            <template v-else><PhDownloadSimple :size="18" />下載圖片</template>
                        </span>
                    </Transition>
                </button>
            </footer>
        </div>
    </div>
</template>
