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

/*
 * The Listener module controls audio channel matching.
 */
var SP = SP || {}

SP.Listener = (function (SP, window_requestAnimationFrame) {
  return {
    create: function (canvasCtx) {
      var listener = {}
      var scriptNode
      var processor
      var matchCallback
      var audioChannel
      var inputBlockSize = 1024

      listener.start = function (audioContext, inputNode) {
        audioChannel = SP.Audio.create({
          sampleRate: audioContext.sampleRate
        })
        scriptNode = audioContext.createScriptProcessor(inputBlockSize, 1, 1)
        scriptNode.onaudioprocess = listenLoop
        inputNode.connect(scriptNode)
        scriptNode.connect(audioContext.destination)
      }

      listener.ready = function () {
        if (audioChannel) return true
        return false
      }

      listener.stop = function () {
        scriptNode = null
      }

      listener.match = function (bits, timeout, callback, ready) {
        x = canvasCtx.canvas.width
        correlation = null
        lastCorrelation = null
        haveHighCorrelation = 0
        highCorrelation = null
        found = false

        audioChannel.createMatcher(bits, inputBlockSize, function (newMatcher) {
          processor = newMatcher
          setTimeout(ready, 500)
        })
        matchCallback = callback

        if (timeout > 0) {
          setTimeout(function () {
            processor = null
            if (!found) {
              callback(null)
            }
          }, timeout)
        }
      }

      var x = 0
      var correlation = null
      var lastCorrelation = null
      var haveHighCorrelation = 0
      var highCorrelation = null
      var found = false

      var listenLoop = function (event) {
        var time = Date.now()
        var data = event.inputBuffer.getChannelData(0)
        if (processor) {
          lastCorrelation = correlation
          correlation = processor(data)
        }
        var elapsed = Date.now() - time
        if (processor && correlation !== null) {
          correlation.elapsed = elapsed / (inputBlockSize / 44100 * 1000)
        }

        window_requestAnimationFrame(function () {
          var width = canvasCtx.canvas.width
          var height = canvasCtx.canvas.height
          var labelWidth = 60

          if (processor && lastCorrelation !== null && correlation !== null) {
            if (correlation.votes >= 0.5) {
              console.log('High vote: ' + correlation.votes)
              haveHighCorrelation++
              if (highCorrelation === null || correlation.votes > highCorrelation.votes) {
                highCorrelation = correlation
              }
            } else if (haveHighCorrelation > 0 && !found) {
              haveHighCorrelation = 0
              var result = highCorrelation
              highCorrelation = null
              found = true
              setTimeout(function () {
                processor = null
              }, 2000)
              matchCallback(result)
            }
            if (x + labelWidth >= width) {
              canvasCtx.clearRect(0, 0, width, height)
              x = 0
            }

            var pixelsEach = height / (audioChannel.notes.length + 2)
            var scale = pixelsEach * 8 / 9
            var plot = function (i, label, last, current) {
              var offset = height - i * pixelsEach

              canvasCtx.fillStyle = 'rgb(0, 0, 0)'
              canvasCtx.font = '20px sans-serif'
              canvasCtx.fillText(label, 0, offset - 10)

              canvasCtx.beginPath()
              canvasCtx.strokeStyle = 'rgb(50, 100, 50)'
              canvasCtx.lineWidth = 1
              canvasCtx.moveTo(labelWidth + x, offset - last * scale)
              canvasCtx.lineTo(labelWidth + x + 1, offset - current * scale)
              canvasCtx.stroke()

              canvasCtx.beginPath()
              canvasCtx.strokeStyle = 'rgb(100, 100, 100)'
              canvasCtx.lineWidth = 1
              canvasCtx.moveTo(labelWidth + x, offset)
              canvasCtx.lineTo(labelWidth + x + 1, offset)
              canvasCtx.stroke()
            }

            var i = 1
            audioChannel.notes.forEach(function (note) {
              var value = correlation.correlations[note]
              var lastValue = lastCorrelation.correlations[note]
              plot(i, note, lastValue, value)
              i++
            })
            plot(i, 'detect', lastCorrelation.votes, correlation.votes)
            plot(0, 'timing', lastCorrelation.elapsed, correlation.elapsed)
            x += 0.25
          }
        })
      }
      return listener
    }
  }
})(SP, window.requestAnimationFrame)

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
