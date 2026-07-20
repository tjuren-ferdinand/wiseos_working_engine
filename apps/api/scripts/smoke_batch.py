"""Smoke test: POST /api/v1/batch/grade with two fake student files."""
import json
import time
import urllib.request
import urllib.error
import mimetypes
import os
import sys
import uuid

URL = "http://127.0.0.1:8000/api/v1/batch/grade"

ANSWER_KEY = [
    {
        "question_number": "1",
        "final_answer": "a = 2.0 m/s^2",
        "derivation_steps": ["v = 20 m/s", "t = 10 s", "a = v/t"],
    },
    {
        "question_number": "2",
        "final_answer": "s = 100 m",
        "derivation_steps": ["s = 0.5*a*t^2"],
    },
]

STUDENTS = [
    ("Anna_Andersson.png", b"fake-png-bytes-anna", "image/png"),
    ("Erik_Eriksson.png", b"fake-png-bytes-erik", "image/png"),
]


def build_multipart(fields, files):
    boundary = "----wisebound" + uuid.uuid4().hex
    lines = []
    for name, value in fields:
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        lines.append(value.encode() if isinstance(value, str) else value)
    for name, filename, data, ctype in files:
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
        )
        lines.append(f"Content-Type: {ctype}".encode())
        lines.append(b"")
        lines.append(data)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"


def main():
    fields = [
        ("prov_id", "smoke-prov-1"),
        ("class_grading_parameters", "Kräv enheter i slutsvar"),
        ("test_specific_parameters", ""),
        ("answer_key_json", json.dumps(ANSWER_KEY)),
    ]
    files = [("files", fn, data, ct) for (fn, data, ct) in STUDENTS]
    body, ctype = build_multipart(fields, files)

    req = urllib.request.Request(URL, data=body, method="POST")
    req.add_header("Content-Type", ctype)
    req.add_header("Content-Length", str(len(body)))

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8")
            elapsed = time.time() - t0
            print(f"HTTP {r.status} in {elapsed:.1f}s, {len(raw)} bytes")
            data = json.loads(raw)
            print("integrations:", data.get("integrations"))
            print("activeRules:", data.get("activeRules"))
            print("totalStudents:", data.get("totalStudents"))
            print("totalSteps:", data.get("totalSteps"))
            for res in data["results"]:
                print(f"\n--- {res['studentName']} ({res['id'][:8]}) ---")
                for st in res["steps"]:
                    print(
                        f"  {st['label']}: verdict={st['aiVerdict']} "
                        f"pts={st['pointsBase']}/{st['pointsMax']} "
                        f"applied={st['appliedRules']} conf={st['confidence']}"
                    )
                    print(f"    feedback: {st['baseAnnotation'][:120]}")
    except urllib.error.HTTPError as e:
        elapsed = time.time() - t0
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTPError {e.code} in {elapsed:.1f}s\n{body}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
