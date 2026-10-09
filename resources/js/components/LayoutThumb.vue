<script setup>
import {computed} from 'vue';
import {computeLayout} from '../lib/geometry.js';

const props = defineProps({
    tree: {type: Object, required: true},
    ratio: {type: Number, default: 1}, // 寬 / 高
});

const W = 40;
const H = computed(() => W / props.ratio);
const cells = computed(() => computeLayout(props.tree, W, H.value, {border: 70, gap: 70}).cells);
</script>

<template>
    <svg :viewBox="`0 0 ${W} ${H}`" class="block h-auto w-full" aria-hidden="true">
        <rect
            v-for="(c, i) in cells"
            :key="i"
            :x="c.x"
            :y="c.y"
            :width="c.w"
            :height="c.h"
            rx="1.6"
            class="fill-current"
        />
    </svg>
</template>
