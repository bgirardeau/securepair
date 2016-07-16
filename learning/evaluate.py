import numpy as np


def exact_match(ground_truth_seq, prediction_seq):
    """Exact Match."""
    return np.all(ground_truth_seq[:, 0] == prediction_seq)

def evaluate_set(ground_truth, predictions):
    """Evaluate according to the metric."""
    assert(len(ground_truth) == len(predictions))
    for metric in ['exact_match']:
        scores = []
        for i in range(len(ground_truth)):
            if metric == 'exact_match':
                fn = exact_match

            if fn is not None:
                scores.append(fn(ground_truth[i], predictions[i]))
            else:
                raise ValueError('Metric type not found')
        print("Metric: ", metric, "Score: ", np.mean(scores))
