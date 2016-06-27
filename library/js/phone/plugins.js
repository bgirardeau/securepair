/**
 * Plugins module.
 *
 * Functions:
 *   SP.Plugins.load()
 */
var SP = SP || {}

// Populate SP.Plugins with Cordova plugin references
SP.Plugins = (function (window) {
  return {
    load: function () {
      SP.Plugins.ble = window.ble
    }
  }
})(window)
