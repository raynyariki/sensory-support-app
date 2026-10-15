from datetime import datetime, timedelta, timezone


def test_empty_history(client, auth):
    r = client.get("/analytics?days=7", headers=auth).json()
    assert r["total_events"] == 0 and r["most_frequent_sound"] is None
    assert len(r["by_day"]) == 7 and all(d["count"] == 0 for d in r["by_day"])
    assert [x["response"] for x in r["by_response"]] == ["comfortable", "uncomfortable", "very_uncomfortable"]


def test_counts(client, auth):
    client.put("/sound-preferences", headers=auth, json={"preferences": [{"sound_category": "siren", "sensitivity_level": "high"}]})
    now = datetime.now(timezone.utc)
    for sound, response in [("siren", "uncomfortable"), ("siren", "very_uncomfortable"), ("alarm", None)]:
        body = {"sound_category": sound, "timestamp": now.isoformat()}
        if response:
            body["response"] = response
        client.post("/sound-events", headers=auth, json=body)
    client.post("/sound-events", headers=auth, json={"sound_category": "alarm", "timestamp": (now - timedelta(days=40)).isoformat()})
    r = client.get("/analytics?days=14", headers=auth).json()
    assert r["total_events"] == 4
    assert r["most_frequent_sound"]["sound_category"] in ("siren", "alarm")
    assert r["high_relevance_events"] == 2
    assert sum(d["count"] for d in r["by_day"]) == 3  # the 40-day-old entry is outside the window
    assert {x["response"]: x["count"] for x in r["by_response"]}["uncomfortable"] == 1


def test_timezone_and_validation(client, auth):
    assert client.get("/analytics?tz=Africa/Nairobi", headers=auth).json()["tz"] == "Africa/Nairobi"
    assert client.get("/analytics?tz=Mars/Base", headers=auth).status_code == 422
    assert client.get("/analytics?days=0", headers=auth).status_code == 422
    assert client.get("/analytics?days=91", headers=auth).status_code == 422


def test_analytics_only_counts_my_events(client, auth, second_auth):
    client.post("/sound-events", headers=auth, json={"sound_category": "siren"})
    assert client.get("/analytics", headers=second_auth).json()["total_events"] == 0