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