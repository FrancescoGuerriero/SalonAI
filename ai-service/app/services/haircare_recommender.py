from app.schemas.common import ServiceMetadata
from app.schemas.haircare import (
    ChemicalService,
    HairConcern,
    HairType,
    HaircareRecommendationRequest,
    HaircareRecommendationResponse,
    HomecareStep,
    MaintenancePreference,
    RecommendedService,
)


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _add_service(
    services: list[RecommendedService],
    *,
    name: str,
    reason: str,
    priority: int,
) -> None:
    if any(item.name == name for item in services):
        return
    services.append(RecommendedService(name=name, reason=reason, priority=priority))


def _add_step(
    steps: list[HomecareStep],
    *,
    title: str,
    guidance: str,
    frequency: str,
) -> None:
    if any(item.title == title for item in steps):
        return
    steps.append(HomecareStep(title=title, guidance=guidance, frequency=frequency))


def build_haircare_recommendation(
    payload: HaircareRecommendationRequest,
    *,
    provider_mode: str = "mock",
) -> HaircareRecommendationResponse:
    """Return a deterministic, explainable Phase 4 recommendation."""

    concerns = set(payload.concerns)
    chemical_services = set(payload.chemical_services)
    services: list[RecommendedService] = []
    products: list[str] = []
    steps: list[HomecareStep] = []
    cautions: list[str] = []
    rules: list[str] = []

    _add_service(
        services,
        name="Professional hair and scalp consultation",
        reason="Confirms the condition of the hair and converts the recommendation into a safe salon plan.",
        priority=1,
    )
    _add_step(
        steps,
        title="Use a suitable cleansing routine",
        guidance="Cleanse the scalp thoroughly while avoiding aggressive rubbing through the lengths.",
        frequency="According to scalp oiliness and product build-up",
    )

    if HairConcern.DRYNESS in concerns or payload.hair_type in {HairType.CURLY, HairType.COILY}:
        rules.append("moisture-support")
        _add_service(
            services,
            name="Moisture treatment",
            reason="Supports softness, elasticity and manageability for dry or textured hair.",
            priority=2,
        )
        _append_unique(products, "Moisturising sulphate-conscious cleanser")
        _append_unique(products, "Rich conditioner or mask")
        _append_unique(products, "Leave-in moisturiser")
        _add_step(
            steps,
            title="Protect moisture between washes",
            guidance="Apply leave-in care through damp mid-lengths and ends, then minimise unnecessary brushing when dry.",
            frequency="After each wash",
        )

    chemically_processed = bool(
        chemical_services
        & {
            ChemicalService.COLOUR,
            ChemicalService.BLEACH,
            ChemicalService.RELAXER,
            ChemicalService.PERM,
            ChemicalService.KERATIN,
        }
    )

    if chemically_processed or concerns & {HairConcern.DAMAGE, HairConcern.BREAKAGE}:
        rules.append("repair-support")
        _add_service(
            services,
            name="Bond-repair or strengthening treatment",
            reason="Helps reduce further breakage after chemical processing or repeated mechanical stress.",
            priority=2,
        )
        _append_unique(products, "Bond-repair treatment")
        _append_unique(products, "Heat protectant")
        _add_step(
            steps,
            title="Reduce avoidable stress",
            guidance="Use lower heat, detangle from the ends and avoid overlapping strong chemical services.",
            frequency="Every styling session",
        )

    if HairConcern.COLOUR_CARE in concerns or ChemicalService.COLOUR in chemical_services or ChemicalService.BLEACH in chemical_services:
        rules.append("colour-preservation")
        _add_service(
            services,
            name="Colour maintenance consultation",
            reason="Plans refresh intervals while protecting tone and hair condition.",
            priority=3,
        )
        _append_unique(products, "Colour-safe cleanser")
        _append_unique(products, "UV and heat protection")

    if HairConcern.FRIZZ in concerns:
        rules.append("frizz-control")
        _append_unique(products, "Anti-humidity finishing product")
        _add_step(
            steps,
            title="Control drying technique",
            guidance="Blot rather than rub with a towel and direct airflow down the hair shaft.",
            frequency="After each wash",
        )

    if HairConcern.OILINESS in concerns:
        rules.append("scalp-balance")
        _append_unique(products, "Lightweight scalp-balancing cleanser")
        _add_step(
            steps,
            title="Keep conditioner off the scalp",
            guidance="Concentrate conditioner on mid-lengths and ends unless a professional advises otherwise.",
            frequency="Every wash",
        )

    if HairConcern.LACK_OF_VOLUME in concerns or payload.texture.value == "fine":
        rules.append("volume-support")
        _append_unique(products, "Lightweight volumising cleanser")
        _append_unique(products, "Root-lift styling product")

    if payload.heat_styling_per_week >= 3:
        rules.append("heat-risk")
        _append_unique(products, "Heat protectant")
        cautions.append("Frequent heat styling can increase dryness and breakage; reduce temperature and repeat passes.")

    if payload.scalp_sensitive or HairConcern.SCALP_SENSITIVITY in concerns:
        rules.append("sensitive-scalp")
        _append_unique(products, "Fragrance-minimised sensitive-scalp cleanser")
        cautions.append("Patch-test new products and colour services before full application where appropriate.")
        cautions.append("Stop using any product that causes burning, swelling or persistent irritation.")

    if concerns & {HairConcern.DANDRUFF, HairConcern.THINNING}:
        rules.append("professional-referral")
        cautions.append(
            "Persistent flaking, scalp inflammation or unexplained hair loss needs assessment by a GP, pharmacist or dermatologist; this salon recommendation is not a diagnosis."
        )

    if payload.maintenance_preference == MaintenancePreference.LOW:
        rules.append("low-maintenance")
        _add_step(
            steps,
            title="Keep the routine simple",
            guidance="Use one suitable cleanser, one conditioner and one targeted leave-in product consistently.",
            frequency="Ongoing",
        )
    elif payload.maintenance_preference == MaintenancePreference.HIGH:
        rules.append("high-maintenance")
        _add_step(
            steps,
            title="Track treatment results",
            guidance="Review condition, breakage and manageability with the stylist before adding further products.",
            frequency="Every 4 to 8 weeks",
        )

    services.sort(key=lambda item: (item.priority, item.name))
    confidence = min(
        0.96,
        0.68
        + (0.035 * len(concerns))
        + (0.025 * len(chemical_services))
        + (0.03 if payload.notes.strip() else 0),
    )

    concern_text = ", ".join(item.value.replace("_", " ") for item in payload.concerns)
    summary = (
        f"A {payload.maintenance_preference.value}-maintenance plan for "
        f"{payload.texture.value} {payload.hair_type.value} hair"
    )
    if concern_text:
        summary += f", prioritising {concern_text}"
    summary += "."

    return HaircareRecommendationResponse(
        summary=summary,
        recommended_services=services,
        product_categories=products,
        homecare_steps=steps,
        cautions=cautions,
        confidence=round(confidence, 3),
        metadata=ServiceMetadata(
            provider_mode=provider_mode,
            model_name="salonai-haircare-rules-v1",
            rules_applied=rules,
        ),
    )
