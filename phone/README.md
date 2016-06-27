# Secure Pairing with Audio

This project demonstrates secure pairing of Bluetooth LE devices using audio,
implementing the central role on a phone.

## Getting Started

### Installation

This is a [PhoneGap](http://phonegap.com/) application. To run on a phone without
compiling, you need to first download the PhoneGap application for your platform
(this project is currently only tested on iOS).

Now make sure [Node.js](https://nodejs.org) and npm are installed. Then
install PhoneGap on your computer and start the PhoneGap server:

```
npm install -g phonegap
phonegap serve
```

### Running

Once the PhoneGap server is running on your computer, open the PhoneGap application
on the phone and connect to the computer.

If you have also started the Secure Pairing server, the phone should play a short
sequence of audio after a few seconds that is detected by the Secure Pairing server.

### Running Natively

PhoneGap can also be used to create native applications, without need for a server
or the PhoneGap application. To build a native iOS application, first generate
the Xcode framework:

```
phonegap build ios
```

Now you can open the application in `platforms/ios` in Xcode as a native iOS
application. You should not make any changes in this native application, as
they may be overwritten. Instead make the changes in `www/`, then rerun
the above command to regenerate the application.
 
