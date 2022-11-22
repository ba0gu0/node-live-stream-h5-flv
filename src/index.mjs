import EventEmitter from "events";
import {makeGetStreamInfoFFmpegCmd, makeForwardStreamFFmpegCmd} from "./makeFFmpegCmd.mjs"
import GetStreamInfo from "./getStreamInfo.mjs"
import FFmpegForwardStream from "./ffmpegForwardStream.mjs"
import WebSocket, { WebSocketServer } from 'ws';

const STREAM_MAGIC_BYTES = 'rtsp'

export default class LiveStream extends EventEmitter {
    constructor(options) {
        super();
        this.ffmpegPath = options.ffmpegPath
        // 视频流地址
        this.streamUrl = options.streamUrl
        // 强制设置转发时开启的websocket地址和端口
        this.wsHost = options.wsHost ? options.wsPort : "127.0.0.1"
        this.wsPort = options.wsPort ? options.wsPort : Math.floor(Math.random()*(1 - 100) + 100) + 64000

        // 强制设置输出视频流的分辨率
        this.setWidth = options.width
        this.setHeight = options.height
         // 强制设置输出视频流的fps帧数
        this.setFps = options.fps
        // 强制设置输出视频流的码率
        this.setBits = options.bits

        this.forwardStream = undefined
        this.streamBuffer = undefined

        this.streamInfo = {}
        this.printFFmpegStdout = options.printFFmpegStdout === false ? options.printFFmpegStdout : true
        this.start()
    }

    start(){
        const getInfoCommandArgs = makeGetStreamInfoFFmpegCmd(this.streamUrl)
        new GetStreamInfo(this.ffmpegPath, getInfoCommandArgs, this.printFFmpegStdout)
            .on("getStreamInfoExit", (data)=>{
                if (!data.fps){
                    // console.log("index.mjs", "获取直播流信息失败.")
                    this.emit("getStreamInfoError")
                    return false
                }else {
                    // console.log("index.mjs", "获取直播流信息成功.", data)
                    this.streamInfo = data
                    this.emit("getStreamInfoSuccess", data)
                }
                const forwardStreamCommandArgs = makeForwardStreamFFmpegCmd(this)
                this.forwardStream = new FFmpegForwardStream(this.ffmpegPath, forwardStreamCommandArgs, this.printFFmpegStdout)
                this.forwardStream
                    .on("forwardStreamExit", ()=>{
                        // console.log("index.mjs", "转发视频流失败")
                        this.stop()
                        this.emit("forwardStreamExit")
                    })
                    .once("forwardStreamSuccess", (data)=>{
                        // console.log("index.mjs", "转发视频流成功", `访问地址为: ws://${this.wsHost}:${this.wsPort}`)
                        this.streamBuffer = data
                        this.emit("forwardStreamSuccess", this.streamInfo)
                    })
                this.pipeStreamToSocketServer()
            })
    }

    stop(){
        console.log("index.mjs", "停止所有")
        if (this.forwardStream){
            this.forwardStream.removeAllListeners()
            this.forwardStream.child.kill()
        }
        if (this.wsServer) this.wsServer.close()
    }

    pipeStreamToSocketServer() {
        this.wsServer = new WebSocketServer({
            host: this.wsHost,
            port: this.wsPort
        })
        this.wsServer.on("connection", (socket) => {
            let buffer = false
            while (!buffer){
                if (this.streamBuffer) buffer = true
                socket.send(this.streamBuffer, {
                    binary: true
                })
            }

        })
        this.forwardStream.on('forwardStreamSuccess', (data) => {
            this.wsServer.clients.forEach((client) =>{
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data, { binary: true });
                }
            });
        })
    }

}

