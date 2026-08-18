# WISEOS — OFFICIAL PRODUCT ARCHITECTURE & PERMANENT SYSTEM MEMORY

## IMPORTANT — READ THIS FIRST

This document defines the intended architecture, product behavior, AI pipeline, safety model and development direction of WiseOS.

Treat this document as a permanent architectural source of truth for the project.

Do NOT reinterpret the core architecture.
Do NOT replace the architecture with a simpler alternative.
Do NOT redesign the system around a single AI model.
Do NOT remove human oversight.
Do NOT make destructive changes to existing functionality.

WiseOS is NOT a greenfield project.

You are working on an existing production-oriented codebase. Preserve existing functionality while progressively implementing and refining the architecture described below.

Before making major changes:
1. Inspect the existing repository.
2. Inspect Git branches and current working state.
3. Inspect the existing backend, frontend, database and services.
4. Identify what already exists versus what is missing.
5. Never overwrite working functionality simply because a cleaner implementation is possible.
6. Prefer incremental, testable changes.

---

# 1. WHAT WISEOS IS

WiseOS is an AI-assisted education platform designed to help teachers process, review and assess student work.

The long-term goal is to create a highly professional, reliable and secure system where:

- student work can be uploaded/scanned
- OCR extracts the student's written answers
- mathematical expressions are identified
- mathematical calculations are verified by a specialized/deterministic mathematical system where possible
- the results are returned to WiseOS
- Claude AI reviews the complete evidence
- Claude generates teacher-oriented feedback/annotations
- the teacher remains the final decision-maker
- every important step is traceable and auditable

WiseOS should feel like a serious professional SaaS product for schools and municipalities.

It should NOT feel like:
- a generic AI wrapper
- a generic school dashboard template
- an experimental developer tool
- a chatbot
- a system where an LLM blindly decides grades

---

# 2. CORE PRODUCT PRINCIPLE

The fundamental architecture is:

SCANNED STUDENT WORK
        ↓
OCR / MATPIX
        ↓
STRUCTURED STUDENT DATA
        ↓
MATHEMATICAL VERIFICATION WHERE REQUIRED
        ↓
RESULTS RETURN TO WISEOS
        ↓
EVIDENCE PACKAGE
        ↓
CLAUDE AI REVIEW
        ↓
AI ASSESSMENT + FEEDBACK PROPOSAL
        ↓
HUMAN TEACHER REVIEW
        ↓
TEACHER APPROVES / EDITS / REJECTS
        ↓
FINAL RESULT
        ↓
AUDIT TRAIL

This architecture is fundamental.

Do not collapse these steps into one AI call.

---

# 3. COMPLETE ASSESSMENT PIPELINE

## STEP 1 — TEACHER UPLOADS STUDENT WORK

The teacher uploads:

- PDF
- JPG
- JPEG
- PNG
- scanned documents
- potentially other supported document formats later

Every submission must receive a unique identifier.

Example:

submission_id:
WOS-2026-000184

WiseOS should associate the submission with:

- teacher
- student
- class
- assignment/test
- timestamp
- original file
- submission version
- processing status

The original uploaded document must be preserved.

The original student work must never be silently overwritten.

---

# 4. STEP 2 — OCR / MATPIX

The OCR layer is responsible for extracting information from the scanned student work.

The OCR system should identify, where possible:

- normal text
- mathematical expressions
- question boundaries
- answer boundaries
- page numbers
- coordinates/bounding boxes
- confidence values
- other useful structural information

Example:

{
  "question": 4,
  "raw_text": "Lös ekvationen 2x + 6 = 14",
  "math_expression": "2x + 6 = 14",
  "bbox": [120, 430, 680, 520]
}

The original image/document must remain available alongside the OCR result.

OCR output is evidence.

OCR output is NOT automatically considered ground truth.

If OCR confidence is too low or the extracted content is ambiguous, the system must be able to route the item to human review.

---

# 5. STEP 3 — MATHEMATICAL VERIFICATION

WiseOS must distinguish between:

A. content that requires mathematical verification

and

B. content that does not.

Mathematical problems should be sent to a specialized mathematical verification/calculation service where possible.

Do NOT rely on Claude alone to perform deterministic mathematical calculations when a reliable mathematical engine can perform the calculation.

Example:

Student answer:

2x + 6 = 14
2x = 8
x = 5

