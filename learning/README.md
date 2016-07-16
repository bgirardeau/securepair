
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

##Run 
###Data Generation
To generate data:
```bash
cd data/
source data_pipeline.sh
```
1000 wav files by default, can change in generate_midi.js

###Train Neural Network
To run neural net, use:
```bash
python train.py ./data/
```
To force use the cpu:
```THEANO_FLAGS=device=cpu python train.py data``` (for cpu)