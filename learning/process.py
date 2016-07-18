"""Processor module."""
import json
import numpy as np
import glob
import os

import scipy.io.wavfile
from tqdm import tqdm


class Processor(object):
    def __init__(self):
        self.RANDOM_SEED = 2
        self.SAMPLE_RATE = 44100
        self.SUBSAMPLE = 8

    def _get_raw(self, data_folder):
        print("Loading files...")
        for f in tqdm(glob.glob(data_folder + '/*.wav')):
            sr, x = scipy.io.wavfile.read(f)
            assert sr == self.SAMPLE_RATE
            y_str = os.path.basename(f).split('-')[0]
            y = []
            for i in range(0, len(y_str), 2):
                y.append(int(y_str[i:i + 2]))
            yield (x, y)

    def _add_time(self, x_y_pairs):
        for x, y in x_y_pairs:
            time_x = np.array(range(len(x))) / self.SAMPLE_RATE
            time_y = (np.array(range(len(y))) + 0.5) *  time_x[-1] / len(y)
            yield (np.column_stack((x, time_x)), np.column_stack((y, time_y)))

    def _subsample(self, x_y_pairs):
        for x, y in x_y_pairs:
            yield (x[::self.SUBSAMPLE], y)

    def load_xy_pairs(self, data_folder):
        """Run the pipeline to load the dataset given a filename."""
        x_y_raw = self._get_raw(data_folder)
        x_y_timed = self._add_time(x_y_raw)
        x_y_subsampled = self._subsample(x_y_timed)
        return x_y_subsampled
