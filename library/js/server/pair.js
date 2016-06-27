/*
 * The Pair module handles pairing and communication over the pair.
 *
 * Functions:
 *   SP.Pair.create()
 *     pair.listen(callback)
 *       callback(err, result)
 *     pair.send(message, callback)
 *       callback(err)
 *     pair.receive(callback)
 *       callback(err, message)
 */
var SP = SP || {}

SP.Pair = (function (SP, AudioContext) {
  var securePair = {}

  securePair.create = function (listener) {
    var pair = {}

    var sharedKey

    var readBytes = function (readCB) {
      SP.Bluetooth.Server.receive(function (data) {
        var arr = SP.Util.toArrayBuffer(data)
        readCB(null, arr)
      })
    }

    var writeBytes = function (data, writeCB) {
      SP.Bluetooth.Server.send(new Buffer(data), function (err) {
        writeCB(err)
      })
    }

    pair.listen = function (callback) {
      var authenticatedMatch = function (matchValue, matchCB) {
        SP.Bluetooth.Server.receive(function (data) {
          var bits = SP.Util.intToString(matchValue, 2, SP.Crypto.SAS_RANDOM_SIZE * 8)
          if (!listener.ready()) {
            SP.Bluetooth.Server.send(new Buffer('failed'), function (err) {
              matchCB(err, false)
            })
            return
          }

          listener.match(bits, 6000, function (match) {
            if (match === null) {
              SP.Bluetooth.Server.send(new Buffer('failed'), function (err) {
                matchCB(err, false)
              })
            } else {
              SP.Bluetooth.Server.send(new Buffer('paired'), function (err) {
                matchCB(err, true)
              })
            }
          }, function () {
            SP.Bluetooth.Server.send(new Buffer('ready'))
          })
        })
      }

      SP.Crypto.listenForPairing(readBytes, writeBytes, authenticatedMatch, function (err, result, key) {
        sharedKey = key
        callback(err, result)
      })
    }

    pair.send = function (message, callback) {
      writeBytes(sharedKey.encryptString(message), callback)
    }

    pair.receive = function (callback) {
      readBytes(function (err, result) {
        if (err) return callback(err)
        callback(null, sharedKey.decryptString(result))
      })
    }

    return pair
  }

  return securePair
})(SP, window.AudioContext)
