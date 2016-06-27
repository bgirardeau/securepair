var Midi = require('./midi.js')
var SP = require('../sp.js')

var main = function (SP, Midi, directory, number) {
  var midi = new Midi(directory)
  var channel = SP.Audio.create()
  number = number || 1000

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

  for (var i = 0; i < number; i++) {
    generateRandomMatchWav()
  }
}

main(SP, Midi, 'midi_files/')
