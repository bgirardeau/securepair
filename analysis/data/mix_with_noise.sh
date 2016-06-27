#!/bin/bash
# $1: filename
# $2: output dir
# $3: volume
# $4: mix filename

filename=`basename $1 .wav`
mixfile=`basename $4 -rs-2.wav`
sox --combine mix "|sox $1 -p gain +$3" "|sox $4 -p gain -n" "|sox $1 -p synth noise vol 0.02" "$2/$filename-$mixfile-$3-noise.wav" trim 0 `soxi -D $1`
