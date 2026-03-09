import { readdirSync, readFileSync } from 'node:fs'
import { extname, basename, join } from 'node:path'

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.gitignore',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.nojekyll',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

const decoder = new TextDecoder('utf-8', { fatal: true })

const SKIP_DIRECTORIES = new Set([
  '.git',
  'dist',
  'node_modules',
])

const collectFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue
      }
      files.push(...collectFiles(join(directory, entry.name)))
      continue
    }

    files.push(join(directory, entry.name))
  }

  return files
}

const candidateFiles = collectFiles(process.cwd()).map((file) => file.replaceAll('\\', '/'))

const textFiles = candidateFiles.filter((file) => {
  const ext = extname(file)
  const name = basename(file)
  return TEXT_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(name)
})

const failures = []

for (const file of textFiles) {
  const bytes = readFileSync(file)
  const hasUtf8Bom = bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf

  try {
    decoder.decode(bytes)
  } catch {
    failures.push(`${file}: not valid UTF-8`)
    continue
  }

  if (hasUtf8Bom) {
    failures.push(`${file}: UTF-8 BOM detected`)
  }
}

if (failures.length) {
  console.error('Encoding check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Encoding OK: ${textFiles.length} tracked text files are UTF-8 without BOM.`)
