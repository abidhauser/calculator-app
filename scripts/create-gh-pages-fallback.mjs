import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const distDir = resolve(projectRoot, 'dist')
const indexHtml = resolve(distDir, 'index.html')
const fallbackHtml = resolve(distDir, '404.html')

await mkdir(distDir, { recursive: true })
await copyFile(indexHtml, fallbackHtml)

console.log('Created GitHub Pages SPA fallback: dist/404.html')
