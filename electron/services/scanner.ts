import fs from 'node:fs'
import path from 'node:path'
import { isVideoFile } from './parser'

export interface ScannedFile {
  /** Absolute path to the file */
  path: string
  /** File size in bytes */
  size: number
  /** Parent dirs relative to the library root, immediate first, topmost last */
  parentDirs: string[]
  /** The library root this file lives under */
  rootPath: string
}

export async function scanDirectory(rootPath: string): Promise<ScannedFile[]> {
  const results: ScannedFile[] = []

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        let size = 0
        try {
          const st = await fs.promises.stat(full)
          size = st.size
        } catch {
          // ignore unreadable
        }
        const rel = path.relative(rootPath, full)
        const parts = rel.split(path.sep).slice(0, -1).reverse() // immediate parent first
        results.push({ path: full, size, parentDirs: parts, rootPath })
      }
    }
  }

  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
    await walk(rootPath)
  }
  return results
}