Mathematical verification:

Expected:
x = 4

Student:
x = 5

Result:
incorrect

Example structured result:

{
  "input": "2x + 6 = 14",
  "expected_result": "x = 4",
  "student_result": "x = 5",
  "verified": true,
  "correct": false,
  "method": "symbolic"
}

The mathematical service should return structured results to WiseOS.

WiseOS then becomes the central source of orchestration.

---

# 6. STEP 4 — RETURN ALL RESULTS TO WISEOS

WiseOS must collect the evidence from all relevant services.

At this stage WiseOS should have something similar to:

ORIGINAL STUDENT DOCUMENT

+

OCR RESULT

+

QUESTION

+

ANSWER KEY

+

STUDENT ANSWER

+

MATHEMATICAL VERIFICATION

+

RELEVANT GRADING RULES / RUBRIC

+

CONFIDENCE INFORMATION

This collection becomes the evidence package.

---

# 7. STEP 5 — CLAUDE AI REVIEW

Claude is an intelligent review and reasoning layer.

Claude should NOT be treated as the sole source of truth.

Claude receives a structured evidence package.

Example:

{
  "original_submission": "...",
  "ocr_text": "...",
  "question": "...",
  "student_answer": "...",
  "answer_key": "...",
  "math_verification": "...",
  "rubric": "..."
}

Claude should review the evidence and produce structured output.

For example:

{
  "assessment": "incorrect",
  "confidence": 0.94,
  "reason": "...",
  "feedback": "...",
  "needs_human_review": false
}

Claude should explain its proposed assessment using the available evidence.

Claude should never invent evidence.

Claude should never claim that a calculation was performed if the mathematical verification service did not perform it.

Claude should distinguish between:
- facts from OCR
- verified mathematical results
- answer-key information
- its own interpretation

---

# 8. STEP 6 — CLAUDE GENERATES FEEDBACK / ANNOTATIONS

Claude's major value is generating useful, understandable teacher/student feedback.

Example:

Student:

2x + 6 = 14
2x = 8
x = 5

Mathematical verification:

x = 4

Claude feedback:

"You have solved the equation correctly up to the final step. When dividing 8 by 2, the result is 4 rather than 5. Therefore x = 4."

The feedback should be:

- specific
- constructive
- understandable
- based on evidence
- appropriate for the student's work
- connected to the actual mistake
- not unnecessarily verbose

WiseOS should be able to store the generated feedback separately from the final teacher decision.

---

# 9. HUMAN TEACHER MUST REMAIN IN CONTROL

This is one of the most important architectural requirements.

The system must NOT automatically turn:

AI output → final grade

Instead:

AI proposal
    ↓
Teacher review
    ↓
Teacher:
    APPROVE
    EDIT
    REJECT
    ↓
Final result

The teacher must be able to inspect the evidence behind the AI proposal.

The teacher should be able to see, where appropriate:

- original student work
- OCR interpretation
- mathematical verification
- answer key
- AI assessment
- AI reasoning/justification suitable for the UI
- generated feedback
- confidence / review flags
- previous teacher edits

The teacher must always have the ability to override the AI proposal.

---

# 10. HUMAN REVIEW / SAFETY GATES

WiseOS must have a human-review mechanism.

Automatically route an item to human review when:

- OCR confidence is too low
- handwriting/content is ambiguous
- mathematical verification fails
- mathematical verification is unavailable
- services disagree
- answer key is missing
- rubric is missing when required
- Claude reports uncertainty
- evidence is incomplete
- multiple interpretations are possible
- an unexpected processing error occurs

The principle is:

WHEN THE SYSTEM IS NOT CONFIDENT,
DO NOT PRETEND TO BE CONFIDENT.

Route the item to the teacher.

---

# 11. AI DECISION RECORD

Every AI-assisted assessment should have a structured record.

Example:

WISEOS ASSESSMENT RECORD

Submission:
WOS-2026-000184

Question:
4

OCR:
2x + 6 = 14

Student answer:
x = 5

Mathematical verification:
Expected x = 4

Claude review:
INCORRECT

Claude feedback:
"..."

Teacher:
[teacher identifier]

Teacher decision:
APPROVED

Timestamp:
2026-08-14 14:32

AI model:
[model identifier/version]

OCR service:
[service/version]

Math engine:
[service/version]

This record should allow WiseOS to answer:

