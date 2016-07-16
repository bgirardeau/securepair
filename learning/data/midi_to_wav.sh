#!/bin/bash
# $1: filename
# $2: output dir
fluidsynth -F "$2`basename $1 .mid`.wav"  Scc1t2_Piano_1.sf2 "$1"
