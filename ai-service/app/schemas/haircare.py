from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ServiceMetadata


class HairType(StrEnum):
    STRAIGHT = "straight"
    WAVY = "wavy"
    CURLY = "curly"
    COILY = "coily"


class HairTexture(StrEnum):
    FINE = "fine"
    MEDIUM = "medium"
    COARSE = "coarse"


class HairConcern(StrEnum):
    DRYNESS = "dryness"
    DAMAGE = "damage"
    FRIZZ = "frizz"
    OILINESS = "oiliness"
    COLOUR_CARE = "colour_care"
    SCALP_SENSITIVITY = "scalp_sensitivity"
    DANDRUFF = "dandruff"
    THINNING = "thinning"
    BREAKAGE = "breakage"
    LACK_OF_VOLUME = "lack_of_volume"


class ChemicalService(StrEnum):
    COLOUR = "colour"
    BLEACH = "bleach"
    RELAXER = "relaxer"
    PERM = "perm"
    KERATIN = "keratin"
    NONE = "none"


class MaintenancePreference(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class HaircareRecommendationRequest(BaseModel):
    customer_id: str | None = Field(default=None, max_length=100)
    hair_type: HairType
    texture: HairTexture = HairTexture.MEDIUM
    concerns: list[HairConcern] = Field(default_factory=list, max_length=8)
    chemical_services: list[ChemicalService] = Field(default_factory=list, max_length=5)
    heat_styling_per_week: int = Field(default=0, ge=0, le=14)
    maintenance_preference: MaintenancePreference = MaintenancePreference.MEDIUM
    scalp_sensitive: bool = False
    notes: str = Field(default="", max_length=1000)

    @field_validator("concerns", "chemical_services")
    @classmethod
    def remove_duplicates(cls, values):
        return list(dict.fromkeys(values))


class RecommendedService(BaseModel):
    name: str
    reason: str
    priority: int = Field(ge=1, le=5)


class HomecareStep(BaseModel):
    title: str
    guidance: str
    frequency: str


class HaircareRecommendationResponse(BaseModel):
    summary: str
    recommended_services: list[RecommendedService]
    product_categories: list[str]
    homecare_steps: list[HomecareStep]
    cautions: list[str]
    confidence: float = Field(ge=0, le=1)
    metadata: ServiceMetadata
