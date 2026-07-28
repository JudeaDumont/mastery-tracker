import { ElectronAPI } from '@electron-toolkit/preload'

interface GraphPersistenceApi {
  load: () => Promise<unknown | null>
  save: (document: unknown) => Promise<void>
  getPath: () => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      graphPersistence: GraphPersistenceApi
    }
  }
}
