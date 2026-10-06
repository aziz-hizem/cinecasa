import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { IpcResult, RemoteServerInfo } from '@shared/types'
import { getRemoteInfo, newPairingCode, unpairAll } from '../server/httpServer'

export function registerRemoteIpc(): void {
  ipcMain.handle(IPC.REMOTE_GET_INFO, (): IpcResult<RemoteServerInfo> => ({
    ok: true,
    data: getRemoteInfo(),
  }))

  ipcMain.handle(IPC.REMOTE_NEW_PAIRING_CODE, (): IpcResult<string> => ({
    ok: true,
    data: newPairingCode(),
  }))

  ipcMain.handle(IPC.REMOTE_UNPAIR_ALL, (): IpcResult<void> => {
    try {
      unpairAll()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}
