"""
LLM provider abstraction for resume/JD-based question generation. Real, tested prompt
construction and JSON-repair logic (see question_generator.py's tests) sits on top of this;
only the actual network call to a provider is unverified here (no internet/Ollama binary in
the sandbox this was built in — see README for what was and wasn't run).
"""
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Sends a prompt to the LLM and returns its raw text response."""
