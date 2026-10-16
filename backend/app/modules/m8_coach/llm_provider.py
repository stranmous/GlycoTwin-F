"""Live LLM API Provider (Gemini / OpenAI) with local fallback mode for Module 8 AI Coach."""

import json
from collections.abc import Generator

import httpx

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger("glycotwin.coach.llm")

# Failure modes of the live provider calls that trigger the local fallback:
# transport/status errors, malformed JSON, unexpected response shapes.
API_ERRORS = (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError)


class LLMProvider:
    """Provider wrapper supporting live Gemini/OpenAI API requests and local fallback mode."""

    def __init__(self):
        # All configuration comes from Settings (the single source of
        # configuration). A fresh Settings() is read here rather than the
        # cached get_settings() so callers that set env vars before
        # constructing the provider (e.g. tests) see them.
        settings = Settings()
        self.gemini_api_key = settings.gemini_api_key or None
        self.openai_api_key = settings.openai_api_key or None
        self.provider_override = settings.llm_provider.lower()
        self.gemini_model = settings.gemini_model
        # Fall back to the unified LLM_API_KEY when provider-specific
        # variables are not set.
        if self.provider_override == "gemini" and not self.gemini_api_key:
            self.gemini_api_key = settings.llm_api_key or None
        elif self.provider_override == "openai" and not self.openai_api_key:
            self.openai_api_key = settings.llm_api_key or None

    def generate_response(self, prompt: str, language: str = "en") -> str:
        """Generate full text response using live API or local fallback."""
        if self.provider_override == "local" or (not self.gemini_api_key and not self.openai_api_key):
            return self._local_generate(prompt, language)

        if self.gemini_api_key and self.provider_override != "openai":
            try:
                return self._call_gemini_api(prompt)
            except API_ERRORS as exc:
                log.warning("Gemini call failed (%s); using local fallback", exc)
                return self._local_generate(prompt, language)

        if self.openai_api_key:
            try:
                return self._call_openai_api(prompt)
            except API_ERRORS as exc:
                log.warning("OpenAI call failed (%s); using local fallback", exc)
                return self._local_generate(prompt, language)

        return self._local_generate(prompt, language)

    def stream_response(self, prompt: str, language: str = "en") -> Generator[str, None, None]:
        """Stream text response chunks using live API or local fallback."""
        if self.provider_override == "local" or (not self.gemini_api_key and not self.openai_api_key):
            yield from self._local_stream(prompt, language)
            return

        if self.gemini_api_key and self.provider_override != "openai":
            try:
                yield from self._stream_gemini_api(prompt)
                return
            except API_ERRORS as exc:
                log.warning("Gemini stream failed (%s); using local fallback", exc)
                yield from self._local_stream(prompt, language)
                return

        if self.openai_api_key:
            try:
                yield from self._stream_openai_api(prompt)
                return
            except API_ERRORS as exc:
                log.warning("OpenAI stream failed (%s); using local fallback", exc)
                yield from self._local_stream(prompt, language)
                return

        yield from self._local_stream(prompt, language)

    def _local_generate(self, prompt: str, language: str = "en") -> str:
        from app.modules.m8_coach.rag_service import generate_coaching_response
        return generate_coaching_response(prompt, language)

    def _local_stream(self, prompt: str, language: str = "en") -> Generator[str, None, None]:
        full_text = self._local_generate(prompt, language)
        words = full_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else " " + word
            yield chunk

    def _get_gemini_candidate_models(self) -> list[str]:
        candidates = [self.gemini_model]
        for m in ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-flash-latest"]:
            if m not in candidates:
                candidates.append(m)
        return candidates

    def _call_gemini_api(self, prompt: str) -> str:
        candidates = self._get_gemini_candidate_models()
        last_exc = None
        for model_name in candidates:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            headers = {"Content-Type": "application/json", "x-goog-api-key": self.gemini_api_key}
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            try:
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as exc:
                log.warning("Gemini model %s failed (%s); trying next fallback", model_name, exc)
                last_exc = exc
                continue
        if last_exc:
            raise last_exc
        raise RuntimeError("No Gemini models succeeded.")

    def _stream_gemini_api(self, prompt: str) -> Generator[str, None, None]:
        candidates = self._get_gemini_candidate_models()
        for model_name in candidates:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent"
            headers = {"Content-Type": "application/json", "x-goog-api-key": self.gemini_api_key}
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            try:
                with httpx.Client(timeout=45.0) as client, client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code != 200:
                        continue
                    yielded_any = False
                    for line in response.iter_lines():
                        if line:
                            try:
                                clean_line = line.strip().lstrip("[").rstrip(",")
                                data = json.loads(clean_line)
                                text = data["candidates"][0]["content"]["parts"][0]["text"]
                                if text:
                                    yielded_any = True
                                    yield text
                            except (ValueError, KeyError, IndexError, TypeError):
                                continue
                    if yielded_any:
                        return
            except Exception as exc:
                log.warning("Gemini stream with %s failed (%s); trying next candidate", model_name, exc)
                continue

        # If streaming didn't produce tokens, fallback to regular call
        full_text = self._call_gemini_api(prompt)
        yield full_text

    def _call_openai_api(self, prompt: str) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _stream_openai_api(self, prompt: str) -> Generator[str, None, None]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        with httpx.Client(timeout=30.0) as client, client.stream(
            "POST", url, json=payload, headers=headers
        ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: ") and not line.endswith("[DONE]"):
                        try:
                            data = json.loads(line[6:])
                            delta = data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except (ValueError, KeyError, IndexError, TypeError):
                            log.debug("skipping malformed stream line", exc_info=True)
                            continue
