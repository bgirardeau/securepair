# SecurePair
SecurePair is a system to securely pair devices using Bluetooth and audio with minimal user interaction. Instead of needing a user to enter a PIN or compare numbers at the end of the pairing process, the devices emit a short audio sequence that is automatically recognized.

This [post](https://rajpurkar.github.io/mlx/recognizing-musical-melodies/) explains the project and how the latest system incorporating machine learning will work. This [paper](SecureAudioPairing.pdf) describes the original project in more detail, including the core protocol, related work, and initial system implementation. Work is in progress to replace the note recognition pipeline described in the paper with the machine learning approach.  

## Organization
  - `analysis/` System performance testing and analysis
  - `learning/` Machine learning system to recognize audio notes
  - `library/` Core library code
  - `phone/` Phone application
  - `server/` Server application

## Getting Started
This code demonstrates securely pairing a phone with a laptop. To set up the system, follow the instructions for the [`phone/README.md`](phone/README.md) and [`server/README.md`](server/README.md). The phone application currently works on iPhone, and the server has been tested on Mac OS X but should also work on Windows and Linux.

## Development

### System
Development of the system takes place in [`library/`](library/). When changes are made to the library, the phone and server library versions must be rebuilt and copied into `phone/www/js/` and `server/js/`.

### Audio Recognition
Work to recognize the audio notes using machine learning is in progress in [`learning`](learning/). It is not currently used by the library code.

Code to help test the original recognition pipeline is in `analysis/` and will be updated once the machine learning system is integrated.
