<script setup>
import {computed, onMounted, ref} from 'vue';
import {PhDownloadSimple, PhShareNetwork, PhSpinnerGap, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {useToast} from '../composables/useToast.js';
import {EXPORT_SIZES, exportCollage, exportDimensions, exportFileName} from '../lib/exporter.js';
import RangeField from './ui/RangeField.vue';
import SectionTitle from './ui/SectionTitle.vue';

const emit = defineEmits(['close']);
const store = useCollageStore();
const {toast} = useToast();

const format = ref('jpg');
const edge = ref(2048);
const quality = ref(92);
const busy = ref(false);
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
    busy.value = true;
    try {
        const file = await produce();
        if (action === 'share' && navigator.canShare?.({files: [file]})) {
            try {
                await navigator.share({files: [file], title: 'Tessera 組圖'});
            } catch (err) {
                if (err?.name !== 'AbortError') throw err;
                return;
            }
        } else {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            toast(`已下載 ${file.name}`);
        }
        emit('close');
    } catch {
        toast('匯出失敗，試試看較小的尺寸', {tone: 'error'});
    } finally {
        busy.value = false;
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
            class="anim-sheet pb-safe w-full max-w-md rounded-t-2xl bg-surface shadow-sheet outline-none sm:rounded-2xl"
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
                    <div class="grid grid-cols-2 rounded-lg bg-desk p-1 text-[13px] font-medium">
                        <button
                            v-for="f in [{id: 'jpg', label: 'JPG・檔案小'}, {id: 'png', label: 'PNG・無損'}]"
                            :key="f.id"
                            type="button"
                            class="rounded-md py-1.5 transition-colors"
                            :class="format === f.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
                            :aria-pressed="String(format === f.id)"
                            @click="format = f.id"
                        >{{ f.label }}</button>
                    </div>
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
                    class="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
                    :disabled="busy"
                    @click="run('download')"
                >
                    <PhSpinnerGap v-if="busy" :size="18" class="animate-spin" />
                    <PhDownloadSimple v-else :size="18" />
                    {{ busy ? '處理中…' : '下載圖片' }}
                </button>
            </footer>
        </div>
    </div>
</template>
