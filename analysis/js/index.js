/*
 * The main application.
 */
var ndarrayWav = require('ndarray-wav')
var path = require('path')
var fs = require('fs')

var SP = SP || {}

var app = (function (SP, Midi, async, MIDI, $, AudioContext, document) {
  var midi = new Midi()
  var channel = SP.Audio.create()
  var inputBlockSize = 1024

  var generateRandomMatchWav = function (filename) {
    var matchValue = SP.Crypto.getRandomBytes(SP.Crypto.SAS_RANDOM_SIZE)
    var bits = SP.Util.intToString(parseInt(matchValue, 16), 2, SP.Crypto.SAS_RANDOM_SIZE * 8)
    var notes = channel.getNotes(bits)
    if (typeof filename === 'undefined') {
      filename = ''
      for (var i = 0; i < notes.length; i++) {
        filename += notes[i]
      }
    }
    midi.newFile(notes, channel.noteDuration, filename)
  }

  var testWav = function (filepath, callback) {
    // console.log('*********')
    var notes = []
    var filename = path.basename(filepath)
    for (var i = 0; i < filename.length; i += 2) {
      if (filename[i] === '.') break
      notes.push(parseInt(filename.substring(i, i + 2), 10))
    }
    for (var k = 0; k < 2; k++) {
      var idx = Math.floor(Math.random() * notes.length)
      var newNote = -1
      // var oldNote = notes[idx]
      do {
        newNote = channel.notes[Math.floor(Math.random() * channel.notes.length)]
      } while (newNote === notes[idx])
      notes[idx] = newNote
    }
    var lastResult = null
    var currentResult = null
    var bestResult = null
    var haveHighVote = 0
    var threshold = 0.875
    var found = false
    var ready = function (all_data, matcher) {
      var zero = new Float32Array(inputBlockSize)
      for (var j = 0; j < zero.length; j++) {
        zero[j] = 0
      }
      for (var i = -15 * inputBlockSize; i < all_data.length + inputBlockSize * 15; i += inputBlockSize) {
        var data = zero
        if (i >= 0 && i < all_data.length) {
          data = all_data.subarray(i, i + inputBlockSize)
        }
        lastResult = currentResult
        currentResult = matcher(data)
        if (lastResult !== null && currentResult !== null) {
          if (bestResult === null || currentResult.vote > bestResult.vote) {
            bestResult = currentResult
          }
          if (currentResult.vote >= threshold) {
            haveHighVote++
          } else if (haveHighVote > 0 && !found) {
            found = true
          }
        }
      }
      var result = {
        found: found,
        name: filename
      }
      if (bestResult !== null) {
        result.data = bestResult
        /* if (bestResult.debug.votes[idx] === 1) {
          console.log(filename + ': @' + idx + ' ' + oldNote + ' -> ' + newNote)
          console.log('   ' + JSON.stringify(bestResult.debug.correlations[idx]))
          if (idx > 0) {
            console.log('   b ' + JSON.stringify(bestResult.debug.correlations[idx - 1]))
          }
          if (idx < bestResult.debug.correlations.length - 1) {
            console.log('   a ' + JSON.stringify(bestResult.debug.correlations[idx + 1]))
          }
        }*/
      }
      callback(null, result)
    }

    ndarrayWav.open(filepath, function (err, chunkMap, chunkArr) {
      if (err) {
        callback('error with ' + filepath + ': ' + err)
        return
      }
      var data = chunkMap.data
      var arr = new Float32Array(data.shape[1])
      for (var i = 0; i < arr.length; i++) {
        arr[i] = 0.5 * (data.get(0, i) + data.get(1, i))
      }
      channel.createNoteMatcher(notes, inputBlockSize, function (matcher) {
        ready(arr, matcher)
      })
    })
  }

  return {
    initialize: function () {
      // var featuresCanvas = document.getElementById('features')
      // var featuresCtx = featuresCanvas.getContext('2d')
      // app.listener = SP.Listener.create(featuresCtx)
      // needed for MIDI XHR request to work in nw.js
      MIDI.client = MIDI.client || {}
      MIDI.client.cordova = true
      MIDI.loadPlugin({
        soundfontUrl: './soundfont/',
        instrument: 'acoustic_grand_piano',
        onprogress: function (state, progress) {
          console.log('MIDI ' + state + ' progress:', progress)
        },
        onsuccess: function () {
          console.log('MIDI loaded')
          app.run()
        }
      })
    },
    run: function () {
      var files = fs.readdirSync('wav_files/')
      files = files.filter(function (f) {
        return f.indexOf('wav') > 0
      })
      files.sort()
      var test = files.slice(0, 500)
      // test = ['7272778372758383.wav']
      // test = ['7272728172767479.wav']
      async.mapSeries(test, function (path, cb) {
        testWav('wav_files/' + path, cb)
      }, function (err, results) {
        if (err) {
          console.log('* ' + err)
        }
        var success = 0
        var total_votes = 0
        for (var i = 0; i < results.length; i++) {
          if (results[i].found) {
            success++
            total_votes += results[i].data.vote
            console.log('found: ' + results[i].name + ' (' + results[i].data.vote + ')')
            if (results[i].data.vote < 1) {
              console.log('        ' + results[i].data.debug.votes)
            }
          } else {
            console.log('failed to find: ' + results[i].name)
            console.log('         ' + results[i].data.debug.votes)
            console.log('         ' + JSON.stringify(results[i].data.debug.correlations))
          }
        }
        console.log('result: ' + success + '/' + results.length + ' with confidence ' + total_votes / success)
      })
      /* testWav('wav_files/7272727275757683.wav', function (err, result) {
        console.log('* ' + found)
      }) */
      /* for (var i = 0; i < 10000; i++) {
        generateRandomMatchWav()
      } */
    }
  }
})(SP, window.Midi, window.async, window.MIDI, window.jQuery, window.AudioContext, document)
