/*
 * @Author: Rhymedys/Rhymedys@gmail.com 
 * @Date: 2018-03-16 12:26:59 
 * @Last Modified by: Rhymedys
 * @Last Modified time: 2018-03-16 12:29:35
 */


import * as commonUtils from './CommonUtils'

class LightSocketIO {

  /**
   * Creates an instance of SocketUtils.
   * @param {any} socketApi  socket request address
   * @param {any} options other options
   * @memberof SocketUtils
   */
  constructor(socketApi, options) {
    this.socketClient = null
    this.eventType = null
    this.socketReadyState = null
    this.heartBreakInterval = null
    this.heartBreakCallbackInterval = null
    this.reconnectSocketClientTimeOut = null
    this.callbackList = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onbeforeunload: null,
      onerror: null
    }
    this.socketClientRunning = false
    this.lockReconnectSocketClient = false
    this.options = options
    this.nextAutoConnectTimeOut = 0
    this.msgsCache = []
    this.socketApi = this.reclaimApiProtocol(socketApi)
    this.setEventType()
    this.setSocketReadyState()
    this.checkAndInitSocketUtils(socketApi)
  }

  /**
   * @description 纠正Api协议
   * @param {any} api
   * @memberof SocketIO
   */
  reclaimApiProtocol(api) {
    let res = `ws://${api}`
    if (window.location.protocol.match('https:')) {
      res = res.replace('ws', 'wss')
    }
    return res
  }

  /**
   * @description 检测是否达到可以初始化标准,如果符合条件则创建webSocket实例
   * @param {any} socketApi
   * @memberof SocketUtils
   */
  checkAndInitSocketUtils(socketApi) {
    if (!socketApi) {
      this.throwError('socketApi can not be null')
      return
    }

    if (!this.checkBrowserSupportWebSocket()) {
      this.throwError('this browser unsupport websocket')
      return
    }

    this.createSocket(socketApi)
  }

  /**
   * @description 检测当前浏览器是否支持WebSocket
   * @returns
   * @memberof SocketUtils
   */
  checkBrowserSupportWebSocket() {
    return 'WebSocket' in window
  }

  /**
   * @description 获取可监听的事件类型
   * @memberof SocketUtils
   */
  setEventType() {
    this.eventType = {
      onopen: 'onopen',
      onmessage: 'onmessage',
      onclose: 'onclose',
      onbeforeunload: 'onbeforeunload',
      onerror: 'onerror'
    }
  }


