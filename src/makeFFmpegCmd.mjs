export const makeGetStreamInfoFFmpegCmd =  (streamUrl) => {
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
}

export const makeForwardStreamFFmpegCmd =  (thit) => {
    /**
     * 生成ffmpeg命令
     * @param options {Object} 需要提供视频流转码设置
     * @return Command {Array} 返回ffmpeg命令
     */
    let command = []
    let addPrefixFlags = []
    // console.log("makeFFmpegCmd.mjs", thit.streamUrl.split('://')[0])
    switch (thit.streamUrl.split('://')[0]) {
        case "rtmp":
            break
        case  "rtsp":
            addPrefixFlags = ["-rtsp_transport", "tcp"]
            break
        default:
    }
    let addSuffixFlags = ['-f', 'flv', '-c:a', 'aac']

    if (thit.setBits){
        addSuffixFlags = [...addSuffixFlags, '-b:v', thit.setBits]
    }

    if (thit.setHeight){
        addSuffixFlags = [...addSuffixFlags, '-vf', `scale=-2:${thit.setHeight}`]
    }

    if (thit.setFps){
        addSuffixFlags = [...addSuffixFlags, '-r', thit.setFps]
    }

    if (thit.streamInfo.codec === "h264"){
        addSuffixFlags = [...addSuffixFlags, '-c:v', 'copy']
    }else {
        addSuffixFlags = [...addSuffixFlags, '-c:v', 'libx264']
    }

    return [
        "-hide_banner",
        ...addPrefixFlags,
        "-i",
        thit.streamUrl,
        ...addSuffixFlags,
        "pipe:"
    ]
}