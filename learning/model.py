from seqmodels.window.window_model import CombinerModel, WindowBasedModel
from seqmodels.window.frame_models.recurrent import RecurrentModel


class BestModel(WindowBasedModel):
    def __init__(self):
        frame_model = RecurrentModel()
        combiner_model = CombinerModel()
        super().__init__(frame_model, combiner_model)

        self.left_epsilon=0.05
        self.right_epsilon=0.05
        self.only_positive=False
        self.X_TIME_COLUMN=2
        self.Y_TIME_COLUMN=1