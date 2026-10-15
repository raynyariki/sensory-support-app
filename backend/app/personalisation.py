"""Compare a detected sound with the user's own sound profile.

The wording matches the frontend's Monitor page. None of these messages makes a
medical claim: they only report what the user told the app.
"""

RANK = {"none": 0, "low": 1, "medium": 2, "high": 3}

RELEVANCE_MESSAGES = {
    "high": "This sound is marked as highly relevant in your sound profile.",
    "medium": "This sound is marked as moderately relevant in your sound profile.",
    "low": "This sound is marked as minimally relevant in your sound profile.",
    "none": "You marked this sound as not relevant, so no alert is shown.",
}


def relevance_message(level: str) -> str:
    return RELEVANCE_MESSAGES.get(level, RELEVANCE_MESSAGES["none"])


def should_alert(level: str, alerts_enabled: bool, threshold: str) -> bool:
    """Alert only if alerts are on and the sound is rated at or above the user's chosen level."""
    if not alerts_enabled:
        return False
    rank = RANK.get(level, 0)
    return rank > 0 and rank >= RANK[threshold]


def no_alert_message(level: str, alerts_enabled: bool) -> str:
    if level == "none":
        return RELEVANCE_MESSAGES["none"]
    if not alerts_enabled:
        return "Alerts are turned off in Settings."
    return "This sound is below your alert level in Settings, so no alert is shown."