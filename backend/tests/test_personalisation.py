import pytest

from app.personalisation import no_alert_message, relevance_message, should_alert


@pytest.mark.parametrize(
    "level,enabled,threshold,expected",
    [
        ("high", True, "high", True),
        ("medium", True, "high", False),
        ("medium", True, "medium", True),
        ("low", True, "medium", False),
        ("low", True, "low", True),
        ("none", True, "low", False),
        ("high", False, "low", False),
    ],
)
def test_should_alert(level, enabled, threshold, expected):
    assert should_alert(level, enabled, threshold) is expected


def test_messages_exist_and_make_no_medical_claims():
    for level in ("high", "medium", "low", "none"):
        text = (relevance_message(level) + no_alert_message(level, True)).lower()
        for word in ("diagnos", "treat", "meltdown", "disorder", "cure"):
            assert word not in text