"Why did this student receive this assessment?"

The system should be able to reconstruct the relevant decision chain.

---

# 12. AUDIT LOGGING

WiseOS must maintain an auditable processing history.

Example:

OCR_STARTED
OCR_COMPLETED
MATH_VERIFICATION_REQUESTED
MATH_VERIFICATION_COMPLETED
CLAUDE_REVIEW_REQUESTED
CLAUDE_REVIEW_COMPLETED
HUMAN_REVIEW_REQUIRED
TEACHER_REVIEWED
TEACHER_MODIFIED
TEACHER_APPROVED
FINAL_RESULT_PUBLISHED

Important events should include timestamps and relevant identifiers.

Do not store unnecessary sensitive information in logs.

Audit logs must be designed with privacy and security in mind.

---

# 13. API / SERVICE ARCHITECTURE

The frontend must NOT directly call sensitive external AI APIs.

Never expose API keys in:

- browser code
- frontend environment variables
- client-side JavaScript
- public source code

Correct architecture:

WISEOS FRONTEND
       ↓
WISEOS BACKEND/API
       ↓
EXTERNAL SERVICES

Not:

WISEOS FRONTEND
       ↓
CLAUDE API

The backend should manage:

- authentication
- authorization
- API credentials
- orchestration
- validation
- retries
- timeouts
- rate limiting
- error handling
- audit logging
- service status
- structured responses

---

# 14. SERVICE BOUNDARIES

The architecture should remain modular.

At minimum conceptually separate:

OCR SERVICE

MATHEMATICAL VERIFICATION SERVICE

AI REVIEW SERVICE

ASSESSMENT/GRADING SERVICE

FEEDBACK SERVICE

AUDIT SERVICE

AUTHENTICATION/AUTHORIZATION

WISEOS ORCHESTRATION/API

Do not make one gigantic service responsible for everything.

---

# 15. ORCHESTRATION

WiseOS should act as the central orchestrator.

Conceptually:

WiseOS
 ↓
create submission
 ↓
OCR
 ↓
validate OCR
 ↓
identify mathematical content
 ↓
mathematical verification
 ↓
collect evidence
 ↓
Claude review
 ↓
validate AI response
 ↓
human review if required
 ↓
teacher decision
 ↓
final assessment
 ↓
audit record

The orchestration layer must handle:

- failures
- retries
- duplicate requests
- timeouts
- partial results
- service outages
- invalid responses

Use idempotency where appropriate.

A failed API request must not accidentally create duplicate assessments.

---

# 16. STRUCTURED AI OUTPUT

Never rely on free-form Claude responses for critical system logic.

Claude should return structured JSON according to a defined schema.

The backend must validate the response before using it.

Example:

{
  "assessment": "incorrect",
  "confidence": 0.94,
  "reason": "...",
  "feedback": "...",
  "needs_human_review": false
}

If the response is malformed:

DO NOT continue as if it were valid.

Instead:

- reject the response
- retry where appropriate
- log the failure
- route to human review if necessary

---

# 17. SECURITY

WiseOS must be designed with security as a core requirement.

Important principles:

- server-side API keys
- secure authentication
- authorization
- least privilege
- encrypted transport
- secure secret management
- input validation
- output validation
- rate limiting
- audit logging
- secure database access
- secure file handling
- controlled file access
- protection against unauthorized student-data access

Do not assume that an authenticated user is allowed to access every student's data.

Authorization must be enforced.

---

# 18. PRIVACY / STUDENT DATA

WiseOS may process highly sensitive educational data.

Therefore:

- minimize collected data
- minimize retained data
- define retention policies
- avoid unnecessary personal information in AI prompts
- use pseudonymous identifiers where practical
- restrict access based on role
- log access appropriately
- do not expose student information unnecessarily
- do not send unnecessary data to external AI providers

Before production deployment, the organization must perform the appropriate legal/privacy assessment, including GDPR requirements and any applicable educational-data requirements.

Do NOT claim that technical architecture alone makes WiseOS legally compliant.

The architecture should instead be designed to SUPPORT compliance.

---

# 19. EU AI ACT READINESS

WiseOS should be designed with EU AI Act readiness in mind.

Important principles include:

- human oversight
- transparency
- traceability
- logging
- robustness
- cybersecurity
- clear AI involvement
- controlled decision-making
- ability to intervene
- ability to override AI
- appropriate documentation

