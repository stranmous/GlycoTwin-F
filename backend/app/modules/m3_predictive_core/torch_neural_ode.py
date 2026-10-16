import torch
from torch import nn
from torchdiffeq import odeint

# Kept in sync with ode_solver.py (serving path): same bolus decay and
# plasma-equivalent scale so the trained residual learns the dynamics it
# will actually be evaluated on.
BOLUS_DECAY_PER_MIN = 0.025
BOLUS_U_TO_MU_PER_ML = 15.0


class GlucoseInsulinDynamics(nn.Module):
    def __init__(self):
        super().__init__()
        # A simple neural network to predict the residual derivative of glucose
        self.neural_residual = nn.Sequential(
            nn.Linear(2, 16),
            nn.Tanh(),
            nn.Linear(16, 1)
        )
        # Initialize with small weights so it doesn't disturb the physical model much initially
        nn.init.zeros_(self.neural_residual[2].weight)
        nn.init.zeros_(self.neural_residual[2].bias)

        self.S_i = 0.0  # To be set dynamically
        self.k_abs = 0.0  # To be set dynamically
        self.D = 0.0  # To be set dynamically
        self.G_b = 95.0  # Baseline glucose; set dynamically (mirrors ode_solver.py)
        self.I_b = 10.0  # Basal insulin
        # Bolus schedule: [N, K, 2] tensor of (offset_min, units) per window,
        # K = max doses in the batch, padded with units=0; or None.
        self.bolus = None

    def _bolus_active(self, t):
        if self.bolus is None:
            return 0.0
        t_dose, units = self.bolus[..., 0], self.bolus[..., 1]
        active = torch.where(t >= t_dose,
                             units * torch.exp(-BOLUS_DECAY_PER_MIN * (t - t_dose)),
                             torch.zeros_like(units))
        return BOLUS_U_TO_MU_PER_ML * active.sum(dim=-1)

    def forward(self, t, y):
        # Batched-safe: y is [2] for one window or [N, 2] for a batch of
        # windows (WS1 cross-validation). Physics params may be scalars or
        # [N] tensors; everything broadcasts element-wise.
        G, I = y[..., 0], y[..., 1]

        # Meal appearance rate (physical model)
        meal_appearance = self.D * (self.k_abs**2) * t * torch.exp(-self.k_abs * t)

        # Normalize inputs for the neural network to avoid large activations
        y_norm = torch.stack([G / 100.0, I / 10.0], dim=-1)
        residual = self.neural_residual(y_norm)[..., 0]

        # ODE for glucose (G) — baseline-anchored clearance on TOTAL
        # (endogenous + exogenous bolus) insulin, same form as the scipy
        # solver in ode_solver.py (keep the two in sync).
        dG_dt = -self.S_i * (I + self._bolus_active(t)) * (G - self.G_b) \
            + meal_appearance + residual

        # ODE for insulin (I)
        dI_dt = 0.01 * torch.relu(G - self.G_b) - 0.1 * (I - self.I_b)

        return torch.stack([dG_dt, dI_dt], dim=-1)


class TorchNeuralODESolver(nn.Module):
    def __init__(self):
        super().__init__()
        self.dynamics = GlucoseInsulinDynamics()

    def forward(self, t_span, y0, S_i, k_abs, D, G_b=95.0, bolus=None):
        self.dynamics.S_i = S_i
        self.dynamics.k_abs = k_abs
        self.dynamics.D = D
        self.dynamics.G_b = G_b
        self.dynamics.bolus = bolus

        # Solve the ODE
        trajectory = odeint(self.dynamics, y0, t_span, method='rk4')
        return trajectory
