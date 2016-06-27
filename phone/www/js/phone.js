/*
 * The Audio module handles sending and matching data over audio. The phone
 * only uses the encode and play functions. The listener uses the matcher
 * and correlation functions.
 *
 * Functions:
 *   SP.Audio.defaultCorrelationAnalyzer [read only]
 *   SP.Audio.create(options)
 *     channel.correlationAnalyzer
 *       fn(Correlations, expectedNote)
 *         Boolean
 *     channel.getNotes(bits)
 *     channel.encodeNotes(notes, callback)
 *       callback(buffer)
 *     channel.encode(bits, callback)
 *       callback(buffer)
 *     channel.play(audioContext, bits, callback)
 *       callback()
 *     channel.createMatcher(bits, inputBlockSize, callback)
 *       callback(matchFn)
 *         matchFn(audioInputBlock)
 *   SP.Audio.Correlations()
 *     correlations.average()
 *     correlations[note] ->
 *       Number [correlation coefficient for note]
 */
var SP = SP || {}

SP.Audio = (function (SP, MIDI, OfflineAudioContext) {
  var audioChannel = {
    get defaultCorrelationAnalyzer () {
      return defaultCorrelationAnalyzer
    }
  }

  audioChannel.create = function (options) {
    var channel = {
      get correlationAnalyzer () {
        return correlationAnalyzer
      },
      set correlationAnalyzer (fn) {
        correlationAnalyzer = fn
      }
    }

    options = options || {}
    channel.noteDuration = options.noteDuration || 0.25
    channel.sampleRate = options.sampleRate || 44100
    channel.notes = options.notes || [72, 74, 75, 76, 77, 79, 81, 83]

    channel.getNotes = function (bits) {
      var parsedNumber = parseInt(bits, 2)
      var numNotes = channel.notes.length
      var notesNeeded = Math.ceil(bits.length / Math.log2(numNotes))
      var encodedString = SP.Util.intToString(parsedNumber, numNotes, notesNeeded)
      var encodedNotes = []
      for (var i = 0; i < encodedString.length; i++) {
        var idx = parseInt(encodedString[i], channel.notes.length)
        encodedNotes.push(channel.notes[idx])
      }
      return encodedNotes
    }

    channel.encodeNotes = function (notes, callback) {
      var numSamples = notes.length * channel.noteDuration * channel.sampleRate
      var audioContext = new OfflineAudioContext(1, numSamples, channel.sampleRate)
      MIDI.setContext(audioContext, function () {
        audioContext.oncomplete = function (e) {
          callback(e.renderedBuffer)
        }
        for (var i = 0; i < notes.length; i++) {
          playNote(notes[i], i * channel.noteDuration, channel.noteDuration)
        }
        audioContext.startRendering()
      })
    }

    channel.encode = function (bits, callback) {
      var notes = channel.getNotes(bits)
      channel.encodeNotes(notes, callback)
    }

    channel.play = function (audioContext, bits, callback) {
      channel.encode(bits, function (data) {
        var song = audioContext.createBufferSource()
        song.buffer = data
        song.onended = callback
        song.connect(audioContext.destination)
        song.start(0)
      })
    }

    var correlationAnalyzer = defaultCorrelationAnalyzer

    channel.createMatcher = function (bits, inputBlockSize, callback) {
      channel.createNoteMatcher(channel.getNotes(bits), inputBlockSize, callback)
    }

    channel.createNoteMatcher = function (notes, inputBlockSize, callback) {
      makeCorrelationBank(inputBlockSize, function (correlationBank) {
        var samplesPerNote = channel.noteDuration * channel.sampleRate

        // circular buffer
        var buffer = new Float32Array(channel.notes.length * samplesPerNote + inputBlockSize)
        var bufferLength = 0

        var frameProcessor = function (audioData) {
          // resample and copy into buffer
          for (var i = 0; i < audioData.length; i++) {
            buffer[bufferLength++ % buffer.length] = audioData[i]
          }
          // wait for buffer to fill
          if (bufferLength < buffer.length - inputBlockSize) {
            return null
          }
          // analyze each note period to see if it looks OK
          var total_votes = 0
          var votes = []
          var correlations = []
          for (i = 0; i < notes.length; i++) {
            correlations.push(correlationBank(buffer, bufferLength + i * samplesPerNote, samplesPerNote))
            votes.push(correlationAnalyzer(correlations[i], notes[i]))
            total_votes += votes[i]
          }
          total_votes /= notes.length
          var info = {
            correlations: correlations,
            votes: votes
          }
          return {
            vote: total_votes,
            info: info
          }
        }
        callback(frameProcessor)
      })
    }

    var getNoteTable = function (callback) {
      channel.encodeNotes(channel.notes, function (buffer) {
        var data = buffer.getChannelData(0)
        var samplesPerNote = data.length / channel.notes.length
        var table = {}
        for (var i = 0; i < channel.notes.length; i++) {
          table[channel.notes[i]] = data.subarray(i * samplesPerNote, (i + 1) * samplesPerNote)
        }
        callback(table)
      })
    }

    // The correlation function returned handles circular buffers
    var makeCorrelationBank = function (border, callback) {
      getNoteTable(function (table) {
        var correlators = {}
        channel.notes.forEach(function (note) {
          correlators[note] = makeCorrelator(table[note], border)
        })

        var correlationBank = function (input, offset, length) {
          var correlations = new audioChannel.Correlations()
          for (var note in correlators) {
            correlations[note] = correlators[note](input, offset, length)
          }
          return correlations
        }

        callback(correlationBank)
      })
    }

    return channel
  }

  audioChannel.Correlations = function () {}
  audioChannel.Correlations.prototype.average = function () {
    var average = 0
    var count = 0
    for (var key in this) {
      average += this[key]
      count++
    }
    return average / count
  }

  var playNote = function (note, time, duration) {
    MIDI.noteOn(0, note, 127, time)
    MIDI.noteOff(0, note, time + duration)
  }
  /*
    MIDI table for reference
    -------------------------
    note  name  frequency (Hz)
    60    C4    261.6
    62    D4
    64    E4
    65    F4
    67    G4
    69    A4    440
    71    B4
    72    C5    523.25
    74    D5
    76    E5
    77    F5
    79    G5
    81    A5    880
    83    B5
    84    C6    1046.5

  Functions to play notes as sine waves (no MIDI)
  -----------------------------------------------

  var noteToFrequency = function (note) {
    return Math.pow(2, (note - 69) / 12) * 440
  }

  var playFrequency = function (audioContext, frequency, time, duration) {
    if (duration === 0) {
      return
    }
    var oscillator = audioContext.createOscillator()
    oscillator.connect(audioContext.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.start(time)
    oscillator.stop(time + duration)
  }
  */

  var defaultCorrelationAnalyzer = function (correlations, expected) {
    if (correlations[expected] > 0.25) {
      return 1
    }

    var average = correlations.average()

    if (correlations[expected] > 0.1 &&
        correlations[expected] > 0.5 * average) {
      return 1
    }

    if (correlations[expected] > 0.05 &&
        correlations[expected] > 2.0 * average) {
      return 1
    }

    return 0
  }

  // This function handles circular buffers
  var sumSquares = function (data, offset, length) {
    offset = offset || 0
    length = length || data.length
    var sum = 0
    for (var i = offset; i < offset + length; i++) {
      sum += data[i % data.length] * data[i % data.length]
    }
    return sum
  }

  // The correlator returned handles circular buffers
  var makeCorrelator = function (signal, border) {
    var signalScale = sumSquares(signal, border, signal.length - 2 * border)
    return function (input, offset, length) {
      offset += border
      length -= 2 * border
      var inputScale = sumSquares(input, offset, length)
      var correlation = 0
      for (var i = 0; i < length; i++) {
        correlation += input[(offset + i) % input.length] * signal[i]
      }
      return Math.abs(correlation) / Math.sqrt(inputScale * signalScale)
    }
  }

  return audioChannel
})(SP, window.MIDI, window.OfflineAudioContext)

