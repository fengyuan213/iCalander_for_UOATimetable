import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [
        svelte(),
        viteStaticCopy({
            targets: [
                {
                    src: 'manifest.json',
                    dest: './'
                },
                {
                    src: 'icons/*',
                    dest: './icons/'
                }
            ]
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: path.resolve(__dirname, 'src/popup/index.html'),
                background: path.resolve(__dirname, 'src/background/background.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    return chunkInfo.name === 'background' || chunkInfo.name === 'content'
                        ? '[name].js'
                        : 'assets/[name].[hash].js';
                },
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'popup.html') {
                        return '[name]';
                    }
                    return 'assets/[name].[hash].[ext]';
                }
            }
        }
    }
}); 