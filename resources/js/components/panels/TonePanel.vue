<script setup>
import {computed} from 'vue';
import {PhCursorClick} from '@phosphor-icons/vue';
import {useCollageStore} from '../../stores/collage.js';
import {useToast} from '../../composables/useToast.js';
import {ADJUST_KEYS, EMPTY_ADJUST, FILTERS, resolveParams} from '../../lib/adjust.js';
import {filterThumb} from '../../lib/photos.js';
import RangeField from '../ui/RangeField.vue';
import SectionTitle from '../ui/SectionTitle.vue';

const store = useCollageStore();
const {toast} = useToast();

const index = computed(() => (store.selection.type === 'cell' ? store.selection.index : -1));
const cell = computed(() => (index.value >= 0 && store.doc.cells[index.value]?.photoId ? store.doc.cells[index.value] : undefined));

const signed = (v) => (v > 0 ? `+${v}` : String(v));
const touched = computed(() => cell.value && (cell.value.filter !== 'none' || ADJUST_KEYS.some(({key}) => cell.value.adjust[key])));

function applyAll() {
    store.applyToneToAll(index.value);
    toast('已套用到全部照片');
}

function reset() {
    store.updateCell(index.value, {filter: 'none', adjust: {...EMPTY_ADJUST}});
}
</script>

<template>
    <div v-if="!cell" class="flex flex-col items-center gap-3 px-4 py-10 text-center text-ink-3">
        <PhCursorClick :size="28" />
        <p class="text-[13px] leading-relaxed">先在畫布上點選一格照片，<br />再來這裡套濾鏡、調亮度。</p>
    </div>

    <div v-else class="space-y-6">
        <section>
            <SectionTitle>濾鏡<template #aside>第 {{ index + 1 }} 格</template></SectionTitle>
            <div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
                <button
                    v-for="f in FILTERS"
                    :key="f.id"
                    type="button"
                    class="w-[72px] shrink-0 text-center lg:w-auto"
                    :aria-pressed="String(cell.filter === f.id)"
                    @click="store.updateCell(index, {filter: f.id})"
                >
                    <span
                        class="block aspect-square overflow-hidden rounded-lg ring-offset-2 transition-shadow"
                        :class="cell.filter === f.id ? 'ring-2 ring-accent' : 'ring-1 ring-line'"
                    >
                        <img :src="filterThumb(cell.photoId, f.id, resolveParams(f.id))" alt="" class="size-full object-cover" />
                    </span>
                    <span class="mt-1 block text-xs" :class="cell.filter === f.id ? 'font-semibold text-accent' : 'text-ink-2'">{{ f.label }}</span>
                </button>
            </div>
        </section>

        <section class="space-y-3">
            <SectionTitle>微調</SectionTitle>
            <RangeField
                v-for="k in ADJUST_KEYS"
                :key="k.key"
                v-model="cell.adjust[k.key]"
                :label="k.label"
                :min="k.min ?? -100"
                :max="100"
                :origin="0"
                :format="signed"
            />
        </section>

        <div class="flex gap-2">
            <button
                type="button"
                class="flex-1 rounded-lg bg-ink py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                @click="applyAll"
            >套用到全部照片</button>
            <button
                type="button"
                class="rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-desk disabled:opacity-40"
                :disabled="!touched"
                @click="reset"
            >重設</button>
        </div>
    </div>
</template>
