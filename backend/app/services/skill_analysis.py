import re

from app.core.skills import SKILLS

ALIASES = {
    "nodejs": ["node.js", "nodejs", "node js"],
    "postgresql": ["postgresql", "postgres"],
    "dsa": ["dsa", "data structures", "algorithms"],
    "oop": ["oop", "object-oriented programming", "object oriented programming"],
    "dbms": ["dbms", "database management systems"],
    "aws": ["aws", "amazon web services"],
}
ROLE_KEYWORDS = [
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "Java Developer",
    "Python Developer",
    "Data Analyst",
    "Software Engineer",
]


def extract_skills(text: str) -> list[str]:
    text = text.casefold()
    return sorted(
        id
        for id, name, _ in SKILLS
        if any(
            re.search(r"(?<!\w)" + re.escape(alias.casefold()) + r"(?!\w)", text)
            for alias in ALIASES.get(id, [name])
        )
    )


def analyze_job(text: str) -> dict:
    required, preferred = set(), set()
    section = "required"
    for line in text.splitlines():
        if re.search(r"preferred|nice.to.have|bonus|desirable", line, re.I):
            section = "preferred"
        elif re.search(r"required|must.have|essential|mandatory|requirements", line, re.I):
            section = "required"
        (preferred if section == "preferred" else required).update(extract_skills(line))
    preferred -= required
    roles = [role for role in ROLE_KEYWORDS if role.casefold() in text.casefold()]
    return {"required": sorted(required), "preferred": sorted(preferred), "role_keywords": roles}


def match_skills(candidate: list[str], required: list[str]) -> dict:
    candidate_set, required_set = set(candidate), set(required)
    matched = sorted(candidate_set & required_set)
    missing = sorted(required_set - candidate_set)
    return {
        "matched": matched,
        "missing": missing,
        "percentage": round(len(matched) / len(required_set) * 100) if required_set else None,
    }
