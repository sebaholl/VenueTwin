import { defineConfig, loadEnv } from 'vite'
import { studioPilotPlugin } from './server/studioPilot'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return ({
  plugins: [react(), studioPilotPlugin({ apiKey: env.OPENAI_API_KEY ?? '', model: env.OPENAI_MODEL ?? 'gpt-5-mini' })],
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production',
  },
})
})
