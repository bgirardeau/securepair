var fs = require('fs')
var jsmidgen = require('jsmidgen')

var SP = SP || {}

var Midi = function () {
  var d = new Date()
  this.t = d.getTime()
  // fs.mkdirSync('midi_files/' + this.t)
}

// notes is an array of notes, e.g. [67, 70, 72]
Midi.prototype.addNotes = function (notes, duration) {
  duration = duration * 128
  for (var i = 0; i < notes.length; i++) {
    this.track.addNote(0, notes[i], duration)
  }
}

Midi.prototype.writeFile = function (name) {
  fs.writeFileSync('midi_files/' + name + '.mid', this.file.toBytes(), 'binary')
}

Midi.prototype.newFile = function (notes, duration, name) {
  this.file = new jsmidgen.File()
  this.track = new jsmidgen.Track()
  this.track.setTempo(60)
  this.file.addTrack(this.track)

  this.time = 0
  if (typeof notes !== 'undefined') {
    this.addNotes(notes, duration)
    if (typeof name !== 'undefined') {
      this.writeFile(name)
    }
  }
}

if (typeof module !== 'undefined') module.exports = Midi
