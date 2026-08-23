"""Kör golden-sviten mot den RIKTIGA API-endpointen och rapporterar per dimension.

    bild -> POST /api/v1/batch/grade -> Gemini -> parse -> validate -> API-svar

Varje fall bedöms på fem dimensioner:
  question_detection   hittades rätt antal uppgifter?
  work_extraction      kommer studentWork från bilden (och är inte påhittat)?
  question_mapping     hamnade rätt svar på rätt uppgiftsnummer?
  scoring              är status/poäng rimliga mot oberoende verifierat facit?
  annotation           finns strukturerad annotering som speglar elevens arbete?

Kör:
    python tests/run_golden.py                # alla fall
    python tests/run_golden.py --case NAMN    # ett fall
    python tests/run_golden.py --provenance real
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.golden_cases import GoldenCase, QuestionExpectation, build_cases  # noqa: E402

API_URL = "http://localhost:8000/api/v1/batch/grade"
REQUEST_TIMEOUT = 600.0

DIMENSIONS = (
    "question_detection",
    "work_extraction",
    "question_mapping",
    "scoring",
    "annotation",
)


@dataclass
class CaseReport:
    case: GoldenCase
    dimensions: dict[str, bool] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    questions_expected: int = 0
    questions_detected: int = 0
    latency_ms: int = 0
    http_status: int = 0
    raw: dict | None = None
    document_meta: dict | None = None

    @property
    def passed(self) -> bool:
        return bool(self.dimensions) and all(self.dimensions.values())


def _norm(text: str) -> str:
    """Normaliserar för tolerant nyckelordsjämförelse."""
    lowered = (text or "").lower()
    for ch in ("*", " ", "\u00b7", "\u22c5", "\u2212", "-", "\n", "\t"):
        lowered = lowered.replace(ch, "" if ch != "\n" else " ")
    return lowered


def _contains(haystack: str, needle: str) -> bool:
    return _norm(needle) in _norm(haystack)


def _post_case(case: GoldenCase) -> tuple[int, dict, int]:
    files = []
    for index, path in enumerate(case.files, start=1):
        mime = mimetypes.guess_type(path.name)[0] or "image/png"
        # Filnamnet styr elev + sidnummer. Alla sidor i ett fall tillhör
        # samma elev, så de får samma bas och löpande sidnummer.
        upload_name = f"{case.name}_sida{index}{path.suffix}"
        files.append(("files", (upload_name, path.read_bytes(), mime)))

    data = {
        "prov_id": f"golden-{case.name}",
        "class_grading_parameters": "",
        "test_specific_parameters": "",
        "answer_key_json": json.dumps(case.answer_key, ensure_ascii=False),
    }

    started = time.perf_counter()
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.post(API_URL, data=data, files=files)
    latency = int((time.perf_counter() - started) * 1000)

    try:
        body = response.json()
    except Exception:
        body = {"_raw_text": response.text[:2000]}
    return response.status_code, body, latency


def _check_question(
    exp: QuestionExpectation, q: dict, report: CaseReport
) -> dict[str, bool]:
    """Returnerar dimensionsutfall för en enskild uppgift."""
    out = {"work_extraction": True, "scoring": True, "annotation": True}
    qn = exp.question_number
    work = q.get("studentWork") or ""
    assessment = q.get("assessment") or {}
    status = assessment.get("status")
    points = float(assessment.get("points") or 0.0)
    annotation = q.get("annotation") or {}

    # --- found ---
    if q.get("found") is not exp.found:
        report.failures.append(
            f"Q{qn}: found={q.get('found')} men förväntade {exp.found}"
        )
        out["work_extraction"] = False

    # --- transkription ---
    if exp.expect_empty_work:
        if work.strip():
            report.failures.append(
                f"Q{qn}: förväntade tomt studentWork men fick {work[:80]!r}"
            )
            out["work_extraction"] = False
    else:
        for needle in exp.must_contain:
            if not _contains(work, needle):
                report.failures.append(
                    f"Q{qn}: studentWork saknar {needle!r} (fick {work[:100]!r})"
                )
                out["work_extraction"] = False

    for banned in exp.must_not_contain:
        if _contains(work, banned):
            report.failures.append(
                f"Q{qn}: studentWork innehåller förbjuden text {banned!r} "
                f"– tyder på påhittat elevarbete"
            )
            out["work_extraction"] = False

    # --- bedömning ---
    if status not in exp.allowed_status:
        report.failures.append(
            f"Q{qn}: status={status!r} utanför tillåtna {exp.allowed_status}"
        )
        out["scoring"] = False
    if exp.min_points is not None and points < exp.min_points:
        report.failures.append(f"Q{qn}: poäng {points} < förväntat minst {exp.min_points}")
        out["scoring"] = False
    if exp.max_points_awarded is not None and points > exp.max_points_awarded:
        report.failures.append(
            f"Q{qn}: poäng {points} > tillåtet max {exp.max_points_awarded}"
        )
        out["scoring"] = False

    # --- annotering ---
    has_any = bool(
        (annotation.get("summary") or "").strip()
        or annotation.get("evidence")
        or annotation.get("issues")
    )
    if not has_any:
        report.failures.append(f"Q{qn}: annotering saknas helt")
        out["annotation"] = False
    if exp.require_issue and not annotation.get("issues"):
        report.failures.append(
            f"Q{qn}: förväntade minst ett konkret fel i annotation.issues"
        )
        out["annotation"] = False
    # En uppgift med elevarbete och feedback ska inte ha tom feedback.
    if work.strip() and not (q.get("feedback") or "").strip():
        report.failures.append(f"Q{qn}: feedback saknas trots elevarbete")
        out["annotation"] = False

    return out


def run_case(case: GoldenCase) -> CaseReport:
    report = CaseReport(case=case, questions_expected=case.expected_question_count)
    dims = {d: True for d in DIMENSIONS}

    try:
        status_code, body, latency = _post_case(case)
    except Exception as e:
        report.failures.append(f"HTTP-anrop misslyckades: {e}")
        report.dimensions = {d: False for d in DIMENSIONS}
        return report

    report.http_status = status_code
    report.latency_ms = latency
    report.raw = body

    if status_code != 200:
        report.failures.append(f"HTTP {status_code}: {str(body)[:300]}")
        report.dimensions = {d: False for d in DIMENSIONS}
        return report

    results = body.get("results") or []
    if len(results) != 1:
        report.failures.append(
            f"Förväntade 1 elevdokument (sidorna ska grupperas) men fick {len(results)}"
        )
        report.dimensions = {d: False for d in DIMENSIONS}
        return report

    result = results[0]
    report.document_meta = result.get("document") or {}
    questions = result.get("questions") or []
    listed = [q for q in questions if q.get("inAnswerKey")]
    unlisted = [q for q in questions if not q.get("inAnswerKey")]
    report.questions_detected = sum(1 for q in listed if q.get("found"))

    # --- question_detection ---
    if len(listed) != case.expected_question_count:
        report.failures.append(
            f"Antal facit-uppgifter i svaret: {len(listed)}, "
            f"förväntade {case.expected_question_count}"
        )
        dims["question_detection"] = False

    expected_unlisted = set(case.expected_unlisted)
    found_unlisted = {q.get("questionNumber") for q in unlisted}
    if expected_unlisted and not expected_unlisted.issubset(found_unlisted):
        report.failures.append(
            f"Förväntade oförtecknade uppgifter {sorted(expected_unlisted)} "
            f"men hittade {sorted(found_unlisted)}"
        )
        dims["question_detection"] = False

    # --- per uppgift ---
    by_number = {str(q.get("questionNumber")): q for q in listed}
    for exp in case.expectations:
        q = by_number.get(exp.question_number)
        if q is None:
            report.failures.append(f"Q{exp.question_number}: saknas helt i svaret")
            dims["question_mapping"] = False
            dims["work_extraction"] = False
            dims["scoring"] = False
            dims["annotation"] = False
            continue
        outcome = _check_question(exp, q, report)
        for key, ok in outcome.items():
            dims[key] = dims[key] and ok

    # --- question_mapping: samma transkription får inte dyka upp på två uppgifter ---
    # Men korta numeriska svar (t.ex. 'Svar: 12') kan legitimerat vara lika
    # för olika uppgifter. Trigga bara om texten är tillräckligt lång.
    _DUPLICATE_MIN_CHARS = 50
    works = [
        (q.get("questionNumber"), _norm(q.get("studentWork") or ""))
        for q in listed
        if (q.get("studentWork") or "").strip()
    ]
    seen: dict[str, str] = {}
    for number, work in works:
        if len(work) >= _DUPLICATE_MIN_CHARS and work in seen:
            report.failures.append(
                f"Q{number} har identisk transkription som Q{seen[work]} "
                f"– elevsvar kopierat mellan uppgifter"
            )
            dims["question_mapping"] = False
        seen[work] = number

    report.dimensions = dims
    return report


def print_report(report: CaseReport) -> None:
    case = report.case
    verdict = "PASS" if report.passed else "FAIL"
    print(f"\n{'=' * 78}")
    print(f"Test:              {case.name}   [{verdict}]")
    print(f"Beskrivning:       {case.description}")
    print(f"Ursprung:          {case.provenance}")
    print(f"Input image(s):    {', '.join(f.name for f in case.files)}")
    if case.notes:
        print(f"Not:               {case.notes}")
    print(f"Questions expected: {report.questions_expected}")
    print(f"Questions detected: {report.questions_detected}")
    print(f"HTTP:              {report.http_status}   latency {report.latency_ms} ms")
    meta = report.document_meta or {}
    if meta:
        print(
            f"Dokument:          sidor={meta.get('pageCount')} "
            f"modell={meta.get('model')} försök={meta.get('attempts')} "
            f"motor-latens={meta.get('latencyMs')} ms"
        )
    if meta.get("error"):
        print(f"MOTORFEL:          {meta['error']}")
    for dim in DIMENSIONS:
        ok = report.dimensions.get(dim)
        label = "PASS" if ok else "FAIL" if ok is False else "-"
        print(f"  {dim:<20} {label}")
    if report.failures:
        print("  Avvikelser:")
        for failure in report.failures:
            print(f"    - {failure}")


def print_transcriptions(report: CaseReport) -> None:
    if not report.raw:
        return
    results = report.raw.get("results") or []
    if not results:
        return
    for q in results[0].get("questions") or []:
        assessment = q.get("assessment") or {}
        annotation = q.get("annotation") or {}
        tag = "" if q.get("inAnswerKey") else "  (ej i facit)"
        print(
            f"    Q{q.get('questionNumber')}{tag}: found={q.get('found')} "
            f"status={assessment.get('status')} "
            f"{assessment.get('points')}/{assessment.get('maxPoints')} "
            f"conf={q.get('transcriptionConfidence')}"
        )
        work = (q.get("studentWork") or "").replace("\n", " | ")
        print(f"      elev: {work[:160]!r}")
        if annotation.get("evidence"):
            print(f"      [+] {annotation['evidence'][:3]}")
        if annotation.get("issues"):
            print(f"      [-] {annotation['issues'][:3]}")
        if q.get("error"):
            print(f"      [!] error: {q['error']}")


def main() -> int:
    # Windows-konsolen är cp1252; tvinga UTF-8 så sv/matematiska tecken inte kraschar.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--case", help="kör bara detta fall")
    parser.add_argument("--provenance", help="real | derived | synthetic")
    parser.add_argument("--verbose", action="store_true", help="visa transkriptioner")
    args = parser.parse_args()

    cases = build_cases()
    if args.case:
        cases = [c for c in cases if c.name == args.case]
    if args.provenance:
        cases = [c for c in cases if c.provenance == args.provenance]
    if not cases:
        print("Inga fall matchade filtret.")
        return 2

    missing = [f for c in cases for f in c.files if not f.exists()]
    if missing:
        print("Saknade fixtures. Kör: python tests/make_fixtures.py")
        for f in missing:
            print(f"  {f}")
        return 2

    reports: list[CaseReport] = []
    for case in cases:
        report = run_case(case)
        reports.append(report)
        print_report(report)
        if args.verbose:
            print_transcriptions(report)

    passed = sum(1 for r in reports if r.passed)
    failed = len(reports) - passed

    print(f"\n{'=' * 78}")
    print("SAMMANFATTNING")
    print(f"{'=' * 78}")
    print(f"Tests executed: {len(reports)}")
    print(f"Passed:         {passed}")
    print(f"Failed:         {failed}")

    for dim in DIMENSIONS:
        ok = sum(1 for r in reports if r.dimensions.get(dim))
        pct = (ok / len(reports) * 100) if reports else 0
        print(f"  {dim:<20} {ok}/{len(reports)}  ({pct:.0f}%)")

    latencies = [r.latency_ms for r in reports if r.latency_ms]
    if latencies:
        print(
            f"\nLatens: min {min(latencies)} ms | median "
            f"{sorted(latencies)[len(latencies) // 2]} ms | max {max(latencies)} ms"
        )

    if failed:
        print("\nMisslyckade fall:")
        for r in reports:
            if not r.passed:
                print(f"  - {r.case.name}")
                for failure in r.failures:
                    print(f"      {failure}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
