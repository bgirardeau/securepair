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
