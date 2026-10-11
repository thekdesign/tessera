import {nextTick, ref} from 'vue';
import {driver} from 'driver.js';
import 'driver.js/dist/driver.css';
import {useCollageStore} from '../stores/collage.js';
import {buildTourSteps, CHAPTER_IDS} from '../lib/tour.js';
import {reducedMotion} from '../lib/motion.js';

/**
 * 使用導覽：用 driver.js 亮起目標、顯示說明。
 * 「看過哪些章節」只是給章節清單打勾用的便利資訊，存 localStorage 就好，讀不到也不影響使用。
 */

const SEEN_KEY = 'tessera:tour-seen';

function readSeen() {
    try {
        return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

const seen = ref(readSeen());
const running = ref(false);

function markSeen(ids) {
    seen.value = new Set([...seen.value, ...ids]);
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.value]));
    } catch {
        // 私密瀏覽等情況寫不進去，下次會再自動播一次導覽，可以接受
    }
}

// 切面板、選格子之後，等面板過場（約 300ms）結束再亮起，框才不會對到移動中的元素
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 40 : ms));

export function useTour() {
    const store = useCollageStore();

    const uiSnapshot = () => JSON.stringify([store.activeTool, store.selection, store.rotateRuler]);

    function start(chapterIds = CHAPTER_IDS) {
        if (running.value) return;
        const steps = buildTourSteps(store, chapterIds);
        if (!steps.length) return;
        running.value = true;

        let moving = false;
        const tour = driver({
            steps: steps.map((s) => ({
                element: s.element,
                popover: {title: s.title, description: s.body, side: s.side, align: s.align || 'center'},
            })),
            animate: !reducedMotion(),
            showProgress: steps.length > 1,
            progressText: '{{current}} / {{total}}',
            nextBtnText: '下一步',
            prevBtnText: '上一步',
            doneBtnText: '完成',
            popoverClass: 'tour-pop',
            overlayColor: '#111318',
            overlayOpacity: 0.5,
            stagePadding: 6,
            stageRadius: 12,
            // 導覽中點到畫面不會誤改作品
            disableActiveInteraction: true,
            onPopoverRender: (popover, {index}) => {
                const eyebrow = document.createElement('span');
                eyebrow.className = 'tour-eyebrow';
                eyebrow.textContent = steps[index]?.chapter || '';
                popover.title.prepend(eyebrow);
                popover.closeButton.setAttribute('aria-label', '關閉導覽');
            },
            onNextClick: () => go((tour.getActiveIndex() ?? -1) + 1),
            onPrevClick: () => go((tour.getActiveIndex() ?? 1) - 1),
            onDestroyed: () => {
                running.value = false;
                markSeen(chapterIds);
            },
        });

        async function go(index) {
            if (moving || index < 0) return;
            if (index >= steps.length) {
                tour.destroy();
                return;
            }
            const step = steps[index];
            moving = true;
            const popover = tour.getState('popover')?.wrapper;
            try {
                if (step.prepare) {
                    const before = uiSnapshot();
                    step.prepare();
                    // 面板或選取真的有變才等過場，否則立刻前往下一步
                    if (uiSnapshot() !== before) {
                        popover?.classList.add('tour-wait');
                        await nextTick();
                        await settle(340);
                    }
                }
            } finally {
                moving = false;
                popover?.classList.remove('tour-wait');
            }
            // 等待中使用者可能已經按了關閉
            if (index > 0 && !tour.isActive()) return;
            if (index === 0) tour.drive(0);
            else tour.moveTo(index);
        }

        go(0);
    }

    return {seen, running, start};
}
