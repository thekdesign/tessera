<script setup>
import {PhArrowUUpLeft, PhArrowUUpRight, PhDownloadSimple, PhFilePlus} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';

const emit = defineEmits(['export', 'start-over']);
const store = useCollageStore();
const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl+';
</script>

<template>
    <header class="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <div class="flex items-center gap-2.5 pr-2">
            <svg viewBox="0 0 24 24" class="size-7" aria-hidden="true">
                <rect x="2" y="2" width="9" height="9" rx="2" fill="#111318" />
                <rect x="13" y="2" width="9" height="9" rx="2" fill="#2E55FF" />
                <rect x="2" y="13" width="9" height="9" rx="2" fill="#CFD3DA" />
                <rect x="13" y="13" width="9" height="9" rx="2" fill="#111318" />
            </svg>
            <span class="text-[17px] font-semibold tracking-tight">Tessera</span>
            <span class="hidden text-[13px] text-ink-3 sm:inline">組圖</span>
        </div>

        <div class="ml-auto flex items-center gap-1">
            <button
                type="button"
                class="grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-desk disabled:text-line-strong disabled:hover:bg-transparent"
                :disabled="!store.canUndo"
                :title="`復原 (${mod}Z)`"
                aria-label="復原"
                @click="store.undo()"
            >
                <PhArrowUUpLeft :size="19" />
            </button>
            <button
                type="button"
                class="grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-desk disabled:text-line-strong disabled:hover:bg-transparent"
                :disabled="!store.canRedo"
                :title="`重做 (${mod}⇧Z)`"
                aria-label="重做"
                @click="store.redo()"
            >
                <PhArrowUUpRight :size="19" />
            </button>
            <span class="mx-1.5 h-5 w-px bg-line" />
            <button
                type="button"
                class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-desk"
                title="清空，重新開始"
                @click="emit('start-over')"
            >
                <PhFilePlus :size="18" />
                <span class="hidden sm:inline">新作品</span>
            </button>
            <button
                type="button"
                class="ml-1 flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
                :disabled="!store.filledCount && !store.doc.overlays.length"
                @click="emit('export')"
            >
                <PhDownloadSimple :size="17" weight="bold" />
                匯出
            </button>
        </div>
    </header>
</template>
