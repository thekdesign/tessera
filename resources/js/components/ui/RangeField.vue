<script setup>
import {computed} from 'vue';

const props = defineProps({
    label: {type: String, required: true},
    min: {type: Number, default: 0},
    max: {type: Number, default: 100},
    step: {type: Number, default: 1},
    format: {type: Function, default: (v) => String(Math.round(v))},
    // 數值為 0 時顯示的中性點（雙向滑桿用）
    origin: {type: Number, default: undefined},
});

const model = defineModel({type: Number, required: true});

const fill = computed(() => `${((model.value - props.min) / (props.max - props.min)) * 100}%`);
const changed = computed(() => props.origin !== undefined && model.value !== props.origin);
</script>

<template>
    <label class="block">
        <span class="flex items-center justify-between text-[13px]">
            <span class="text-ink-2">{{ label }}</span>
            <button
                v-if="changed"
                type="button"
                class="tabular-nums text-accent hover:underline"
                :title="`重設${label}`"
                @click.prevent="model = origin"
            >{{ format(model) }}</button>
            <span v-else class="tabular-nums text-ink-3">{{ format(model) }}</span>
        </span>
        <input
            v-model.number="model"
            class="range"
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :style="{'--fill': fill}"
        />
    </label>
</template>
