from collections import Counter
from datetime import datetime, timezone

from app.schemas.common import ServiceMetadata
from app.schemas.customer_summary import (
    AppointmentSnapshot,
    CustomerSummaryRequest,
    CustomerSummaryResponse,
)


def _append_unique(items: list[str], value: str) -> None:
    clean = " ".join(str(value or "").split())
    if clean and clean not in items:
        items.append(clean)


def _format_currency(value: float) -> str:
    return f"£{max(0, float(value or 0)):,.2f}"


def _format_date(value: datetime | None) -> str:
    if value is None:
        return "an unspecified date"
    return value.astimezone(timezone.utc).strftime("%d %b %Y")


def _service_counter(appointments: list[AppointmentSnapshot]) -> Counter:
    return Counter(
        item.service_name.strip()
        for item in appointments
        if item.service_name.strip()
    )


def build_customer_summary(
    payload: CustomerSummaryRequest,
    *,
    provider_mode: str = "mock",
) -> CustomerSummaryResponse:
    """Create an explainable summary from authorised SalonAI customer data."""

    preferences: list[str] = []
    history: list[str] = []
    safety: list[str] = []
    actions: list[str] = []
    upcoming: list[str] = []
    products: list[str] = []
    gaps: list[str] = []
    rules: list[str] = []

    metrics = payload.metrics
    hair = payload.hair_profile
    booking = payload.booking_preferences

    completed = metrics.completed_appointments
    total_recorded = (
        completed
        + metrics.cancelled_appointments
        + metrics.no_show_appointments
    )

    if payload.preferred_stylist:
        _append_unique(preferences, f"Preferred stylist: {payload.preferred_stylist}.")
        rules.append("preferred-stylist")

    if payload.preferred_services:
        _append_unique(
            preferences,
            "Preferred services: " + ", ".join(payload.preferred_services[:5]) + ".",
        )
        rules.append("preferred-services")

    if booking.preferred_days:
        _append_unique(
            preferences,
            "Preferred booking days: " + ", ".join(booking.preferred_days) + ".",
        )

    if booking.preferred_time_of_day:
        _append_unique(
            preferences,
            f"Usually prefers {booking.preferred_time_of_day.replace('_', ' ')} appointments.",
        )

    if booking.preferred_reminder_channel:
        _append_unique(
            preferences,
            f"Preferred reminder channel: {booking.preferred_reminder_channel}.",
        )

    if booking.accessibility_requirements:
        _append_unique(
            preferences,
            f"Accessibility requirement: {booking.accessibility_requirements}",
        )
        rules.append("accessibility-requirement")

    completed_services = _service_counter(
        [item for item in payload.recent_appointments if item.status == "completed"]
    )

    if completed_services:
        top_services = completed_services.most_common(3)
        _append_unique(
            history,
            "Most frequent recent services: "
            + ", ".join(f"{name} ({count})" for name, count in top_services)
            + ".",
        )
        rules.append("service-frequency")
    else:
        gaps.append("No completed service history was available for pattern analysis.")

    if total_recorded > 0:
        completion_rate = completed / total_recorded
        _append_unique(
            history,
            f"Recorded appointment completion rate is {completion_rate * 100:.0f}% "
            f"across {total_recorded} completed, cancelled or no-show appointments.",
        )

        if metrics.no_show_appointments > 0:
            _append_unique(
                actions,
                "Confirm upcoming appointments proactively because the record includes one or more no-shows.",
            )
            rules.append("no-show-follow-up")

        if metrics.cancelled_appointments >= max(2, completed // 2):
            _append_unique(
                actions,
                "Review preferred booking times and cancellation reasons before scheduling the next visit.",
            )
            rules.append("cancellation-pattern")

    _append_unique(
        history,
        f"Recorded customer value is {_format_currency(metrics.total_spent)} "
        f"across {metrics.visit_count} visits, with an average spend of "
        f"{_format_currency(metrics.average_spend)}.",
    )

    if metrics.loyalty_points > 0 or payload.loyalty_tier != "standard":
        _append_unique(
            actions,
            f"Acknowledge {payload.loyalty_tier} loyalty status and {metrics.loyalty_points} available points during the consultation.",
        )
        rules.append("loyalty-recognition")

    hair_description = " ".join(
        item
        for item in [hair.density, hair.texture, hair.hair_type]
        if item
    )
    if hair_description:
        _append_unique(
            safety,
            f"Hair profile: {hair_description.replace('_', ' ')} hair.",
        )
    else:
        gaps.append("Hair type, texture and density are incomplete.")

    if hair.current_hair_colour:
        _append_unique(safety, f"Current recorded hair colour: {hair.current_hair_colour}.")

    if hair.concerns:
        _append_unique(
            safety,
            "Recorded hair concerns: " + ", ".join(hair.concerns) + ".",
        )
        rules.append("hair-concerns")

    if hair.allergies:
        _append_unique(
            safety,
            "Important allergy record: " + ", ".join(hair.allergies) + ". Verify before product or colour use.",
        )
        rules.append("allergy-caution")

    if hair.sensitivities:
        _append_unique(
            safety,
            "Recorded sensitivities: " + ", ".join(hair.sensitivities) + ".",
        )
        rules.append("sensitivity-caution")

    if hair.products_to_avoid:
        _append_unique(
            safety,
            "Products or ingredients to avoid: " + ", ".join(hair.products_to_avoid) + ".",
        )

    if hair.scalp_condition:
        _append_unique(safety, f"Scalp note: {hair.scalp_condition}")

    if hair.chemical_history:
        _append_unique(safety, f"Chemical history: {hair.chemical_history}")

    if hair.patch_test_result:
        patch_text = f"Last patch-test result: {hair.patch_test_result.replace('_', ' ')}"
        if hair.last_patch_test_at:
            patch_text += f" on {_format_date(hair.last_patch_test_at)}"
        _append_unique(safety, patch_text + ".")
    elif hair.current_hair_colour or hair.chemical_history:
        gaps.append("No current patch-test result is recorded for chemical-service planning.")

    open_follow_ups = [
        note
        for note in payload.recent_notes
        if note.requires_follow_up and not note.follow_up_completed
    ]
    if open_follow_ups:
        due_descriptions = []
        for note in open_follow_ups[:3]:
            due = _format_date(note.follow_up_at) if note.follow_up_at else "unscheduled"
            label = note.title or note.note_type.replace("_", " ")
            due_descriptions.append(f"{label} ({due})")
        _append_unique(
            actions,
            "Resolve open follow-ups: " + ", ".join(due_descriptions) + ".",
        )
        rules.append("open-follow-up")

    pinned_notes = [note for note in payload.recent_notes if note.pinned]
    if pinned_notes:
        for note in pinned_notes[:2]:
            _append_unique(
                actions,
                f"Review pinned {note.note_type.replace('_', ' ')} note: {note.title or note.content[:120]}",
            )
        rules.append("pinned-note")

    allergy_notes = [
        note for note in payload.recent_notes if note.note_type == "allergy"
    ]
    for note in allergy_notes[:2]:
        _append_unique(
            safety,
            f"Allergy note requiring staff review: {note.title or note.content[:180]}",
        )

    for appointment in payload.upcoming_appointments[:4]:
        service = appointment.service_name or "service"
        stylist = f" with {appointment.stylist_name}" if appointment.stylist_name else ""
        _append_unique(
            upcoming,
            f"{service}{stylist} on {_format_date(appointment.appointment_date)}"
            + (f" at {appointment.appointment_time}" if appointment.appointment_time else "")
            + ".",
        )

    if not payload.upcoming_appointments:
        _append_unique(actions, "Consider rebooking because no upcoming appointment is recorded.")
        rules.append("rebooking-opportunity")

    product_counter: Counter = Counter()
    for order in payload.recent_orders:
        for product in order.products:
            if product.strip():
                product_counter[product.strip()] += 1

    if product_counter:
        _append_unique(
            products,
            "Recently purchased products: "
            + ", ".join(
                f"{name} ({count})" for name, count in product_counter.most_common(5)
            )
            + ".",
        )
        rules.append("retail-history")
    else:
        gaps.append("No completed retail order history was available.")

    if hair.preferred_products:
        _append_unique(
            products,
            "Recorded product preferences: " + ", ".join(hair.preferred_products) + ".",
        )

    evidence_groups = sum(
        bool(group)
        for group in [
            payload.recent_appointments,
            payload.recent_notes,
            payload.recent_orders,
            hair_description or hair.concerns,
            preferences,
        ]
    )
    confidence = min(0.97, 0.52 + (0.085 * evidence_groups))

    headline = f"Customer briefing for {payload.display_name}"
    executive_summary = (
        f"{payload.display_name} is a {payload.loyalty_tier} customer with "
        f"{metrics.visit_count} recorded visits and {_format_currency(metrics.total_spent)} "
        "in recorded spend."
    )

    if completed_services:
        executive_summary += (
            f" Their recent service history centres on {completed_services.most_common(1)[0][0]}."
        )
    if open_follow_ups:
        executive_summary += f" {len(open_follow_ups)} follow-up action(s) remain open."
    if payload.upcoming_appointments:
        executive_summary += " An upcoming booking is present and should be prepared using the safety and preference notes below."
    else:
        executive_summary += " No upcoming booking is currently recorded."

    if payload.summary_style == "concise":
        preferences = preferences[:4]
        history = history[:3]
        safety = safety[:5]
        actions = actions[:4]
        upcoming = upcoming[:2]
        products = products[:2]
        gaps = gaps[:4]

    return CustomerSummaryResponse(
        headline=headline,
        executive_summary=executive_summary,
        key_preferences=preferences,
        service_history_insights=history,
        hair_and_safety_notes=safety,
        relationship_actions=actions,
        upcoming_appointment_focus=upcoming,
        product_insights=products,
        data_quality_gaps=gaps,
        confidence=round(confidence, 3),
        metadata=ServiceMetadata(
            provider_mode=provider_mode,
            model_name="salonai-customer-summary-rules-v1",
            rules_applied=rules,
        ),
    )