/*
 * The Bluetooth module handles the bluetooth channel.
 */
var SP = SP || {}

SP.Bluetooth = {
  SERVICE_UID: '90A8DD1E-BB81-44C8-9181-F0DBA1FE5587',
  CHARACTERISTIC_ID: '7B2E744C-8C71-4E32-A5D9-F9DD8C9F030D',
  NOTIFY_CHARACTERISTIC_ID: '80b93575-35dd-485d-849b-54cd54dbff62'
}

/*
 * The Crypto module handles the pairing protocol and message encryption.
 *
 * Functions:
 *   SP.Crypto.initiatePairing(readBytes, writeBytes, authenticatedMatch, callback)
 *     callback(err, sharedKey)
 *       sharedKey.encrypt(message)
 *       sharedKey.decrypt(ciphertext)
 */
var nacl_factory = window.nacl_factory || require('./js/vendor/nacl_factory')

var SP = SP || {}

SP.Crypto = (function (SP, window_crypto, nacl_factory) {
  var nacl = nacl_factory.instantiate()

  var ECDH_KEY_SIZE = 32
  var COMMIT_RANDOM_SIZE = 2
  var SAS_RANDOM_SIZE = 3

  var getRandomBytes = function (bytes) {
    var random = new Uint8Array(bytes)
    window_crypto.getRandomValues(random)
    return random
  }

  var getRandomHexBytes = function (bytes) {
    return nacl.to_hex(getRandomBytes(bytes))
  }

  var generateECDHKey = function () {
    var key = {}
    var secretKey = getRandomBytes(ECDH_KEY_SIZE)
    secretKey[0] &= 248
    secretKey[31] &= 127
    secretKey[31] |= 64
    key.publicKey = nacl.crypto_scalarmult_base(secretKey)
    key.computeSharedKey = function (otherPublicKey) {
      otherPublicKey = otherPublicKey.subarray(0, ECDH_KEY_SIZE)
      return wrapSharedKey(nacl.crypto_scalarmult(secretKey, otherPublicKey))
    }
    return key
  }

  var wrapSharedKey = function (key) {
    key = key.subarray(0, nacl.crypto_secretbox_KEYBYTES)

    var keyObj = {}
    keyObj.encrypt = function (data) {
      var nonce = nacl.crypto_secretbox_random_nonce()
      var ciphertext = nacl.crypto_secretbox(data, nonce, key)
      return concatByteArrays(nonce, ciphertext)
    }
    keyObj.decrypt = function (data) {
      var nonce = data.subarray(0, nacl.crypto_secretbox_NONCEBYTES)
      var ciphertext = data.subarray(nacl.crypto_secretbox_NONCEBYTES)
      return nacl.crypto_secretbox_open(ciphertext, nonce, key)
    }
    keyObj.encryptString = function (message) {
      return keyObj.encrypt(nacl.encode_utf8(message))
    }
    keyObj.decryptString = function (data) {
      return nacl.decode_utf8(keyObj.decrypt(data))
    }
    return keyObj
  }

  var makeCommitment = function (message) {
    var random = getRandomBytes(COMMIT_RANDOM_SIZE)
    var concatenated = concatByteArrays(random, message)
    return {
      commitment: nacl.crypto_hash_sha256(concatenated),
      opening: concatenated
    }
  }

  var concatByteArrays = function (array1, array2) {
    var concatenated = new Uint8Array(array1.byteLength + array2.byteLength)
    concatenated.set(array1, 0)
    concatenated.set(array2, array1.byteLength)
    return concatenated
  }

  var openCommitment = function (commitment, opening) {
    var check = nacl.crypto_hash_sha256(opening)
    if (!constTimeEqual(commitment, check)) {
      return null
    }
    var message = opening.subarray(COMMIT_RANDOM_SIZE)
    return message
  }

  var constTimeEqual = function (array1, array2) {
    var c = 0
    if (array1.length !== array2.length) {
      return false
    }
    for (var i = 0; i < array1.length; i++) {
      c |= array1[i] ^ array2[i]
    }
    return c === 0
  }

  var listenForPairing = function (readBytes, writeBytes, authenticatedMatch, callback) {
    var ecdhKey = generateECDHKey()
    var myRandom = getRandomBytes(SAS_RANDOM_SIZE)
    var message = concatByteArrays(myRandom, ecdhKey.publicKey)
    var myCommitment = makeCommitment(message)

    readBytes(function (err, theirCommitment) {
      if (err) {
        return callback('error reading their commitment (' + err + ')')
      }
      writeBytes(myCommitment.commitment, function (err) {
        if (err) {
          return callback('error sending commitment (' + err + ')')
        }
        readBytes(function (err, theirOpening) {
          if (err) {
            return callback('error reading commit opening (' + err + ')')
          }
          writeBytes(myCommitment.opening, function (err) {
            if (err) {
              return callback('error writing opening (' + err + ')')
            }
            var theirMessage = openCommitment(theirCommitment, theirOpening)
            if (theirMessage === null) {
              return callback('error opening commitment')
            }
            var theirRandom = theirMessage.subarray(0, SAS_RANDOM_SIZE)
            var theirPublicKey = theirMessage.subarray(SAS_RANDOM_SIZE)

            var sharedKey = ecdhKey.computeSharedKey(theirPublicKey)
            var matchValue = new Uint8Array(SAS_RANDOM_SIZE)
            for (var i = 0; i < SAS_RANDOM_SIZE; i++) {
              matchValue[i] = myRandom[i] ^ theirRandom[i]
            }
            matchValue = parseInt(nacl.to_hex(matchValue), 16)

            authenticatedMatch(matchValue, function (err, result) {
              callback(err, result, sharedKey)
            })
          })
        })
      })
    })
  }

  var initiatePairing = function (readBytes, writeBytes, authenticatedMatch, callback) {
    var ecdhKey = generateECDHKey()
    var myRandom = getRandomBytes(SAS_RANDOM_SIZE)
    var message = concatByteArrays(myRandom, ecdhKey.publicKey)
    var myCommitment = makeCommitment(message)
    writeBytes(myCommitment.commitment, function (err) {
      if (err) {
        return callback('error sending first message (' + err + ')')
      }
      readBytes(function (err, theirCommitment) {
        if (err) {
          return callback('error reading their commitment (' + err + ')')
        }
        writeBytes(myCommitment.opening, function (err) {
          if (err) {
            return callback('error sending commit opening (' + err + ')')
          }
          readBytes(function (err, theirOpening) {
            if (err) {
              return callback('error reading their opening (' + err + ')')
            }
            var theirMessage = openCommitment(theirCommitment, theirOpening)
            if (theirMessage === null) {
              return callback('error opening commitment')
            }
            var theirRandom = theirMessage.subarray(0, SAS_RANDOM_SIZE)
            var theirPublicKey = theirMessage.subarray(SAS_RANDOM_SIZE)

            var sharedKey = ecdhKey.computeSharedKey(theirPublicKey)
            var matchValue = new Uint8Array(SAS_RANDOM_SIZE)
            for (var i = 0; i < SAS_RANDOM_SIZE; i++) {
              matchValue[i] = myRandom[i] ^ theirRandom[i]
            }
            matchValue = parseInt(nacl.to_hex(matchValue), 16)

            authenticatedMatch(matchValue, function (err, result) {
              callback(err, result, sharedKey)
            })
          })
        })
      })
    })
  }

  return {
    initiatePairing: initiatePairing,
    listenForPairing: listenForPairing,
    getRandomBytes: getRandomHexBytes,
    SAS_RANDOM_SIZE: SAS_RANDOM_SIZE
  }
})(SP, window.crypto, nacl_factory)

