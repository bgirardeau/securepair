import os
import scipy.io.wavfile
import numpy as np
from keras.utils import np_utils

BLOCK_SIZE = 512
DOWNSAMPLE = 4

def get_notes(f):
  f = f.split('.wav')[0].split('-')[0]
  notes = []
  for i in range(0, len(f), 2):
    notes.append(int(f[i:i+2]))
  return notes

def process_dir(directory):
  files = os.listdir(directory)
  X = []
  y = []

  for f in files:
    # print(DIR + f)
    sr, data = scipy.io.wavfile.read(directory + '/' + f)
    assert sr == 44100
    notes = get_notes(f)
    # print(notes)
    note_len = int(data.shape[0] / len(notes))
    for i, n in enumerate(notes):
      note = data[note_len * i: note_len * (i + 1)]
      windows = []
      for i in range(0, note_len, BLOCK_SIZE):
        window = note[i: i + BLOCK_SIZE: DOWNSAMPLE, 0]
        if (window.shape[0] < BLOCK_SIZE / DOWNSAMPLE):
          window = np.pad(window, (0, int(BLOCK_SIZE / DOWNSAMPLE - window.shape[0])), 'constant', constant_values=0)
        windows.append(window)
      X.append(np.array(windows))
      y.append(n)
  classes = np.unique(y).tolist()
  classes.sort()
  y = list(map(lambda n: classes.index(n), y))
  y = np_utils.to_categorical(y, len(classes))
  
  return np.array(X), y, classes

def main():
  X, y, classes = process_dir(os.getcwd())
  with open('X.npy', 'wb') as f:
    np.save(f, X)
  with open('y.npy', 'wb') as f:
    np.save(f, y)
  with open('classes.npy', 'wb') as f:
    np.save(f, classes)

if __name__ == '__main__':
  main()
