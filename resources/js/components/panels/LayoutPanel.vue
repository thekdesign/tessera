<script setup>
import {computed} from 'vue';
import {useCollageStore} from '../../stores/collage.js';
import {findLayout, groupLayoutsByCount} from '../../lib/layouts.js';
import LayoutThumb from '../LayoutThumb.vue';
import SectionTitle from '../ui/SectionTitle.vue';

const store = useCollageStore();
const groups = groupLayoutsByCount();
const ratio = computed(() => store.aspect.w / store.aspect.h);

const ratiosChanged = computed(
    () => JSON.stringify(store.doc.tree) !== JSON.stringify(findLayout(store.doc.layoutId)?.tree),
);
</script>

<template>
    <div class="space-y-5">
        <div
            v-if="ratiosChanged"
            class="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent"
        >
            已拖曳調整過格子比例
            <button type="button" class="font-semibold hover:underline" @click="store.resetRatios()">還原等分</button>
        </div>

        <section v-for="g in groups" :key="g.count">
            <SectionTitle>
                {{ g.count }} 格
                <template v-if="g.count === store.photos.length" #aside>剛好放下你的照片</template>
            </SectionTitle>
            <div class="grid grid-cols-5 gap-2 lg:grid-cols-4">
                <button
                    v-for="l in g.layouts"
                    :key="l.id"
                    type="button"
                    class="grid place-items-center rounded-lg border p-2 transition-colors"
                    :class="store.doc.layoutId === l.id
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2'"
                    :aria-label="`${g.count} 格版型`"
                    :aria-pressed="String(store.doc.layoutId === l.id)"
                    @click="store.setLayout(l.id)"
                >
                    <span class="block w-full" :style="{maxWidth: ratio < 1 ? `${ratio * 100}%` : '100%'}">
                        <LayoutThumb :tree="l.tree" :ratio="ratio" />
                    </span>
                </button>
            </div>
        </section>
    </div>
</template>
