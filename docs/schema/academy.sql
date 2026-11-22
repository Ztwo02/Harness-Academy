-- Phase 0 design baseline. Run on an empty SQLite 3.38+ database.
PRAGMA foreign_keys = ON;
BEGIN;

CREATE TABLE project (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    first_phase INTEGER NOT NULL CHECK (first_phase BETWEEN 1 AND 6)
) STRICT;
CREATE TABLE repository (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES project(id),
    source_kind TEXT NOT NULL CHECK (source_kind IN ('public-repo','sdk-repo','local-repo')),
    public_url TEXT,
    UNIQUE (project_id, id),
    CHECK (source_kind = 'local-repo' OR public_url IS NOT NULL)
) STRICT;
CREATE TABLE repository_import (
    id INTEGER PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repository(id),
    origin_kind TEXT NOT NULL CHECK (origin_kind IN ('github','directory')),
    origin_locator TEXT NOT NULL,
    UNIQUE (repository_id, origin_kind, origin_locator)
) STRICT;
CREATE TABLE revision (
    repository_id TEXT NOT NULL REFERENCES repository(id),
    commit_sha TEXT NOT NULL CHECK (length(commit_sha) IN (40,64) AND commit_sha NOT GLOB '*[^0-9a-f]*'),
    pinned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (repository_id, commit_sha)
) STRICT;
CREATE TABLE course (
    project_id TEXT NOT NULL REFERENCES project(id),
    id TEXT NOT NULL,
    PRIMARY KEY (project_id, id)
) STRICT;
CREATE TABLE course_release (
    id INTEGER PRIMARY KEY,
    project_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    repository_id TEXT NOT NULL,
    commit_sha TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    document TEXT NOT NULL CHECK (json_valid(document)),
    UNIQUE (project_id, course_id, version),
    FOREIGN KEY (project_id, course_id) REFERENCES course(project_id, id),
    FOREIGN KEY (project_id, repository_id) REFERENCES repository(project_id, id),
    FOREIGN KEY (repository_id, commit_sha) REFERENCES revision(repository_id, commit_sha)
) STRICT;
CREATE TRIGGER immutable_course_release
BEFORE UPDATE ON course_release
BEGIN
    SELECT RAISE(ABORT, 'Publish a new course version to change a release');
END;
CREATE TABLE lesson (
    release_id INTEGER NOT NULL REFERENCES course_release(id),
    id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    title TEXT NOT NULL,
    PRIMARY KEY (release_id, id),
    UNIQUE (release_id, ordinal)
) STRICT;
CREATE TABLE source_evidence (
    release_id INTEGER NOT NULL REFERENCES course_release(id),
    id TEXT NOT NULL,
    path TEXT NOT NULL,
    symbol TEXT,
    start_line INTEGER NOT NULL CHECK (start_line >= 1),
    end_line INTEGER NOT NULL CHECK (end_line >= start_line),
    blob_oid TEXT NOT NULL CHECK (length(blob_oid) IN (40,64) AND blob_oid NOT GLOB '*[^0-9a-f]*'),
    excerpt_sha256 TEXT NOT NULL CHECK (length(excerpt_sha256) = 64 AND excerpt_sha256 NOT GLOB '*[^0-9a-f]*'),
    PRIMARY KEY (release_id, id)
) STRICT;
CREATE INDEX evidence_by_location ON source_evidence(release_id, path, start_line, end_line);
CREATE TABLE lesson_evidence (
    release_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    PRIMARY KEY (release_id, lesson_id, evidence_id),
    FOREIGN KEY (release_id, lesson_id) REFERENCES lesson(release_id, id),
    FOREIGN KEY (release_id, evidence_id) REFERENCES source_evidence(release_id, id)
) STRICT;
CREATE INDEX evidence_backlinks ON lesson_evidence(release_id, evidence_id);
CREATE TABLE exercise (
    release_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('single-choice','trace')),
    PRIMARY KEY (release_id, lesson_id, id),
    FOREIGN KEY (release_id, lesson_id) REFERENCES lesson(release_id, id)
) STRICT;
CREATE TABLE lesson_progress (
    release_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('unstarted','reading','completed')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (release_id, lesson_id),
    FOREIGN KEY (release_id, lesson_id) REFERENCES lesson(release_id, id)
) STRICT;
CREATE TABLE learning_entry (
    id INTEGER PRIMARY KEY,
    release_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    evidence_id TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('note','question')),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0,1) AND (kind = 'question' OR resolved = 0)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id, lesson_id) REFERENCES lesson(release_id, id),
    FOREIGN KEY (release_id, lesson_id, evidence_id) REFERENCES lesson_evidence(release_id, lesson_id, evidence_id)
) STRICT;
CREATE TABLE attempt (
    id INTEGER PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    release_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('correct','incorrect')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id, lesson_id, exercise_id) REFERENCES exercise(release_id, lesson_id, id)
) STRICT;
CREATE INDEX attempt_history ON attempt(release_id, lesson_id, exercise_id, id DESC);

PRAGMA user_version = 1;
COMMIT;