/*
 * The Log module handles logging for the other modules.
 */
var SP = SP || {}

SP.Log = (function () {
  var handler
  return {
    makeLog: function (name) {
      return {
        debug: function (message) {
          handler && handler('[' + name + '] ' + message)
        },
        info: function (message) {
          handler && handler('[' + name + '] ' + message)
        },
        error: function (message) {
          handler && handler('[' + name + '] ' + message)
        }
      }
    },
    setHandler: function (_handler) {
      handler = _handler
    }
  }
})()

/*
 * Util module.
 */
var SP = SP || {}

SP.Util = (function (SP) {
  return {
    intToString: function (number, radix, minLength) {
      var string = number.toString(radix)
      if (string.length < minLength) {
        string = new Array(minLength - string.length + 1).join('0') + string
      }
      return string
    },

    // ASCII only
    stringToBytes: function (string) {
      var array = new Uint8Array(string.length)
      for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i)
      }
      return array.buffer
    },

    // ASCII only
    bytesToString: function (buffer) {
      return String.fromCharCode.apply(null, new Uint8Array(buffer))
    },

    toArrayBuffer: function (buffer) {
      var ab = new ArrayBuffer(buffer.length)
      var view = new Uint8Array(ab)
      for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i]
      }
      return view
    }
  }
})(SP)

/*
 * The Bluetooth module handles communication over the Bluetooth channel.
 *
 * Functions:
 *   SP.Bluetooth.create()
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
    var btChannel = SP.Bluetooth.create()

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

/**
 * Plugins module.
 *
 * Functions:
 *   SP.Plugins.load()
 */
var SP = SP || {}

// Populate SP.Plugins with Cordova plugin references
SP.Plugins = (function (window) {
  return {
    load: function () {
      SP.Plugins.ble = window.ble
    }
  }
})(window)
