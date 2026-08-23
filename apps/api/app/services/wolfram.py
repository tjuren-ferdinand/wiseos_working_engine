"""Wolfram-verifierare med flera lägen och mock-fallback.

Prioriterad ordning när vi verifierar att elevens svar ≡ korrekt svar:

1. **Egen Wolfram Cloud-funktion** (`WOLFRAM_API_URL`) – mest kraftfull, kan
   returnera steg-för-steg via Mathematicas `Solve`/`Simplify`.
2. **Wolfram|Alpha Full Results API v2** (`WOLFRAM_APP_ID`) – rik JSON-output
   med pods. Detta är vad användaren har konfigurerat (App "wiseOS").
3. **Wolfram|Alpha Short Answers API v1** – textsvar `Yes`/`No`/`True`.
4. **Lokal deterministisk jämförelse** – för utvecklingsläge utan internet.
"""
from __future__ import annotations

import re
from typing import Any

import httpx

from ..config import settings
from ..schemas import WolframResult


def _normalize(expr: str) -> str:
    s = expr.strip().lower().replace(" ", "")
    s = s.replace("**", "^")
    # Ta bort trailing punkt/komma
    s = s.rstrip(".,;")
    return s


def _local_equivalence(a: str, b: str) -> bool:
    if _normalize(a) == _normalize(b):
        return True
    # Försök numerisk jämförelse om båda är rena tal
    try:
        return abs(float(a.replace(",", ".")) - float(b.replace(",", "."))) < 1e-6
    except ValueError:
        pass
    # Försök lös ekvation typ "x=3"
    m1 = re.search(r"=\s*(-?\d+(?:[\.,]\d+)?)", a)
    m2 = re.search(r"=\s*(-?\d+(?:[\.,]\d+)?)", b)
    if m1 and m2:
        try:
            return abs(float(m1.group(1).replace(",", ".")) - float(m2.group(1).replace(",", "."))) < 1e-6
        except ValueError:
            return False
    return False


