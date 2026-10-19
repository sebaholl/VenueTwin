import { build } from 'vite'
await build({ configFile: false, publicDir: false, build: { ssr: 'server/main.ts', outDir: 'dist-server', target: 'node22', sourcemap: false, rollupOptions: { output: { entryFileNames: 'main.mjs' } } } })
