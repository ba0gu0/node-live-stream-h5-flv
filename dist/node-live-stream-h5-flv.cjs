'use strict';

var EventEmitter = require('events');
var child_process = require('child_process');
var WebSocket = require('ws');

const makeGetStreamInfoFFmpegCmd =  (streamUrl) => {
    /**
     * 生成ffmpeg命令
     * @param streamUrl {String} 需要提供视频流的地址
     * @return Command {Array} 返回ffmpeg命令
     */
    return [
        "-hide_banner",
        "-i",
        streamUrl
    ]
};

const makeForwardStreamFFmpegCmd =  (thit) => {
    let addPrefixFlags = [];
    // console.log("makeFFmpegCmd.mjs", thit.streamUrl.split('://')[0])
    switch (thit.streamUrl.split('://')[0]) {
        case "rtmp":
            break
        case  "rtsp":
            addPrefixFlags = ["-rtsp_transport", "tcp"];
            break
    }
    let addSuffixFlags = ['-f', 'flv', '-c:a', 'aac'];

    if (thit.setBits){
        addSuffixFlags = [...addSuffixFlags, '-b:v', thit.setBits];
    }

    if (thit.setHeight){
        addSuffixFlags = [...addSuffixFlags, '-vf', `scale=-2:${thit.setHeight}`];
    }

    if (thit.setFps){
        addSuffixFlags = [...addSuffixFlags, '-r', thit.setFps];
    }

    if (thit.streamInfo.codec === "h264"){
        addSuffixFlags = [...addSuffixFlags, '-c:v', 'copy'];
    }else {
        addSuffixFlags = [...addSuffixFlags, '-c:v', 'libx264'];
    }

    return [
        "-hide_banner",
        ...addPrefixFlags,
        "-i",
        thit.streamUrl,
        ...addSuffixFlags,
        "pipe:"
    ]
};

class RunCommand extends EventEmitter {
    constructor(commandPath, commandArgs) {
        super();
        this.commandPath = commandPath ? commandPath : "ffmpeg";
        this.commandArgs = commandArgs;

        // console.log(this.commandArgs.toString())
        this.child = child_process.spawn(this.commandPath, this.commandArgs, {
            detached: false
        });
        this.child.stdout.on('data', (data)=>{
            this.emit('execCommandSuccess', data);
        });
        this.child.stderr.on('data', (data)=>{
            this.emit('execCommandError', data);
        });
        this.child.on('exit', ()=>{
            this.emit('execCommandExit');
        });
    }
}

class GetStreamInfo extends EventEmitter{
    constructor(commandPath, getInfoCommandArgs, printFFmpegStdout) {
        super();
        this.commandPath = commandPath;
        this.commandArgs = getInfoCommandArgs;
        this.printFFmpegStdout = printFFmpegStdout;
        this.streamInfo = {};

        new RunCommand(this.commandPath, this.commandArgs)
            .on("execCommandError", (data)=>{
                data = data.toString();
                if (data.indexOf('Stream #0') !== -1) {
                    // console.log("getStreamInfo.mjs", data)
                    let size = data.match(/, \d+x\d+/);
                    if (size !== null) {
                        size = size[0].split('x');
                        this.streamInfo.width = parseInt(size[0].substring(1), 10);
                        this.streamInfo.height = parseInt(size[1], 10);
                    }
                    let fps = data.match(/\d+ fps,/);
                    if (fps !== null){
                        fps = fps[0].split(' ');
                        this.streamInfo.fps = parseInt(fps[0], 10);
                    }
                    let bits = data.match(/\d+ kb\/s,/);
                    if (bits !== null){
                        bits = bits[0].split(' ');
                        this.streamInfo.bits = bits[0];
                    }
                    let codec = data.match(/Video: [a-z0-9_]+\b/);
                    if (codec !== null){
                        codec = codec[0].split(' ');
                        this.streamInfo.codec = codec[1];
                    }
                    this.emit('getStreamInfoSuccess', this.streamInfo);
                }
            })
            .on("execCommandExit", ()=>{
                this.emit('getStreamInfoExit', this.streamInfo);
            })
            .on("execCommandError", (data)=>{
                if (this.printFFmpegStdout){
                    process.stderr.write(data);
                }

            });
    }
}

