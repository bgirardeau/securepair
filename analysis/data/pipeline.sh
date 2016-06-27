#!/bin/bash
mkdir midi_files
mkdir wav_files
mkdir mix_files

node generate_midi.js

for f in midi_files/*; do bash midi_to_wav.sh $f wav_files/; done
for f in wav_files/*; do bash mix_with_noise.sh $f mix_files/ 12 noise/babble-rs-2.wav; done
