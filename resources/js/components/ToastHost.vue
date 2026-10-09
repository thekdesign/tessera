<script setup>
import {useToast} from '../composables/useToast.js';

const {toasts} = useToast();
</script>

<template>
    <div class="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        <div
            v-for="t in toasts"
            :key="t.id"
            class="anim-sheet rounded-full px-4 py-2 text-[13px] font-medium shadow-float"
            :class="t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'"
        >{{ t.message }}</div>
    </div>
</template>
