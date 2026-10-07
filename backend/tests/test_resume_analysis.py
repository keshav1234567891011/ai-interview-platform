from io import BytesIO
from zipfile import ZipFile

import pytest
from docx import Document
from fastapi import HTTPException
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.services.resume_parser import DOCX_MIME, MAX_FILE_SIZE, extract_resume, validate_upload
from app.services.skill_analysis import analyze_job, extract_skills, match_skills
from app.services.storage import LocalResumeStorage, get_storage


def docx_bytes(text="Python SQL PostgreSQL Docker"):
    document = Document()
    document.add_paragraph(text)
    data = BytesIO()
    document.save(data)
    return data.getvalue()


def pdf_bytes():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 200 Td (Python SQL Docker) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def test_real_pdf_and_docx_parsers():
    assert "Python" in extract_resume(pdf_bytes(), "application/pdf")
    assert "PostgreSQL" in extract_resume(docx_bytes(), DOCX_MIME)


@pytest.mark.parametrize(
    "name,mime,data,status",
    [
        ("bad.exe", "application/pdf", b"%PDF-", 415),
        ("bad.pdf", "application/pdf", b"not pdf", 422),
        ("empty.pdf", "application/pdf", b"", 413),
        ("oversized.pdf", "application/pdf", b"x" * (MAX_FILE_SIZE + 1), 413),
        ("wrong.docx", "application/pdf", b"PK", 415),
    ],
    ids=["extension", "signature", "empty", "oversized", "mime"],
)
def test_upload_validation(name, mime, data, status):
    with pytest.raises(HTTPException) as error:
        validate_upload(name, mime, data)
    assert error.value.status_code == status


def test_malformed_and_empty_documents():
    for data, mime in [
        (b"%PDF-1.7 bad", "application/pdf"),
        (b"PK invalid", DOCX_MIME),
        (docx_bytes(""), DOCX_MIME),
    ]:
        with pytest.raises(HTTPException) as error:
            extract_resume(data, mime)
        assert error.value.status_code == 422


def test_active_docx_rejected():
    data = BytesIO(docx_bytes())
    with ZipFile(data, "a") as archive:
        archive.writestr("word/vbaProject.bin", b"fake")
    with pytest.raises(HTTPException):
        extract_resume(data.getvalue(), DOCX_MIME)


def test_skills_use_boundaries_and_aliases():
    assert extract_skills("JavaScript TypeScript Node.js PostgreSQL AWS") == [
        "aws",
        "javascript",
        "nodejs",
        "postgresql",
        "typescript",
    ]
    assert "java" not in extract_skills("JavaScript")
    assert extract_skills("Pythonic reaction") == []
    assert extract_skills("Object-oriented programming and data structures") == ["dsa", "oop"]


def test_job_sections_and_match():
    result = analyze_job("Backend Developer\nRequired: Python SQL\nPreferred: Docker AWS")
    assert result["required"] == ["python", "sql"]
    assert result["preferred"] == ["aws", "docker"]
    assert match_skills(["python"], result["required"])["percentage"] == 50
    assert match_skills([], []) == {"matched": [], "missing": [], "percentage": None}


def test_resume_upload_review_and_job_matching(client, account, tmp_path):
    storage = LocalResumeStorage(tmp_path)
    client.application.dependency_overrides[get_storage] = lambda: storage
    response = client.post("/api/resumes", files={"file": ("resume.docx", docx_bytes(), DOCX_MIME)})
    assert response.status_code == 201
    resume = response.json()
    assert "extracted_text" not in resume and "storage_key" not in resume
    assert "python" in [skill["id"] for skill in resume["skills"]]
    assert len(client.get("/api/resumes").json()) == 1
    updated = client.put(f"/api/resumes/{resume['id']}/skills", json={"skill_ids": ["python"]})
    assert updated.status_code == 200
    result = client.post(
        "/api/jobs/analyze",
        json={
            "description": "Backend Developer\nRequired: Python SQL\nPreferred: Docker",
            "resume_id": resume["id"],
        },
    )
    assert result.status_code == 201
    assert result.json()["match_percentage"] == 50
    assert result.json()["candidate_source"] == "resume"
    assert "SQL" in [skill["name"] for skill in result.json()["missing_skills"]]
    assert len(list(tmp_path.iterdir())) == 1


def test_resume_ownership_and_malformed_request(client, account, tmp_path):
    client.application.dependency_overrides[get_storage] = lambda: LocalResumeStorage(tmp_path)
    assert (
        client.post(
            "/api/resumes", files={"file": ("bad.pdf", b"%PDF-bad", "application/pdf")}
        ).status_code
        == 422
    )
    assert list(tmp_path.iterdir()) == []
    first = client.post(
        "/api/resumes", files={"file": ("resume.docx", docx_bytes(), DOCX_MIME)}
    ).json()
    client.post(
        "/api/auth/register",
        json={
            "email": "second@example.com",
            "display_name": "Candidate Two",
            "password": "Another-test-password42",
        },
    )
    assert client.get("/api/resumes").json() == []
    assert (
        client.put(f"/api/resumes/{first['id']}/skills", json={"skill_ids": ["python"]}).status_code
        == 404
    )
    assert (
        client.post(
            "/api/jobs/analyze",
            json={
                "description": "Python SQL Backend Developer requirements",
                "resume_id": first["id"],
            },
        ).status_code
        == 404
    )


def test_storage_prevents_traversal(tmp_path):
    with pytest.raises(ValueError):
        LocalResumeStorage(tmp_path).location("/absolute-outside-storage")