Do NOT market the product as "100% AI Act compliant" solely because these technical controls exist.

Instead, the product should be developed toward:

"EU AI Act readiness"

with appropriate legal/compliance review before production claims are made.

The system must not hide AI involvement from users.

---

# 20. DO NOT LET AI BECOME THE FINAL AUTHORITY

Critical principle:

CLAUDE IS AN ASSISTANT,
NOT THE TEACHER.

Claude can:

- analyze
- compare
- identify possible errors
- explain
- suggest
- generate feedback

Claude must not silently become:

- the final teacher
- the only calculator
- the unquestionable grading authority
- the sole source of evidence

The teacher remains the final authority in the assessment workflow.

---

# 21. MATHEMATICS PRINCIPLE

Whenever a deterministic mathematical calculation can be performed by a reliable mathematical engine, prefer that over asking an LLM to calculate.

LLMs may assist with interpretation and explanation.

Specialized mathematical systems should provide verification whenever possible.

This separation is intentional:

MATHEMATICS ENGINE:
"What is mathematically correct?"

CLAUDE:
"How should this student's work be interpreted and explained?"

WISEOS:
"How should all evidence and workflow be orchestrated?"

TEACHER:
"What is the final educational decision?"

---

# 22. DESIGN PRINCIPLES

WiseOS should visually feel:

- premium
- modern
- intelligent
- calm
- professional
- minimalist
- Scandinavian-inspired without being stereotypical
- sophisticated
- coherent
- trustworthy
- like a next-generation education operating system

The design direction is strongly inspired by Apple's spatial/visionOS philosophy, but WiseOS must NOT simply copy Apple.

Prefer:

- clean composition
- excellent typography
- restrained color palette
- subtle surfaces
- intentional spacing
- elegant transitions
- clear hierarchy
- minimal visual noise
- professional information density

If there is a choice between:

more colors
vs
monochrome

choose monochrome.

If there is a choice between:

more cards
vs
clean composition

choose clean composition.

Avoid:

- generic dashboard templates
- excessive cards
- excessive rounded containers
- unnecessary gradients
- loud colors
- box-inside-box layouts
- decorative UI without purpose
- giant headings
- inconsistent typography

WiseOS should feel like a real premium SaaS product that could be deployed to schools and municipalities.

---

# 23. EXISTING DESIGN DIRECTION

The current WiseOS project already contains work toward:

- premium/minimal design
- graphite dark system
- spatial/floating sidebar
- consistent layout primitives
- PageHeader
- Surface
- EmptyState
- StatusBadge
- refined typography
- restrained accent colors

Preserve and extend the strongest parts of the existing implementation.

Do not unnecessarily revert to the old visual system.

Before redesigning any component, inspect the existing design system and reuse established primitives.

---

# 24. DEVELOPMENT WORKFLOW

Before implementing a large feature:

1. Inspect existing implementation.
2. Identify dependencies.
3. Identify existing functionality.
4. Identify potential regressions.
5. Plan the smallest safe implementation.
6. Implement.
7. Run the relevant tests/build.
8. Inspect the UI where applicable.
9. Verify backend behavior.
10. Check Git diff.
11. Only then move to the next part.

Never claim something is complete without verifying it.

---

# 25. GIT SAFETY

Never destroy working project state.

Before major architectural changes:

- inspect git status
- inspect current branch
- inspect recent commits
- create an appropriate backup branch/commit when necessary

Never force-reset or delete branches containing important work without explicit instruction.

Do not overwrite existing working functionality merely to simplify implementation.

---

# 26. CURRENT DEVELOPMENT PRIORITY

The goal is NOT to endlessly redesign the frontend.

The ultimate goal is:

WISEOS PRODUCTION-READY PILOT

The priority order should generally be:

1. Protect current working state.
2. Understand existing architecture.
3. Stabilize backend.
4. Stabilize authentication/authorization.
5. Stabilize OCR pipeline.
6. Implement/verify mathematical verification architecture.
7. Implement Claude review architecture.
8. Implement structured evidence packages.
9. Implement human review workflow.
10. Implement audit trail.
11. Implement error handling/retries/timeouts.
12. Implement secure configuration/secrets.
13. Complete the frontend workflow.
14. Polish UI/UX.
15. Test the complete end-to-end flow.
16. Prepare production deployment configuration.

