import {useCollageStore} from '../stores/collage.js';
import {useToast} from './useToast.js';
import {isMediaFile} from '../lib/photos.js';

export function useImport() {
    const store = useCollageStore();
    const {toast} = useToast();

    async function addFiles(files, targetIndex) {
        const media = [...files].filter(isMediaFile);
        if (!media.length) return;
        const {photos, failed} = await store.addFiles(media, targetIndex);
        if (failed) {
            toast(`${failed} 個檔案無法讀取，可能是瀏覽器不支援的格式（例如 HEIC、HEVC 影片）`, {tone: 'error', duration: 4000});
        } else if (photos.length > 1) {
            toast(`已加入 ${photos.length} 個檔案`);
        }
    }

    /** 開啟系統選檔視窗；必須在使用者點擊的事件中呼叫 */
    function pickFiles(targetIndex, {multiple = true} = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.multiple = multiple;
        input.onchange = () => addFiles(input.files, targetIndex);
        input.click();
    }

    return {addFiles, pickFiles};
}
