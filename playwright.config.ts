import type { PlaywrightTestConfig } from '@playwright/test'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const root = path.resolve(__dirname, './playground')
const port = 8080

const config: PlaywrightTestConfig = {
  testDir: 'tests',
  webServer: {
    command: `npx http-server ${root} -p ${port} --cors`,
    port,
    reuseExistingServer: !process.env.CI,
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
