"""Curated interview prompts. No reference answers are exposed to candidates."""

from dataclasses import dataclass


@dataclass(frozen=True)
class BankQuestion:
    question: str
    skill: str
    difficulty: str


# Each topic has a progression from foundations to trade-offs and failure analysis.
TOPICS = {
    "dsa": (
        (
            "How do arrays and linked lists differ? Explain the cost of access, "
            "insertion, and deletion."
        ),
        (
            "Find the first non-repeating character in a string. Explain your approach, "
            "complexity, and edge cases."
        ),
        (
            "Design a bounded LRU cache. Explain your data structures, invariants, and "
            "concurrent-access trade-offs."
        ),
    ),
    "dbms": (
        "What is a database index, and when can adding one make a workload slower?",
        "Explain transaction isolation with an example of a lost update. How would you prevent it?",
        (
            "A query slows down as a table grows. Walk through execution-plan analysis "
            "and index design trade-offs."
        ),
    ),
    "operating-systems": (
        "How does a process differ from a thread? Explain memory sharing and isolation.",
        (
            "Explain deadlock conditions and compare strategies for preventing and "
            "detecting deadlocks."
        ),
        (
            "A service has rising latency despite low CPU use. How would you investigate "
            "scheduling, memory, and I/O?"
        ),
    ),
    "computer-networks": (
        "What happens between entering a URL and receiving an HTTP response?",
        (
            "Compare TCP and UDP. When would you choose each, and what reliability must "
            "the application provide?"
        ),
        (
            "How would you diagnose intermittent request failures across DNS, TLS, "
            "proxies, and application servers?"
        ),
    ),
    "oop": (
        "Explain encapsulation and polymorphism with a small practical example.",
        (
            "When is composition more appropriate than inheritance? Describe a design "
            "that illustrates the trade-off."
        ),
        (
            "Refactor a tightly coupled payment system to support new providers. Explain "
            "interfaces and testing boundaries."
        ),
    ),
    "sql": (
        (
            "Explain INNER JOIN and LEFT JOIN using customers and orders, including "
            "customers with no orders."
        ),
        "How would you find each department's top three salaries, including ties, using SQL?",
        (
            "Explain how you would implement reliable cursor pagination with non-unique "
            "sort values and concurrent writes."
        ),
    ),
    "system-design": (
        (
            "What are the responsibilities of a load balancer, application server, and "
            "database in a web service?"
        ),
        (
            "Design a URL shortener. Discuss identifiers, redirects, storage, and basic "
            "scaling decisions."
        ),
        (
            "Design an idempotent job-processing service. Discuss retries, deduplication, "
            "visibility, and failure recovery."
        ),
    ),
    "javascript": (
        "Explain let, const, and var, including scope and reassignment.",
        "Explain the event loop and the execution order of promises and timers with an example.",
        (
            "How would you investigate a memory leak in a long-lived browser application "
            "with event listeners?"
        ),
    ),
    "typescript": (
        "How do TypeScript's types help during development, and what happens to them at runtime?",
        (
            "Model a request state using a discriminated union. Explain exhaustive "
            "handling and narrowing."
        ),
        (
            "Design type-safe boundaries for untrusted API data. Explain runtime "
            "validation and generic type trade-offs."
        ),
    ),
    "react": (
        "Explain props and state in React. When does a component re-render?",
        (
            "How would you avoid stale data and race conditions when fetching on a "
            "changing search query?"
        ),
        (
            "A large React form feels slow. Explain how you would profile it and improve "
            "rendering without breaking accessibility."
        ),
    ),
    "nodejs": (
        (
            "What does non-blocking I/O mean in Node.js, and why can CPU-heavy work still "
            "block requests?"
        ),
        "Design error handling and input validation for a Node.js REST endpoint.",
        (
            "How would you handle backpressure and graceful shutdown in a Node.js "
            "stream-processing service?"
        ),
    ),
    "fastapi": (
        "What are request validation and dependency injection used for in FastAPI?",
        (
            "Compare async and sync route handlers. How should database work and blocking "
            "tasks be handled?"
        ),
        (
            "Design a FastAPI service's transaction boundaries, worker lifecycle, and "
            "connection pool for reliable deployment."
        ),
    ),
    "python": (
        (
            "Compare Python lists, tuples, sets, and dictionaries and give an appropriate "
            "use for each."
        ),
        "Explain generators and context managers. How do they help process large files safely?",
        (
            "Compare threading, asyncio, and multiprocessing for a workload mixing CPU "
            "work and network requests."
        ),
    ),
    "java": (
        "Explain equals and hashCode in Java. Why must their contracts agree?",
        "Compare HashMap and ConcurrentHashMap and discuss compound operations under concurrency.",
        (
            "How would you diagnose Java service pauses using heap behavior, garbage "
            "collection, and thread information?"
        ),
    ),
    "spring-boot": (
        "What does dependency injection solve in a Spring Boot application?",
        "Explain transaction boundaries and proxy behavior in a Spring service.",
        (
            "Design resilient integration with a slow downstream service using deadlines, "
            "retries, and idempotency."
        ),
    ),
    "postgresql": (
        "What is a primary key and how does it differ from a unique constraint in PostgreSQL?",
        "Explain how composite indexes relate to filtering and ordering in PostgreSQL queries.",
        (
            "How would you investigate lock contention and vacuum-related issues in a "
            "busy PostgreSQL database?"
        ),
    ),
    "docker": (
        "How does a container differ from a virtual machine, and what does an image contain?",
        (
            "Explain multi-stage builds, environment configuration, and graceful shutdown "
            "for a containerized service."
        ),
        (
            "Design resource limits, health checks, and rollout safeguards for a "
            "containerized application."
        ),
    ),
    "aws": (
        "Explain compute, object storage, and managed databases using AWS service examples.",
        (
            "How would you restrict a service's access to one storage bucket using "
            "least-privilege permissions?"
        ),
        (
            "Design a multi-zone web application's recovery strategy, including failure "
            "detection and data durability."
        ),
    ),
}
ROLE_SKILLS = {
    "Frontend Developer": {"javascript", "typescript", "react", "computer-networks", "dsa"},
    "Backend Developer": {
        "dbms",
        "sql",
        "postgresql",
        "fastapi",
        "nodejs",
        "system-design",
        "computer-networks",
        "operating-systems",
        "dsa",
        "oop",
    },
    "Full Stack Developer": {
        "react",
        "javascript",
        "typescript",
        "nodejs",
        "dbms",
        "sql",
        "system-design",
        "computer-networks",
        "dsa",
    },
    "Java Developer": {"java", "spring-boot", "oop", "dsa", "dbms", "sql", "operating-systems"},
    "Python Developer": {"python", "fastapi", "dsa", "dbms", "sql", "oop", "operating-systems"},
    "Data Analyst": {"python", "sql", "postgresql", "dbms", "dsa"},
    "General SDE": {
        "dsa",
        "dbms",
        "operating-systems",
        "computer-networks",
        "oop",
        "system-design",
        "sql",
    },
}
BANK = tuple(
    BankQuestion(text, skill, difficulty)
    for skill, texts in TOPICS.items()
    for difficulty, text in zip(("Beginner", "Intermediate", "Advanced"), texts, strict=True)
)


def select_questions(
    role: str,
    difficulty: str,
    focus: list[str],
    candidate_skills: set[str],
    count: int,
    excluded: set[str] | None = None,
) -> list[BankQuestion]:
    allowed = ROLE_SKILLS[role] | set(focus) | candidate_skills
    candidates = [q for q in BANK if q.skill in allowed and q.question not in (excluded or set())]
    # Prefer exact difficulty and requested focus; deterministic ordering is reproducible in tests.
    candidates.sort(
        key=lambda q: (
            q.difficulty != difficulty,
            q.skill not in focus,
            q.skill not in candidate_skills,
            q.skill,
            q.question,
        )
    )
    return candidates[:count]
