"""Golden testfall för wiseOS bildförst-rättning.

VIKTIGT OM METODEN
------------------
Förväntningarna nedan är härledda från matematiken/fysiken i uppgifterna och
från vad en människa läser i bilden — INTE genom att kopiera modellens output.

Exempel på oberoende verifiering (math_derivative):
    s(t) = 2t^2 + 5t
    v(t) = s'(t) = 4t + 5
    v(3) = 4*3 + 5 = 12 + 5 = 17
  -> Anna skriver 17 via korrekt mellanled            => correct, 3/3
  -> Linnea skriver 17 men hoppar över mellanledet    => correct men färre steg
  -> Erik skriver "4*3 = 16" och landar på 21         => RÄKNEFEL, får inte bli correct

Erik-fallet är det viktigaste i sviten: en modell som bara mönstermatchar
"rätt metod" kommer felaktigt ge full poäng. Rätt beteende är delpoäng.

FIXTURES
--------
real       = fotograferat/renderat elevmaterial som redan fanns i projektet
derived    = samma riktiga elevmaterial, transformerat (rotation, brus, delning)
synthetic  = genererad bild för ett scenario vi saknar riktigt material för
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Riktigt elevmaterial ägs av testsviten själv så att den inte beror på
# mappar i repo-roten som kan hinna ändras eller dubbleras.
REAL = FIXTURES / "real"


# ---------------------------------------------------------------------------
# Facit
# ---------------------------------------------------------------------------

PHYSICS_ANSWER_KEY = [
    {
        "question_number": "1",
        "question_text": (
            "Beskriv rörelsen hos en sten som en astronaut kastar i rymden, "
            "förutsatt att inga yttre krafter påverkar den."
        ),
        "final_answer": (
            "Stenen rör sig med konstant hastighet i en rak linje i all oändlighet "
            "eftersom inga yttre krafter påverkar den."
        ),
        "derivation_steps": [
            "Newtons första lag (tröghetslagen)",
            "F = 0 ger a = 0",
            "konstant hastighet i rak linje",
        ],
        "max_points": 2,
        "rubric": {
            "2": "Nämner tröghetslagen/F=0 => a=0 OCH konstant hastighet i rak linje.",
            "1": "Nämner endast en av delarna.",
            "0": "Beskriver rörelsen felaktigt, t.ex. att stenen stannar.",
        },
    },
    {
        "question_number": "2",
        "question_text": "Vad händer med luften i en sluten flaska när den värms upp?",
        "final_answer": (
            "Luftmolekylerna rör sig snabbare och krockar oftare och hårdare mot "
            "flaskans väggar, vilket gör att trycket ökar."
        ),
        "derivation_steps": [
            "Temperatur = mått på molekylernas medelrörelseenergi",
            "molekylerna rör sig snabbare",
            "fler och hårdare krockar mot väggarna",
            "trycket ökar",
        ],
        "max_points": 2,
        "rubric": {
            "2": "Kopplar ökad temperatur till snabbare molekyler OCH ökat tryck.",
            "1": "Nämner att trycket ökar men förklarar inte molekylnivån.",
            "0": "Felaktig eller utebliven förklaring.",
        },
    },
    {
        "question_number": "3",
        "question_text": (
            "Förklara varför en penna ser ut att vara böjd när den delvis sänks "
            "ner i ett glas med vatten."
        ),
        "final_answer": (
            "När ljuset passerar gränsen mellan luft och vatten ändras dess hastighet, "
            "vilket får ljusstrålarna att byta riktning (brytas). Det skapar en "
            "virtuell bild och får pennan att se böjd ut."
        ),
        "derivation_steps": [
            "ljus går från luft till vatten",
            "hastigheten ändras",
            "ljuset bryts (refraktion)",
            "virtuell bild gör att pennan ser böjd ut",
        ],
        "max_points": 2,
        "rubric": {
            "2": "Nämner hastighetsändring OCH brytning/refraktion som orsak.",
            "1": "Nämner brytning utan att förklara varför.",
            "0": "Felaktig förklaring.",
        },
    },
]

DERIVATIVE_ANSWER_KEY = [
    {
        "question_number": "1",
        "question_text": "Bestäm hastigheten v vid t = 3 s då s(t) = 2t² + 5t.",
        "final_answer": "v(3) = 17 m/s",
        "derivation_steps": [
            "v(t) = s'(t) = 4t + 5",
            "v(3) = 4*3 + 5",
            "4*3 = 12",
            "12 + 5 = 17",
        ],
        "max_points": 3,
        "rubric": {
            "3": "Korrekt derivata, korrekt insättning, korrekt aritmetik och svar 17 m/s.",
            "2": "Korrekt derivata och metod men räknefel som ger fel slutsvar.",
            "1": "Korrekt derivata men i övrigt felaktig lösning.",
            "0": "Felaktig derivata.",
        },
    }
]


# ---------------------------------------------------------------------------
# Förväntningar
# ---------------------------------------------------------------------------


@dataclass
class QuestionExpectation:
    question_number: str
    found: bool = True
    # Nyckelord som MÅSTE finnas i transkriptionen (elevens faktiska ord).
    must_contain: list[str] = field(default_factory=list)
    # Text som INTE får förekomma – fångar att modellen hittar på elevarbete.
    must_not_contain: list[str] = field(default_factory=list)
    # Tillåtna statusvärden. Flera tillåts där mänskliga bedömare kan skilja sig.
    allowed_status: tuple[str, ...] = ("correct", "partial", "incorrect", "needs_review")
    min_points: float | None = None
    max_points_awarded: float | None = None
    expect_empty_work: bool = False
    # Kräver att annoteringen listar minst ett konkret fel.
    require_issue: bool = False


@dataclass
class GoldenCase:
    name: str
    description: str
    # "real" | "derived" | "synthetic"
    provenance: str
    files: list[Path]
    answer_key: list[dict]
    expectations: list[QuestionExpectation]
    expected_question_count: int
    # Uppgiftsnummer som finns i bilden men saknas i facit.
    expected_unlisted: list[str] = field(default_factory=list)
    notes: str = ""


def _fixture(name: str) -> Path:
    return FIXTURES / name


def build_cases() -> list[GoldenCase]:
    """Alla golden-fall. Fixtures genereras av tests/make_fixtures.py."""
    cases: list[GoldenCase] = []

    # ---------------- Riktiga bilder ----------------

    cases.append(
        GoldenCase(
            name="physics_handwritten_real",
            description="Test A/B/D/E – handskrivet fysikprov, 3 uppgifter, diagram och formler",
            provenance="real",
            files=[REAL / "physics_prov.jpg"],
            answer_key=PHYSICS_ANSWER_KEY,
            expected_question_count=3,
            notes=(
                "Två ark fotograferade sida vid sida. Fråga 2 förekommer TVÅ gånger "
                "(nedre vänster + övre höger) och måste slås ihop till en uppgift."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["tröghetslagen"],
                    allowed_status=("correct",),
                    min_points=2.0,
                ),
                QuestionExpectation(
                    question_number="2",
                    must_contain=["trycket"],
                    allowed_status=("correct",),
                    min_points=2.0,
                ),
                QuestionExpectation(
                    question_number="3",
                    must_contain=["hastighet"],
                    allowed_status=("correct",),
                    min_points=2.0,
                ),
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_derivative_correct_real",
            description="Test A/I – Anna, korrekt derivata med fullständigt mellanled",
            provenance="real",
            files=[REAL / "Anna_Andersson.png"],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="Oberoende verifierat: v(3) = 4*3+5 = 17. Anna har allt rätt.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["4t + 5", "17"],
                    allowed_status=("correct",),
                    min_points=3.0,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_derivative_arithmetic_error_real",
            description="Test I/J – Erik, rätt metod men räknefel (4*3=16 -> svar 21)",
            provenance="real",
            files=[REAL / "Erik_Eriksson.png"],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes=(
                "KRITISKT FALL. Rätt derivata v(t)=4t+5 men eleven skriver 4*3=16 och "
                "svarar 21 m/s. Får ALDRIG bli 'correct'. Rätt utfall är delpoäng."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["21"],
                    must_not_contain=["v = 17 m/s"],
                    allowed_status=("partial", "incorrect"),
                    max_points_awarded=2.0,
                    require_issue=True,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_derivative_terse_real",
            description="Test A – Linnea, korrekt svar men hoppar över ett mellanled",
            provenance="real",
            files=[REAL / "Linnea_Svensson.png"],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="Oberoende verifierat: svaret 17 m/s är korrekt. Mellanledet 4*3=12 saknas.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    allowed_status=("correct", "partial"),
                    min_points=2.0,
                )
            ],
        )
    )

    # ---------------- Härledda från riktiga bilder ----------------

    cases.append(
        GoldenCase(
            name="physics_multipage_derived",
            description="Test G/H – samma fysikprov delat i två sidor",
            provenance="derived",
            files=[
                _fixture("physics_multipage_page1.png"),
                _fixture("physics_multipage_page2.png"),
            ],
            answer_key=PHYSICS_ANSWER_KEY,
            expected_question_count=3,
            notes=(
                "Vänstra arket blir sida 1, högra arket sida 2. Fråga 2 spänner över "
                "båda sidorna och ska bli EN uppgift, inte två."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1", must_contain=["tröghetslagen"],
                    allowed_status=("correct",), min_points=2.0,
                ),
                QuestionExpectation(
                    question_number="2", must_contain=["trycket"],
                    allowed_status=("correct",), min_points=2.0,
                ),
                QuestionExpectation(
                    question_number="3", must_contain=["hastighet"],
                    allowed_status=("correct",), min_points=2.0,
                ),
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_rotated_derived",
            description="Test O – Annas lösning roterad 90 grader",
            provenance="derived",
            files=[_fixture("math_rotated.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="Samma innehåll som Anna. Rotation får inte förstöra transkriptionen.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    allowed_status=("correct", "partial", "needs_review"),
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_low_quality_derived",
            description="Test C/N – Annas lösning nedskalad, brusig och lågkontrast",
            provenance="derived",
            files=[_fixture("math_low_quality.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes=(
                "Dålig bildkvalitet. Antingen läser modellen rätt, eller så flaggar "
                "den needs_review. Den får INTE hitta på ett svar."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    allowed_status=("correct", "partial", "incorrect", "needs_review"),
                )
            ],
        )
    )

    # ---------------- Syntetiska scenarier ----------------

    cases.append(
        GoldenCase(
            name="blank_answer_synthetic",
            description="Test K – uppgiften finns men eleven har inte svarat",
            provenance="synthetic",
            files=[_fixture("blank_answer.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="found=True men tomt studentWork. Får ALDRIG fyllas med facit.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    found=True,
                    expect_empty_work=True,
                    must_not_contain=["17", "4t + 5"],
                    allowed_status=("incorrect", "needs_review"),
                    max_points_awarded=0.0,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="crossed_out_synthetic",
            description="Test L – eleven har strukit över ett felaktigt försök",
            provenance="synthetic",
            files=[_fixture("crossed_out.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes=(
                "Överstruket: 'v = 4t' (fel). Gällande svar: v(3)=17. "
                "Bedömningen ska utgå från det gällande svaret."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    allowed_status=("correct", "partial"),
                    min_points=2.0,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="teacher_marks_synthetic",
            description="Test M – lärarkommentarer och redan satta poäng på sidan",
            provenance="synthetic",
            files=[_fixture("teacher_marks.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes=(
                "Sidan innehåller lärartext 'Bra jobbat! 3/3 /Läraren'. Den får inte "
                "hamna i studentWork och inte styra bedömningen."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    must_not_contain=["Läraren", "Bra jobbat"],
                    allowed_status=("correct", "partial"),
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="missing_question_synthetic",
            description="Test – facit har 2 uppgifter men bilden innehåller bara 1",
            provenance="synthetic",
            files=[_fixture("blank_answer.png")],
            answer_key=DERIVATIVE_ANSWER_KEY
            + [
                {
                    "question_number": "2",
                    "question_text": "Beräkna accelerationen a vid t = 3 s.",
                    "final_answer": "a = 4 m/s^2",
                    "derivation_steps": ["a(t) = v'(t) = 4"],
                    "max_points": 2,
                }
            ],
            expected_question_count=2,
            notes="Uppgift 2 finns inte i dokumentet -> found=False, needs_review.",
            expectations=[
                QuestionExpectation(question_number="1", found=True),
                QuestionExpectation(
                    question_number="2",
                    found=False,
                    expect_empty_work=True,
                    allowed_status=("needs_review",),
                    max_points_awarded=0.0,
                ),
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="unlisted_question_synthetic",
            description="Test/krav 12 – bilden har en uppgift 2 som saknas i facit",
            provenance="synthetic",
            files=[_fixture("extra_question.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            expected_unlisted=["2"],
            notes="Systemet ska upptäcka uppgift 2 trots att facit bara har uppgift 1.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    allowed_status=("correct", "partial"),
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="math_notation_synthetic",
            description="Test D – bråk, potenser och rottecken",
            provenance="synthetic",
            files=[_fixture("math_notation.png")],
            answer_key=[
                {
                    "question_number": "1",
                    "question_text": "Lös ekvationen x² = 16 där x > 0.",
                    "final_answer": "x = 4",
                    "derivation_steps": ["x = √16", "x = 4"],
                    "max_points": 2,
                }
            ],
            expected_question_count=1,
            notes="Oberoende verifierat: √16 = 4. Eleven svarar korrekt.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["4"],
                    allowed_status=("correct",),
                    min_points=2.0,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="wrong_answer_synthetic",
            description="Test J – helt felaktig lösning",
            provenance="synthetic",
            files=[_fixture("wrong_answer.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes=(
                "Eleven deriverar fel: skriver v(t)=2t+5 och svarar 11 m/s. "
                "Korrekt är 17. Ska bli incorrect eller låg delpoäng."
            ),
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["11"],
                    allowed_status=("incorrect", "partial"),
                    max_points_awarded=1.0,
                    require_issue=True,
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="answer_between_lines_synthetic",
            description="Test F – svaret är inklämt mellan raderna, inte på svarsraden",
            provenance="synthetic",
            files=[_fixture("between_lines.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="Eleven har skrivit lösningen i marginalen/mellan raderna.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    must_contain=["17"],
                    allowed_status=("correct", "partial"),
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="multi_question_synthetic",
            description="Krav 12 – 5 uppgifter i samma dokument ska alla hittas",
            provenance="synthetic",
            files=[_fixture("five_questions.png")],
            answer_key=[
                {
                    "question_number": str(n),
                    "question_text": q,
                    "final_answer": a,
                    "derivation_steps": [],
                    "max_points": 1,
                }
                for n, q, a in [
                    (1, "Vad är 7 + 5?", "12"),
                    (2, "Vad är 9 * 3?", "27"),
                    (3, "Vad är 20 - 8?", "12"),
                    (4, "Vad är 36 / 6?", "6"),
                    (5, "Vad är 2^5?", "32"),
                ]
            ],
            expected_question_count=5,
            notes=(
                "Oberoende verifierat: 12, 27, 12, 6, 32. Eleven svarar rätt på "
                "1,2,3,5 och fel på 4 (skriver 7)."
            ),
            expectations=[
                QuestionExpectation("1", must_contain=["12"], allowed_status=("correct",)),
                QuestionExpectation("2", must_contain=["27"], allowed_status=("correct",)),
                QuestionExpectation("3", must_contain=["12"], allowed_status=("correct",)),
                QuestionExpectation(
                    "4", must_contain=["7"],
                    allowed_status=("incorrect", "partial"), max_points_awarded=0.5,
                ),
                QuestionExpectation("5", must_contain=["32"], allowed_status=("correct",)),
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="messy_handwriting_synthetic",
            description="Test C – ojämn, lutande och skakig handstil",
            provenance="synthetic",
            files=[_fixture("messy_handwriting.png")],
            answer_key=DERIVATIVE_ANSWER_KEY,
            expected_question_count=1,
            notes="Svårläst men läsbar. Antingen korrekt läsning eller needs_review.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    allowed_status=("correct", "partial", "incorrect", "needs_review"),
                    must_not_contain=["Läraren"],
                )
            ],
        )
    )

    cases.append(
        GoldenCase(
            name="diagram_answer_synthetic",
            description="Test E – svaret ges som ett diagram med etiketter",
            provenance="synthetic",
            files=[_fixture("diagram_answer.png")],
            answer_key=[
                {
                    "question_number": "1",
                    "question_text": "Rita en graf som visar hur sträckan ökar linjärt med tiden.",
                    "final_answer": "En rät linje genom origo i ett s-t-diagram.",
                    "derivation_steps": ["s på y-axeln", "t på x-axeln", "rät linje uppåt"],
                    "max_points": 2,
                }
            ],
            expected_question_count=1,
            notes="Eleven har ritat ett korrekt s-t-diagram med rät linje genom origo.",
            expectations=[
                QuestionExpectation(
                    question_number="1",
                    allowed_status=("correct", "partial"),
                    min_points=1.0,
                )
            ],
        )
    )

    return cases


def real_case_count(cases: list[GoldenCase]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for case in cases:
        counts[case.provenance] = counts.get(case.provenance, 0) + 1
    return counts
