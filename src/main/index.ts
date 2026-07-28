import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { GRAPH_PERSISTENCE_CHANNELS } from '../shared/persistenceChannels'
import icon from '../../resources/icon.png?asset'

const GRAPH_STATE_FILENAME = 'mastery-graph.json'
let graphSaveQueue: Promise<void> = Promise.resolve()

function graphStatePath(): string {
  return join(app.getPath('userData'), GRAPH_STATE_FILENAME)
}

async function loadGraphState(): Promise<unknown | null> {
  const filePath = graphStatePath()

  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch (error) {
    if (isMissingFile(error)) return null

    if (error instanceof SyntaxError) {
      const corruptPath = `${filePath}.corrupt-${Date.now()}`
      await rename(filePath, corruptPath).catch(() => undefined)
      console.error(`Invalid graph state moved to ${corruptPath}`, error)
      return null
    }

    throw error
  }
}

async function saveGraphState(document: unknown): Promise<void> {
  const filePath = graphStatePath()
  const tempPath = `${filePath}.tmp`
  const backupPath = `${filePath}.backup`

  await mkdir(app.getPath('userData'), { recursive: true })

  try {
    await copyFile(filePath, backupPath)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  await writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

  try {
    await rename(tempPath, filePath)
  } catch {
    await rm(filePath, { force: true })
    await rename(tempPath, filePath)
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}

function registerGraphPersistence(): void {
  ipcMain.handle(GRAPH_PERSISTENCE_CHANNELS.load, loadGraphState)
  ipcMain.handle(GRAPH_PERSISTENCE_CHANNELS.save, (_event, document: unknown) => {
    graphSaveQueue = graphSaveQueue.catch(() => undefined).then(() => saveGraphState(document))
    return graphSaveQueue
  })
  ipcMain.handle(GRAPH_PERSISTENCE_CHANNELS.path, () => graphStatePath())
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#050814',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  registerGraphPersistence()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
