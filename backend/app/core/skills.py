"""Canonical vocabulary, shared by profiles and deterministic analysis."""

SKILLS = [
    ("java", "Java", "language"),
    ("python", "Python", "language"),
    ("javascript", "JavaScript", "language"),
    ("typescript", "TypeScript", "language"),
    ("react", "React", "framework"),
    ("nodejs", "Node.js", "framework"),
    ("fastapi", "FastAPI", "framework"),
    ("spring-boot", "Spring Boot", "framework"),
    ("sql", "SQL", "database"),
    ("postgresql", "PostgreSQL", "database"),
    ("docker", "Docker", "tool"),
    ("aws", "AWS", "tool"),
    ("dbms", "DBMS", "cs"),
    ("operating-systems", "Operating Systems", "cs"),
    ("computer-networks", "Computer Networks", "cs"),
    ("system-design", "System Design", "cs"),
    ("dsa", "Data Structures & Algorithms", "cs"),
    ("oop", "Object-Oriented Programming", "cs"),
]
SKILL_IDS = {skill[0] for skill in SKILLS}
