import {PhExport, PhHandGrabbing, PhSliders, PhSparkle, PhSquaresFour, PhTextAa} from '@phosphor-icons/vue';
import {canShareFiles, isIOS, isTouch, modKey} from './platform.js';

/**
 * 使用導覽的章節與步驟。
 * 每一步可以帶 prepare（切面板、選格子），導覽會先做完、等過場結束才亮起目標。
 * when 回傳 false 的步驟會略過，例如還沒放照片時不介紹照片工具列。
 */

export const CHAPTERS = [
    {id: 'start', title: '開始使用', desc: '畫布、加入照片、照片匣', icon: PhSparkle},
    {id: 'layout', title: '版型與邊框', desc: '換版型、拖分隔線、比例與背景', icon: PhSquaresFour},
    {id: 'cell', title: '調整照片', desc: '移動縮放、旋轉角度、交換格子', icon: PhHandGrabbing},
    {id: 'tone', title: '濾鏡與調色', desc: '濾鏡、細部調整、一鍵套用', icon: PhSliders},
    {id: 'decor', title: '文字與貼圖', desc: '加字、貼圖、移動縮放旋轉', icon: PhTextAa},
    {id: 'export', title: '匯出與儲存', desc: '復原重做、尺寸格式、存到相片', icon: PhExport},
];

export const CHAPTER_IDS = CHAPTERS.map((c) => c.id);

const compact = () => window.matchMedia('(max-width: 1023px)').matches;
const $ = (selector) => document.querySelector(selector);
const list = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const alt = modKey === '⌘' ? '⌥ Option' : 'Alt';

