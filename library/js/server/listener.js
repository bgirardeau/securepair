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
            if (correlation.vote >= 0.7) {
              console.log('High vote: ' + correlation.vote)
              haveHighCorrelation++
              if (highCorrelation === null || correlation.vote > highCorrelation.vote) {
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
              var value = correlation.info.correlations[0][note]
              var lastValue = lastCorrelation.info.correlations[0][note]
              plot(i, note, lastValue, value)
              i++
            })
            plot(i, 'detect', lastCorrelation.vote, correlation.vote)
            plot(0, 'timing', lastCorrelation.elapsed, correlation.elapsed)
            x += 0.25
          }
        })
      }
      return listener
    }
  }
})(SP, window.requestAnimationFrame)
