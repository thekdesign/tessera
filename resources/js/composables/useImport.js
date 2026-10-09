import {useCollageStore} from '../stores/collage.js';
import {useToast} from './useToast.js';

export function useImport() {
    const store = useCollageStore();
    const {toast} = useToast();

    async function addFiles(files, targetIndex) {
        const images = [...files].filter((f) => !f.type || f.type.startsWith('image/'));
        if (!images.length) return;
        const {photos, failed} = await store.addFiles(images, targetIndex);
        if (failed) {
            toast(`${failed} 張無法讀取，可能是瀏覽器不支援的格式（例如 HEIC）`, {tone: 'error', duration: 4000});
        } else if (photos.length > 1) {
            toast(`已加入 ${photos.length} 張照片`);
        }
    }

    /** 開啟系統選檔視窗；必須在使用者點擊的事件中呼叫 */
    function pickFiles(targetIndex, {multiple = true} = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = multiple;
        input.onchange = () => addFiles(input.files, targetIndex);
        input.click();
    }

    return {addFiles, pickFiles};
}
