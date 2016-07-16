"""load module."""
import os
import pickle

import numpy as np
import sklearn.cross_validation

class Loader(object):
    """Load a dataset created with the dataset collection pipeline.
    """
    def __init__(self, data_folder, use_cached_if_available=True):
        pass

    def _train_test(self, x_y_pairs):
        """Split the data pairs into a train test split."""
        x, y = zip(*x_y_pairs)
        x_train, x_test, y_train, y_test = sklearn.cross_validation.\
            train_test_split(
                x, y, test_size=0.2, random_state=self.RANDOM_SEED)
        return (x_train, x_test, y_train, y_test)

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