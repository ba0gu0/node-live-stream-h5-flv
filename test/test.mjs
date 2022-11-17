import LiveStream from '../src/index.mjs';
import assert from 'assert';
import ffmpegPath from "ffmpeg-static"
let testStreamUrl = "rtmp://ns8.indexforce.com/home/mystream"

const wsPort = Math.floor(Math.random()*(1 - 100) + 100) + 64000

describe('node-live-stream-h5-flv', function() {
    return it('should not throw an error when instantiated', function(done) {
        const stream = new LiveStream({
            streamUrl: testStreamUrl,
            wsPort: wsPort,
            ffmpegPath: ffmpegPath,
            printFFmpegStdout: false
        });
        stream.on("getStreamInfoError", ()=>{
            assert.fail('获取视频流信息失败，检查地址信息');
            return done();
        })
        stream.on("getStreamInfoSuccess", (data)=>{
            console.log("获取视频流信息成功.", data)
        })
        stream.once('forwardStreamExit', () => {
            stream.stop();
            assert.fail('转发视频流失败。');
            return done();
        });
        stream.once('forwardStreamSuccess', (data) => {
            console.log(`转发视频流成功，视频流信息为: ${JSON.stringify(data)}, 访问地址为: ws://127.0.0.1:${wsPort}`)
            stream.stop();
            return done();
        });
    });
});
