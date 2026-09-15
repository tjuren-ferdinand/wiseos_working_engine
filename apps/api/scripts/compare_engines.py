"""Jämförande test: samma golden-fall genom alla tre vision-bedömningsmotorer.

Kör identiska fixtures + facit + promptkontrakt mot Gemini, OpenAI och Claude
via respektive analyze_document och utvärderar med samma dimensionslogik som
tests/run_golden.py. Inga HTTP-anrop till den egna API:n — bara motorlagret.

    python scripts/compare_engines.py                # alla fall, alla motorer
    python scripts/compare_engines.py --case NAMN    # ett fall
    python scripts/compare_engines.py --engine openai
"""
from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.schemas import AnswerKeyItem, QuestionResult, DocumentMeta  # noqa: E402
from app.services import claude_vision, gemini_vision, openai_vision  # noqa: E402
from tests.golden_cases import build_cases  # noqa: E402
from tests.run_golden import DIMENSIONS, _check_question, _norm  # noqa: E402

# .env kan peka på en pensionerad Claude-modell — testet kör mot den
# nuvarande generationen om det gamla datum-ID:t är satt.
if settings.ANTHROPIC_MODEL == "claude-sonnet-4-20250514":
    print("NOTERING: .env har pensionerad ANTHROPIC_MODEL — kör testet mot claude-sonnet-4-6")
    settings.ANTHROPIC_MODEL = "claude-sonnet-4-6"

ENGINES = {
    "gemini": gemini_vision,
    "openai": openai_vision,
    "claude": claude_vision,
}


@dataclass
class EngineResult:
    engine: str
    case_name: str
    provenance: str
    dimensions: dict[str, bool] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    latency_ms: int = 0
    attempts: int = 0
    needs_review: int = 0
    questions: list[dict] = field(default_factory=list)
    meta_error: str | None = None

    @property
    def passed(self) -> bool:
        return bool(self.dimensions) and all(self.dimensions.values())


def _evaluate(case, questions: list[QuestionResult], meta: DocumentMeta) -> tuple[dict[str, bool], list[str], int]:
    """Samma dimensionslogik som run_golden.run_case, mot QuestionResult-objekt."""
    dims = {d: True for d in DIMENSIONS}
    failures: list[str] = []
    listed = [q for q in questions if q.inAnswerKey]
    unlisted = [q for q in questions if not q.inAnswerKey]
    needs_review = sum(1 for q in listed if q.assessment.status == "needs_review")

    if len(listed) != case.expected_question_count:
        failures.append(
            f"Antal facit-uppgifter i svaret: {len(listed)}, "
            f"förväntade {case.expected_question_count}"
        )
        dims["question_detection"] = False

    expected_unlisted = set(case.expected_unlisted)
    found_unlisted = {q.questionNumber for q in unlisted}
    if expected_unlisted and not expected_unlisted.issubset(found_unlisted):
        failures.append(
            f"Förväntade oförtecknade uppgifter {sorted(expected_unlisted)} "
            f"men hittade {sorted(found_unlisted)}"
        )
        dims["question_detection"] = False

    # _check_question förväntar API-formade dicts — dumpa med alias.
    by_number = {
        str(q.questionNumber): q.model_dump(by_alias=True) for q in listed
    }

    class _Rep:
        def __init__(self):
            self.failures = failures

    for exp in case.expectations:
        q = by_number.get(exp.question_number)
        if q is None:
            failures.append(f"Q{exp.question_number}: saknas helt i svaret")
            dims["question_mapping"] = False
            dims["work_extraction"] = False
            dims["scoring"] = False
            dims["annotation"] = False
            continue
        outcome = _check_question(exp, q, _Rep())
        for key, ok in outcome.items():
            dims[key] = dims[key] and ok

    # question_mapping: identisk lång transkription på två uppgifter = klistrat svar.
    works = [
        (q.questionNumber, _norm(q.studentWork or ""))
        for q in listed
        if (q.studentWork or "").strip()
    ]
    seen: dict[str, str] = {}
    for number, work in works:
        if len(work) >= 50 and work in seen:
            failures.append(
                f"Q{number} har identisk transkription som Q{seen[work]}"
            )
            dims["question_mapping"] = False
        seen[work] = number

    return dims, failures, needs_review


