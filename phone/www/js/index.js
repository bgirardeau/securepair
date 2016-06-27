/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 * Modified 2016 by Brad Girardeau
 */
var SP = SP || {}

var app = (function (SP, async, MIDI, $) {
  return {

    initialized: false,
    paired: false,

    initialize: function () {
      SP.Log.setHandler(function (message) {
        console.log(message)
      })
      app.log = SP.Log.makeLog('App')

      app.isPhone = (document.URL.indexOf('http://') === -1 &&
                     document.URL.indexOf('https://') === -1)

      async.parallel([
        function (callback) {
          if (app.isPhone) {
            document.addEventListener('deviceready', function () {
              app.receivedEvent('deviceready')
              callback()
            }, false)
          } else {
            app.receivedEvent('deviceready')
            callback()
          }
        }, function (callback) {
          MIDI.loadPlugin({
            soundfontUrl: './soundfont/',
            instrument: 'acoustic_grand_piano',
            onprogress: function (state, progress) {
              app.log.debug('MIDI ' + state + ' progress: ' + progress)
            },
            onsuccess: function () {
              app.log.debug('MIDI loaded')
              callback()
            }
          })
        }
      ], function (err, results) {
        if (err) {
          app.log.error('Error initializing application: ' + err)
        }
        app.ready()
      })
    },

    ready: function () {
      app.initialized = true
      app.receivedEvent('apploaded')
      SP.Plugins.load()
      app.securePair = SP.Pair.create()

      $('.audio-control').click(function (event) {
        var message = $(event.target).closest('i').attr('data')
        app.send(message)
      })

      $('#scan').click(function () {
        app.scan()
      })

      app.scan()
    },

    scan: function () {
      $('#loading').show()
      $('#status_message').text('Scanning')
      $('#scan').hide()
      var foundDevice = false
      app.securePair.scan(10000, function (device) {
        var option = $('<option>' + device.name + '</option>')
        option.attr('value', device.id)
        if (!foundDevice) {
          foundDevice = true
          app.pair(device)
        }
      })
      setTimeout(function () {
        if (!foundDevice) {
          $('#scan').show()
          $('#loading').hide()
          $('#status_message').text('No devices found')
        }
      }, 10000)
    },

    pair: function (device) {
      $('#loading').show()
      $('#status_message').text('Pairing')

      app.securePair.initiate(device.id, function (err, paired) {
        if (err || paired !== 'paired') {
          app.log.info('Could not pair with ' + device.name + ': ' + err)
          $('#status_message').text('Pairing Failed')
          $('#loading').hide()
          $('#scan').show()
        } else {
          app.paired = true
          app.log.info('Paired with ' + device.name)
          $('#status_message').text('Ready')
          $('#loading').hide()
          $('#scan').show()
        }
      })
    },

    send: function (message) {
      if (app.paired) {
        app.securePair.send(message, function (err) {
          if (err) {
            app.log.error('Error sending message')
          }
        })
      } else {
        app.log.info('Cannot send message when not paired')
      }
    },

    receivedEvent: function (id) {
      var parentElement = document.getElementById(id)
      if (!parentElement) return
      var listeningElement = parentElement.querySelector('.listening')
      var receivedElement = parentElement.querySelector('.received')

      listeningElement.setAttribute('style', 'display:none;')
      receivedElement.setAttribute('style', 'display:block;')

      app.log.info('Received Event: ' + id)
    }
  }
})(SP, window.async, window.MIDI, window.jQuery)
