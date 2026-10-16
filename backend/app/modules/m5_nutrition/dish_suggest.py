"""CLIP zero-shot dish suggestion for M5 assisted logging.

The pipeline estimates portions but does not recognise dishes. Instead of
making the user type a dish name blind, this module ranks the local dish
catalog against the meal photo with CLIP (ViT-B/32) text-image similarity and
returns the top-3 candidates with scores. The user confirms one — assisted
logging WITH suggestion, not blind typing and not claimed recognition.

Honesty rules (enforced here, not just documented):
- `dish_hint` stays optional. When absent and the top CLIP score is below
  `SUGGESTION_THRESHOLD`, no suggestion is returned (reason
  "dish_unidentified") rather than a low-confidence guess.
- Scores are raw cosine similarities, not probabilities. They are shown to
  the user as ranking signals only.
- The threshold was calibrated on 106 D1NAMO food photos, none of which are
  Pakistani dishes (all out-of-catalog negatives): the threshold sits above
  the 95th percentile of those negative top-scores, so out-of-catalog photos
  are refused a suggestion instead of being mislabelled.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.logging import get_logger

log = get_logger("glycotwin.m5.suggest")

# Calibrated on 106 D1NAMO food photos (all out-of-catalog negatives):
# top-1 CLIP cosine scores: p50=0.256, p95=0.296, max=0.317. The threshold sits
# just above p95, so ~95% of out-of-catalog photos get no suggestion rather
# than a mislabel. See backend/ml/reports/clip_validation.md.
SUGGESTION_THRESHOLD = 0.30

_TEXT_TEMPLATES = (
    "a photo of {name}",
    "a Pakistani dish called {name}",
    "{name} food",
)


def _prompts_for(taxon: Any) -> list[str]:
    names = [taxon.english_name] + [a for a in (taxon.aliases or []) if a]
    seen: list[str] = []
    for name in names:
        for tpl in _TEXT_TEMPLATES:
            p = tpl.format(name=name.strip())
            if p not in seen:
                seen.append(p)
    return seen


class DishSuggester:
    """Zero-shot CLIP ranker over the local dish catalog. Loads lazily."""

    def __init__(self, catalog: Any, model_path: Path, device: str = "cpu") -> None:
        self._catalog = catalog
        self._model_path = Path(model_path)
        self._device = device
        self._model = None
        self._processor = None
        self._text_features = None
        self._taxa: list[Any] = []

    @property
    def available(self) -> bool:
        return self._model_path.exists()

    def _load(self) -> None:
        if self._model is not None:
            return
        import torch
        from transformers import CLIPModel, CLIPProcessor
        log.info("Loading CLIP dish-suggestion weights from %s", self._model_path)
        self._torch = torch
        self._model = CLIPModel.from_pretrained(str(self._model_path), local_files_only=True)
        self._processor = CLIPProcessor.from_pretrained(str(self._model_path), local_files_only=True)
        self._model.to(self._device)
        self._model.eval()
        self._index_catalog()

    def _index_catalog(self) -> None:
        import torch
        taxa = sorted(self._catalog.taxonomy.values(), key=lambda t: t.food_id)
        self._taxa = taxa
        feats = []
        with torch.no_grad():
            for taxon in taxa:
                prompts = _prompts_for(taxon)
                inputs = self._processor(text=prompts, return_tensors="pt",
                                         padding=True, truncation=True)
                inputs = {k: v.to(self._device) for k, v in inputs.items()}
                tf = self._model.get_text_features(**inputs)
                if not isinstance(tf, torch.Tensor):
                    tf = tf.pooler_output  # projected pooled embedding (512-d)
                tf = tf / tf.norm(p=2, dim=-1, keepdim=True)
                feats.append(tf.mean(dim=0))
        self._text_features = torch.stack(feats)
        self._text_features = self._text_features / self._text_features.norm(p=2, dim=-1, keepdim=True)
        log.info("CLIP indexed %d catalog taxa", len(taxa))

    def suggest(self, image: Any, top_k: int = 3,
                threshold: float = SUGGESTION_THRESHOLD) -> list[dict[str, Any]]:
        """Rank catalog dishes for a PIL image. Returns top-k dicts with
        food_id, label and cosine score, filtered by threshold."""
        self._load()
        import torch
        with torch.no_grad():
            inputs = self._processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            img_f = self._model.get_image_features(**inputs)
            if not isinstance(img_f, torch.Tensor):
                img_f = img_f.pooler_output
            img_f = img_f / img_f.norm(p=2, dim=-1, keepdim=True)
            sims = (img_f @ self._text_features.T).squeeze(0)
        scored = sorted(
            ((float(sims[i]), self._taxa[i]) for i in range(len(self._taxa))),
            key=lambda x: x[0], reverse=True)
        out = []
        for score, taxon in scored[:top_k]:
            if score < threshold:
                break
            out.append({"food_id": taxon.food_id, "label": taxon.english_name,
                        "score": round(score, 4)})
        return out
