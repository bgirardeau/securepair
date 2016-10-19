/*
 * The Bluetooth module handles communication over the Bluetooth channel.
 *
 * Functions:
 *   SP.Bluetooth.Phone.create()
 *     channel.scan(timeout, callback)
 *       callback(device)
 *     channel.connect(device, callback)
 *       callback(err, device)
 *     channel.read(callback, timeout)
 *       callback(buffer)
 *     channel.send(data, callback)
 *       callback(err)
 */
var SP = SP || {}

SP.Bluetooth.Phone = (function (SP, async, Blob, FileReader) {
  var bluetoothChannel = {}
  var service = SP.Bluetooth.SERVICE_UID
  var characteristic = SP.Bluetooth.CHARACTERISTIC_ID
  var notifyCharacteristic = SP.Bluetooth.NOTIFY_CHARACTERISTIC_ID
  var MAX_PACKET_SIZE = 20

  bluetoothChannel.create = function () {
    var ble = SP.Plugins.ble
    var log = SP.Log.makeLog('Bluetooth')
    var channel = {}
    var connectedTo = {}
    var activeConnection = null
    var readQueue = []
    var pendingReadCallback = null
    var lastReadTime = 0
    channel.scan = function (timeout, callback) {
      ble.startScan([], function (device) {
        if (device.advertising && device.advertising.kCBAdvDataServiceUUIDs &&
          device.advertising.kCBAdvDataServiceUUIDs.indexOf(service) !== -1) {
          log.debug('found supported device while scanning, "' + device.name + '"')
          callback(device)
        }
      }, function () {
        log.debug('error scanning for devices')
      })

      setTimeout(function () {
        ble.stopScan(function () {
          log.debug('stopped scanning')
        }, function () {
          log.debug('error stopping scan')
        })
      }, timeout)
    }

    channel.connect = function (deviceID, callback) {
      var setupReads = function () {
        readQueue = []
        pendingReadCallback = null
        ble.startNotification(deviceID, service, notifyCharacteristic, function (buffer) {
          log.debug('got notification: ' + SP.Util.bytesToString(buffer))
          lastReadTime = new Date().getTime()
          var readMore = function (cb) {
            ble.read(deviceID, service, characteristic, function (data) {
              cb(data)
            }, function (error) {
              log.debug('error reading data: ' + error)
              cb(SP.Util.stringToBytes('eom'))
            })
          }
          var parts = []
          var done = function () {
            var data = new Blob(parts)
            var fileReader = new FileReader()
            fileReader.onload = function () {
              log.debug('finished reading data: ' + SP.Util.bytesToString(this.result))
              if (pendingReadCallback !== null) {
                var cb = pendingReadCallback
                pendingReadCallback = null
                cb(this.result)
              } else {
                readQueue.push(this.result)
              }
            }
            fileReader.readAsArrayBuffer(data)
          }
          var loop = function (data) {
            if (SP.Util.bytesToString(data).substring(0, 3) === 'eom') {
              done()
            } else {
              parts.push(data.slice(1))
              readMore(loop)
            }
          }
          readMore(loop)
        }, function (error) {
          log.debug('error starting notification of reads: ' + error)
        })
      }
      var activateConnection = function (deviceID) {
        setTimeout(function () {
          callback(null, connectedTo[deviceID])
        }, 250)
        if (activeConnection !== null) {
          ble.stopNotification(activeConnection, service, characteristic, function () {
            log.debug('succesfully stopped being notified of reads for old connection')
            setupReads()
          }, function (error) {
            log.debug('error stopping notification of reads for old connection: ' + error)
            setupReads()
          })
        } else {
          setupReads()
        }
        activeConnection = deviceID
      }

      if (deviceID === activeConnection) return
      if (!connectedTo[deviceID]) {
        ble.connect(deviceID, function (data) {
          connectedTo[deviceID] = data
          activateConnection(deviceID)
        })
      } else {
        activateConnection(deviceID)
      }
    }

    var write = function (data, callback) {
      ble.write(activeConnection, service, characteristic, data, callback)
    }

    var encode = function (data) {
      var packets = []
      var dataArr = new Uint8Array(data)
      for (var i = 0; i < dataArr.length; i += (MAX_PACKET_SIZE - 1)) {
        var packetSize = dataArr.length - i + 1
        if (packetSize > MAX_PACKET_SIZE) packetSize = MAX_PACKET_SIZE
        var packet = new Uint8Array(packetSize)
        packet[0] = 'd'.charCodeAt(0)
        packet.set(dataArr.subarray(i, i + packetSize - 1), 1)
        packets.push(packet.buffer)
      }
      packets.push(SP.Util.stringToBytes('eom'))
      return packets
    }

    channel.write = function (data, callback) {
      var packets = encode(data)
      log.debug('sending ' + packets.length + ' packets')
      async.eachSeries(packets, write, function (err, results) {
        callback(err)
      })
    }

    /* Read code should be cleaned up. It has to take notifications from
    the server and pass those to clients who call this function. */
    channel.read = function (callback, timeout) {
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

    return channel
  }

  return bluetoothChannel
})(SP, window.async, window.Blob, window.FileReader)
