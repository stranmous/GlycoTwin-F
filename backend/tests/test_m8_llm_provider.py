"""M8 live-LLM path (WS3 follow-up): the Gemini provider is optional and
config-gated. These tests fake the HTTP transport — no real key, no network —
and pin the behaviors that make enabling an LLM safe:

- a configured key produces an API call to the current model, key in header;
- any API failure falls back to the local corpus answer;
- the post-LLM safety gate rejects generated dosage instructions outright.
"""
from typing import ClassVar

import httpx
import pytest

from app.modules.m8_coach import service as coach_service
from app.modules.m8_coach.llm_provider import LLMProvider
from app.modules.m8_coach.safety_guard import enforce_post_llm_safety
from app.modules.m8_coach.schemas import AICoachQuery


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


class _FakeClient:
    """Stands in for httpx.Client inside llm_provider."""

    captured: ClassVar[dict] = {}
    fail_next: bool = False

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, url, json=None, headers=None):
        _FakeClient.captured = {"url": url, "headers": headers, "json": json}
        if _FakeClient.fail_next:
            raise httpx.ConnectError("no route", request=None)
        return _FakeResponse(
            {"candidates": [{"content": {"parts": [{"text": "API answer text."}]}}]}
        )


@pytest.fixture
def fake_transport(monkeypatch):
    _FakeClient.captured = {}
    _FakeClient.fail_next = False
    monkeypatch.setattr(
        "app.modules.m8_coach.llm_provider.httpx.Client", _FakeClient
    )
    return _FakeClient


def test_gemini_call_uses_current_model_and_header_key(fake_transport, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    provider = LLMProvider()
    out = provider.generate_response("prompt text", "en")
    assert out == "API answer text."
    url = fake_transport.captured["url"]
    assert "models/gemini" in url and ":generateContent" in url
    assert "test-key-123" not in url  # key travels in the header, not the URL
    assert fake_transport.captured["headers"]["x-goog-api-key"] == "test-key-123"


def test_api_failure_falls_back_to_local(fake_transport, monkeypatch):
    fake_transport.fail_next = True
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
    provider = LLMProvider()
    out = provider.generate_response("User Query: can I eat mango?", "en")
    assert out != "API answer text."
    assert len(out) > 20  # a real local answer, not an error string


def test_no_key_stays_local(fake_transport, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    provider = LLMProvider()
    out = provider.generate_response("User Query: can I eat mango?", "en")
    assert out != "API answer text."
    assert fake_transport.captured == {}  # no HTTP attempted


def test_post_gate_replaces_generated_dosage_instruction():
    final, passed, _ = enforce_post_llm_safety(
        "Based on your reading, take 12 units of insulin before the meal.", "en"
    )
    assert passed is False
    assert "cannot recommend insulin dosages" in final


def test_post_gate_replaces_roman_urdu_dosage_instruction():
    final, passed, _ = enforce_post_llm_safety(
        "Aap khane se pehle 10 units insulin le lo, glucose control ho jayega.", "en"
    )
    assert passed is False
    assert "cannot recommend insulin dosages" in final


def test_post_gate_passes_benign_educational_text():
    final, passed, disclaimer = enforce_post_llm_safety(
        "A 30-minute walk after meals can blunt the glucose rise for many people.", "en"
    )
    assert passed is True
    assert disclaimer is True
    assert "Disclaimer:" not in final
    assert "30-minute walk" in final


def test_end_to_end_generated_dosage_is_caught(monkeypatch):
    """A safe question whose (faked) generation contains a dose must be refused."""
    monkeypatch.setattr(
        coach_service.llm_provider,
        "generate_response",
        lambda prompt, language="en": "You should inject 8 units of insulin now.",
    )
    resp = coach_service.process_coach_query(
        AICoachQuery(user_id="test-user", query_text="What does a post-meal walk do?", language="en")
    )
    assert resp.safety_passed is False
    assert "cannot recommend insulin dosages" in resp.response_text
