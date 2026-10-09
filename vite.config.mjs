import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwind from '@tailwindcss/vite';
import {VitePWA} from 'vite-plugin-pwa';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = (p) => path.resolve(__dirname, p);

// 沿用 project-common 的 root=resources/js 慣例；純前端、無後端
export default defineConfig({
    root: 'resources/js',
    base: '/',
    publicDir: r('resources/js/public'),
    plugins: [
        vue(),
        tailwind(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'Tessera 組圖',
                short_name: 'Tessera',
                description: '把多張照片拼成一張圖，照片只在你的裝置上處理。',
                lang: 'zh-Hant',
                theme_color: '#F4F5F7',
                background_color: '#F4F5F7',
                display: 'standalone',
                icons: [
                    {src: 'icon-192.png', sizes: '192x192', type: 'image/png'},
                    {src: 'icon-512.png', sizes: '512x512', type: 'image/png'},
                    {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts',
                            expiration: {maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365},
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            css: r('resources/css'),
        },
    },
    server: {
        port: 8088,
        host: '0.0.0.0',
        strictPort: true,
    },
    build: {
        outDir: r('dist'),
        emptyOutDir: true,
    },
    test: {
        root: '.',
        include: ['resources/js/**/*.test.js'],
    },
});
