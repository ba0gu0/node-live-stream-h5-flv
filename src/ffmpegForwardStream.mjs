import EventEmitter from "events"
import RunCommand from "./runCommand.mjs"

export default class FFmpegForwardStream extends EventEmitter{
    constructor(commandPath, getInfoCommandArgs, printFFmpegStdout) {
        super();
        this.commandPath = commandPath
        this.commandArgs = getInfoCommandArgs
        this.printFFmpegStdout = printFFmpegStdout

        const command = new RunCommand(this.commandPath, this.commandArgs)
            .on("execCommandSuccess", (data)=>{
                this.emit('forwardStreamSuccess', data)
            })
            .on("execCommandError", (data)=>{
                if (this.printFFmpegStdout){
                    process.stderr.write(data)
                }
            })
            .on("execCommandExit", ()=>{
                this.emit('forwardStreamExit')
            })
        this.child = command.child
    }
}