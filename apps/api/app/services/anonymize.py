"""GDPR-anonymisering.

Innan persondata skickas till externa AI-tjänster (Claude, Wolfram, Mathpix)
ersätter vi identifierbar information med deterministiska pseudonymer.
"""
from __future__ import annotations

import hashlib
import re

# Mönster som ofta förekommer i svenska skoluppgifter
_PERSONNUMMER = re.compile(r"\b\d{6,8}[-\s]?\d{4}\b")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE = re.compile(r"\b(?:\+46|0)[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,4}[\s-]?\d{2,4}\b")
# Heuristik för person-namn i fri text: två eller fler efterföljande ord som
# börjar med versal (t.ex. "Anna Svensson", "Erik Karlsson"). Detta är
# MEDVETET brett och kan i sällsynta fall även träffa andra egennamn
# (produktnamn, platser) i lärarens fritext – det är en accepterad avvägning
# för att minimera risken att ett elevnamn läcker till en extern AI-leverantör.
_NAME_LIKE = re.compile(r"\b[A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+\b")


def pseudonymize_student(student_name: str, salt: str = "wiseos-v1") -> str:
    """Returnerar deterministisk pseudonym (t.ex. 'Elev #A4F7') för student_name.

    Samma input → samma pseudonym, men namnet kan inte återställas utan saltet.
    """
    digest = hashlib.sha256(f"{salt}:{student_name.strip().lower()}".encode("utf-8")).hexdigest()
    return f"Elev #{digest[:4].upper()}"


def scrub_pii(text: str) -> str:
    """Strippar personnummer, e-post, telefonnummer och namnliknande text.

    Ordningen spelar roll: personnummer/e-post/telefon skrubbas FÖRST med
    strikta mönster, sedan körs den bredare namn-heuristiken. Görs det i
    omvänd ordning riskerar delar av redan dolda taggar (t.ex. "E post") att
    felaktigt matchas som namn.
    """
    if not text:
        return text
    text = _PERSONNUMMER.sub("[personnummer dolt]", text)
    text = _EMAIL.sub("[e-post dold]", text)
    text = _PHONE.sub("[telefon dold]", text)
    text = _NAME_LIKE.sub("[namn dolt]", text)
    return text
