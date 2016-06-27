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
