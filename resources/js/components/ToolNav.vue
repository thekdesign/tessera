<script setup>
import {useCollageStore} from '../stores/collage.js';
import {TOOLS} from '../lib/tools.js';

const store = useCollageStore();

// 手機上再點一次目前的分頁可收起面板，讓畫布有更多空間
function select(id) {
    const compact = window.matchMedia('(max-width: 1023px)').matches;
    store.activeTool = compact && store.activeTool === id ? undefined : id;
}
</script>

<template>
    <nav
        class="pb-safe flex shrink-0 border-line bg-surface max-lg:border-t lg:w-[76px] lg:flex-col lg:gap-1 lg:border-r lg:py-3"
        aria-label="工具"
    >
        <button
            v-for="t in TOOLS"
            :key="t.id"
            type="button"
            class="relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors lg:flex-none lg:mx-2 lg:rounded-xl lg:py-2.5"
            :class="store.activeTool === t.id ? 'text-accent lg:bg-accent-soft' : 'text-ink-3 hover:text-ink-2 lg:hover:bg-desk'"
            :aria-current="store.activeTool === t.id ? 'page' : undefined"
            @click="select(t.id)"
        >
            <component :is="t.icon" :size="22" :weight="store.activeTool === t.id ? 'fill' : 'regular'" />
            {{ t.label }}
        </button>
    </nav>
</template>
