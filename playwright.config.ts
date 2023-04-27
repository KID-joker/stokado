import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PlaywrightTestConfig } from '@playwright/test'
import { serve } from 'serve-then'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const baseURL = await serve({
  root: path.resolve(__dirname, './playground'),
  open: false,
})

const config: PlaywrightTestConfig = {
  testDir: 'tests',
  use: {
    baseURL,
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
    },
  }],
}

export default config
