<script setup>
import {PhCheck} from '@phosphor-icons/vue';
import {ASPECTS, BACKGROUNDS, useCollageStore} from '../../stores/collage.js';
import {contrastOn} from '../../lib/overlays.js';
import RangeField from '../ui/RangeField.vue';
import SectionTitle from '../ui/SectionTitle.vue';

const store = useCollageStore();

const iconBox = (a) => {
    const k = 18 / Math.max(a.w, a.h);
    return {width: `${a.w * k}px`, height: `${a.h * k}px`};
};
</script>

<template>
    <div class="space-y-6">
        <section>
            <SectionTitle>畫布比例</SectionTitle>
            <div class="grid grid-cols-4 gap-2">
                <button
                    v-for="a in ASPECTS"
                    :key="a.id"
                    type="button"
                    class="flex flex-col items-center gap-1.5 rounded-lg border px-1 pt-2.5 pb-2 transition-colors"
                    :class="store.doc.aspect === a.id
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-ink-2 hover:border-line-strong'"
                    :aria-pressed="String(store.doc.aspect === a.id)"
                    @click="store.doc.aspect = a.id"
                >
                    <span class="grid h-5 place-items-center">
                        <span class="block rounded-[3px] border-[1.5px] border-current" :style="iconBox(a)" />
                    </span>
                    <span class="text-xs font-semibold tabular-nums">{{ a.id }}</span>
                    <span class="text-[11px] leading-none opacity-70">{{ a.hint }}</span>
                </button>
            </div>
        </section>

        <section class="space-y-3">
            <SectionTitle>邊框與間距</SectionTitle>
            <RangeField v-model="store.doc.border" label="外框" :max="120" />
            <RangeField v-model="store.doc.gap" label="格線間距" :max="120" />
            <RangeField v-model="store.doc.radius" label="圓角" :max="200" />
        </section>

        <section>
            <SectionTitle>背景色</SectionTitle>
            <div class="flex flex-wrap items-center gap-2">
                <button
                    v-for="c in BACKGROUNDS"
                    :key="c"
                    type="button"
                    class="grid size-9 place-items-center rounded-full border border-line transition-transform hover:scale-105"
                    :style="{backgroundColor: c}"
                    :aria-label="`背景色 ${c}`"
                    :aria-pressed="String(store.doc.background === c)"
                    @click="store.doc.background = c"
                >
                    <PhCheck v-if="store.doc.background === c" :size="16" weight="bold" :color="contrastOn(c)" />
                </button>
                <label
                    class="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-line"
                    style="background: conic-gradient(#ff5a36, #ffc531, #18a76b, #2e55ff, #8b5cf6, #f06ba8, #ff5a36)"
                    title="自訂顏色"
                >
                    <span class="sr-only">自訂背景色</span>
                    <input v-model="store.doc.background" type="color" class="absolute inset-0 cursor-pointer opacity-0" />
                </label>
            </div>
        </section>
    </div>
</template>
