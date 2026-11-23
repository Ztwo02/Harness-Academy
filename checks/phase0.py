"""Offline checks for Phase 0 design artifacts. Run from any working directory."""

import hashlib
import json
import re
import sqlite3
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "docs" / "schema"
SAMPLE_BYTES = b"\xef\xbb\xbffunction sample() {\r\n  return 1;\r\n}\r\n"
SAMPLE_SHA = "1" * 40  # Synthetic commit ID, never used to identify upstream code.


def distinct_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=distinct_keys)


def excerpt_hash(raw, first, last):
    content = raw.decode("utf-8-sig").replace("\r\n", "\n")
    if "\r" in content or "\x00" in content:
        raise ValueError("Unsupported source text")
    lines = content.split("\n")
    if lines[-1] == "":
        lines.pop()
    if not 1 <= first <= last <= len(lines):
        raise ValueError("Invalid source range")
    selected = "\n".join(lines[first - 1:last]).encode("utf-8")
    return hashlib.sha256(selected).hexdigest()


def sample_course():
    """A complete synthetic lesson for contract tests, with no upstream claims."""
    claim = {"kind": "fact", "text": "夹具中的函数返回 1。", "sourceRefs": ["definition"]}
    evidence = {
        "path": "sample.js", "symbol": "sample", "startLine": 1, "endLine": 3,
        "blobOid": hashlib.sha1(f"blob {len(SAMPLE_BYTES)}\0".encode() + SAMPLE_BYTES).hexdigest(),
        "excerptSha256": excerpt_hash(SAMPLE_BYTES, 1, 3),
    }
    exercise = {
        "id": "result", "kind": "single-choice", "prompt": "返回哪个值？",
        "options": [{"id": "one", "text": "1"}, {"id": "two", "text": "2"}],
        "correctOption": "one", "explanation": claim,
    }
    lesson = {
        "id": "read", "title": "读一个夹具函数", "objectives": ["定位返回语句"],
        "priorKnowledge": ["理解函数返回值"], "prerequisiteLessons": [],
        "concepts": [claim], "sourceReading": ["definition"],
        "keySymbols": [{"name": "sample", "sourceRef": "definition"}],
        "execution": [claim],
        "calls": [{"kind": "fact", "text": "函数体中没有下游调用。", "sourceRefs": ["definition"]}],
        "scenario": "教学夹具：调用 sample 获取一个值。",
        "designRationale": [{"kind": "advice", "text": "练习定位时可先看返回语句。", "sourceRefs": ["definition"]}],
        "faq": [{"question": "结果从哪里返回？", "answer": claim}],
        "exercises": [exercise], "summary": [claim],
    }
    return {
        "schemaVersion": 1, "projectId": "fixture", "repositoryId": "fixture-repo",
        "commit": SAMPLE_SHA, "courseId": "demo", "version": 1, "title": "契约夹具",
        "sourceEvidence": {"definition": evidence}, "materials": {}, "lessons": [lesson],
    }


class DocumentChecks(unittest.TestCase):
    def test_relative_links(self):
        pages = [ROOT / name for name in ("README.md", "PLAN.md", "AGENTS.md")]
        for page in pages + sorted((ROOT / "docs").rglob("*.md")):
            for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", page.read_text(encoding="utf-8")):
                if target.startswith(("https://", "#")):
                    continue
                with self.subTest(page=page.name, target=target):
                    self.assertTrue((page.parent / target.split("#")[0]).is_file())

    def test_source_catalog_and_plan(self):
        catalog = load_json(ROOT / "config" / "repositories.json")
        self.assertEqual(catalog["catalogVersion"], 1)
        expected = {
            "pi": ("agentic-labs/pi-mono", 1),
            "codex": ("openai/codex", 3),
            "deepseek": ("DeepSeek-ai/deepseek-harness", 4),
            "claude": ("anthropics/claude-code", 5),
        }
        repositories = [r for r in catalog["repositories"] if r.get("sourceKind") != "sdk-repo"]
        self.assertCountEqual([r["projectId"] for r in repositories], expected.keys())
        self.assertEqual(len({r["repositoryId"] for r in repositories}), len(expected))
        sources = (ROOT / "docs" / "REPOSITORY_SOURCES.md").read_text(encoding="utf-8")
        for repo in repositories:
            slug, phase = expected[repo["projectId"]]
            self.assertEqual(repo["phase"], phase)
            self.assertEqual(repo["url"], f"https://github.com/{slug}")
            self.assertRegex(repo["baselineCommit"], r"^[0-9a-f]{40}$")
            self.assertIn(repo["url"], sources)
            self.assertIn(repo["baselineCommit"][:8], sources)
        plan = (ROOT / "PLAN.md").read_text(encoding="utf-8")
        for phase in range(7):
            self.assertIn(f"| P{phase} ", plan)

    def test_phase5_source_contracts(self):
        repos = load_json(ROOT / "config/repositories.json")["repositories"]
        sdk = [r for r in repos if r.get("sourceKind") == "sdk-repo"]
        self.assertEqual(len(sdk), 1)
        self.assertEqual(sdk[0]["projectId"], "claude")
        self.assertEqual(sdk[0]["url"], "https://github.com/anthropics/claude-agent-sdk-python")
        schema = load_json(SCHEMA_DIR / "course-v2.schema.json")
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for name in ("claude-public.v1.json", "claude-sdk-python.v1.json"):
            course = load_json(ROOT / "courses" / name)
            validator.validate(course)
            self.assertEqual(course["schemaVersion"], 2)
            self.assertTrue(course["unverifiedQuestions"])
        cards_schema = load_json(SCHEMA_DIR / "reading-card.schema.json")
        Draft202012Validator.check_schema(cards_schema)
        for card in load_json(ROOT / "materials" / "claude" / "cards.v1.json"):
            Draft202012Validator(cards_schema, format_checker=FormatChecker()).validate(card)
            snapshot = (ROOT / "materials" / "claude" / (card["sha256"] + ".txt")).read_bytes()
            self.assertEqual(hashlib.sha256(snapshot).hexdigest(), card["sha256"])
            self.assertIn(card["locator"], snapshot.decode("utf-8"))
            self.assertIn(card["excerpt"], snapshot.decode("utf-8"))


class CourseChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = load_json(SCHEMA_DIR / "course.schema.json")
        Draft202012Validator.check_schema(schema)
        checker = FormatChecker()
        if not {"date-time", "uri"} <= checker.checkers.keys():
            raise RuntimeError('Install format validators: python -m pip install "jsonschema[format]>=4.18,<5"')
        cls.validator = Draft202012Validator(schema, format_checker=checker)

    def test_complete_lesson_and_trace_exercise(self):
        course = sample_course()
        self.validator.validate(course)
        course["lessons"][0]["exercises"] = [{
            "id": "locate", "kind": "trace", "prompt": "写出返回语句的位置。",
            "rubric": ["指出正确行号"], "explanation": course["lessons"][0]["summary"][0],
        }]
        self.validator.validate(course)

    def test_each_teaching_section_required(self):
        sections = ("objectives", "priorKnowledge", "concepts", "sourceReading", "keySymbols",
                    "execution", "calls", "scenario", "designRationale", "faq", "exercises", "summary")
        for key in sections:
            course = sample_course()
            del course["lessons"][0][key]
            with self.subTest(key=key):
                self.assertFalse(self.validator.is_valid(course))

    def test_invalid_version_evidence_and_exercise(self):
        course = sample_course()
        for field, value in [("commit", "main"), ("commit", "abc1234"), ("schemaVersion", 2),
                             ("sourceEvidence", {}), ("unexpected", True)]:
            with self.subTest(field=field, value=value):
                self.assertFalse(self.validator.is_valid({**course, field: value}))
        lesson = course["lessons"][0]
        lesson["exercises"][0]["options"].pop()
        self.assertFalse(self.validator.is_valid(course))
        lesson["exercises"] = sample_course()["lessons"][0]["exercises"]
        lesson["summary"] = [{"kind": "fact", "text": "缺少依据", "sourceRefs": []}]
        self.assertFalse(self.validator.is_valid(course))

    def test_material_snapshot_metadata(self):
        course = sample_course()
        material = {
            "kind": "official-doc", "url": "https://example.org/fixture",
            "accessedAt": "2026-11-22T00:00:00Z", "sha256": "a" * 64, "locator": "夹具标题",
        }
        course["materials"]["guide"] = material
        self.validator.validate(course)
        for key, bad in [("accessedAt", "recently"), ("sha256", "main"), ("url", "file:///fixture")]:
            course["materials"]["guide"] = {**material, key: bad}
            with self.subTest(key=key):
                self.assertFalse(self.validator.is_valid(course))

    def test_line_coordinate_rules(self):
        expected = hashlib.sha256(b"A\n").hexdigest()
        self.assertEqual(excerpt_hash(b"A\r\n\r\nB\r\n", 1, 2), expected)
        self.assertEqual(excerpt_hash(b"\xef\xbb\xbfA\n\nB", 1, 2), expected)
        self.assertEqual(excerpt_hash(b"\n", 1, 1), hashlib.sha256(b"").hexdigest())
        self.assertNotEqual(excerpt_hash(b"A ", 1, 1), excerpt_hash(b"A", 1, 1))
        for raw, first, last in [(b"", 1, 1), (b"A\n", 1, 2), (b"A", 0, 1),
                                 (b"A\nB", 2, 1), (b"A\rB", 1, 1), (b"\x00", 1, 1),
                                 (b"\xff", 1, 1)]:
            with self.subTest(raw=raw, first=first, last=last), self.assertRaises(ValueError):
                excerpt_hash(raw, first, last)


