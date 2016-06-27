/*
 * The main application.
 */
var SP = SP || {}

var app = (function (SP, MIDI, $, AudioContext, document) {
  var listener
  var audioCtx
  var featuresCanvas
  var featuresCtx
  var mediaStreamSource
  var isListening

  var toggleListening = function () {
    if (isListening) {
      isListening = false
      mediaStreamSource = null
      listener.stop()
    } else {
      getUserMedia({
        'audio': {
          'mandatory': {
            'googEchoCancellation': 'false',
            'googAutoGainControl': 'false',
            'googNoiseSuppression': 'false',
            'googHighpassFilter': 'false'
          },
          'optional': []
        }
      }, function (stream) {
        mediaStreamSource = audioCtx.createMediaStreamSource(stream)
        listener.start(audioCtx, mediaStreamSource)
      })
    }
  }

  function getUserMedia (dictionary, callback) {
    try {
      navigator.getUserMedia = (
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia
      )
      navigator.getUserMedia(dictionary, callback, function () {
        console.log('Opening user media failed')
      })
    } catch (e) {
      console.log('getUserMedia threw exception :' + e)
    }
  }

  return {
    initialize: function () {
      featuresCanvas = document.getElementById('features')
      featuresCtx = featuresCanvas.getContext('2d')
      listener = SP.Listener.create(featuresCtx)
      audioCtx = new AudioContext()

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
        }
      })

      SP.Bluetooth.Server.start(function (err) {
        if (err) console.log('error starting advertising')
      })

      toggleListening()

      app.pair = SP.Pair.create(listener)
      var listenCB = function (err, result) {
        if (err) console.log('error listening for pairing: ' + err)
        if (!result) {
          $('#pairing-result').text('Pairing Failed')
          app.pair.listen(listenCB)
        } else {
          $('#pairing-result').text('Pairing Succeeded')
          var receivedCB = function (err, message) {
            if (err) console.log('Error receiving message: ' + message)
            app.controlReceived(message)
            app.pair.receive(receivedCB)
          }
          app.pair.receive(receivedCB)
        }
      }
      app.pair.listen(listenCB)
    },

    controlReceived: function (control) {
      $('#control').text(control)
    }
  }
})(SP, window.MIDI, window.jQuery, window.AudioContext, document)
