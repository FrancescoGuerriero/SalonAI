from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from app.schemas.ai_gateway import (
    AdvisoryCitation,
    AdvisoryItem,
    CanonicalFact,
    GatewayAdvisoryResponse,
    GatewayPlanRequest,
)


ADVISORY_VERSION = "salonai-canonical-adviser-baseline-v1"


def _numeric(value) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        parsed = float(value)
        return None if parsed != parsed else parsed
    return None


def _citation(index: int, fact: CanonicalFact, evidence_id: str) -> AdvisoryCitation:
    return AdvisoryCitation(
        id=f"fact:{index}",
        evidence_id=evidence_id,
        fact_index=index,
        fact_name=fact.name,
        fact_value=fact.value,
        dimensions=fact.dimensions,
    )


def _format_value(fact: CanonicalFact) -> str:
    value = fact.value
    if isinstance(value, float):
        rendered = f"{value:,.2f}"
    else:
        rendered = str(value)
    return f"{rendered} {fact.unit}".strip() if fact.unit else rendered


def _first_matching(
    indexed: Iterable[tuple[int, CanonicalFact]],
    name: str,
) -> tuple[int, CanonicalFact] | None:
    for index, fact in indexed:
        if fact.name == name:
            return index, fact
    return None


def _total_summary(indexed: list[tuple[int, CanonicalFact]], evidence_id: str) -> tuple[list[AdvisoryItem], list[AdvisoryCitation]]:
    totals = [
        (index, fact)
        for index, fact in indexed
        if fact.name.startswith("total.") and _numeric(fact.value) is not None
    ][:4]
    if not totals:
        return [], []

    citations = [_citation(index, fact, evidence_id) for index, fact in totals]
    statement = "; ".join(
        f"{fact.name.removeprefix('total.')} = {_format_value(fact)}"
        for _, fact in totals
    )
    return [
        AdvisoryItem(
            id="summary:totals",
            category="summary",
            priority="info",
            title="Canonical location totals",
            message=f"The selected location evidence reports: {statement}.",
            citations=[item.id for item in citations],
        )
    ], citations


def _record_coverage(indexed: list[tuple[int, CanonicalFact]], evidence_id: str) -> tuple[list[AdvisoryItem], list[AdvisoryCitation]]:
    record_fact = _first_matching(indexed, "total.recordCount")
    if record_fact is None:
        return [], []
    index, fact = record_fact
    citation = _citation(index, fact, evidence_id)
    count = _numeric(fact.value) or 0
    if count <= 0:
        item = AdvisoryItem(
            id="constraint:no-records",
            category="constraint",
            priority="high",
            title="No canonical records matched",
            message=(
                "No canonical records matched the selected location query. Do not make a marketing decision from this preview; "
                "review the saved view, date window and connected location sources first."
            ),
            citations=[citation.id],
        )
    else:
        item = AdvisoryItem(
            id="summary:coverage",
            category="summary",
            priority="info",
            title="Evidence coverage",
            message=f"The advisory is based on {int(count)} canonical records matched for the selected location.",
            citations=[citation.id],
        )
    return [item], [citation]


def _provider_comparisons(indexed: list[tuple[int, CanonicalFact]], evidence_id: str) -> tuple[list[AdvisoryItem], list[AdvisoryCitation]]:
    groups: dict[tuple[str, str], list[tuple[int, CanonicalFact, float]]] = defaultdict(list)
    for index, fact in indexed:
        provider = fact.dimensions.get("provider")
        date_bucket = fact.dimensions.get("dateBucket")
        numeric = _numeric(fact.value)
        if provider and date_bucket and numeric is not None:
            groups[(fact.name, date_bucket)].append((index, fact, numeric))

    items: list[AdvisoryItem] = []
    citations: list[AdvisoryCitation] = []
    for (name, date_bucket), rows in sorted(groups.items()):
        providers = {fact.dimensions.get("provider") for _, fact, _ in rows}
        if len(providers) < 2:
            continue
        highest = max(rows, key=lambda row: row[2])
        lowest = min(rows, key=lambda row: row[2])
        if highest[2] == lowest[2]:
            continue
        high_cite = _citation(highest[0], highest[1], evidence_id)
        low_cite = _citation(lowest[0], lowest[1], evidence_id)
        citations.extend([high_cite, low_cite])
        high_provider = highest[1].dimensions.get("provider", "unknown")
        low_provider = lowest[1].dimensions.get("provider", "unknown")
        items.append(
            AdvisoryItem(
                id=f"observation:provider:{len(items) + 1}",
                category="observation",
                priority="medium",
                title=f"Provider difference in {name}",
                message=(
                    f"On {date_bucket}, the observed {name} fact is higher for {high_provider} "
                    f"({_format_value(highest[1])}) than for {low_provider} ({_format_value(lowest[1])}). "
                    "This is a comparison of canonical facts, not a recalculation of the metric."
                ),
                citations=[high_cite.id, low_cite.id],
            )
        )
        if len(items) >= 3:
            break
    return items, citations