async def _run_engine(engine_name: str, module, case) -> EngineResult:
    result = EngineResult(engine=engine_name, case_name=case.name, provenance=case.provenance)
    pages = [
        (path.read_bytes(), mimetypes.guess_type(path.name)[0] or "image/png")
        for path in case.files
    ]
    answer_key = [AnswerKeyItem(**item) for item in case.answer_key]

    started = time.perf_counter()
    try:
        questions, meta = await module.analyze_document(
            pages=pages,
            answer_key=answer_key,
            grading_notes="",
            student_label=case.name,
        )
        result.latency_ms = int((time.perf_counter() - started) * 1000)
        result.attempts = meta.attempts or 0
        result.meta_error = meta.error
        dims, failures, nr = _evaluate(case, questions, meta)
        result.dimensions = dims
        result.failures = failures
        result.needs_review = nr
        result.questions = [q.model_dump(by_alias=True) for q in questions]
    except Exception as e:
        result.latency_ms = int((time.perf_counter() - started) * 1000)
        result.dimensions = {d: False for d in DIMENSIONS}
        result.failures = [f"MOTORFEL: {type(e).__name__}: {e}"]
        result.meta_error = str(e)[:300]
    return result


async def main_async(args) -> int:
    cases = build_cases()
    if args.case:
        cases = [c for c in cases if c.name == args.case]
    if args.provenance:
        cases = [c for c in cases if c.provenance == args.provenance]
    engines = [args.engine] if args.engine else list(ENGINES)
    if not cases:
        print("Inga fall matchade filtret.")
        return 2

    all_results: list[EngineResult] = []
    for case in cases:
        # Samma fall genom alla tre motorer parallellt — identisk input.
        results = await asyncio.gather(*[
            _run_engine(name, ENGINES[name], case) for name in engines
        ])
        for r in results:
            verdict = "PASS" if r.passed else "FAIL"
            print(
                f"{case.name:<42} {r.engine:<7} {verdict}  "
                f"{r.latency_ms:>7} ms  needs_review={r.needs_review}"
                + (f"  ERR:{r.meta_error[:80]}" if r.meta_error else ""),
                flush=True,
            )
            if not r.passed and args.verbose:
                for f in r.failures:
                    print(f"      - {f}")
        all_results.extend(results)

    # ---- Sammanställning per motor ----
    print(f"\n{'=' * 80}\nSAMMANSTÄLLNING PER MOTOR\n{'=' * 80}")
    for name in engines:
        rows = [r for r in all_results if r.engine == name]
        passed = sum(1 for r in rows if r.passed)
        nr = sum(r.needs_review for r in rows)
        lats = sorted(r.latency_ms for r in rows)
        med = lats[len(lats) // 2] if lats else 0
        print(f"\n{name.upper()}  ({rows[0].engine if rows else name})")
        print(f"  Fall godkända:      {passed}/{len(rows)}")
        for dim in DIMENSIONS:
            ok = sum(1 for r in rows if r.dimensions.get(dim))
            print(f"    {dim:<20} {ok}/{len(rows)}")
        print(f"  needs_review totalt: {nr}")
        print(f"  Latens median:       {med} ms  (min {min(lats) if lats else 0}, max {max(lats) if lats else 0})")
        # Per provenance-kategori
        for prov in ("real", "derived", "synthetic"):
            prow = [r for r in rows if r.provenance == prov]
            if prow:
                ppassed = sum(1 for r in prow if r.passed)
                print(f"    {prov:<12} {ppassed}/{len(prow)} fall godkända")

    out = Path(__file__).resolve().parent / "compare_engines_result.json"
    out.write_text(
        json.dumps(
            [
                {
                    "engine": r.engine, "case": r.case_name,
                    "provenance": r.provenance, "passed": r.passed,
                    "dimensions": r.dimensions, "failures": r.failures,
                    "latency_ms": r.latency_ms, "attempts": r.attempts,
                    "needs_review": r.needs_review, "meta_error": r.meta_error,
                }
                for r in all_results
            ],
            ensure_ascii=False, indent=2,
        )
    )
    print(f"\nDetaljer sparade: {out}")
    return 0


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass
    parser = argparse.ArgumentParser()
    parser.add_argument("--case")
    parser.add_argument("--provenance")
    parser.add_argument("--engine", choices=list(ENGINES))
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
