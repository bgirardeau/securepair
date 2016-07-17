"""Visualize."""
import matplotlib.pyplot as plt
import numpy as np

def visualize_sample(x_sample, y_sample):
    """Visualize a sample pair."""
    for i in np.unique(y_sample[:, 0]):
        labels_relevant = y_sample[y_sample[:, 0] == i, :]
        plt.vlines(
            labels_relevant[:, 1],
            np.amin(x_sample),
            np.amax(x_sample),
            linestyles='dashdot'
        )
    for i in range(2):
        plt.plot(x_sample[:, 2], x_sample[:, i])
    plt.show()
