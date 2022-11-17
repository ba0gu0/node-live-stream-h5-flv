
# node-live-stream-h5-flv

* 项目`node-live-stream-jsmpeg`是将任意流转换成rtsp，然后网页基于jsmpeg-player播放，发现这种视频编码格式会导致视频质量变的很差，因此研究了一下将视频转换成h264编码格式，同时基于flv进行流式播放，网页播放则基于mpegts.js进行(flv.js作者的新作品)
* 将任意的视频直播流转换成flv流, 并在浏览器中播放, 依赖于ffmpeg进行流转换.
* 项目基于`node-rtsp-stream`进行二次修改，使用ffmpeg可以将任意的直播类型转换成flv流，之后可以在网页上使用mpegts.js进行播放。
* 一般配合electron开发跨平台的看直播。
* [node-live-stream-h5-flv](https://www.github.com/ba0gu0/node-live-stream-h5-flv)

### Usage

```shell
yarn add node-live-stream-h5-flv
或者
npm install node-live-stream-h5-flv
```

* 此项目需要结合ffmpeg进行使用

* [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static)

```shell
yarn add ffmpeg-static
或者
npm install ffmpeg-static
```

### 结合electron使用

* 示例代码[ElectronVuevite](examples/ElectronApp/)
* 如果需要使用electron+vue+vite，可以使用模板进行创建，[electron-vite-vue](https://github.com/electron-vite/electron-vite-vue)
* electron main.js

```js
import { app, BrowserWindow, shell, ipcMain } from 'electron'
/**
 * 需要加载ffmpeg-static
 */
import ffmpegPath from "ffmpeg-static";
import LiveStream from "node-live-stream-h5-flv";
/**
 * electron 自带启动代码,参考默认的electron代码
 * @returns {Promise<void>}
 */
async function createWindow() {
    win = new BrowserWindow({
        title: 'Main window',
        icon: join(process.env.PUBLIC, 'favicon.ico'),
        webPreferences: {
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
    })
    // ........ 省略代码，参考electron官方
}
app.on('window-all-closed', () => {
    for (const liveOpender in liveOpenders) {
        try {
            liveOpenders[liveOpender].stream.stop()
        }catch (e) {
            console.log(e)
        }
    }
    liveOpenders = {}
    win = null
    if (process.platform !== 'darwin') app.quit()
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
```
* 网页代码`index.html`或者`app.vue`

* 在网页中播放,可以直接使用mpegts.js.
* [mpegts.js](https://github.com/xqq/mpegts.js)


```js
<script setup lang="ts">
    import { ref } from 'vue'
    import mpegts from 'mpegts.js';
    import {ipcRenderer} from 'electron'
    const rtspUrl = ref('')
    const mpegPlayer = ref()
    const msg = ref('')
    let player: any = null
    const vHeight = ref("680px")
    const vWidth = ref("1200px")
    const open = () => {
        const res = ipcRenderer.sendSync('openLiveStream', rtspUrl.value)
        if (res.code === 200) {
            player = mpegts.createPlayer({
              type: 'flv',  // could also be mpegts, m2ts, flv
              isLive: true,
              url: res.ws
            })
            player.attachMediaElement(mpegPlayer.value)
            player.load();
        }
        msg.value = res.msg
        // vHeight.value = res.videoSize.height + "px"
        // vWidth.value = res.videoSize.width + "px"
    }
    const close = () => {
        const res = ipcRenderer.sendSync('closeLiveStream', rtspUrl.value)
        player.destroy()
        msg.value = res.msg
    }
</script>

<template>
  <center>
    <div class="flexBox">
      <input type="text" v-model="rtspUrl">
      <button @click="open">打开直播流</button>
      <button @click="close">关闭直播流</button>
    </div>

    <video class="mpegPlayer" controls ref="mpegPlayer"></video>
    <div>{{msg}}</div>
  </center>
</template>

<style>
* {
  padding: 0;
  margin: 0;
}
.flexBox {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
}
.flexBox input  {
  height: 30px;
  width: 500px;
  box-sizing: border-box;
  padding-left: 8px;
}
.flexBox button {
  height: 30px;
  padding: 0 12px;
}
.mpegPlayer {
  width: v-bind(vWidth);
  height: v-bind(vHeight);
  background: #ccc;
}
</style>
```

### 单App ES6标准使用

* 示例代码[NodeApp](./examples/NodeApp/)
* Node应用 wsplay.mjs
* npm install && npm run dev

```js
import LiveStream from '../../dist/node-live-stream-h5-flv.mjs';
import ffmpegPath from "ffmpeg-static";
import c from 'child_process'
import * as httpServer from 'http-server'

const wsPort = 64321;
const httpPort = 64320;
const liveUrl = process.argv.slice(2)[0]

if (!liveUrl) {
    console.log(`Error 请输入直播流地址. \nUsage: \nnode ${process.argv.slice(1)[0]} rtmp://ns8.indexforce.com/home/mystream`)
    process.exit()
}

console.log('开始测试...')
const stream = new LiveStream({
    ffmpegPath: ffmpegPath,
    streamUrl: liveUrl,
    wsPort: wsPort,
    printFFmpegStdout: false
});

console.log('启动网页服务...')
const server = httpServer.createServer()
server.listen(httpPort, '127.0.0.1')

console.log(`ws地址为: ws://127.0.0.1:${wsPort}, 正在为你打开视频流,请稍等...`)

stream.once('getStreamInfoError' || "forwardStreamExit", () => {
    console.log('直播流打开失败, 请检查网络和视频流地址是否正确.')
    process.exit()
});


stream.once('forwardStreamSuccess', (data) => {
    console.log(`视频流打开成功, 视频信息为: ${JSON.stringify(data)}\n浏览器中打开地址"http://127.0.0.1:${httpPort}/play", 进行观看.`)
    console.log('启动浏览器进行播放...')
    const cmd = (process.platform==='win32') ?  `start http://127.0.0.1:${httpPort}/play` : `open http://127.0.0.1:${httpPort}/play.html`
    c.exec(cmd)
});

stream.once("forwardStreamExit", ()=>{
    console.log("视频流转发出现问题, 尝试重新进行视频流转发.")
    stream.start()
})



```