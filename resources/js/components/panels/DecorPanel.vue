<script setup>
import {computed, nextTick, onMounted, ref, watch} from 'vue';
import {PhArrowLineUp, PhCopy, PhTextAa, PhTrash} from '@phosphor-icons/vue';
import {useCollageStore} from '../../stores/collage.js';
import {ensureFontStylesheet, FONTS, fontStack} from '../../lib/fonts.js';
import {STICKER_SETS, TEXT_COLORS, TEXT_STYLES} from '../../lib/overlays.js';
import RangeField from '../ui/RangeField.vue';
import SectionTitle from '../ui/SectionTitle.vue';

const store = useCollageStore();
const mode = ref('text');
const textarea = ref();

const overlay = computed(() => store.selectedOverlay);
const sizePct = computed({
    get: () => Math.round(overlay.value.size * 100),
    set: (v) => store.updateOverlay(overlay.value.id, {size: v / 100}),
});

onMounted(ensureFontStylesheet);

// 選到哪種疊加物件，就切到對應分頁
watch(overlay, (o) => {
    if (o) mode.value = o.kind === 'sticker' ? 'sticker' : 'text';
}, {immediate: true});

// 雙擊畫布上的文字、或剛新增文字時，直接把游標放進輸入框並全選
watch(() => store.editingOverlayId, async (id) => {
    if (!id) return;
    await nextTick();
    textarea.value?.focus();
    textarea.value?.select();
}, {immediate: true});

function addSticker(emoji) {
    store.addSticker(emoji);
}
</script>

<template>
    <div class="space-y-5">
        <div class="grid grid-cols-2 rounded-lg bg-desk p-1 text-[13px] font-medium" role="tablist">
            <button
                v-for="t in [{id: 'text', label: '文字'}, {id: 'sticker', label: '貼圖'}]"
                :key="t.id"
                type="button"
                role="tab"
                class="rounded-md py-1.5 transition-colors"
                :class="mode === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
                :aria-selected="String(mode === t.id)"
                @click="mode = t.id"
            >{{ t.label }}</button>
        </div>

        <!-- 文字 -->
        <template v-if="mode === 'text'">
            <button
                type="button"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 font-medium text-white transition-opacity hover:opacity-85"
                @click="store.addText()"
            >
                <PhTextAa :size="18" />
                新增文字
            </button>

            <div v-if="overlay?.kind === 'text'" class="space-y-5">
                <textarea
                    ref="textarea"
                    :value="overlay.text"
                    rows="2"
                    class="block w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 leading-snug outline-none focus:border-accent"
                    aria-label="文字內容"
                    @input="store.updateOverlay(overlay.id, {text: $event.target.value})"
                />

                <section>
                    <SectionTitle>字型</SectionTitle>
                    <div class="grid grid-cols-3 gap-2">
                        <button
                            v-for="f in FONTS"
                            :key="f.id"
                            type="button"
                            class="truncate rounded-lg border px-2 py-2 text-[15px] transition-colors"
                            :class="overlay.font === f.id ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line-strong'"
                            :style="{fontFamily: fontStack(f), fontWeight: f.weight}"
                            :aria-pressed="String(overlay.font === f.id)"
                            @click="store.updateOverlay(overlay.id, {font: f.id})"
                        >{{ f.label }}</button>
                    </div>
                </section>

                <section>
                    <SectionTitle>樣式</SectionTitle>
                    <div class="grid grid-cols-4 gap-2">
                        <button
                            v-for="s in TEXT_STYLES"
                            :key="s.id"
                            type="button"
                            class="rounded-lg border py-2 text-xs font-medium transition-colors"
                            :class="overlay.style === s.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-line-strong'"
                            :aria-pressed="String(overlay.style === s.id)"
                            @click="store.updateOverlay(overlay.id, {style: s.id})"
                        >{{ s.label }}</button>
                    </div>
                </section>

                <section>
                    <SectionTitle>顏色</SectionTitle>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="c in TEXT_COLORS"
                            :key="c"
                            type="button"
                            class="size-8 rounded-full border border-line ring-accent ring-offset-2 transition-shadow"
                            :class="overlay.color.toUpperCase() === c && 'ring-2'"
                            :style="{backgroundColor: c}"
                            :aria-label="`顏色 ${c}`"
                            @click="store.updateOverlay(overlay.id, {color: c})"
                        />
                        <label
                            class="relative size-8 cursor-pointer overflow-hidden rounded-full border border-line"
                            style="background: conic-gradient(#ff5a36, #ffc531, #18a76b, #2e55ff, #8b5cf6, #f06ba8, #ff5a36)"
                            title="自訂顏色"
                        >
                            <span class="sr-only">自訂文字顏色</span>
                            <input
                                type="color"
                                class="absolute inset-0 cursor-pointer opacity-0"
                                :value="overlay.color"
                                @input="store.updateOverlay(overlay.id, {color: $event.target.value})"
                            />
                        </label>
                    </div>
                </section>

                <RangeField v-model="sizePct" label="大小" :min="2" :max="40" />
            </div>
            <p v-else class="text-xs leading-relaxed text-ink-3">新增後可在畫布上拖曳移動，拉右下角把手縮放與旋轉，雙擊文字可直接修改。</p>
        </template>

        <!-- 貼圖 -->
        <template v-else>
            <section v-for="set in STICKER_SETS" :key="set.label">
                <SectionTitle>{{ set.label }}</SectionTitle>
                <div class="grid grid-cols-6 gap-1">
                    <button
                        v-for="e in set.items"
                        :key="e"
                        type="button"
                        class="grid aspect-square place-items-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-desk"
                        :aria-label="`加入貼圖 ${e}`"
                        @click="addSticker(e)"
                    >{{ e }}</button>
                </div>
            </section>
            <RangeField v-if="overlay?.kind === 'sticker'" v-model="sizePct" label="貼圖大小" :min="4" :max="60" />
        </template>

        <div v-if="overlay" class="flex gap-2 border-t border-line pt-4">
            <button
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[13px] text-ink-2 hover:bg-desk"
                @click="store.duplicateOverlay(overlay.id)"
            >
                <PhCopy :size="16" />複製
            </button>
            <button
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[13px] text-ink-2 hover:bg-desk"
                @click="store.bringToFront(overlay.id)"
            >
                <PhArrowLineUp :size="16" />移到最上層
            </button>
            <button
                type="button"
                class="grid w-10 place-items-center rounded-lg border border-line text-danger hover:bg-desk"
                aria-label="刪除"
                @click="store.removeOverlay(overlay.id)"
            >
                <PhTrash :size="16" />
            </button>
        </div>
    </div>
</template>
