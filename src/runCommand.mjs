import child_process from 'child_process';
import EventEmitter from 'events';

export default class RunCommand extends EventEmitter {
    constructor(commandPath, commandArgs) {
        super();
        this.commandPath = commandPath ? commandPath : "ffmpeg"
        this.commandArgs = commandArgs

        // console.log(this.commandArgs.toString())
        this.child = child_process.spawn(this.commandPath, this.commandArgs, {
            detached: false
        })
        this.child.stdout.on('data', (data)=>{
            this.emit('execCommandSuccess', data)
        })
        this.child.stderr.on('data', (data)=>{
            this.emit('execCommandError', data)
        })
        this.child.on('exit', ()=>{
            this.emit('execCommandExit')
        })
    }
}