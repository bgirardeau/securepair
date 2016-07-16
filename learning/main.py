"""Main."""
import load, evaluate
import seqmodels

import numpy as np
import sys


def run_pipeline(data_folder):
    """Main function.

    Run the full pipeline from the
    data loading to evaluation.
    """
    print("Loading dataset...\n")
    dl = load.Loader(data_folder)
    x_train = dl.get_x_train()
    y_train = dl.get_y_train()
    print("Training size: " + str(len(x_train)) + " examples.")

    print("Train Model...\n")
    model = seqmodels.BestModel()
    model.train(x_train, y_train)

    print("\nEvaluating training set...\n")
    predictions = model.predict(x_train)
    evaluate.evaluate_set(y_train, predictions)

    print("\nEvaluating test set...\n")
    x_test = dl.get_x_test()
    y_test = dl.get_y_test()
    predictions = model.predict(x_test)
    evaluate.evaluate_set(y_test, predictions)


if __name__ == '__main__':
    if(len(sys.argv) <= 1):
        raise ValueError('Give folder path which contains data...')
    run_pipeline(sys.argv[1])
