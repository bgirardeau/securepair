/*
 * The Crypto module handles the pairing protocol and message encryption.
 *
 * Functions:
 *   SP.Crypto.initiatePairing(readBytes, writeBytes, authenticatedMatch, callback)
 *     callback(err, sharedKey)
 *       sharedKey.encrypt(message)
 *       sharedKey.decrypt(ciphertext)
 */
var nacl_factory = window.nacl_factory || require('./js/vendor/nacl_factory')

var SP = SP || {}

SP.Crypto = (function (SP, window_crypto, nacl_factory) {
  var nacl = nacl_factory.instantiate()

  var ECDH_KEY_SIZE = 32
  var COMMIT_RANDOM_SIZE = 2
  var SAS_RANDOM_SIZE = 3

  var getRandomBytes = function (bytes) {
    var random = new Uint8Array(bytes)
    window_crypto.getRandomValues(random)
    return random
  }

  var getRandomHexBytes = function (bytes) {
    return nacl.to_hex(getRandomBytes(bytes))
  }

  var generateECDHKey = function () {
    var key = {}
    var secretKey = getRandomBytes(ECDH_KEY_SIZE)
    secretKey[0] &= 248
    secretKey[31] &= 127
    secretKey[31] |= 64
    key.publicKey = nacl.crypto_scalarmult_base(secretKey)
    key.computeSharedKey = function (otherPublicKey) {
      otherPublicKey = otherPublicKey.subarray(0, ECDH_KEY_SIZE)
      return wrapSharedKey(nacl.crypto_scalarmult(secretKey, otherPublicKey))
    }
    return key
  }

  var wrapSharedKey = function (key) {
    key = key.subarray(0, nacl.crypto_secretbox_KEYBYTES)

    var keyObj = {}
    keyObj.encrypt = function (data) {
      var nonce = nacl.crypto_secretbox_random_nonce()
      var ciphertext = nacl.crypto_secretbox(data, nonce, key)
      return concatByteArrays(nonce, ciphertext)
    }
    keyObj.decrypt = function (data) {
      var nonce = data.subarray(0, nacl.crypto_secretbox_NONCEBYTES)
      var ciphertext = data.subarray(nacl.crypto_secretbox_NONCEBYTES)
      return nacl.crypto_secretbox_open(ciphertext, nonce, key)
    }
    keyObj.encryptString = function (message) {
      return keyObj.encrypt(nacl.encode_utf8(message))
    }
    keyObj.decryptString = function (data) {
      return nacl.decode_utf8(keyObj.decrypt(data))
    }
    return keyObj
  }

  var makeCommitment = function (message) {
    var random = getRandomBytes(COMMIT_RANDOM_SIZE)
    var concatenated = concatByteArrays(random, message)
    return {
      commitment: nacl.crypto_hash_sha256(concatenated),
      opening: concatenated
    }
  }

  var concatByteArrays = function (array1, array2) {
    var concatenated = new Uint8Array(array1.byteLength + array2.byteLength)
    concatenated.set(array1, 0)
    concatenated.set(array2, array1.byteLength)
    return concatenated
  }

  var openCommitment = function (commitment, opening) {
    var check = nacl.crypto_hash_sha256(opening)
    if (!constTimeEqual(commitment, check)) {
      return null
    }
    var message = opening.subarray(COMMIT_RANDOM_SIZE)
    return message
  }

  var constTimeEqual = function (array1, array2) {
    var c = 0
    if (array1.length !== array2.length) {
      return false
    }
    for (var i = 0; i < array1.length; i++) {
      c |= array1[i] ^ array2[i]
    }
    return c === 0
  }

  var listenForPairing = function (readBytes, writeBytes, authenticatedMatch, callback) {
    var ecdhKey = generateECDHKey()
    var myRandom = getRandomBytes(SAS_RANDOM_SIZE)
    var message = concatByteArrays(myRandom, ecdhKey.publicKey)
    var myCommitment = makeCommitment(message)

    readBytes(function (err, theirCommitment) {
      if (err) {
        return callback('error reading their commitment (' + err + ')')
      }
      writeBytes(myCommitment.commitment, function (err) {
        if (err) {
          return callback('error sending commitment (' + err + ')')
        }
        readBytes(function (err, theirOpening) {
          if (err) {
            return callback('error reading commit opening (' + err + ')')
          }
          writeBytes(myCommitment.opening, function (err) {
            if (err) {
              return callback('error writing opening (' + err + ')')
            }
            var theirMessage = openCommitment(theirCommitment, theirOpening)
            if (theirMessage === null) {
              return callback('error opening commitment')
            }
            var theirRandom = theirMessage.subarray(0, SAS_RANDOM_SIZE)
            var theirPublicKey = theirMessage.subarray(SAS_RANDOM_SIZE)

            var sharedKey = ecdhKey.computeSharedKey(theirPublicKey)
            var matchValue = new Uint8Array(SAS_RANDOM_SIZE)
            for (var i = 0; i < SAS_RANDOM_SIZE; i++) {
              matchValue[i] = myRandom[i] ^ theirRandom[i]
            }
            matchValue = parseInt(nacl.to_hex(matchValue), 16)

            authenticatedMatch(matchValue, function (err, result) {
              callback(err, result, sharedKey)
            })
          })
        })
      })
    })
  }

  var initiatePairing = function (readBytes, writeBytes, authenticatedMatch, callback) {
    var ecdhKey = generateECDHKey()
    var myRandom = getRandomBytes(SAS_RANDOM_SIZE)
    var message = concatByteArrays(myRandom, ecdhKey.publicKey)
    var myCommitment = makeCommitment(message)
    writeBytes(myCommitment.commitment, function (err) {
      if (err) {
        return callback('error sending first message (' + err + ')')
      }
      readBytes(function (err, theirCommitment) {
        if (err) {
          return callback('error reading their commitment (' + err + ')')
        }
        writeBytes(myCommitment.opening, function (err) {
          if (err) {
            return callback('error sending commit opening (' + err + ')')
          }
          readBytes(function (err, theirOpening) {
            if (err) {
              return callback('error reading their opening (' + err + ')')
            }
            var theirMessage = openCommitment(theirCommitment, theirOpening)
            if (theirMessage === null) {
              return callback('error opening commitment')
            }
            var theirRandom = theirMessage.subarray(0, SAS_RANDOM_SIZE)
            var theirPublicKey = theirMessage.subarray(SAS_RANDOM_SIZE)

            var sharedKey = ecdhKey.computeSharedKey(theirPublicKey)
            var matchValue = new Uint8Array(SAS_RANDOM_SIZE)
            for (var i = 0; i < SAS_RANDOM_SIZE; i++) {
              matchValue[i] = myRandom[i] ^ theirRandom[i]
            }
            matchValue = parseInt(nacl.to_hex(matchValue), 16)

            authenticatedMatch(matchValue, function (err, result) {
              callback(err, result, sharedKey)
            })
          })
        })
      })
    })
  }

  return {
    initiatePairing: initiatePairing,
    listenForPairing: listenForPairing,
    getRandomBytes: getRandomHexBytes,
    SAS_RANDOM_SIZE: SAS_RANDOM_SIZE
  }
})(SP, window.crypto, nacl_factory)
