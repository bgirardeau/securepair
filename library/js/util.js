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
