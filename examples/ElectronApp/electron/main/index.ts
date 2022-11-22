// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'os'
import { join } from 'path'

import ffmpegPath from "ffmpeg-static";
import LiveStream from "node-live-stream-h5-flv"

/**
 stream相关配置及方法
 streamUrl = options.streamUrl
 setWidth = options.width
 setHeight = options.height
 wsPort = options.wsPort
 stream = undefined
 ffmpegPath = options.ffmpegPath ? ffmpeg
 printFFmpegOutput = options.printFFmpegOutput ? true
 stop()
 */


const streamOpenders :any = {};

/**
 * rtsp列表
 * interface {
 *   rtspUrl: {
 *     ws: websocket地址
 *     stream: stream实例
 *   }
 * }
 */

// console.log(ffmpegPath);
// console.log(VideoStream);


// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
    win = new BrowserWindow({
        width: 1366,
        height: 768,
        title: 'App',
        icon: join(process.env.PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
    })
    win.maximize()
    if (process.env.VITE_DEV_SERVER_URL) { // ElectronApp#298
        win.loadURL(url)
        // Open devTool if the app is not packaged
        win.webContents.openDevTools()
    } else {
        win.loadFile(indexHtml)
    }

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return { action: 'deny' }
    })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    for (const rtspOpender in streamOpenders) {
        try {
            streamOpenders[rtspOpender].stream.stop()
        }catch (e) {
            console.log(e)
        }
    }
    win = null
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        allWindows[0].focus()
    } else {
        createWindow()
    }
})

// new window example arg: new windows url
ipcMain.handle('open-win', (event, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
    })

    if (app.isPackaged) {
        childWindow.loadFile(indexHtml, { hash: arg })
    } else {
        childWindow.loadURL(`${url}#${arg}`)
        // childWindow.webContents.openDevTools({ mode: "undocked", activate: true })
    }
})

/**
 * 开启live stream
 * @param liveUrl {String} 直播流地址
 */
ipcMain.on('openLiveStream', (event, liveUrl) => {
    const wsPort = Math.floor(Math.random()*(1 - 100) + 100) + 64000;
    if (streamOpenders[liveUrl]) {
        event.returnValue = {
            code: 200,
            msg: '开启成功',
            ws: streamOpenders[liveUrl].ws,
            videoSize: streamOpenders[liveUrl].videoSize
        }
    } else {
        const stream = new LiveStream({
            streamUrl: liveUrl,
            wsPort: wsPort,
            ffmpegPath: app.isPackaged ? ffmpegPath.replace('app.asar', 'app.asar.unpacked') : ffmpegPath,
            // printFFmpegStdout: false
        })
            .on('getStreamInfoError' || "forwardStreamExit", () => {
                console.log("打开视频流失败，请检查网络和视频流地址.")
                stream.stop()
                delete streamOpenders[liveUrl]
                event.returnValue = {
                    code: 400,
                    msg: '开启失败'
                }
            })
            .once('forwardStreamSuccess', (data) => {
                console.log(`打开视频流成功，视频信息: ${JSON.stringify(data)}`)
                streamOpenders[liveUrl] = {
                    ws: `ws://localhost:${wsPort}`,
                    stream: stream,
                    videoSize: data
                }
                event.returnValue = {
                    code: 200,
                    msg: '开启成功',
                    ws: streamOpenders[liveUrl].ws,
                    videoSize: data
                }
            })
    }
})

/**
 * 关闭live stream
 * @param liveUrl {String} 直播流地址
 */
ipcMain.on('closeLiveStream', (event, liveUrl) => {
    if (streamOpenders[liveUrl]) {
        // 停止解析
        streamOpenders[liveUrl].stream.stop()
        // 删除该项
        delete streamOpenders[liveUrl]
        // 返回结果
        event.returnValue = {
            code: 200,
            msg: '关闭成功'
        }
    } else {
        event.returnValue = {
            code: 400,
            msg: `未找到该${liveUrl}`
        }
    }
})