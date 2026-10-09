<script setup>
import {ref} from 'vue';
import {useCollageStore} from '../stores/collage.js';
import {TOOLS} from '../lib/tools.js';
import {useSlidingIndicator} from '../composables/useSlidingIndicator.js';

const store = useCollageStore();
const root = ref();

const compact = () => window.matchMedia('(max-width: 1023px)').matches;

// 桌面版底色框住整顆按鈕；手機底部列只框住圖示（類似原生 App 的分頁列）
const indicator = useSlidingIndicator(root, () => store.activeTool, (el) => (compact() ? el.querySelector('[data-pill]') : el));

// 手機上再點一次目前的分頁可收起面板，讓畫布有更多空間
function select(id) {
    store.activeTool = compact() && store.activeTool === id ? undefined : id;
}
</script>

<template>
    <nav
        ref="root"
        class="pb-safe relative flex shrink-0 border-line bg-surface max-lg:border-t lg:w-[76px] lg:flex-col lg:gap-1 lg:border-r lg:py-3"
        aria-label="工具"
    >
        <span
            class="pointer-events-none absolute top-0 left-0 rounded-full bg-accent-soft transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:rounded-xl"
            :style="indicator"
            aria-hidden="true"
        />
        <button
            v-for="t in TOOLS"
            :key="t.id"
            type="button"
            class="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors lg:mx-2 lg:flex-none lg:gap-1 lg:rounded-xl lg:py-2.5"
            :class="store.activeTool === t.id ? 'text-accent' : 'text-ink-3 hover:text-ink-2 lg:hover:bg-desk'"
            :data-active="String(store.activeTool === t.id)"
            :aria-current="store.activeTool === t.id ? 'page' : undefined"
            @click="select(t.id)"
        >
            <span data-pill class="grid h-8 w-14 place-items-center lg:h-auto lg:w-auto">
                <component :is="t.icon" :size="22" :weight="store.activeTool === t.id ? 'fill' : 'regular'" />
            </span>
            {{ t.label }}
        </button>
    </nav>
</template>
