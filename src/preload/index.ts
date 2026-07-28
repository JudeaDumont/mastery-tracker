import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { GRAPH_PERSISTENCE_CHANNELS } from '../shared/persistenceChannels'

const api = {
  graphPersistence: {
    load: (): Promise<unknown | null> => ipcRenderer.invoke(GRAPH_PERSISTENCE_CHANNELS.load),
    save: (document: unknown): Promise<void> =>
      ipcRenderer.invoke(GRAPH_PERSISTENCE_CHANNELS.save, document),
    getPath: (): Promise<string> => ipcRenderer.invoke(GRAPH_PERSISTENCE_CHANNELS.path)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
