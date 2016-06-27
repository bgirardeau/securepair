for f in midi_files/*; do fluidsynth -F "wav_files/`basename $f .mid`.wav"  soundfont/Scc1t2_Piano_1.sf2 "$f"; done
