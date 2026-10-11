<script setup>
import {computed, onMounted, ref} from 'vue';
import {PhCaretRight, PhCheckCircle, PhPlay, PhX} from '@phosphor-icons/vue';
import {useCollageStore} from '../stores/collage.js';
import {useTour} from '../composables/useTour.js';
import {buildTourSteps, CHAPTER_IDS, CHAPTERS} from '../lib/tour.js';
import {isTouch, modKey} from '../lib/platform.js';

const emit = defineEmits(['close', 'start']);
const store = useCollageStore();
const {seen} = useTour();
const dialog = ref();

onMounted(() => dialog.value?.focus());

const touch = isTouch();
const stepCount = (ids) => buildTourSteps(store, ids).length;
const totalSteps = computed(() => stepCount(CHAPTER_IDS));
const chapters = computed(() => CHAPTERS.map((c, i) => ({...c, no: String(i + 1).padStart(2, '0'), steps: stepCount([c.id])})));

const alt = modKey === '⌘' ? '⌥' : 'Alt';
const gestures = touch
    ? [
        {keys: ['單指拖曳'], does: '移動照片'},
        {keys: ['雙指捏合'], does: '放大縮小'},
        {keys: ['雙指轉動'], does: '旋轉角度'},
        {keys: ['點兩下'], does: '回到置中'},
        {keys: ['拖出格子'], does: '和其他格交換'},
        {keys: ['再點分頁'], does: '收起面板'},
    ]
    : [
        {keys: ['拖曳'], does: '移動照片'},
        {keys: ['滾輪'], does: '放大縮小'},
        {keys: [alt, '滾輪'], does: '旋轉角度'},
        {keys: ['點兩下'], does: '回到置中'},
        {keys: ['拖出格子'], does: '和其他格交換'},
        {keys: [modKey, 'V'], does: '貼上照片'},
        {keys: [modKey, 'Z'], does: '復原'},
        {keys: ['⇧', modKey, 'Z'], does: '重做'},
    ];
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" @click.self="emit('close')">
        <div
            ref="dialog"
            tabindex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            class="modal-sheet pb-safe flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-sheet outline-none sm:max-h-[min(720px,90vh)] sm:rounded-2xl"
            @keydown.esc="emit('close')"
        >
            <header class="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
                <div>
                    <h2 id="tour-title" class="text-base font-semibold">使用導覽</h2>
                    <p class="mt-0.5 text-xs text-ink-3">挑一個章節，跟著畫面上的提示走一遍。</p>
                </div>
                <button type="button" class="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-desk" aria-label="關閉" @click="emit('close')">
                    <PhX :size="18" />
                </button>
            </header>

            <div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5">
                <button
                    type="button"
                    class="group flex w-full items-center gap-3 rounded-xl bg-accent px-4 py-3.5 text-left text-white transition-[background-color,transform] hover:bg-accent-strong active:scale-[0.99]"
                    @click="emit('start', CHAPTER_IDS)"
                >
                    <span class="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
                        <PhPlay :size="16" weight="fill" />
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold">從頭看完整導覽</span>
                        <span class="block text-xs text-white/75 tabular-nums">{{ CHAPTERS.length }} 個章節・共 {{ totalSteps }} 步</span>
                    </span>
                    <PhCaretRight :size="16" weight="bold" class="opacity-70 transition-transform group-hover:translate-x-0.5" />
                </button>

                <section>
                    <h3 class="mb-2 text-[13px] font-semibold">章節</h3>
                    <ol class="divide-y divide-line overflow-hidden rounded-xl border border-line">
                        <li v-for="c in chapters" :key="c.id">
                            <button
                                type="button"
                                class="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-desk focus-visible:-outline-offset-2"
                                @click="emit('start', [c.id])"
                            >
                                <span class="relative grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                                    <component :is="c.icon" :size="20" />
                                    <span class="absolute -top-1 -left-1 rounded-md bg-surface px-1 text-[10px] leading-4 font-semibold text-ink-3 tabular-nums ring-1 ring-line">{{ c.no }}</span>
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="flex items-center gap-1.5 text-sm font-semibold">
                                        {{ c.title }}
                                        <PhCheckCircle v-if="seen.has(c.id)" :size="15" weight="fill" class="text-[#18A76B]" aria-label="已看過" />
                                    </span>
                                    <span class="block truncate text-xs text-ink-3">{{ c.desc }}</span>
                                </span>
                                <span class="shrink-0 text-xs text-ink-3 tabular-nums">{{ c.steps }} 步</span>
                                <PhCaretRight :size="14" weight="bold" class="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </li>
                    </ol>
                </section>

                <section>
                    <h3 class="mb-2 text-[13px] font-semibold">{{ touch ? '手勢速查' : '操作速查' }}</h3>
                    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-desk p-3">
                        <div v-for="g in gestures" :key="g.does" class="flex min-w-0 flex-col gap-1">
                            <dt class="flex flex-wrap items-center gap-1">
                                <span
                                    v-for="k in g.keys"
                                    :key="k"
                                    class="rounded-md border border-b-2 border-line-strong bg-surface px-1.5 text-[11px] leading-5 font-semibold text-ink"
                                >{{ k }}</span>
                            </dt>
                            <dd class="text-xs text-ink-2">{{ g.does }}</dd>
                        </div>
                    </dl>
                </section>
            </div>
        </div>
    </div>
</template>
