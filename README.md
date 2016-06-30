# SecurePair

SecurePair is a system to securely pair devices using Bluetooth and audio with minimal user interaction.

##Install
### Python
```bash
pip install -r requirements.txt
```

### Node
```bash
npm install
```

### Fluidsynth
To generate wav from midi
```bash
brew install fluid-synth --with-libsndfile
```

### Sox
To add noise to wav
```bash
brew install sox
```

## Organization

library/ Core library code

phone/ Phone application

server/ Server application

analysis/ System performance testing and analysis

