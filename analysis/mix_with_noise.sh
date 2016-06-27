#!/bin/bash
# $1: filename
# $2: volume
# $3: mix filename

filename=`basename $1 .wav`
mixfile=`basename $3 -rs-2.wav`
sox --combine mix "|sox $1 -p gain +$2" "|sox $3 -p gain -n" "|sox $1 -p synth noise vol 0.02" ~/securepair_data/mixed/$filename-$mixfile-$2-noise.wav trim 0 `soxi -D $1`
