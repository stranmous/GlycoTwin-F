"""Validated loader for local, versioned nutrition knowledge-base records.

The loader deliberately keeps taxonomy records separate from nutrition profiles:
an item may be searchable and representable in a meal even when a commercially
usable nutrient source or a measured regional recipe has not been approved.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any


class KnowledgeBaseValidationError(ValueError):
    """Raised when a knowledge-base record cannot be safely used."""


DATA_CLASSES = frozenset({"fixture", "provisional", "measured", "expert_reviewed"})
REVIEW_STATUSES = frozenset({"not_reviewed", "pending", "expert_reviewed"})
OBSERVATION_MODES = frozenset({"visible", "occluded_user_supplied", "either"})
COMMERCIAL_USE_STATUSES = frozenset({"confirmed", "unknown", "not_permitted", "not_applicable"})
SOURCE_RECORD_STATUSES = frozenset({"fixture", "candidate", "approved", "rejected"})


@dataclass(frozen=True)
class NutrientsPer100g:
    calories_kcal: Decimal
    carbs_g: Decimal
    protein_g: Decimal
    fat_g: Decimal
    fiber_g: Decimal


@dataclass(frozen=True)
class SourceRecord:
    source_id: str
    title: str
    publisher: str
    url: str
    license: str
    commercial_use: str
    record_status: str
    accessed_on: str
    transformation: str

    @property
    def commercially_usable(self) -> bool:
        return self.commercial_use == "confirmed" and self.record_status == "approved"


@dataclass(frozen=True)
class Provenance:
    source_ids: tuple[str, ...]
    transformation: str
    data_class: str
    review_status: str
    reviewer: str | None
    reviewed_on: str | None


@dataclass(frozen=True)
class NutrientUncertainty:
    relative_percent: Decimal
    variation_notes: tuple[str, ...]


@dataclass(frozen=True)
class FoodTaxon:
    food_id: str
    display_name: str
    english_name: str
    urdu_name: str
    roman_urdu_name: str
    aliases: tuple[str, ...]
    category: str
    kind: str
    parent_id: str | None
    observation_mode: str


@dataclass(frozen=True)
class FoodProfile:
    """A directly usable per-100g profile, including its evidence status."""

    food_id: str
    display_name: str
    aliases: tuple[str, ...]
    nutrients_per_100g: NutrientsPer100g
    density_g_per_ml: Decimal | None
    preparation_assumptions: tuple[str, ...]
    provenance: Provenance
    uncertainty: NutrientUncertainty

    @property
    def recipe_provenance(self) -> dict[str, str]:
        """Compatibility view for the Phase 1 fixture consumer."""

        return {
            "record_type": self.provenance.data_class,
            "review_status": self.provenance.review_status,
            "transformation": self.provenance.transformation,
        }

    @property
    def review_status(self) -> str:
        return self.provenance.review_status

    @property
    def uncertainty_notes(self) -> tuple[str, ...]:
        return self.uncertainty.variation_notes


@dataclass(frozen=True)
class RecipeIngredient:
    food_id: str
    mass_g: Decimal


@dataclass(frozen=True)
class RecipeProfile:
    recipe_id: str
    dish_id: str
    ingredients: tuple[RecipeIngredient, ...]
    cooked_yield_g: Decimal
    density_g_per_ml: Decimal | None
    preparation_assumptions: tuple[str, ...]
    provenance: Provenance
    uncertainty: NutrientUncertainty


@dataclass(frozen=True)
class NutritionCatalog:
    schema_version: str
    data_version: str
    status: str
    sources: dict[str, SourceRecord]
    taxonomy: dict[str, FoodTaxon]
    profiles: dict[str, FoodProfile]
    recipes: dict[str, RecipeProfile]
    _alias_index: dict[str, str]
    household_portions: dict[str, dict[str, Decimal]] | None = None

    def get(self, food_id: str) -> FoodProfile | None:
        return self.profiles.get(food_id)

    def resolve_taxon(self, identifier: str) -> FoodTaxon | None:
        food_id = self._alias_index.get(_normalise(identifier))
        return self.taxonomy.get(food_id) if food_id else None

    def resolve(self, identifier: str) -> FoodProfile | None:
        taxon = self.resolve_taxon(identifier)
        return self.profiles.get(taxon.food_id) if taxon else None

    def is_public_claim_eligible(self, food_id: str) -> bool:
        profile = self.get(food_id)
        if profile is None:
            return False
        return _provenance_is_public_claim_eligible(profile.provenance, self.sources)

    def portion_mass_g(self, food_id: str, unit: str) -> Decimal | None:
        portions = self.household_portions or {}
        return portions.get(food_id, {}).get(unit)


def _normalise(value: str) -> str:
    return " ".join(value.casefold().split())


def _decimal(value: float | str) -> Decimal:
    try:
        result = Decimal(str(value))
    except Exception as exc:  # pragma: no cover - Decimal has several subclasses of error
        raise KnowledgeBaseValidationError(f"invalid decimal value: {value!r}") from exc
    if not result.is_finite():
        raise KnowledgeBaseValidationError(f"decimal value must be finite: {value!r}")
    return result


def _required(raw: dict[str, Any], field: str, context: str) -> Any:
    if field not in raw:
        raise KnowledgeBaseValidationError(f"{context} is missing required field {field!r}")
    return raw[field]


def _provenance(raw: dict[str, Any], context: str) -> Provenance:
    data_class = _required(raw, "data_class", context)
    review_status = _required(raw, "review_status", context)
    if data_class not in DATA_CLASSES:
        raise KnowledgeBaseValidationError(f"{context} has unsupported data_class {data_class!r}")
    if review_status not in REVIEW_STATUSES:
        raise KnowledgeBaseValidationError(
            f"{context} has unsupported review_status {review_status!r}"
        )
    reviewer = raw.get("reviewer")
    reviewed_on = raw.get("reviewed_on")
    if review_status == "expert_reviewed" and (not reviewer or not reviewed_on):
        raise KnowledgeBaseValidationError(
            f"{context} expert review requires reviewer and reviewed_on"
        )
    if review_status != "expert_reviewed" and (reviewer or reviewed_on):
        raise KnowledgeBaseValidationError(f"{context} cannot imply a review that did not occur")
    source_ids = tuple(raw.get("source_ids", []))
    if data_class != "fixture" and not source_ids:
        raise KnowledgeBaseValidationError(f"{context} non-fixture data requires source_ids")
    transformation = _required(raw, "transformation", context)
    return Provenance(
        source_ids=source_ids,
        transformation=str(transformation),
        data_class=data_class,
        review_status=review_status,
        reviewer=str(reviewer) if reviewer else None,
        reviewed_on=str(reviewed_on) if reviewed_on else None,
    )


def _uncertainty(raw: dict[str, Any], context: str) -> NutrientUncertainty:
    relative_percent = _decimal(_required(raw, "relative_percent", context))
    if relative_percent < 0:
        raise KnowledgeBaseValidationError(f"{context} relative_percent cannot be negative")
    notes = tuple(raw.get("variation_notes", []))
    if not notes:
        raise KnowledgeBaseValidationError(f"{context} requires at least one variation note")
    return NutrientUncertainty(relative_percent=relative_percent, variation_notes=notes)


def _nutrients(raw: dict[str, Any], context: str) -> NutrientsPer100g:
    values = {
        field: _decimal(_required(raw, field, context))
        for field in NutrientsPer100g.__annotations__
    }
    if any(value < 0 for value in values.values()):
        raise KnowledgeBaseValidationError(f"{context} nutrients cannot be negative")
    return NutrientsPer100g(**values)


def _provenance_is_public_claim_eligible(
    provenance: Provenance, sources: dict[str, SourceRecord]
) -> bool:
    return (
        provenance.data_class == "expert_reviewed"
        and provenance.review_status == "expert_reviewed"
        and bool(provenance.source_ids)
        and all(
            source_id in sources and sources[source_id].commercially_usable
            for source_id in provenance.source_ids
        )
    )


def load_catalog(path: Path | str) -> NutritionCatalog:
    """Load a local knowledge-base JSON file without contacting any service."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schema_version") != "1.0":
        raise KnowledgeBaseValidationError("only knowledge-base schema_version '1.0' is supported")
    status = _required(payload, "status", "knowledge base")
    if status not in DATA_CLASSES:
        raise KnowledgeBaseValidationError("knowledge base status must be a recognised data class")

    sources: dict[str, SourceRecord] = {}
    for raw in payload.get("sources", []):
        source = SourceRecord(
            source_id=str(_required(raw, "source_id", "source")),
            title=str(_required(raw, "title", "source")),
            publisher=str(_required(raw, "publisher", "source")),
            url=str(_required(raw, "url", "source")),
            license=str(_required(raw, "license", "source")),
            commercial_use=str(_required(raw, "commercial_use", "source")),
            record_status=str(_required(raw, "record_status", "source")),
            accessed_on=str(_required(raw, "accessed_on", "source")),
            transformation=str(_required(raw, "transformation", "source")),
        )
        if source.commercial_use not in COMMERCIAL_USE_STATUSES:
            raise KnowledgeBaseValidationError(
                f"source {source.source_id} has invalid commercial_use status"
            )
        if source.record_status not in SOURCE_RECORD_STATUSES:
            raise KnowledgeBaseValidationError(
                f"source {source.source_id} has invalid record_status"
            )
        if source.source_id in sources:
            raise KnowledgeBaseValidationError(f"duplicate source_id {source.source_id!r}")
        sources[source.source_id] = source

    taxonomy: dict[str, FoodTaxon] = {}
    alias_index: dict[str, str] = {}
    for raw in payload.get("taxonomy", []):
        names = _required(raw, "names", "taxonomy record")
        food_id = str(_required(raw, "id", "taxonomy record"))
        observation_mode = str(_required(raw, "observation_mode", f"taxonomy {food_id}"))
        if observation_mode not in OBSERVATION_MODES:
            raise KnowledgeBaseValidationError(f"taxonomy {food_id} has invalid observation_mode")
        taxon = FoodTaxon(
            food_id=food_id,
            display_name=str(_required(names, "english", f"taxonomy {food_id} names")),
            english_name=str(_required(names, "english", f"taxonomy {food_id} names")),
            urdu_name=str(_required(names, "urdu", f"taxonomy {food_id} names")),
            roman_urdu_name=str(_required(names, "roman_urdu", f"taxonomy {food_id} names")),
            aliases=tuple(raw.get("aliases", [])),
            category=str(_required(raw, "category", f"taxonomy {food_id}")),
            kind=str(_required(raw, "kind", f"taxonomy {food_id}")),
            parent_id=raw.get("parent_id"),
            observation_mode=observation_mode,
        )
        if food_id in taxonomy:
            raise KnowledgeBaseValidationError(f"duplicate taxonomy id {food_id!r}")
        taxonomy[food_id] = taxon
        for label in (
            taxon.food_id,
            taxon.english_name,
            taxon.urdu_name,
            taxon.roman_urdu_name,
            *taxon.aliases,
        ):
            normalised = _normalise(label)
            existing = alias_index.get(normalised)
            if existing and existing != food_id:
                raise KnowledgeBaseValidationError(
                    f"alias {label!r} is shared by taxonomy ids {existing!r} and {food_id!r}"
                )
            alias_index[normalised] = food_id
    for taxon in taxonomy.values():
        if taxon.parent_id is not None and taxon.parent_id not in taxonomy:
            raise KnowledgeBaseValidationError(
                f"taxonomy {taxon.food_id} references an unknown parent"
            )

    profiles: dict[str, FoodProfile] = {}
    for raw in payload.get("nutrition_profiles", []):
        food_id = str(_required(raw, "food_id", "nutrition profile"))
        if food_id not in taxonomy:
            raise KnowledgeBaseValidationError(
                f"nutrition profile {food_id} has no taxonomy record"
            )
        if food_id in profiles:
            raise KnowledgeBaseValidationError(f"duplicate nutrition profile for {food_id!r}")
        provenance = _provenance(
            _required(raw, "provenance", f"profile {food_id}"), f"profile {food_id}"
        )
        unknown_sources = set(provenance.source_ids) - set(sources)
        if unknown_sources:
            raise KnowledgeBaseValidationError(
                f"profile {food_id} references unknown sources {unknown_sources}"
            )
        taxon = taxonomy[food_id]
        density = raw.get("density_g_per_ml")
        profiles[food_id] = FoodProfile(
            food_id=food_id,
            display_name=taxon.display_name,
            aliases=tuple(dict.fromkeys((taxon.urdu_name, taxon.roman_urdu_name, *taxon.aliases))),
            nutrients_per_100g=_nutrients(
                _required(raw, "nutrients_per_100g", f"profile {food_id}"), f"profile {food_id}"
            ),
            density_g_per_ml=_decimal(density) if density is not None else None,
            preparation_assumptions=tuple(raw.get("preparation_assumptions", [])),
            provenance=provenance,
            uncertainty=_uncertainty(
                _required(raw, "uncertainty", f"profile {food_id}"), f"profile {food_id}"
            ),
        )

    recipes: dict[str, RecipeProfile] = {}
    for raw in payload.get("recipe_profiles", []):
        recipe_id = str(_required(raw, "recipe_id", "recipe profile"))
        dish_id = str(_required(raw, "dish_id", f"recipe {recipe_id}"))
        if recipe_id in recipes or dish_id not in taxonomy:
            raise KnowledgeBaseValidationError(
                f"recipe {recipe_id} has duplicate id or unknown dish"
            )
        ingredients = tuple(
            RecipeIngredient(
                food_id=str(_required(item, "food_id", f"recipe {recipe_id} ingredient")),
                mass_g=_decimal(_required(item, "mass_g", f"recipe {recipe_id} ingredient")),
            )
            for item in _required(raw, "ingredients", f"recipe {recipe_id}")
        )
        if not ingredients or any(item.mass_g <= 0 for item in ingredients):
            raise KnowledgeBaseValidationError(
                f"recipe {recipe_id} needs positive ingredient masses"
            )
        if any(item.food_id not in profiles for item in ingredients):
            raise KnowledgeBaseValidationError(
                f"recipe {recipe_id} references ingredients without profiles"
            )
        cooked_yield = _decimal(_required(raw, "cooked_yield_g", f"recipe {recipe_id}"))
        if cooked_yield <= 0:
            raise KnowledgeBaseValidationError(
                f"recipe {recipe_id} cooked_yield_g must be positive"
            )
        provenance = _provenance(
            _required(raw, "provenance", f"recipe {recipe_id}"), f"recipe {recipe_id}"
        )
        unknown_sources = set(provenance.source_ids) - set(sources)
        if unknown_sources:
            raise KnowledgeBaseValidationError(
                f"recipe {recipe_id} references unknown sources {unknown_sources}"
            )
        density = raw.get("density_g_per_ml")
        recipes[recipe_id] = RecipeProfile(
            recipe_id=recipe_id,
            dish_id=dish_id,
            ingredients=ingredients,
            cooked_yield_g=cooked_yield,
            density_g_per_ml=_decimal(density) if density is not None else None,
            preparation_assumptions=tuple(raw.get("preparation_assumptions", [])),
            provenance=provenance,
            uncertainty=_uncertainty(
                _required(raw, "uncertainty", f"recipe {recipe_id}"), f"recipe {recipe_id}"
            ),
        )

    household_portions: dict[str, dict[str, Decimal]] = {}
    for raw in payload.get("household_portions", []):
        food_id = str(_required(raw, "food_id", "household portion"))
        unit = str(_required(raw, "unit", "household portion"))
        mass_g = _decimal(_required(raw, "mass_g", "household portion"))
        if food_id not in profiles or not unit or mass_g <= 0:
            raise KnowledgeBaseValidationError(
                "household portion must reference a positive known food"
            )
        if unit in household_portions.setdefault(food_id, {}):
            raise KnowledgeBaseValidationError(f"duplicate household portion {food_id}/{unit}")
        household_portions[food_id][unit] = mass_g

    return NutritionCatalog(
        schema_version=payload["schema_version"],
        data_version=str(_required(payload, "data_version", "knowledge base")),
        status=status,
        sources=sources,
        taxonomy=taxonomy,
        profiles=profiles,
        recipes=recipes,
        _alias_index=alias_index,
        household_portions=household_portions,
    )
