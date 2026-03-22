import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [plugin(), tailwindcss()],
    define: {
        __FUSIONAUTH_URL__: JSON.stringify('http://localhost:9011'),
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        port: 3001,
        host: '0.0.0.0',
    }
})
