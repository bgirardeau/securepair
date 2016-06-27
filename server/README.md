# Secure Pairing with Audio

This project demonstrates secure pairing of Bluetooth LE devices using audio,
implementing the peripheral role.

## Getting Started

### Installation

First make sure [Node.js](https://nodejs.org) and npm are installed. Then
install the application's dependencies:

```
npm install
./rebuild.sh
```

### Running

Now you can start the application with `npm start`. It will begin
listening for a pairing automatically. Use the phone application to test pairing.
Currently the application needs to be restarted to stop pairing with the
current device.
