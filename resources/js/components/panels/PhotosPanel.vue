<script setup>
import {computed} from 'vue';
import {PhUploadSimple, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../../stores/collage.js';
import {useImport} from '../../composables/useImport.js';
import {useToast} from '../../composables/useToast.js';
import {photoThumb} from '../../lib/photos.js';
import SectionTitle from '../ui/SectionTitle.vue';

const store = useCollageStore();
const {pickFiles} = useImport();
const {toast} = useToast();

const cellOf = computed(() => {
    const map = new Map();
    store.doc.cells.forEach((c, i) => c.photoId && map.set(c.photoId, i + 1));
    return map;
});

function onDragStart(id, e) {
    e.dataTransfer.setData('application/x-tessera-photo', id);
    e.dataTransfer.effectAllowed = 'move';
}

/** 點照片：放進選取的格子；沒選就放進第一個空格 */
function place(id) {
    let index = store.selection.type === 'cell' ? store.selection.index : -1;
    if (index < 0) index = store.doc.cells.findIndex((c) => !c.photoId);
    if (index < 0) {
        toast('先點選要替換的格子');
        return;
    }
    store.placePhoto(index, id);
}
</script>

<template>
    <div class="space-y-4">
        <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-strong py-3.5 font-medium text-ink-2 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            @click="pickFiles()"
        >
            <PhUploadSimple :size="18" />
            加入照片
        </button>

        <div v-if="store.photos.length">
            <SectionTitle>
                照片匣
                <template #aside>{{ store.photos.length }} 張・{{ store.unusedPhotos.length }} 張未使用</template>
            </SectionTitle>
            <ul class="grid grid-cols-4 gap-2 lg:grid-cols-3">
                <li v-for="p in store.photos" :key="p.id" class="group relative">
                    <button
                        type="button"
                        draggable="true"
                        class="block aspect-square w-full overflow-hidden rounded-lg bg-desk ring-accent transition-shadow hover:ring-2"
                        :class="cellOf.get(p.id) && 'ring-1 ring-line-strong'"
                        :title="cellOf.get(p.id) ? `在第 ${cellOf.get(p.id)} 格` : '點一下放入格子'"
                        @dragstart="onDragStart(p.id, $event)"
                        @click="place(p.id)"
                    >
                        <img :src="photoThumb(p.id)" :alt="p.name" class="size-full object-cover" :class="!cellOf.get(p.id) && 'opacity-60'" />
                    </button>
                    <span
                        v-if="cellOf.get(p.id)"
                        class="pointer-events-none absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-ink/80 text-[11px] font-semibold text-white tabular-nums"
                    >{{ cellOf.get(p.id) }}</span>
                    <button
                        type="button"
                        class="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-float transition-opacity hover:text-danger lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                        :aria-label="`刪除 ${p.name}`"
                        @click="store.removePhoto(p.id)"
                    >
                        <PhX :size="12" weight="bold" />
                    </button>
                </li>
            </ul>
            <p class="mt-3 text-xs leading-relaxed text-ink-3">
                拖曳照片到格子上，或點一下放進選取的格子。在格子裡拖曳可調整位置，拖出格子外可和其他格交換。
            </p>
        </div>
        <p v-else class="text-xs leading-relaxed text-ink-3">
            照片只會在這台裝置上處理，不會上傳到任何伺服器。
        </p>
    </div>
</template>
