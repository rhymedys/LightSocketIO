const closeErrorEvents = {
  '1000': '正常关闭',
  '1001': '终端离开',
  '1002': '协议错误',
  '1003': '收到错误数据类型',
  '1006': 'proxy_read_timeout超时',
  '1007': '收到了非UTF-8数据',
  '1009': '收到过大数据帧',
  '1010': '客户端期望服务器商定一个或多个拓展, 但服务器没有处理, 因此客户端断开连接',
  '1011': '服务端断开',
  '1012': '服务端由于重启断开',
  '1013': '服务器由于临时原因断开连接, 如服务器过载因此断开一部分客户端连接'
}

export default class WS {
  static ONLINE = window.socketLists = []
  constructor ({url, onOpen, onMessage, onClose, onError, ...options}) {
    this.ws = null
    this.onMessage = onMessage || function () {}
    this.onError = onError || function () {}
    this.onClose = onClose || function () {}
    this.onOpen = onOpen || function () {}
    this.url = url || ''
    this.reconnectTimer = null
    this.options = options || null
    this.timeout = 5000
    this.timeoutObj = null
    this.serverTimeoutObj = null
    this.reGetTokenTimer = null
    this.socketMsgQueue = []
    this.callbacks = []
    this.heartBeatTimer = null
    this.connect()
    this.hideScreen()
  }
  // 重置定时器
  resetHeart () {
    this.heartBeatTimer && clearTimeout(this.heartBeatTimer)
    this.reconnectTimer && clearTimeout(this.reconnectTimer)
  }
  // 开启心跳保活
  startHeart (params) {
    this.resetHeart()
    this.heartBeatTimer = setTimeout(() => {
      this.send('ping')
      this.reconnectTimer = setTimeout(() => {
        // 因为没返回心跳导致中断
        if (params === 'no-pong') {
          console.log(this.url + '心跳未返回, 关闭websocket')
        }
        this.close()
      }, this.timeout)
    }, this.timeout)
  }
  // 创建websocket实例
  createWebSocket () {
    // 全局socket列表
    if (!WS.ONLINE) {
      WS.ONLINE = []
    }
    try {
      let token = sessionStorage.getItem('token')
      // 如果token存在
      if (token) {
        token = token.substring(token.lastIndexOf('.') + 1)
        // 如果websocket是断开的
        if (WS.ONLINE.every(item => item.url !== this.url)) {
          if ('WebSocket' in window) {
            this.ws = new WebSocket(this.url, [token])
          } else if ('MozWebSocket' in window) {
            this.ws = new window.MozWebSocket(this.url, [token])
          } else {
            alert('您的浏览器暂不支持websocket')
            return
          }
          WS.ONLINE.push(this.ws)
        // 如果之前连过websocket
        } else {
          let arr = WS.ONLINE.filter(socket => socket.url === this.url)
          let ws = arr && arr[0]
          this.ws = ws
        }
        this.ws.binaryType = this.options.binaryType || 'blob'
      } else {
        this.reGetTokenTimer && clearTimeout(this.reGetTokenTimer)
        this.reGetTokenTimer = setTimeout(() => {
          this.createWebSocket()
        }, 1000)
      }
    } catch (e) {
      console.log('创建websocket错误:', e.message)
      this.connect()
    }
  }
  // 息屏处理
  hideScreen () {
    const vm = this
    let hideDate = ''
    function fn () {
      // 亮屏
      if (document.visibilityState === 'visible') {
        let now = new Date().getTime()
        let timeLen = now - hideDate
        console.log('🚀 ~ 息屏时长', timeLen / 1000 + '秒')
        console.log('websocket此时状态', vm.ws && vm.ws.readyState, vm.url)
        // websocket因长期熄屏断了
        if (vm.ws && vm.ws.readyState !== 1 || !vm.ws) {
          vm.connect()
        }
        // 息屏
      } else {
        hideDate = new Date().getTime()
      }
    }
    document.addEventListener('visibilitychange', fn)
  }
  // 连接
  connect (cb) {
    // 监听网络是否正常
    if (!window.navigator.onLine) {
      alert('网络未连接！')
      return
    }
    // 执行连接
    const doConnect = () => {
      this.createWebSocket()
      this.listenEvent()
      window.onbeforeunload = () => {
        this.ws.close()
      }
    }
    if (!this.ws) {
      cb && this.callbacks.push(cb)
      // 首次连接
      doConnect()
      console.log('开始连接了')
    } else if (this.ws.readyState === WebSocket.OPEN) {
      console.log('websocket已经连接成功了')
      // 连接正常的情况
      cb && cb()
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      console.log('websocket正在连接中')
      this.callbacks.push(cb)
    } else if (this.ws.readyState === WebSocket.CLOSING) {
      console.log('websocket正在关闭')
      this.callbacks.push(cb)
      doConnect()
    } else if (this.ws.readyState === WebSocket.CLOSED) {
      console.log('websocket已经关闭')
      this.callbacks.push(cb)
      doConnect()
    }
  }
  // 监听消息事件
  listenMessageEvent () {
    this.ws.onmessage = (event) => {
      // 文本格式
      if (typeof event.data === 'string') {
        if (event && event.data === 'pong') {
          this.startHeart()
        } else {
          let data = JSON.parse(event.data)
          this.onMessage(data)
          console.log('websocket消息事件---->', data)
        }
        // 二进制格式
      } else if (event.data instanceof Blob) {
        // todo
        this.onMessage(event.data)
      } else if (event.data instanceof ArrayBuffer) {
        // todo
        this.onMessage(event.data)
      }
    }
  }
  // 监听错误/关闭等事件
  listenEvent () {
    if (!this.ws) return
    // 连接上了
    this.ws.onopen = async (event) => {
      console.log('连接socket成功', event)
      for (let i = 0; i < this.socketMsgQueue.length; i++) {
        console.log('重发数据', this.socketMsgQueue[i])
        await this.send(this.socketMsgQueue[i])
      }
      this.socketMsgQueue = []
      this.listenMessageEvent()
      this.startHeart()
      this.onOpen()
      this.callbacks.forEach(cb => {
        console.log('🚀 ~ 执行websocket事件队列', cb)
        cb && cb()
      })
      this.callbacks.length = 0
    }
    // 关闭/报错的情况
    this.ws.onclose = (event) => {
      WS.ONLINE = WS.ONLINE.filter(item => item.url !== this.url)
      this.onClose(event)
      const errMsg = closeErrorEvents[event.code]
      console.log('websocket关闭事件和原因---->', event, errMsg)
      // 正常关闭
      if (event.code === 1000) {
        this.resetHeart()
      // 非正常关闭
      } else {
        this.onError(event)
        this.connect()
      }
    }
    // 单纯报错, 这个部分不太稳定
    this.ws.onerror = (event, message) => {
      this.onError(event)
      console.error('websocket异常事件---->', event, message)
    }
  }
  // 发送消息
  send (json) {
    // 发送消息必须是连接已经建立的情况下
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(json)
    } else {
      this.socketMsgQueue.push(json)
      console.log('连接尚未建立')
    }
  }
  close () {
    WS.ONLINE = WS.ONLINE.filter(item => item.url !== this.url)
    this.ws && this.ws.close()
    this.ws = null
  }
}