Do not spend all development time on visual polish while the core assessment pipeline remains incomplete.

---

# 27. TARGET END-TO-END USER EXPERIENCE

The final teacher experience should be approximately:

1. Teacher logs in.
2. Teacher opens a class.
3. Teacher creates/selects an assignment/test.
4. Teacher uploads/scans student work.
5. WiseOS shows processing status.
6. OCR processes the document.
7. Mathematical content is detected.
8. Mathematical verification occurs where necessary.
9. WiseOS assembles the evidence.
10. Claude reviews the evidence.
11. Claude generates proposed assessment/feedback.
12. WiseOS shows the teacher the result.
13. Teacher can inspect the evidence.
14. Teacher approves, edits or rejects.
15. WiseOS saves the final decision.
16. Feedback/results can be published.
17. The complete processing history remains traceable.

The experience should feel simple to the teacher even though the underlying architecture is sophisticated.

---

# 28. IMPORTANT: SIMPLICITY FOR THE USER

The underlying system can be extremely complex.

The teacher interface should NOT be.

The teacher should not need to understand:

- OCR APIs
- Claude APIs
- mathematical engines
- JSON
- model versions
- service orchestration
- API retries

The system should hide this complexity.

Example:

Teacher sees:

"Analyserar elevens arbete..."

Then:

"AI-förslag klart — behöver din granskning."

Then:

"Godkänn"
"Ändra"
"Avvisa"

The complexity belongs in the backend.

---

# 29. FUTURE PRODUCTION ACTIVATION

When WiseOS receives investment funding and moves toward a real pilot/production environment, the external services should be activated through secure environment configuration.

Conceptually:

WISEOS FRONTEND
WISEOS API
DATABASE
FILE STORAGE
OCR/MATPIX
MATHEMATICAL VERIFICATION
CLAUDE
MONITORING
AUDIT LOGGING

All external credentials must be stored securely on the server/infrastructure.

Never hard-code credentials.

Never commit credentials to Git.

Never expose them to the frontend.

Production activation should use environment variables/secrets management.

---

# 30. IMPORTANT: DO NOT INVENT INTEGRATIONS

If the exact API, SDK, endpoint, authentication method or capability of MatPix, Claude or another service is unknown:

DO NOT INVENT IT.

Instead:

1. inspect existing project configuration
2. inspect existing integration code
3. check official documentation
4. identify the exact API contract
5. implement against the real contract

Never create fake endpoints just to make the code appear complete.

---

# 31. SOURCE OF TRUTH HIERARCHY

When making technical decisions, use this priority:

1. Existing working WiseOS functionality
2. This WiseOS architecture document
3. Existing WiseOS source-of-truth documentation
4. Existing tests and validated behavior
5. Official API/service documentation
6. Explicit instructions from the project owner
7. General assumptions

Do not silently replace the architecture with an easier implementation.

---

# 32. FINAL PRINCIPLE

WiseOS should become:

A professional education operating system where AI assists teachers with assessment, OCR, mathematical verification and feedback — while the system remains transparent, auditable, secure and human-controlled.

The final conceptual architecture is:

                 WISEOS
                    │
                    ▼
            STUDENT SUBMISSION
                    │
                    ▼
              MATPIX / OCR
                    │
                    ▼
           STRUCTURED EVIDENCE
                    │
             ┌──────┴──────┐
             ▼             ▼
       MATH VERIFICATION   TEXT/CONTEXT
             │             │
             └──────┬──────┘
                    ▼
              WISEOS EVIDENCE
                    │
                    ▼
                CLAUDE AI
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     ASSESSMENT            FEEDBACK
       PROPOSAL             PROPOSAL
          │                   │
          └─────────┬─────────┘
                    ▼
             HUMAN TEACHER
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       APPROVE    EDIT      REJECT
          │         │         │
          └─────────┴─────────┘
                    ▼
             FINAL RESULT
                    │
                    ▼
              AUDIT TRAIL

THIS IS THE INTENDED WISEOS ARCHITECTURE.

Preserve it.

Build toward it.

Do not simplify it into a single-model AI grading system.

Do not remove human oversight.

Do not sacrifice traceability for convenience.

Do not sacrifice security for speed.

Do not sacrifice the existing working product for a greenfield rewrite.

The objective is to take the existing WiseOS codebase and progressively transform it into this production-ready architecture.
