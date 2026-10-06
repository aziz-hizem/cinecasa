import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import { IPC } from '@shared/ipc-channels'
import type { AppSettings, IpcResult, LibraryRoot, LibraryRootType, SpecialKind } from '@shared/types'
import { libraryRootsRepo, settingsRepo } from '../db/queries'
import { clearImageCache, getImageCacheDir } from '../services/imageCache'
import { startRemoteServer } from '../server/httpServer'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    try {
      return ok(settingsRepo.getAll())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    IPC.SETTINGS_SET,
    async (_evt, key: keyof AppSettings, value: string | number | boolean) => {
      try {
        const before = settingsRepo.getAll()[key]
        settingsRepo.set(key, value)
        // Restart only on a real change — Save Settings writes every field.
        if ((key === 'remoteEnabled' || key === 'remotePort') && settingsRepo.getAll()[key] !== before) {
          await startRemoteServer()
        }
        if (key === 'launchAtLogin') {
          // Starts hidden in the tray so the tablet can stream as soon as the PC is on.
          app.setLoginItemSettings({ openAtLogin: value === true, args: ['--hidden'] })
        }
        return ok(undefined)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(IPC.SETTINGS_BROWSE_FOLDER, async (evt) => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender)
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return ok<string | null>(null)
      return ok<string | null>(result.filePaths[0])
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    IPC.SETTINGS_BROWSE_FILE,
    async (evt, filters?: Electron.FileFilter[]) => {
      try {
        const win = BrowserWindow.fromWebContents(evt.sender)
        const result = await dialog.showOpenDialog(win!, {
          properties: ['openFile'],
          filters: filters ?? [],
        })
        if (result.canceled || result.filePaths.length === 0)
          return ok<string | null>(null)
        return ok<string | null>(result.filePaths[0])
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(IPC.SETTINGS_OPEN_DATA_DIR, () => {
    try {
      shell.openPath(app.getPath('userData'))
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.SETTINGS_OPEN_CACHE_DIR, () => {
    try {
      shell.openPath(getImageCacheDir())
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.SETTINGS_CLEAR_CACHE, () => {
    try {
      clearImageCache()
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_ROOTS_LIST, () => {
    try {
      return ok<LibraryRoot[]>(libraryRootsRepo.list())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    IPC.LIBRARY_ROOTS_ADD,
    (_evt, rootPath: string, type: LibraryRootType) => {
      try {
        if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
          return fail(new Error(`Folder does not exist: ${rootPath}`))
        }
        const created = libraryRootsRepo.add(rootPath, type)
        return ok(created)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    IPC.LIBRARY_ROOTS_ADD_SPECIAL,
    (_evt, rootPath: string, type: LibraryRootType, specialKind: SpecialKind) => {
      try {
        if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
          return fail(new Error(`Folder does not exist: ${rootPath}`))
        }
        const created = libraryRootsRepo.addSpecial(rootPath, type, specialKind)
        return ok(created)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(IPC.LIBRARY_ROOTS_REMOVE, (_evt, id: number) => {
    try {
      libraryRootsRepo.remove(id)
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })
}
