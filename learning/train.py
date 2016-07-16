import numpy as np
import sys
import pickle
from sklearn.cross_validation import train_test_split
from keras.models import Sequential
from keras.layers.core import Activation, Dense
from keras.layers.wrappers import TimeDistributed
from keras.layers.recurrent import LSTM, GRU
from keras.layers.normalization import BatchNormalization
from keras.callbacks import EarlyStopping

num_classes = 8


def loadData(path):
    X = np.load(open(path + '/X.npy', 'rb'), encoding="bytes")
    y = np.load(open(path + '/y.npy', 'rb'), encoding="bytes")
    y = np.reshape(np.repeat(y, X.shape[1], axis=0), (y.shape[0], X.shape[1], y.shape[1]))
    return X, y

def compileModel(hidden_layers, shape):
    model = Sequential()
    model.add(LSTM(hidden_layers, input_dim=shape[1], input_length=shape[0], return_sequences = True))
    model.add(LSTM(hidden_layers, input_dim=shape[1], input_length=shape[0], return_sequences = True, go_backwards=True))
    model.add(BatchNormalization())
    model.add(TimeDistributed(Dense(num_classes)))
    model.add(Activation('softmax'))
    model.compile(loss='categorical_crossentropy', optimizer='rmsprop', metrics=["accuracy"])
    return model


def fit(model, X_train, y_train, X_test, y_test, verbose=1):
    early_stopping = EarlyStopping(monitor='val_loss', patience=5)
    model.fit(X_train, y_train, batch_size=256, nb_epoch=10,
              verbose=verbose, validation_split=0.05,
              callbacks=[early_stopping])
    score = model.evaluate(X_test, y_test, show_accuracy=True)
    try:
        print("Classifier: Acc: %0.2f, loss: %0.2f" % (score[1], score[0]))
    except IndexError:
        print("Score: ", score)

def main():
    X, y = loadData(sys.argv[1])
    print('loaded X,y')
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.05)
    model = compileModel(300, X[0].shape)
    print('compiled model, fitting..')
    fit(model, X_train, y_train, X_test, y_test, verbose=2)

    json_string = model.to_yaml()
    open('my_model_architecture.yaml', 'w').write(json_string)
    model.save_weights('my_model_weights.h5')

if __name__ == '__main__':
    main()
