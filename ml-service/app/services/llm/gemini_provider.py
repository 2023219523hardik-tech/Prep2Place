"""
Real Google Gemini client — calls the generateContent REST endpoint. Requires a real
GEMINI_API_KEY (from Google AI Studio) set as an environment variable; NEVER hardcode a key
into this file or any other source file — see .env.example and the project README's security
note. Untestable here (no internet access in the sandbox this was built in), but the request/
response shape matches Gemini's documented API.
"""
import httpx

from app.services.llm.base import LLMProvider


class GeminiProvider(LLMProvider):
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash", timeout: float = 60.0):
        if not api_key:
            raise ValueError("Gemini API key is required — set GEMINI_API_KEY in your .env")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def complete(self, prompt: str, system: str | None = None) -> str:
        contents = []
        if system:
            # Gemini has no dedicated system role in the basic REST call; prepend as context.
            contents.append({"role": "user", "parts": [{"text": f"[System instructions]\n{system}"}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        url = f"{self.BASE_URL}/{self.model}:generateContent?key={self.api_key}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json={"contents": contents})
            response.raise_for_status()
            data = response.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                return ""