class WolframVerifier:
    """Verifierare med tre lägen, i prioritetsordning:

    1. WOLFRAM_API_URL satt → POST {expression, answer} mot egen Wolfram Cloud-funktion
       (förväntar svar: {"success": bool, "areEqual": bool, "steps": [...], ...}).
    2. WOLFRAM_APP_ID satt → Wolfram Alpha Short Answers API (fallback).
    3. Inget satt → lokal deterministisk jämförelse (utvecklingsläge).
    """

    def __init__(self, app_id: str | None = None, api_url: str | None = None):
        self.app_id = app_id if app_id is not None else settings.WOLFRAM_APP_ID
        self.api_url = api_url if api_url is not None else settings.WOLFRAM_API_URL

    async def _via_cloud(self, student: str, correct: str) -> WolframResult:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                self.api_url,
                json={"expression": student, "answer": correct},
            )
            data = r.json() if r.status_code == 200 else {}
            ok = bool(data.get("areEqual", False))
            success = bool(data.get("success", r.status_code == 200))
            return WolframResult(
                is_correct=ok,
                confidence=0.95 if success else 0.4,
                steps_shown=list(data.get("steps", []) or []),
                alternative_forms=list(data.get("alternativeForms", []) or []),
                notes=data.get("error") or "wolfram-cloud",
            )

    async def _via_full_results(self, student: str, correct: str) -> WolframResult:
        """Wolfram|Alpha Full Results API v2 (rekommenderad för matematik).

        Strategin: bygg en boolesk fråga ``(student) == (correct)`` och låt
        Wolfram evaluera den. Hämtar pods (Result, Solution, Plot ...) och
        läser plaintext ur Result-poden för att avgöra korrekthet.

        Docs: https://products.wolframalpha.com/api/documentation
        """
        # Försök stripa "var = " så vi jämför rena uttryck (Wolfram klarar båda
        # formerna, men det här ger mer stabila boolska resultat).
        student_expr = _strip_lhs(student)
        correct_expr = _strip_lhs(correct)

        # Strategi 1: boolesk jämförelse "(student) == (correct)" – funkar för
        # konkreta värden (x=3 vs x=3).
        is_correct, confidence, notes = await self._query_full(
            f"({student_expr}) == ({correct_expr})"
        )
        if confidence >= 0.95:
            return WolframResult(is_correct=is_correct, confidence=confidence, notes=notes)

        # Strategi 2: algebraisk ekvivalens via Simplify[(a)-(b)] – fångar
        # identiteter som "2(x+1) ≡ 2x+2".
        is_correct2, confidence2, notes2 = await self._query_full(
            f"Simplify[({student_expr}) - ({correct_expr})]"
        )
        # Om Simplify reducerar till 0 → uttrycken är ekvivalenta.
        if "0" in (notes2.lower() if "result='0'" in notes2.lower() else "") or notes2.endswith("result='0'"):
            return WolframResult(is_correct=True, confidence=0.97, notes=f"simplify→0: {notes2}")

        # Inget av strategierna gav tydligt svar → kombinera + lokal fallback
        local_ok = _local_equivalence(student, correct)
        return WolframResult(
            is_correct=is_correct or is_correct2 or local_ok,
            confidence=max(confidence, confidence2, 0.6 if local_ok else 0.55),
            notes=f"{notes} | strategi2: {notes2}",
        )

    async def _query_full(self, input_expr: str) -> tuple[bool, float, str]:
        """Skickar en query till Full Results API och returnerar
        (is_correct, confidence, notes). Inkluderar ALLA pods (ingen filter)
        så vi får både Result, Identity, Solution etc.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(
                "https://api.wolframalpha.com/v2/query",
                params={
                    "input": input_expr,
                    "appid": self.app_id,
                    "output": "JSON",
                    "format": "plaintext",
                    "scantimeout": "10",
                    "podtimeout": "10",
                },
            )

        if r.status_code != 200:
            return False, 0.3, f"HTTP {r.status_code}"

        qr = r.json().get("queryresult", {}) if isinstance(r.json(), dict) else {}
        success = bool(qr.get("success", False))
        pods = qr.get("pods", []) or []

        # Samla plaintext från relevanta pods.
        result_text = ""
        all_texts: list[str] = []
        for pod in pods:
            pid = pod.get("id") or ""
            title = (pod.get("title") or "").lower()
            texts = [sp.get("plaintext", "").strip() for sp in pod.get("subpods", []) if sp.get("plaintext")]
            all_texts.extend(texts)
            # Prioriterade pods som ger boolean/förenklat svar
            if pid in {"Result", "Identity", "TrueOrFalseResult"} or title in {"result", "identity"}:
                if texts and not result_text:
                    result_text = texts[0]

        is_correct, confidence = _interpret_result(result_text)

        # Fallback: skanna alla pods efter "True" eller "False" om Result var tom
        if confidence < 0.7 and all_texts:
            joined = " | ".join(all_texts).lower()
            if "true" in joined and "false" not in joined:
                is_correct, confidence = True, 0.85
                result_text = "True (från sekundär pod)"
            elif "false" in joined and "true" not in joined:
                is_correct, confidence = False, 0.85
                result_text = "False (från sekundär pod)"

        return is_correct, confidence, f"success={success}, result='{result_text or '-'}'"

    async def _via_short_answers(self, student: str, correct: str) -> WolframResult:
        query = f"Is {student} equal to {correct}?"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.wolframalpha.com/v1/result",
                params={"i": query, "appid": self.app_id},
            )
            text = r.text.strip().lower() if r.status_code == 200 else ""
            ok = "yes" in text or "true" in text
            return WolframResult(
                is_correct=ok,
                confidence=0.9 if r.status_code == 200 else 0.5,
                notes=f"wolfram-short: {text}" if text else "wolfram: inget svar",
            )

    async def verify_equation(self, student_answer: str, correct_answer: str) -> WolframResult:
        # 1) Egen Wolfram Cloud-funktion
        if self.api_url:
            try:
                return await self._via_cloud(student_answer, correct_answer)
            except Exception as e:  # noqa: BLE001
                ok = _local_equivalence(student_answer, correct_answer)
                return WolframResult(is_correct=ok, confidence=0.5, notes=f"cloud-fel: {e!s}")

        # 2) Wolfram|Alpha Full Results API (rekommenderad – rik JSON med pods)
        if self.app_id:
            try:
                return await self._via_full_results(student_answer, correct_answer)
            except Exception as e:  # noqa: BLE001
                # Sista chans: Short Answers API (enklare textsvar)
                try:
                    return await self._via_short_answers(student_answer, correct_answer)
                except Exception:
                    ok = _local_equivalence(student_answer, correct_answer)
                    return WolframResult(is_correct=ok, confidence=0.5, notes=f"wolfram-fel: {e!s}")

        # 3) Lokal mock
        ok = _local_equivalence(student_answer, correct_answer)
        return WolframResult(
            is_correct=ok,
            confidence=0.85 if ok else 0.6,
            notes="mock: lokal jämförelse (Wolfram ej konfigurerat)",
        )


# ---------- Hjälpfunktioner för Full Results API ----------

def _strip_lhs(answer: str) -> str:
    """Ta bort 'x = ' / 'y = ' / etc. så bara höger-led blir kvar.

    "x = 3"        -> "3"
    "x = 2*pi"     -> "2*pi"
    "3"            -> "3"
    "f(x) = x^2"   -> "x^2"
    """
    s = answer.strip()
    # Matcha *en* identifier (ev. med argument) följd av '='
    m = re.match(r"^[a-zA-Z_]\w*(?:\([^)]*\))?\s*=\s*(.+)$", s)
    return m.group(1).strip() if m else s


def _extract_pods(pods: list[dict[str, Any]]) -> tuple[str, list[str]]:
    """Returnerar (result_plaintext, alternativa_former).

    Result-poden innehåller typiskt "True"/"False" eller det förenklade uttrycket.
    """
    result_text = ""
    alt_forms: list[str] = []

    for pod in pods:
        title = (pod.get("title") or "").lower()
        subpods = pod.get("subpods", []) or []
        texts = [sp.get("plaintext", "").strip() for sp in subpods if sp.get("plaintext")]

        if pod.get("id") == "Result" or title == "result":
            result_text = texts[0] if texts else ""
        elif "form" in title or "alternate" in title:
            alt_forms.extend(t for t in texts if t)

    return result_text, alt_forms


def _interpret_result(result_text: str) -> tuple[bool, float]:
    """Mappa Wolfram-resultat → (is_correct, confidence).

    >>> _interpret_result("True")   -> (True, 0.99)
    >>> _interpret_result("False")  -> (False, 0.99)
    >>> _interpret_result("")       -> (False, 0.0)
    """
    if not result_text:
        return False, 0.0
    norm = result_text.strip().lower()
    if norm in {"true", "yes", "1"}:
        return True, 0.99
    if norm in {"false", "no", "0"}:
        return False, 0.99
    # Oevaluerat / tvetydigt svar – anta inte korrekt; läraren kan granska.
    return False, 0.4