function chapterSteps(id, store) {
    const touch = isTouch();
    const photoIndex = store.doc.cells.findIndex((c) => c.photoId);
    const hasPhoto = photoIndex >= 0;
    const photoCell = () => (hasPhoto && $(`[data-cell="${photoIndex}"]`)) || $('[data-tour="stage"]');
    const openTool = (tool) => () => {
        store.activeTool = tool;
    };

    switch (id) {
        case 'start':
            return [
                {
                    element: '[data-tour="stage"]',
                    title: '這是你的畫布',
                    body: touch
                        ? '點任一個空格就能從相簿挑照片，一次選多張會自動依序填滿。<br>照片只在這台裝置上處理，不會上傳。'
                        : `點空格選檔、把照片拖進來，或直接 <kbd>${modKey}</kbd> <kbd>V</kbd> 貼上；一次多張會自動依序填滿。<br>照片只在這台裝置上處理，不會上傳。`,
                    prepare: () => store.clearSelection(),
                },
                {
                    element: '[data-tour="panel"]',
                    title: '照片匣',
                    body: '加入過的照片都放在這裡。點一下放進選取的格子，或拖到想放的格子上；縮圖上的數字是它在第幾格。',
                    prepare: openTool('photos'),
                },
                {
                    element: '[data-tour="tools"]',
                    title: '工具列',
                    body: list(['<b>版型</b>：格數與排列', '<b>邊框</b>：畫布比例、外框、背景色', '<b>調色</b>：濾鏡與亮度色溫', '<b>文字貼圖</b>：加字與表情符號'])
                        + (touch ? '再點一次目前的分頁，或按「收起」，可以把面板收起來看大圖。' : ''),
                },
            ];

        case 'layout':
            return [
                {
                    element: '[data-tour="panel"]',
                    title: '選擇版型',
                    body: '1 到 9 格共 30 種版型。換版型時照片會留著，依序填進新的格子。',
                    prepare: openTool('layout'),
                },
                {
                    element: () => $('.divider-hit'),
                    when: () => Boolean($('.divider-hit')),
                    title: '拖曳分隔線',
                    body: '格子之間的把手可以拖曳，自由調整比例。想恢復等分，到版型面板按「還原等分」。',
                },
                {
                    element: '[data-tour="panel"]',
                    title: '比例、邊框與背景',
                    body: '換畫布比例（IG 貼文 4:5、限動 9:16…），調整外框、格線間距、圓角，再挑一個背景色。',
                    prepare: openTool('frame'),
                },
            ];

        case 'cell':
            return [
                {
                    element: photoCell,
                    title: hasPhoto ? '移動與縮放' : '放進照片後可以這樣調整',
                    body: touch
                        ? list(['<b>單指拖曳</b>：移動照片位置', '<b>雙指捏合</b>：放大縮小', '<b>雙指轉動</b>：旋轉任意角度，接近直角會自動吸附', '<b>點兩下</b>：回到置中填滿'])
                        : list(['<b>拖曳</b>：移動照片位置', '<b>滾輪 / 觸控板捏合</b>：放大縮小', `<kbd>${alt}</kbd> + <b>滾輪</b>：旋轉角度`, '<b>點兩下</b>：回到置中填滿']),
                    prepare: () => {
                        store.clearSelection();
                        // 手機上先收起面板，舞台大一點比較好示範
                        if (compact()) store.activeTool = undefined;
                    },
                },
                {
                    element: photoCell,
                    when: () => hasPhoto && store.doc.cells.length > 1,
                    title: '交換兩格照片',
                    body: '按住照片拖出格子，移到另一格上放開，兩格的照片就會互換。',
                },
                {
                    element: '[data-tour="cell-toolbar"]',
                    when: () => hasPhoto,
                    title: '照片工具列',
                    body: '點選照片會跳出工具列：換照片、旋轉、左右 / 上下翻轉、重設位置、調色，以及從格子移除。',
                    prepare: () => {
                        store.rotateRuler = false;
                        store.select({type: 'cell', index: photoIndex});
                    },
                },
                {
                    element: '[data-tour="cell-toolbar"]',
                    when: () => hasPhoto,
                    title: '旋轉角度',
                    body: '拖曳角度尺，左右各可微調 45°；兩側按鈕一次轉 90°，點「歸零」轉回原本方向。轉動時格子上會出現三分線，方便把地平線拉正。',
                    prepare: () => {
                        store.select({type: 'cell', index: photoIndex});
                        store.rotateRuler = true;
                    },
                },
            ];

        case 'tone':
            return [
                {
                    element: '[data-tour="panel"]',
                    title: '濾鏡與調色',
                    body: `${hasPhoto ? '' : '先點選一格照片，'}挑一個濾鏡，或拉滑桿微調亮度、對比、飽和度、色溫與褪色。調好後按「套用到全部照片」，整組色調就一致了。`,
                    prepare: () => {
                        if (hasPhoto) store.select({type: 'cell', index: photoIndex});
                        store.activeTool = 'tone';
                    },
                },
            ];

        case 'decor':
            return [
                {
                    element: '[data-tour="panel"]',
                    title: '文字與貼圖',
                    body: '「新增文字」後直接輸入，可以換字型、顏色與樣式；切到「貼圖」分頁挑表情符號。',
                    prepare: () => {
                        store.clearSelection();
                        store.activeTool = 'decor';
                    },
                },
                {
                    element: '[data-tour="stage"]',
                    title: '在畫面上擺放',
                    body: `拖曳文字或貼圖移動位置，右下角的把手可以縮放、旋轉。${touch ? '選取後面板裡有複製、移到最上層與刪除。' : '選取後按 <kbd>Delete</kbd> 刪除，方向鍵微調位置。'}`,
                    prepare: () => {
                        if (compact()) store.activeTool = undefined;
                    },
                },
            ];

        case 'export':
            return [
                {
                    element: '[data-tour="history"]',
                    title: '復原與重做',
                    body: `每個步驟都能復原${touch ? '' : `（<kbd>${modKey}</kbd> <kbd>Z</kbd>／<kbd>⇧</kbd> <kbd>${modKey}</kbd> <kbd>Z</kbd>）`}。作品會自動存在這台裝置上，關掉頁面再回來也還在。`,
                },
                {
                    element: '[data-tour="export"]',
                    title: '匯出圖片',
                    body: '選擇 1080 / 2K / 4K 與 JPG / PNG。'
                        + (isIOS && canShareFiles()
                            ? '<br>在 iPhone 上按<b>「儲存到相片」</b>，再從分享選單點<b>「儲存影像」</b>，圖片就會存進「照片」App。'
                            : canShareFiles() ? '<br>也可以直接分享到其他 App。' : ''),
                },
            ];

        default:
            return [];
    }
}

const helpStep = {
    element: '[data-tour="help"]',
    title: '隨時重看導覽',
    body: '點這裡可以挑章節重看，還有一份手勢速查。',
};

/** 依章節組出要跑的步驟；含「開始使用」或完整導覽時，最後提醒去哪裡重看 */
export function buildTourSteps(store, chapterIds) {
    const steps = [];
    for (const id of chapterIds) {
        const chapter = CHAPTERS.find((c) => c.id === id);
        for (const step of chapterSteps(id, store)) {
            if (step.when && !step.when()) continue;
            steps.push({...step, chapter: chapter.title});
        }
    }
    if (chapterIds.includes('start')) steps.push({...helpStep, chapter: '小提醒'});
    return steps;
}
