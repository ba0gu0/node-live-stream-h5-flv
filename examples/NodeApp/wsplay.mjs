import LiveStream from 'node-live-stream-h5-flv';
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


