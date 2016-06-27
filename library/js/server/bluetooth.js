/*
 * The Bluetooth module handles the bluetooth channel.
 */
var bleno = require('bleno')
var util = require('util')

var SP = SP || {}

SP.Bluetooth.Server = (function (SP) {
  var log = SP.Log.makeLog('Bluetooth')

  var SecurePairNotifyCharacteristic = function () {
    SecurePairNotifyCharacteristic.super_.call(this, {
      uuid: SP.Bluetooth.NOTIFY_CHARACTERISTIC_ID,
      properties: ['notify'],
      value: null
    })
    this._value = new Buffer(0)
    this._updateValueCallback = null
    this.flag = function () {
      if (this._updateValueCallback === null) {
        log.debug('no subscribers')
        return
      }
      this._updateValueCallback(this._value)
    }
  }

  util.inherits(SecurePairNotifyCharacteristic, bleno.Characteristic)

  SecurePairNotifyCharacteristic.prototype.onSubscribe = function (maxValueSize, updateValueCallback) {
    log.debug('SecurePairNotifyCharacteristic - onSubscribe')

    this._updateValueCallback = updateValueCallback
  }

  SecurePairNotifyCharacteristic.prototype.onUnsubscribe = function () {
    log.debug('SecurePairNotifyCharacteristic - onUnsubscribe')

    this._updateValueCallback = null
  }

  var SecurePairCharacteristic = function (messageReceived) {
    SecurePairCharacteristic.super_.call(this, {
      uuid: SP.Bluetooth.CHARACTERISTIC_ID,
      properties: ['read', 'notify', 'write']
    })
    this._EOM = new Buffer('eom')
    this._START = new Buffer('d')
    this._EMPTY = this._EOM
    this._writeRequestState = {
      messages: []
    }
    this._readRequestState = {
      index: 0,
      current: this._EMPTY,
      cb: null
    }
    this._notifyCallback = null
    this.messageReceived = messageReceived
  }

  util.inherits(SecurePairCharacteristic, bleno.Characteristic)

  SecurePairCharacteristic.prototype.onReadRequest = function (offset, callback) {
    var response = this._EMPTY
    var index = this._readRequestState.index
    var current = this._readRequestState.current
    if (index < current.length) {
      var end = Math.min(current.length, index + 19)
      response = Buffer.concat([this._START, current.slice(index, end)], end - index + 1)
      this._readRequestState.index = end
    } else {
      setTimeout(this._readRequestState.cb, 0)
    }
    log.debug('SecurePairCharacteristic - onReadRequest: value = ' + response.toString())
    callback(this.RESULT_SUCCESS, response)
  }

  SecurePairCharacteristic.prototype.onWriteRequest = function (data, offset, withoutResponse, callback) {
    log.debug('SecurePairCharacteristic - onWriteRequest: value = ' + data.toString())
    if (data.toString()[0] === 'd') {
      this._writeRequestState.messages.push(data.slice(1))
    } else if (data.slice(0, 3).toString() === 'eom') {
      var message = Buffer.concat(this._writeRequestState.messages)
      this._writeRequestState.messages = []
      log.debug('message received: ' + message)
      this.messageReceived && this.messageReceived(message)
    }
    callback(this.RESULT_SUCCESS)
  }

  SecurePairCharacteristic.prototype.onSubscribe = function (maxValueSize, updateValueCallback) {
    log.debug('SecurePairCharacteristic - onSubscribe')
    this._notifyCallback = updateValueCallback
  }

  SecurePairCharacteristic.prototype.onUnsubscribe = function () {
    log.debug('SecurePairCharacteristic - onUnsubscribe')
    this._notifyCallback = null
  }

  SecurePairCharacteristic.prototype.sendMessage = function (message, cb) {
    this._readRequestState.current = message
    this._readRequestState.index = 0
    this._readRequestState.cb = cb
    log.debug('sending a message: ' + message.toString())
    this._notifyCallback && this._notifyCallback(this._EOM)
  }

  var BluetoothServer = (function () {
    var bluetoothServer = {}
    var ready = false
    var started = false
    var advertisingStartedCB = null
    var securePairCharacteristic = new SecurePairCharacteristic()
    var notifyCharacteristic = new SecurePairNotifyCharacteristic()

    securePairCharacteristic._notifyCallback = function (data) {
      log.debug('flaging notify')
      notifyCharacteristic.flag()
    }

    bleno.on('stateChange', function (state) {
      log.debug('on -> stateChange: ' + state)
      if (state === 'poweredOn') {
        ready = true
        if (started) bleno.startAdvertising('securepair', [SP.Bluetooth.SERVICE_UID])
      } else {
        bleno.stopAdvertising()
      }
    })

    bleno.on('advertisingStart', function (error) {
      log.debug('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'))
      advertisingStartedCB && advertisingStartedCB(error)
      if (!error) {
        bleno.setServices([
          new bleno.PrimaryService({
            uuid: SP.Bluetooth.SERVICE_UID,
            characteristics: [
              securePairCharacteristic,
              notifyCharacteristic
            ]
          })
        ])
      }
    })

    bluetoothServer.start = function (cb) {
      advertisingStartedCB = cb
      started = true
      if (ready) bleno.startAdvertising('securepair', [SP.Bluetooth.SERVICE_UID])
    }

    bluetoothServer.send = function (message, cb) {
      securePairCharacteristic.sendMessage(message, cb)
    }

    var readQueue = []
    var pendingReadCallback = null
    var lastReadTime
    var notifyRead
    var processRead = function (data) {
      notifyRead && notifyRead(data)
      lastReadTime = new Date().getTime()
      if (pendingReadCallback !== null) {
        var cb = pendingReadCallback
        pendingReadCallback = null
        cb(data)
      } else {
        readQueue.push(data)
      }
    }

    securePairCharacteristic.messageReceived = processRead

    bluetoothServer.receive = function (callback, timeout) {
      var cb = function (buffer) {
        if (buffer === null) {
          callback(null)
        } else {
          callback(buffer)
        }
      }
      if (readQueue.length > 0) {
        setTimeout(function () {
          cb(readQueue.shift())
        }, 0)
      } else {
        if (pendingReadCallback !== null) {
          pendingReadCallback(null)
        }
        pendingReadCallback = cb
        if (timeout) {
          var timeNow = new Date().getTime()
          setTimeout(function () {
            if (lastReadTime <= timeNow) {
              log.debug('read timed out')
              pendingReadCallback && pendingReadCallback(null)
              pendingReadCallback = null
            }
          }, timeout)
        }
      }
    }
    return bluetoothServer
  })()

  return {
    start: BluetoothServer.start,
    send: BluetoothServer.send,
    receive: BluetoothServer.receive
  }
})(SP)
