import EventEmitter from "events"
import RunCommand from "./runCommand.mjs"

export default class GetStreamInfo extends EventEmitter{
    constructor(commandPath, getInfoCommandArgs, printFFmpegStdout) {
        super();
        this.commandPath = commandPath
        this.commandArgs = getInfoCommandArgs
        this.printFFmpegStdout = printFFmpegStdout
        this.streamInfo = {}

        const command = new RunCommand(this.commandPath, this.commandArgs)
            .on("execCommandError", (data)=>{
                data = data.toString()
                if (data.indexOf('Stream #0') !== -1) {
                    // console.log("getStreamInfo.mjs", data)
                    let size = data.match(/, \d+x\d+/)
                    if (size !== null) {
                        size = size[0].split('x')
                        this.streamInfo.width = parseInt(size[0].substring(1), 10)
                        this.streamInfo.height = parseInt(size[1], 10)
                    }
                    let fps = data.match(/\d+ fps,/)
                    if (fps !== null){
                        fps = fps[0].split(' ')
                        this.streamInfo.fps = parseInt(fps[0], 10)
                    }
                    let bits = data.match(/\d+ kb\/s,/)
                    if (bits !== null){
                        bits = bits[0].split(' ')
                        this.streamInfo.bits = bits[0]
                    }
                    let codec = data.match(/Video: [a-z0-9_]+\b/)
                    if (codec !== null){
                        codec = codec[0].split(' ')
                        this.streamInfo.codec = codec[1]
                    }
                    this.emit('getStreamInfoSuccess', this.streamInfo)
                }
            })
            .on("execCommandExit", ()=>{
                this.emit('getStreamInfoExit', this.streamInfo)
            })
            .on("execCommandError", (data)=>{
                if (this.printFFmpegStdout){
                    process.stderr.write(data)
                }

            })
    }
}