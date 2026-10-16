"""Deterministic nutrition and recipe calculations using the local knowledge base."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .catalog import (
    FoodProfile,
    NutrientsPer100g,
    NutrientUncertainty,
    NutritionCatalog,
    Provenance,
    RecipeProfile,
)

ROUNDING = Decimal("0.01")


class FoodNotFoundError(KeyError):
    """Raised when a caller requests an unavailable local nutrition profile."""


@dataclass(frozen=True)
class NutritionAmount:
    calories_kcal: Decimal
    carbs_g: Decimal
    protein_g: Decimal
    fat_g: Decimal
    fiber_g: Decimal

    def as_dict(self) -> dict[str, float]:
        return {field: float(getattr(self, field)) for field in self.__dataclass_fields__}


@dataclass(frozen=True)
class KnownMassItem:
    food_id: str
    mass_g: Decimal


@dataclass(frozen=True)
class CalculationResult:
    """Nutrition plus traceable uncertainty and provenance for non-UI consumers."""

    amount: NutritionAmount
    per_100g: NutrientsPer100g
    provenance: Provenance
    uncertainty: NutrientUncertainty
    public_claim_eligible: bool


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(ROUNDING, rounding=ROUND_HALF_UP)


def _validate_mass(mass_g: Decimal | float | str) -> Decimal:
    mass = Decimal(str(mass_g))
    if not mass.is_finite() or mass <= 0:
        raise ValueError("mass_g must be a finite value greater than zero")
    return mass


def _amount_from_per_100g(source: NutrientsPer100g, mass_g: Decimal) -> NutritionAmount:
    factor = mass_g / Decimal(100)
    return NutritionAmount(
        **{
            field: _quantize(getattr(source, field) * factor)
            for field in source.__dataclass_fields__
        }
    )


def calculate_nutrition(
    catalog: NutritionCatalog, food_id: str, mass_g: Decimal | float | str
) -> NutritionAmount:
    """Calculate nutrients from a known gram mass using a direct local profile."""

    profile = catalog.get(food_id)
    if profile is None:
        raise FoodNotFoundError(food_id)
    return _amount_from_per_100g(profile.nutrients_per_100g, _validate_mass(mass_g))


def calculate_nutrition_for_alias(
    catalog: NutritionCatalog, identifier: str, mass_g: Decimal | float | str
) -> NutritionAmount:
    """Resolve an English, Urdu, Roman Urdu, or canonical local identifier."""

    profile = catalog.resolve(identifier)
    if profile is None:
        raise FoodNotFoundError(identifier)
    return calculate_nutrition(catalog, profile.food_id, mass_g)


def calculate_meal(catalog: NutritionCatalog, items: Iterable[KnownMassItem]) -> NutritionAmount:
    """Sum individual deterministic calculations without intermediate float math."""

    totals = NutritionAmount(*(Decimal(0) for _ in range(5)))
    for item in items:
        amount = calculate_nutrition(catalog, item.food_id, item.mass_g)
        totals = NutritionAmount(
            **{
                field: totals_value + getattr(amount, field)
                for field, totals_value in totals.__dict__.items()
            }
        )
    return NutritionAmount(*(_quantize(value) for value in totals.__dict__.values()))


def calculate_recipe_per_100g(catalog: NutritionCatalog, recipe_id: str) -> CalculationResult:
    """Derive a recipe's per-100g nutrients from weighed ingredients and cooked yield."""

    recipe: RecipeProfile | None = catalog.recipes.get(recipe_id)
    if recipe is None:
        raise FoodNotFoundError(recipe_id)
    total = calculate_meal(
        catalog, [KnownMassItem(item.food_id, item.mass_g) for item in recipe.ingredients]
    )
    per_100g = NutrientsPer100g(
        **{
            field: _quantize(getattr(total, field) * Decimal(100) / recipe.cooked_yield_g)
            for field in NutrientsPer100g.__dataclass_fields__
        }
    )
    amount = _amount_from_per_100g(per_100g, Decimal(100))
    return CalculationResult(
        amount=amount,
        per_100g=per_100g,
        provenance=recipe.provenance,
        uncertainty=recipe.uncertainty,
        public_claim_eligible=(
            recipe.provenance.data_class == "expert_reviewed"
            and recipe.provenance.review_status == "expert_reviewed"
            and bool(recipe.provenance.source_ids)
            and all(
                source_id in catalog.sources and catalog.sources[source_id].commercially_usable
                for source_id in recipe.provenance.source_ids
            )
        ),
    )


def calculate_recipe_nutrition(
    catalog: NutritionCatalog, recipe_id: str, mass_g: Decimal | float | str
) -> CalculationResult:
    """Calculate a served mass from a versioned recipe profile, retaining evidence."""

    per_100g_result = calculate_recipe_per_100g(catalog, recipe_id)
    mass = _validate_mass(mass_g)
    return CalculationResult(
        amount=_amount_from_per_100g(per_100g_result.per_100g, mass),
        per_100g=per_100g_result.per_100g,
        provenance=per_100g_result.provenance,
        uncertainty=per_100g_result.uncertainty,
        public_claim_eligible=per_100g_result.public_claim_eligible,
    )


def profile_result(
    catalog: NutritionCatalog, food_id: str, mass_g: Decimal | float | str
) -> CalculationResult:
    """Calculate a direct profile while preserving its data class and provenance."""

    profile: FoodProfile | None = catalog.get(food_id)
    if profile is None:
        raise FoodNotFoundError(food_id)
    return CalculationResult(
        amount=calculate_nutrition(catalog, food_id, mass_g),
        per_100g=profile.nutrients_per_100g,
        provenance=profile.provenance,
        uncertainty=profile.uncertainty,
        public_claim_eligible=catalog.is_public_claim_eligible(food_id),
    )
