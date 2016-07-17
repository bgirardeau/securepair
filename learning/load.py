"""load module."""
import glob
import os

import joblib
import scipy.io.wavfile
import numpy as np
import sklearn.cross_validation

class Loader(object):
    """Load a dataset created with the dataset collection pipeline.
    """
    def __init__(self, data_folder, use_cached_if_available=True):
        self.x_train = self.x_test = self.y_train = self._y_test = None
        self.RANDOM_SEED = 2
        self.SAMPLE_RATE = 44100
        self.SUBSAMPLE = 8
        self._load(data_folder, use_cached_if_available=True)

    def _get_raw(self, data_folder):
        for f in glob.glob(data_folder + '/*.wav'):
            sr, x = scipy.io.wavfile.read(f)
            assert sr == self.SAMPLE_RATE
            y_str = os.path.basename(f).split('-')[0]
            y = []
            for i in range(0, len(y_str), 2):
                y.append(int(y_str[i:i + 2]))
            yield (x, y)

    def _add_time(self, x_y_pairs):
        for x, y in x_y_pairs:
            time_x = (np.array(range(len(x))) + 1) / self.SAMPLE_RATE
            time_y = (np.array(range(len(y))) + 1) * \
                (int(len(x) / len(y)) / 2.0)
            yield (np.column_stack((x, time_x)), np.column_stack((y, time_y)))

    def _train_test(self, x_y_pairs):
        """Split the data pairs into a train test split."""
        x, y = zip(*x_y_pairs)
        x_train, x_test, y_train, y_test = sklearn.cross_validation.\
            train_test_split(
                x, y, test_size=0.1, random_state=self.RANDOM_SEED)
        return (x_train, x_test, y_train, y_test)

    def _subsample(self, x_y_pairs):
        for x, y in x_y_pairs:
            yield (x[::self.SUBSAMPLE], y)

    def _load_pipeline(self, data_folder):
        """Run the pipeline to load the dataset given a filename."""
        x_y_raw = self._get_raw(data_folder)
        x_y_timed = self._add_time(x_y_raw)
        x_y_subsampled = self._subsample(x_y_timed)
        split = self._train_test(x_y_subsampled)

        return split

    def _load(self, data_folder, use_cached_if_available):
        """Run the pipeline to load the dataset.

        Returns the dataset with a train test split.
        """
        cached_filename = data_folder + '/cached'

        def check_cached_copy():
            return os.path.isfile(cached_filename)

        def load_cached():
            return joblib.load(cached_filename)

        def save_loaded(loaded):
            joblib.dump(loaded, cached_filename)

        if use_cached_if_available and check_cached_copy():
            loaded = load_cached()
        else:
            loaded = self._load_pipeline(data_folder)
            save_loaded(loaded)

        (self.x_train, self.x_test, self.y_train, self._y_test) = loaded

    def get_x_train(self):
        """Get the training data."""
        return self.x_train

    def get_x_test(self):
        """Get the test data."""
        return self.x_test

    def get_y_train(self):
        """Get the traning labels."""
        return self.y_train

    def get_y_test(self):
        """Get the test labels."""
        return self._y_test