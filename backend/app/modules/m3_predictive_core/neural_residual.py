from pathlib import Path


class ZeroResidual:
    """Physics-only serving: the residual contributes exactly zero.

    Replaces the old sine-wave placeholder on the serving path. When no
    trained residual passes the ship gate, the service runs pure physics —
    labelled as such via model_version — instead of a fake "neural"
    perturbation.
    """

    def __init__(self, model_version="v2.1.0-physics-only"):
        self.model_version = model_version

    def evaluate(self, t, G, I):
        return 0.0


class TrainedResidual:
    """The trained torch residual (WS1), loaded from weights/residual_v1.pt.

    Mirrors the serving interface of ZeroResidual so the scipy solver
    consumes either. Torch is imported lazily: serving only needs it when
    the trained artifact is selected (settings.m3_residual_weights).
    The benchmark gate (ml.evaluate) decides whether this ships; the model
    card next to the weights records the data and split it was trained on.
    """

    def __init__(self, weights_path: str | Path, model_version: str = "v2.0.0-trained-residual"):
        import torch

        from app.modules.m3_predictive_core.torch_neural_ode import GlucoseInsulinDynamics

        self.model_version = model_version
        self._torch = torch
        net = GlucoseInsulinDynamics().neural_residual
        net.load_state_dict(torch.load(Path(weights_path), map_location="cpu", weights_only=True))
        net.eval()
        self._net = net

    def evaluate(self, t, G, I):  # t unused: the residual is state-driven
        torch = self._torch
        with torch.no_grad():
            x = torch.tensor([G / 100.0, I / 10.0], dtype=torch.float32)
            return float(self._net(x).item())