def _trend_observations(indexed: list[tuple[int, CanonicalFact]], evidence_id: str) -> tuple[list[AdvisoryItem], list[AdvisoryCitation]]:
    groups: dict[tuple[str, str], list[tuple[int, CanonicalFact, float]]] = defaultdict(list)
    for index, fact in indexed:
        date_bucket = fact.dimensions.get("dateBucket")
        provider = fact.dimensions.get("provider", "all")
        numeric = _numeric(fact.value)
        if date_bucket and numeric is not None and not fact.name.startswith("total."):
            groups[(fact.name, provider)].append((index, fact, numeric))

    items: list[AdvisoryItem] = []
    citations: list[AdvisoryCitation] = []
    for (name, provider), rows in sorted(groups.items()):
        rows.sort(key=lambda row: row[1].dimensions.get("dateBucket", ""))
        if len(rows) < 2:
            continue
        first, last = rows[0], rows[-1]
        if first[2] == last[2]:
            continue
        delta = last[2] - first[2]
        if first[2] != 0:
            magnitude = abs(delta / first[2])
            if magnitude < 0.10:
                continue
        first_cite = _citation(first[0], first[1], evidence_id)
        last_cite = _citation(last[0], last[1], evidence_id)
        citations.extend([first_cite, last_cite])
        direction = "increased" if delta > 0 else "decreased"
        scope = f" for {provider}" if provider != "all" else ""
        items.append(
            AdvisoryItem(
                id=f"observation:trend:{len(items) + 1}",
                category="observation",
                priority="medium",
                title=f"Observed {name} trend",
                message=(
                    f"The canonical {name} fact{scope} {direction} from {_format_value(first[1])} "
                    f"on {first[1].dimensions.get('dateBucket')} to {_format_value(last[1])} "
                    f"on {last[1].dimensions.get('dateBucket')}."
                ),
                citations=[first_cite.id, last_cite.id],
            )
        )
        if len(items) >= 3:
            break
    return items, citations


def _recommendations(observations: list[AdvisoryItem]) -> list[AdvisoryItem]:
    result: list[AdvisoryItem] = []
    for observation in observations[:3]:
        result.append(
            AdvisoryItem(
                id=f"recommendation:{len(result) + 1}",
                category="recommendation",
                priority=observation.priority,
                title=f"Review: {observation.title}",
                message=(
                    "Review the cited difference with the location manager before changing spend, messaging, pricing or customer activity. "
                    "Confirm that the data window and provider attribution are comparable, then decide whether a controlled experiment is justified."
                ),
                citations=list(observation.citations),
            )
        )
    if not result:
        result.append(
            AdvisoryItem(
                id="recommendation:insufficient-signal",
                category="recommendation",
                priority="low",
                title="No material comparative signal found",
                message=(
                    "The current canonical evidence does not contain a strong provider or time-series difference for this deterministic baseline. "
                    "Keep the evidence under review or select a richer saved view before taking action."
                ),
                citations=[],
            )
        )
    return result


def build_canonical_advisory(payload: GatewayPlanRequest) -> GatewayAdvisoryResponse:
    evidence = payload.evidence
    indexed = list(enumerate(evidence.facts))

    items: list[AdvisoryItem] = []
    citations: list[AdvisoryCitation] = []

    coverage_items, coverage_citations = _record_coverage(indexed, evidence.evidence_id)
    items.extend(coverage_items)
    citations.extend(coverage_citations)

    summary_items, summary_citations = _total_summary(indexed, evidence.evidence_id)
    items.extend(summary_items)
    citations.extend(summary_citations)

    comparative_items: list[AdvisoryItem] = []
    if payload.requested_action in {"analyse", "recommend"}:
        provider_items, provider_citations = _provider_comparisons(indexed, evidence.evidence_id)
        trend_items, trend_citations = _trend_observations(indexed, evidence.evidence_id)
        comparative_items = (provider_items + trend_items)[:5]
        items.extend(comparative_items)
        citations.extend(provider_citations + trend_citations)

    if payload.requested_action == "recommend":
        items.extend(_recommendations(comparative_items))

    unique_citations: dict[str, AdvisoryCitation] = {item.id: item for item in citations}
    source_ids = []
    for item in evidence.provenance:
        if item.source_id not in source_ids:
            source_ids.append(item.source_id)

    return GatewayAdvisoryResponse(
        advisory_version=ADVISORY_VERSION,
        tool_key=payload.tool_key,
        requested_action=payload.requested_action,
        evidence_id=evidence.evidence_id,
        location_id=evidence.location_id,
        deterministic_baseline=True,
        model_inference_executed=False,
        execution_authorised=False,
        external_write_authorised=False,
        human_approval_required=True,
        items=items[:20],
        citations=list(unique_citations.values())[:60],
        provenance_source_ids=source_ids[:200],
        message=(
            "A deterministic advisory preview was generated from canonical location-owned facts. "
            "No model inference, metric recalculation, external write or autonomous action occurred."
        ),
    )