class StorageChecks(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript((SCHEMA_DIR / "academy.sql").read_text(encoding="utf-8"))
        self.assertEqual(self.db.execute("PRAGMA foreign_keys").fetchone(), (1,))
        self.assertEqual(self.db.execute("PRAGMA user_version").fetchone(), (1,))
        self.course = sample_course()
        self.db.execute("INSERT INTO project VALUES ('fixture','Fixture',1)")
        self.db.execute("INSERT INTO repository VALUES ('fixture-repo','fixture','local-repo',NULL)")
        self.db.execute("INSERT INTO revision(repository_id,commit_sha) VALUES ('fixture-repo',?)", (SAMPLE_SHA,))
        self.db.execute("INSERT INTO course VALUES ('fixture','demo')")
        self.add_release(1)

    def add_release(self, version):
        course = {**self.course, "version": version}
        self.db.execute("INSERT INTO course_release VALUES (?, 'fixture', 'demo', 'fixture-repo', ?, ?, ?)",
                        (version, SAMPLE_SHA, version, json.dumps(course)))
        self.db.execute("INSERT INTO lesson VALUES (?, 'read', 1, '读一个夹具函数')", (version,))
        evidence = course["sourceEvidence"]["definition"]
        self.db.execute("INSERT INTO source_evidence VALUES (?, 'definition', ?, ?, ?, ?, ?, ?)",
                        (version, evidence["path"], evidence["symbol"], evidence["startLine"],
                         evidence["endLine"], evidence["blobOid"], evidence["excerptSha256"]))
        self.db.execute("INSERT INTO lesson_evidence VALUES (?, 'read', 'definition')", (version,))
        self.db.execute("INSERT INTO exercise VALUES (?, 'read', 'result', 'single-choice')", (version,))

    def test_cross_project_and_unknown_commit_rejected(self):
        self.db.execute("INSERT INTO project VALUES ('other','Other',3)")
        self.db.execute("INSERT INTO course VALUES ('other','demo')")
        for project, sha in [("other", SAMPLE_SHA), ("fixture", "2" * 40)]:
            with self.subTest(project=project, sha=sha), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute("INSERT INTO course_release VALUES (9,?,'demo','fixture-repo',?,2,'{}')",
                                (project, sha))

    def test_backlink_and_edition_isolation(self):
        self.add_release(2)
        self.db.execute("INSERT INTO lesson VALUES (2,'extra',2,'第二章')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO lesson_evidence VALUES (1,'extra','definition')")
        hits = self.db.execute("""
            SELECT le.lesson_id FROM source_evidence AS e
            JOIN lesson_evidence AS le ON le.release_id = e.release_id AND le.evidence_id = e.id
            WHERE e.release_id = 1 AND e.path = 'sample.js' AND e.start_line <= 2 AND e.end_line >= 2
        """).fetchall()
        self.assertEqual(hits, [("read",)])
        self.db.execute("INSERT INTO lesson_progress(release_id,lesson_id,state) VALUES (1,'read','completed')")
        self.assertEqual(self.db.execute("SELECT count(*) FROM lesson_progress WHERE release_id=2").fetchone(), (0,))
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_release_immutable_and_coordinates_numeric(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE course_release SET document='{}' WHERE id=1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE source_evidence SET end_line='three' WHERE release_id=1")

    def test_attempt_history_and_retry(self):
        sql = """INSERT INTO attempt(request_id,release_id,lesson_id,exercise_id,answer,result)
                 VALUES (?,1,'read','result',?,?)"""
        self.db.execute(sql, ("first", "two", "incorrect"))
        self.db.execute(sql, ("second", "one", "correct"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, ("second", "one", "correct"))
        results = self.db.execute("SELECT result FROM attempt ORDER BY id DESC").fetchall()
        self.assertEqual(results, [("correct",), ("incorrect",)])

    def test_bad_evidence_rolls_back_transaction(self):
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError), self.db:
            self.add_release(2)
            self.db.execute("UPDATE source_evidence SET end_line=0 WHERE release_id=2")
        self.assertEqual(self.db.execute("SELECT id FROM course_release").fetchall(), [(1,)])
        self.assertEqual(self.db.execute("SELECT release_id FROM lesson").fetchall(), [(1,)])


if __name__ == "__main__":
    unittest.main(verbosity=2)
