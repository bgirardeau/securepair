/*
 * The Pair module handles pairing and communication over the pair.
 *
 * Functions:
 *   SP.Pair.create()
 *     pair.scan(timeout, callback)
 *       callback(device)
 *     pair.initiate(deviceID, callback)
 *       callback(err, result)
 *     pair.send(message, callback)
 *       callback(err)
 *     pair.receive(callback)
 *       callback(err, message)
 */
var SP = SP || {}

SP.Pair = (function (SP, AudioContext) {
  var securePair = {}

  var audioContext = new AudioContext()

  securePair.create = function () {
    var pair = {}

    var audioChannel = SP.Audio.create({
      sampleRate: audioContext.sampleRate
    })
    var btChannel = SP.Bluetooth.Phone.create()

    pair.scan = btChannel.scan
    var sharedKey

    pair.initiate = function (deviceID, callback) {
      btChannel.connect(deviceID, function (err, device) {
        if (err) {
          return callback('error connecting (' + err + ')')
        }

        var readBytes = function (readCB) {
          btChannel.read(function (data) {
            readCB(null, new Uint8Array(data))
          })
        }

        var writeBytes = function (data, writeCB) {
          btChannel.write(data.buffer, function (err) {
            writeCB(err)
          })
        }

        var authenticatedMatch = function (matchValue, matchCB) {
          btChannel.write(SP.Util.stringToBytes('matching'), function (err) {
            if (err) return matchCB(err)
            btChannel.read(function (readyMessage) {
              if (readyMessage === null) {
                callback('pairing timed out')
                return
              }
              readyMessage = SP.Util.bytesToString(readyMessage)
              if (readyMessage.substring(0, 5) !== 'ready') {
                callback('listener not ready to pair')
                return
              }
              audioChannel.play(audioContext, SP.Util.intToString(matchValue, 2, 20), function () {
                btChannel.read(function (message) {
                  if (message === null) {
                    matchCB('pairing timed out')
                    return
                  }
                  matchCB(null, SP.Util.bytesToString(message))
                }, 2000)
              })
            }, 1000)
          })
        }

        SP.Crypto.initiatePairing(readBytes, writeBytes, authenticatedMatch, function (err, result, key) {
          sharedKey = key
          callback(err, result)
        })
      })
    }

    pair.send = function (message, callback) {
      btChannel.write(sharedKey.encryptString(message).buffer, callback)
    }

    pair.read = function (callback) {
      btChannel.read(function (err, result) {
        if (err) return callback(err)
        callback(null, sharedKey.decryptString(new Uint8Array(result)))
      })
    }

    return pair
  }

  return securePair
})(SP, window.AudioContext)
