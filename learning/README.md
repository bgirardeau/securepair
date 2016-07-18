
##Install
### Python
```bash
pip install -r requirements.txt
pip install -r seqmodels/requirements.txt
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
python main.py ./data/mix_files
```