class FFmpegForwardStream extends EventEmitter{
    constructor(commandPath, getInfoCommandArgs, printFFmpegStdout) {
        super();
        this.commandPath = commandPath;
        this.commandArgs = getInfoCommandArgs;
        this.printFFmpegStdout = printFFmpegStdout;

        const command = new RunCommand(this.commandPath, this.commandArgs)
            .on("execCommandSuccess", (data)=>{
                this.emit('forwardStreamSuccess', data);
            })
            .on("execCommandError", (data)=>{
                if (this.printFFmpegStdout){
                    process.stderr.write(data);
                }
            })
            .on("execCommandExit", ()=>{
                this.emit('forwardStreamExit');
            });
        this.child = command.child;
    }
}

class LiveStream extends EventEmitter {
    constructor(options) {
        super();
        this.ffmpegPath = options.ffmpegPath;
        // 视频流地址
        this.streamUrl = options.streamUrl;
        // 强制设置转发时开启的websocket地址和端口
        this.wsHost = options.wsHost ? options.wsPort : "127.0.0.1";
        this.wsPort = options.wsPort ? options.wsPort : Math.floor(Math.random()*(1 - 100) + 100) + 64000;

        // 强制设置输出视频流的分辨率
        this.setWidth = options.width;
        this.setHeight = options.height;
         // 强制设置输出视频流的fps帧数
        this.setFps = options.fps;
        // 强制设置输出视频流的码率
        this.setBits = options.bits;

        this.forwardStream = undefined;
        this.streamBuffer = undefined;

        this.streamInfo = {};
        this.printFFmpegStdout = options.printFFmpegStdout === false ? options.printFFmpegStdout : true;
        this.start();
    }

    start(){
        const getInfoCommandArgs = makeGetStreamInfoFFmpegCmd(this.streamUrl);
        new GetStreamInfo(this.ffmpegPath, getInfoCommandArgs, this.printFFmpegStdout)
            .on("getStreamInfoExit", (data)=>{
                if (!data.fps){
                    // console.log("index.mjs", "获取直播流信息失败.")
                    this.emit("getStreamInfoError");
                    return false
                }else {
                    // console.log("index.mjs", "获取直播流信息成功.", data)
                    this.streamInfo = data;
                    this.emit("getStreamInfoSuccess", data);
                }
                const forwardStreamCommandArgs = makeForwardStreamFFmpegCmd(this);
                this.forwardStream = new FFmpegForwardStream(this.ffmpegPath, forwardStreamCommandArgs, this.printFFmpegStdout);
                this.forwardStream
                    .on("forwardStreamExit", ()=>{
                        // console.log("index.mjs", "转发视频流失败")
                        this.stop();
                        this.emit("forwardStreamExit");
                    })
                    .once("forwardStreamSuccess", (data)=>{
                        // console.log("index.mjs", "转发视频流成功", `访问地址为: ws://${this.wsHost}:${this.wsPort}`)
                        this.streamBuffer = data;
                        this.emit("forwardStreamSuccess", this.streamInfo);
                    });
                this.pipeStreamToSocketServer();
            });
    }

    stop(){
        console.log("index.mjs", "停止所有");
        if (this.forwardStream){
            this.forwardStream.removeAllListeners();
            this.forwardStream.child.kill();
        }
        if (this.wsServer) this.wsServer.close();
    }

    pipeStreamToSocketServer() {
        this.wsServer = new WebSocket.WebSocketServer({
            host: this.wsHost,
            port: this.wsPort
        });
        this.wsServer.on("connection", (socket) => {
            let buffer = false;
            while (!buffer){
                if (this.streamBuffer) buffer = true;
                socket.send(this.streamBuffer, {
                    binary: true
                });
            }

        });
        this.forwardStream.on('forwardStreamSuccess', (data) => {
            this.wsServer.clients.forEach((client) =>{
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data, { binary: true });
                }
            });
        });
    }

}

module.exports = LiveStream;