/**
 * @description 初始化socket的原生转态
 * @memberof SocketIO
 */
  setSocketReadyState() {
    this.socketReadyState = {
      CLOSED: 3,
      CLOSING: 2,
      OPEN: 1,
      CONNECTING: 0
    }
  }

  /**
   * @description 根据key值返回状态码意义
   * @param {any} key
   * @returns
   * @memberof SocketIO
   */
  getSocketValue(key) {
    return {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    }[key]
  }

  /**
   * @description 清空心跳计时器
   * @memberof SocketIO
   */
  clearHeartBreakInterval() {
    if (this.heartBreakInterval) {
      window.clearInterval(this.heartBreakInterval)
    }
  }


  /**
   * @description 清空心跳回馈Callback计时器
   * @memberof SocketIO
   */
  clearHeartBreakCallbackInterval() {
    if (this.heartBreakCallbackInterval) {
      window.clearInterval(this.heartBreakCallbackInterval)
    }
  }

  /**
   * @description 开启发送心跳包
   * @param {number} [timeOut=60]
   * @param {string} [heartBreakContent='ping']
   * @memberof SocketIO
   */
  openHeatBreak(interval = 30, heartBreakContent = 'ping') {
    const that = this
    let msg = heartBreakContent
    this.clearHeartBreakInterval()
    if (heartBreakContent instanceof Object) {
      msg = JSON.stringify(heartBreakContent)
    }
    if (typeof msg === 'string') {
      this.heartBreakInterval = window.setInterval(() => {
        that.callGobalErrorCallback(`发送心跳包，内容为:${msg}`)
        that.sendMsg(msg)
      }, interval * 1000)
    } else {
      this.throwError('心跳包content类型不能为非Object或String类型')
    }
  }

  /**
   * 开始计时回执
   */
  openHeartBreakCallbackTimer() {
    if (this.options.heartPackageConfig && this.options.heartPackageConfig.openHeatBreakCallbackTimer) {
      const callbackDuration = this.options.heartPackageConfig.heatBreakCallbackDuration || 30
      this.heartBreakCallbackInterval = window.setInterval(() => {

      }, callbackDuration * 1000)
    }
  }

  /**
   * @description socket开启后监听回调
   * @param {any} event
   * @memberof SocketUtils
   */
  onOpenCallback(event) {
    const that = this
    if (event.currentTarget.readyState === this.socketReadyState.OPEN) {
      this.socketClientRunning = true
      this.nextAutoConnectTimeOut = 0
      this.options && this.options.heartPackageConfig && this.options.heartPackageConfig.open && this.openHeatBreak(this.options.heartPackageConfig.interval, this.options.heartPackageConfig.content)
    }
    this.callbackList.onopen && this.callbackList.onopen(event.currentTarget)
    this.socketClient.onmessage = e => that.callbackList.onmessage(e.data, e)
  }

  /**
   * @description socket关闭回调
   * @param {any} event
   * @returns
   * @memberof SocketUtils
   */
  onCloseCallback(event) {
    this.socketClientRunning = false
    this.clearHeartBreakInterval()
    this.callbackList.onclose && this.callbackList.onclose(event.currentTarget)
    if (this.options && this.options.autoReconnect) {
      /**
       * 是否自动重试，如果自动重试的，则渐进延时重试
       */
      this.reconnectSocketClient()
    }
  }

  /**
   * @description
   * @param {any} event
   * @returns
   * @memberof SocketUtils
   */
  onBeforeUnloadCallback(event) {
    this.callbackList.onbeforeunload && this.callbackList.onbeforeunload(event.currentTarget)
  }

  /**
   * @description socket出错回调
   * @param {any} ctx
   * @param {any} event
   * @returns
   * @memberof SocketUtils
   */
  onErrorCallback(event) {
    this.socketClientRunning = false
    this.clearHeartBreakInterval()
    this.callbackList.onerror && this.callbackList.onerror(event.currentTarget)
    if (this.options && this.options.autoReconnect) {
      /**
       * 是否自动重试，如果自动重试的，则渐进延时重试
       */
      this.reconnectSocketClient()
    }
  }

  /**
   * @description 全局错误回调
   * @param {any} error 错误信息
   * @memberof SocketIO
   */
  callGobalErrorCallback(error) {
    this.options && this.options.goablErrorCallback && this.options.goablErrorCallback(error)
  }

  /**
   * @description 注册监听事件
   * @memberof SocketUtils
   */
  registerCallbackListener(eventType) {
    if (this.socketClient) {
      const that = this
      switch (eventType) {
        case this.eventType.onopen:
          this.socketClient.onopen = event => that.onOpenCallback(event)
          break
        case this.eventType.onclose:
          this.socketClient.onclose = event => that.onCloseCallback(event)
          break
        case this.eventType.onbeforeunload:
          this.socketClient.onbeforeunload = event => that.onBeforeUnloadCallback(event)
          break
        case this.eventType.onerror:
          this.socketClient.onerror = event => that.onErrorCallback(event)
          break
        default:
          this.socketClient.onerror = event => that.onErrorCallback(event)
          this.socketClient.onbeforeunload = event => that.onBeforeUnloadCallback(event)
          this.socketClient.onclose = event => that.onCloseCallback(event)
          this.socketClient.onopen = event => that.onOpenCallback(event)
          break
      }
    }
  }

  /**
   * @description 监听事件
   * @param {any} eventTypeCallback
   * @param {any} eventCallback
   * @memberof SocketUtils
   */
  on(eventTypeCallback, eventCallback) {
    if (eventTypeCallback && eventCallback instanceof Function) {
      if (this.eventType[eventTypeCallback(this.eventType)] && eventCallback) {
        this.callbackList[eventTypeCallback(this.eventType)] = eventCallback
        this.registerCallbackListener(eventTypeCallback(this.eventType))
      }
    } else {
      this.throwError('eventTypeCallback should be a function')
    }

    return this
  }

  /**
   * @description 发送消息
   * @param {any} msg
   * @param {any} errorCallback
   * @memberof SocketUtils
   */
  sendMsg(msg, errorCallback) {
    if (this.socketClientRunning && this.socketClient) {
      this.socketClient.send(msg)
    } else {
      this.reconnectSocketClient()
      errorCallback && errorCallback(msg)
    }

    return this
  }

  /**
   * @description 返回socket运行状态
   * @returns
   * @memberof SocketIO
   */
  getState() {
    return this.socketClientRunning
  }

  /**
   * @description 创建socket对象
   * @param {any} socketApi socket地址
   * @returns
   * @memberof SocketUtils
   */
  createSocket(socketApi) {
    if (socketApi && this.checkBrowserSupportWebSocket()) {
      let query
      if (this.options && this.options.query) {
        /**
         * 将query对象转 urlQueryString
         */
        query = commonUtils.tranJson2Query(this.options.query)
        if (query.indexOf('&') === 0) {
          query = query.substring(1, query.length)
        }
      }
      if (!this.socketClient) {
        this.callGobalErrorCallback('创建且连接SocketClient')
      } else {
        this.socketClient.close()
        this.callGobalErrorCallback('重连SocketClient')
      }

      try {
        this.socketClient = new WebSocket(`${socketApi}?${query}`)
        this.registerCallbackListener()
      } catch (e) {
        this.reconnectSocketClient()
      }
    }
    return this
  }

  /**
   * @description 重连WebSocket
   * @memberof SocketIO
   */
  reconnectSocketClient() {
    const that = this
    if (this.lockReconnectSocketClient) return
    this.lockReconnectSocketClient = true

    if (this.reconnectSocketClientTimeOut) {
      window.clearTimeout(this.reconnectSocketClientTimeOut)
      this.reconnectSocketClientTimeOut = null
    }

    this.reconnectSocketClientTimeOut = window.setTimeout(() => {
      that.createSocket(that.socketApi)
      that.nextAutoConnectTimeOut += (10 * 1000)
      that.callGobalErrorCallback(`正在重连 下次重连时间间隔 ${that.nextAutoConnectTimeOut / 1000}s`)
      that.lockReconnectSocketClient = false
    }, that.nextAutoConnectTimeOut)
  }

  /**
   * @description 关闭Socket
   * @memberof SocketIO
   */
  closeSocket() {
    this.socketClientRunning && this.socketClient && this.socketClient.close()
  }

  /**
   * 抛异常
   * @param {*} msg
   */
  throwError(msg) {
    throw new Error(msg)
  }
}

export default LightSocketIO