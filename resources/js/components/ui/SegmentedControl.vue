<script setup>
import {ref} from 'vue';
import {useSlidingIndicator} from '../../composables/useSlidingIndicator.js';

defineProps({
    options: {type: Array, required: true}, // [{id, label}]
    role: {type: String, default: 'group'},
});

const model = defineModel({type: String, required: true});
const root = ref();
const indicator = useSlidingIndicator(root, model);
</script>

<template>
    <div ref="root" class="relative grid auto-cols-fr grid-flow-col rounded-lg bg-desk p-1 text-[13px] font-medium" :role="role === 'tablist' ? 'tablist' : 'group'">
        <span
            class="pointer-events-none absolute top-0 left-0 rounded-md bg-surface shadow-sm transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            :style="indicator"
            aria-hidden="true"
        />
        <button
            v-for="o in options"
            :key="o.id"
            type="button"
            class="relative rounded-md py-1.5 transition-colors"
            :class="model === o.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2'"
            :data-active="String(model === o.id)"
            :role="role === 'tablist' ? 'tab' : undefined"
            :aria-selected="role === 'tablist' ? String(model === o.id) : undefined"
            :aria-pressed="role === 'tablist' ? undefined : String(model === o.id)"
            @click="model = o.id"
        >{{ o.label }}</button>
    </div>
</template>
