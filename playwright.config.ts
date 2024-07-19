import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PlaywrightTestConfig } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = path.resolve(__dirname, './playground')
const port = 8080

const config: PlaywrightTestConfig = {
  testDir: 'tests',
  webServer: {
    command: `npx http-server ${root} -p ${port} -s`,
    port,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
    },
  }],
}

export default config
