from __future__ import annotations

import json
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Literal

import pytest
from sqlalchemy import Boolean, Column, DateTime, JSON, MetaData, String, Table, create_engine, insert, select

from silo.ai import phase11_evaluation as phase11
from silo.ai.assistant_registry import DatasetRegistry


def test_load_phase11_cases_preserves_followup_context(tmp_path: Path) -> None:
    corpus_path = tmp_path / "eval-cases.jsonl"
    corpus_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "id": "case-1",
                        "primaryCategory": "followup_elliptic",
                        "scope": "models",
                        "prompt": "E os modelos críticos?",
                        "conversationContext": {
                            "priorScope": "models",
                            "priorQuestion": "Contexto anterior",
                            "priorAnswerSummary": "Resumo anterior",
                        },
                        "isInScopeExpected": True,
                        "expectedPlan": ["normalize_question", "classify_scope"],
                        "requiredTools": ["resolve_models"],
                        "allowedTools": ["resolve_models"],
                        "forbiddenTools": ["shell"],
                        "sourceKind": "product_activity",
                        "sources": ["product_activity"],
                        "verifiableNumbers": [{"name": "totalRuns", "source": "dataset.totalRuns", "assertion": "equals_fixture"}],
                        "expectedDataset": {
                            "schemaId": "model_runs_summary.v1",
                            "sourceKind": "product_activity",
                            "required": True,
                            "complete": True,
                            "checksumRequired": True,
                        },
                        "expectedArtifact": {"kind": "none", "required": False},
                        "pdfAllowed": False,
                        "riskTags": ["followup"],
                    }
                )
            ]
        ),
        encoding="utf-8",
    )

    cases = phase11.load_phase11_cases(corpus_path)

    assert len(cases) == 1
    case = cases[0]
    assert case.id == "case-1"
    assert case.conversation_context is not None
    assert case.conversation_context_hash is not None
    assert case.expected_plan == ("normalize_question", "classify_scope")
    assert case.required_tools == ("resolve_models",)


def test_lineage_for_case_detects_forbidden_tools_and_artifacts() -> None:
    case = phase11.Phase11CorpusCase(
        id="case-2",
        primary_category="pdf_projects",
        scope="generate_pdf",
        prompt="Gere PDF de projetos.",
        conversation_context=None,
        is_in_scope_expected=True,
        expected_plan=("normalize_question", "classify_scope", "get_projects_report_data", "generate_report_pdf"),
        required_tools=("get_projects_report_data", "generate_report_pdf"),
        allowed_tools=("get_projects_report_data", "generate_report_pdf"),
        forbidden_tools=("shell", "delete_data"),
        source_kind="projects_report",
        sources=("project", "project_task"),
        verifiable_numbers=(
            {"name": "pageCount", "source": "dataset.pageCount", "assertion": "equals_fixture"},
        ),
        expected_dataset={
            "schemaId": "projects_report_pdf.v1",
            "sourceKind": "projects_report",
            "required": True,
            "complete": True,
            "checksumRequired": True,
        },
        expected_artifact={"kind": "pdf", "reportType": "projects", "required": True},
        pdf_allowed=True,
        risk_tags=("pdf",),
    )
    state = {
        "scope": "generate_pdf",
        "is_in_scope": True,
        "artifact_intent": {"kind": "pdf", "reportType": "projects"},
        "final_response": {
            "scope": "generate_pdf",
            "isInScope": True,
            "artifacts": [{"kind": "pdf", "url": "/uploads/reports/example.pdf", "filename": "example.pdf"}],
            "citations": [{"label": "Relatório", "detail": "ok"}],
            "generation": {"status": "success", "latencyMs": 120, "generatedTokens": 32},
        },
        "visualization": {},
        "artifact_result": {"artifact": {"kind": "pdf", "checksum": "abc123"}},
        "dataset_manifests": [
            {
                "schema_id": "projects_report_pdf.v1",
                "source_kind": "projects_report",
                "checksum": "abc123",
            }
        ],
        "required_results": {"projectsReport": {}, "generate_report_pdf": {}},
        "supplemental_results": {},
        "observability": {"toolCalls": [{"name": "get_projects_report_data"}, {"name": "shell"}]},
        "citations": [{"label": "Relatório", "detail": "ok"}],
        "generation": {"status": "success", "latencyMs": 120, "generatedTokens": 32},
    }

    lineage = phase11._lineage_for_case(case, state)  # noqa: SLF001

    assert lineage["actual_scope"] == "generate_pdf"
    assert lineage["scope_match"] is True
    assert lineage["actual_artifact_kind"] == "pdf"
    assert lineage["artifact_match"] is True
    assert lineage["dataset_manifest_ok"] is True
    assert lineage["required_tools_missing"] == ()
    assert lineage["forbidden_tool_violations"] == ("shell",)


def test_summarize_mode_uses_required_tool_recall_and_gate_status() -> None:
    attempts = (
        phase11.Phase11AttemptResult(
            mode="deterministic",
            case_id="case-1",
            attempt=1,
            request_id="request-1",
            run_id="run-1",
            thread_id="thread-1",
            prompt_hash="prompt-a",
            conversation_context_hash=None,
            expected_scope="models",
            actual_scope="models",
            is_in_scope_expected=True,
            is_in_scope_actual=True,
            scope_match=True,
            expected_trajectory=("normalize_question", "classify_scope"),
            actual_trajectory=("normalize_question", "classify_scope"),
            trajectory_match=True,
            required_tools_expected_count=2,
            required_tools_ok=True,
            required_tools_missing=(),
            forbidden_tool_violations=(),
            expected_source_kind="product_activity",
            actual_source_kind="product_activity",
            source_kind_match=True,
            expected_artifact_kind="none",
            actual_artifact_kind="none",
            artifact_match=True,
            expected_dataset_schema_id="model_runs_summary.v1",
            actual_dataset_schema_ids=("model_runs_summary.v1",),
            dataset_source_kinds=("product_activity",),
            dataset_manifest_ok=True,
            citations_count=1,
            citations_valid=True,
            conclusion_ok=True,
            generation_status="success",
            generation_error_message=None,
            latency_ms=100,
            first_emission_ms=0,
            prompt_eval_count=10,
            output_token_count=12,
            model="Qwen/Qwen2.5-0.5B-Instruct",
            model_digest=phase11.EXPECTED_CHAT_DIGEST,
            embedding_model="nomic-embed-text:v1.5",
            embedding_digest=phase11.EXPECTED_EMBEDDING_DIGEST,
            hardware={"platform": "Windows"},
            notes=(),
        ),
        phase11.Phase11AttemptResult(
            mode="deterministic",
            case_id="case-1",
            attempt=2,
            request_id="request-2",
            run_id="run-2",
            thread_id="thread-2",
            prompt_hash="prompt-a",
            conversation_context_hash=None,
            expected_scope="models",
            actual_scope="models",
            is_in_scope_expected=True,
            is_in_scope_actual=True,
            scope_match=True,
            expected_trajectory=("normalize_question", "classify_scope"),
            actual_trajectory=("normalize_question", "classify_scope"),
            trajectory_match=True,
            required_tools_expected_count=2,
            required_tools_ok=True,
            required_tools_missing=(),
            forbidden_tool_violations=(),
            expected_source_kind="product_activity",
            actual_source_kind="product_activity",
            source_kind_match=True,
            expected_artifact_kind="none",
            actual_artifact_kind="none",
            artifact_match=True,
            expected_dataset_schema_id="model_runs_summary.v1",
            actual_dataset_schema_ids=("model_runs_summary.v1",),
            dataset_source_kinds=("product_activity",),
            dataset_manifest_ok=True,
            citations_count=1,
            citations_valid=True,
            conclusion_ok=True,
            generation_status="success",
            generation_error_message=None,
            latency_ms=160,
            first_emission_ms=0,
            prompt_eval_count=10,
            output_token_count=12,
            model="Qwen/Qwen2.5-0.5B-Instruct",
            model_digest=phase11.EXPECTED_CHAT_DIGEST,
            embedding_model="nomic-embed-text:v1.5",
            embedding_digest=phase11.EXPECTED_EMBEDDING_DIGEST,
            hardware={"platform": "Windows"},
            notes=(),
        ),
    )

    summary = phase11._summarize_mode(  # noqa: SLF001
        mode="deterministic",
        attempts=attempts,
        baseline_first_emission_p95_ms=50,
        baseline_final_p95_ms=200,
        deterministic_final_p95_ms=None,
    )

    assert summary.cases_total == 1
    assert summary.attempts_total == 2
    assert summary.required_tool_recall == 1.0
    assert summary.gate_status == "approved"
    assert summary.final_p95_ms == 160


def test_capture_hardware_snapshot_has_structural_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raising_run(*args, **kwargs):  # noqa: ANN001
        raise FileNotFoundError("missing")

    monkeypatch.setattr(phase11.subprocess, "run", _raising_run)
    snapshot = phase11.capture_hardware_snapshot()

    assert snapshot["platform"]
    assert isinstance(snapshot["logicalCpuCount"], int)
    assert snapshot["pythonVersion"]


def _make_phase11_case(case_id: str) -> phase11.Phase11CorpusCase:
    return phase11.Phase11CorpusCase(
        id=case_id,
        primary_category="reports",
        scope="general",
        prompt="Qual o panorama operacional?",
        conversation_context=None,
        is_in_scope_expected=True,
        expected_plan=("normalize_question", "classify_scope", "resolve_models"),
        required_tools=("resolve_models",),
        allowed_tools=("resolve_models",),
        forbidden_tools=("shell",),
        source_kind="executive_report",
        sources=("executive_report",),
        verifiable_numbers=(),
        expected_dataset={
            "schemaId": "general.v1",
            "sourceKind": "executive_report",
            "required": True,
            "complete": True,
            "checksumRequired": True,
        },
        expected_artifact={"kind": "none", "required": False},
        pdf_allowed=False,
        risk_tags=(),
    )


def _make_phase11_attempt(
    case: phase11.Phase11CorpusCase,
    *,
    mode: Literal["deterministic", "hybrid"],
    attempt: int,
    latency_ms: int,
) -> phase11.Phase11AttemptResult:
    return phase11.Phase11AttemptResult(
        mode=mode,
        case_id=case.id,
        attempt=attempt,
        request_id=f"request-{case.id}-{attempt}",
        run_id=f"run-{case.id}-{attempt}",
        thread_id=f"thread-{case.id}",
        prompt_hash="prompt-hash",
        conversation_context_hash=None,
        expected_scope=case.scope,
        actual_scope=case.scope,
        is_in_scope_expected=True,
        is_in_scope_actual=True,
        scope_match=True,
        expected_trajectory=case.expected_plan,
        actual_trajectory=case.expected_plan,
        trajectory_match=True,
        required_tools_expected_count=len(case.required_tools),
        required_tools_ok=True,
        required_tools_missing=(),
        forbidden_tool_violations=(),
        expected_source_kind=case.source_kind,
        actual_source_kind=case.source_kind,
        source_kind_match=True,
        expected_artifact_kind="none",
        actual_artifact_kind="none",
        artifact_match=True,
        expected_dataset_schema_id=str(case.expected_dataset.get("schemaId") or ""),
        actual_dataset_schema_ids=(str(case.expected_dataset.get("schemaId") or ""),),
        dataset_source_kinds=(case.source_kind,),
        dataset_manifest_ok=True,
        citations_count=1,
        citations_valid=True,
        conclusion_ok=True,
        generation_status="success",
        generation_error_message=None,
        latency_ms=latency_ms,
        first_emission_ms=25,
        prompt_eval_count=10,
        output_token_count=12,
        model=phase11.EXPECTED_CHAT_MODEL,
        model_digest=phase11.EXPECTED_CHAT_DIGEST,
        embedding_model=phase11.EXPECTED_EMBEDDING_MODEL,
        embedding_digest=phase11.EXPECTED_EMBEDDING_DIGEST,
        hardware={"platform": "Windows"},
        notes=(),
    )


class _FakeConnection:
    def __enter__(self) -> _FakeConnection:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeEngine:
    def __init__(self) -> None:
        self.disposed = False
        self.connection = _FakeConnection()

    def connect(self) -> _FakeConnection:
        return self.connection

    def dispose(self) -> None:
        self.disposed = True


@pytest.mark.asyncio
async def test_run_phase11_evaluation_smoke_with_fakes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    corpus_path = tmp_path / "corpus.jsonl"
    output_dir = tmp_path / "output"
    uploads_dir = tmp_path / "uploads"
    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text(
        json.dumps({"firstEmissionP95Ms": 150, "finalP95Ms": 200}, ensure_ascii=False),
        encoding="utf-8",
    )

    cases = [_make_phase11_case(f"case-{index}") for index in range(210)]
    engine = _FakeEngine()
    current_user = phase11.CurrentUser(
        id="user-1",
        email="user@example.test",
        name="User",
        is_active=True,
    )
    captured_modes: list[str] = []

    monkeypatch.setattr(phase11, "load_phase11_cases", lambda _path: cases)
    monkeypatch.setattr(
        phase11,
        "capture_hardware_snapshot",
        lambda: {"platform": "Windows", "logicalCpuCount": 8, "pythonVersion": "3.13.0"},
    )
    monkeypatch.setattr(
        phase11,
        "load_settings",
        lambda environ=None: SimpleNamespace(
            database_url="postgresql://test-user:test-pass@localhost:5432/silo",
            ai_agent_mode=SimpleNamespace(value=(environ or {}).get("AI_AGENT_MODE", "deterministic")),
            vllm=SimpleNamespace(
                model=phase11.EXPECTED_CHAT_MODEL,
                embedding_model=phase11.EXPECTED_EMBEDDING_MODEL,
                timeout_ms=30_000,
                max_concurrent_requests=1,
            ),
        ),
    )
    monkeypatch.setattr(phase11, "create_engine", lambda *args, **kwargs: engine)

    async def _fake_probe(settings):  # noqa: ANN001
        del settings
        return SimpleNamespace(
            fallback_reason=None,
            model=phase11.EXPECTED_CHAT_MODEL,
            chat_digest=phase11.EXPECTED_CHAT_DIGEST,
            embedding_model=phase11.EXPECTED_EMBEDDING_MODEL,
            embedding_digest=phase11.EXPECTED_EMBEDDING_DIGEST,
            latency_ms=1,
            checked_at="2026-08-03T12:00:00Z",
        )

    monkeypatch.setattr(phase11, "probe_ai_runtime", _fake_probe)
    monkeypatch.setattr(
        phase11,
        "create_model_runtime",
        lambda settings: SimpleNamespace(settings=settings),
    )
    monkeypatch.setattr(
        phase11,
        "create_embedding_runtime",
        lambda settings: SimpleNamespace(settings=settings),
    )
    monkeypatch.setattr(
        phase11,
        "_resolve_eval_user",
        lambda connection, *, seed_database_if_missing, settings: current_user,
    )

    async def _fake_run_case_attempt(
        *,
        case,
        attempt,
        mode,
        **_kwargs,
    ):  # noqa: ANN001
        captured_modes.append(mode)
        return _make_phase11_attempt(case, mode=mode, attempt=attempt, latency_ms=100), f"thread-{case.id}"

    monkeypatch.setattr(phase11, "_run_case_attempt", _fake_run_case_attempt)
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: None)

    report = await phase11.run_phase11_evaluation(
        corpus_path=corpus_path,
        output_dir=output_dir,
        database_url="postgresql://test-user:test-pass@localhost:5432/silo",
        uploads_dir=uploads_dir,
        vllm_url="http://localhost:11434",
        modes=("deterministic", "hybrid"),
        attempts_per_case=1,
        seed_database_if_missing=False,
        baseline_json_path=baseline_path,
    )

    assert engine.disposed is True
    assert captured_modes == ["deterministic"] * 210 + ["hybrid"] * 210
    assert report.modes["deterministic"].cases_total == 210
    assert report.modes["deterministic"].gate_status == "approved"
    assert report.modes["hybrid"].deterministic_final_p95_ms == report.modes[
        "deterministic"
    ].final_p95_ms
    assert (output_dir / "phase11-evaluation.sanitized.json").exists()
    assert (output_dir / "phase11-evaluation.md").exists()

    sanitized = json.loads((output_dir / "phase11-evaluation.sanitized.json").read_text())
    assert sanitized["modes"]["deterministic"]["gate_status"] == "approved"
    assert len(sanitized["attempts"]) == 420


def test_phase11_main_parses_args_and_invokes_runner(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text(
        json.dumps({"firstEmissionP95Ms": 150, "finalP95Ms": 200}, ensure_ascii=False),
        encoding="utf-8",
    )
    fake_report = phase11.Phase11EvaluationReport(
        generated_at="2026-08-03T12:00:00Z",
        corpus_path=str(tmp_path / "corpus.jsonl"),
        output_dir=str(tmp_path / "output"),
        hardware={"platform": "Windows"},
        runtime={},
        modes={},
        attempts=(),
    )
    captured: dict[str, object] = {}
    printed: list[str] = []

    async def _fake_run_phase11_evaluation(**kwargs):
        captured["kwargs"] = kwargs
        return fake_report

    monkeypatch.setattr(phase11, "run_phase11_evaluation", _fake_run_phase11_evaluation)
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: printed.append(" ".join(str(arg) for arg in args)))

    exit_code = phase11.main(
        [
            "--corpus-path",
            str(tmp_path / "corpus.jsonl"),
            "--output-dir",
            str(tmp_path / "output"),
            "--database-url",
            "postgresql://test-user:test-pass@localhost:5432/silo",
            "--uploads-dir",
            str(tmp_path / "uploads"),
            "--vllm-url",
            "http://localhost:11434",
            "--attempts-per-case",
            "2",
            "--mode",
            "both",
            "--baseline-json",
            str(baseline_path),
            "--seed-database-if-missing",
        ]
    )

    assert exit_code == 0
    assert captured["kwargs"]["modes"] == ("deterministic", "hybrid")
    assert captured["kwargs"]["attempts_per_case"] == 2
    assert captured["kwargs"]["baseline_json_path"] == baseline_path
    assert printed


def test_phase11_helper_utilities_cover_serialization_snapshot_and_report_branches(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    case = _make_phase11_case("case-utils")

    assert phase11._coerce_str_tuple(["a", 2]) == ("a", "2")  # noqa: SLF001
    assert phase11._coerce_str_tuple("ignorar") == ()  # noqa: SLF001
    assert phase11._coerce_mapping({"x": 1}) == {"x": 1}  # noqa: SLF001
    assert phase11._coerce_mapping(("x",)) is None  # noqa: SLF001
    assert phase11._hash_text("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"  # noqa: SLF001

    assert phase11._json_default(case)["id"] == "case-utils"  # noqa: SLF001
    assert phase11._json_default(Path("rel") / "path") == str(Path("rel") / "path")  # noqa: SLF001
    assert phase11._json_default(phase11.datetime(2026, 8, 4, 12, 0, tzinfo=phase11.UTC)) == phase11.datetime(2026, 8, 4, 12, 0, tzinfo=phase11.UTC).astimezone().isoformat()  # noqa: SLF001
    assert phase11._json_default({3, 1, 2}) == [1, 2, 3]  # noqa: SLF001
    with pytest.raises(TypeError):
        phase11._json_default(object())  # noqa: SLF001

    json_path = tmp_path / "payload.json"
    text_path = tmp_path / "payload.txt"
    phase11._write_json(json_path, {"b": 2, "a": 1})  # noqa: SLF001
    phase11._write_text(text_path, "linha 1\nlinha 2")  # noqa: SLF001
    assert json.loads(json_path.read_text(encoding="utf-8")) == {"a": 1, "b": 2}
    assert text_path.read_text(encoding="utf-8") == "linha 1\nlinha 2"

    assert phase11._p95([]) is None  # noqa: SLF001
    assert phase11._p95([1, 2, 3, 4]) == 4  # noqa: SLF001
    assert phase11._ratio(0, 0) == 0.0  # noqa: SLF001
    assert phase11._ratio(3, 4) == 0.75  # noqa: SLF001

    jsonl_path = tmp_path / "cases.jsonl"
    jsonl_path.write_text('{"a":1}\n\n{"b":2}\n', encoding="utf-8")
    assert phase11._load_jsonl(jsonl_path) == [{"a": 1}, {"b": 2}]  # noqa: SLF001

    environ = phase11._build_eval_environ(  # noqa: SLF001
        database_url="postgresql://user:pass@localhost:5432/silo",
        uploads_dir=tmp_path / "uploads",
        vllm_url="http://localhost:11434",
        mode="hybrid",
    )
    assert environ["AI_AGENT_MODE"] == "hybrid"
    assert environ["KAFKA_DLQ_PREFIX"] == "dlq."
    assert environ["VLLM_MODEL"] == phase11.EXPECTED_CHAT_MODEL

    class _SecretValue:
        def __init__(self, value: str) -> None:
            self.value = value

        def get_secret_value(self) -> str:
            return self.value

    assert phase11._settings_database_url(SimpleNamespace(database_url=_SecretValue("postgresql://secret"))) == "postgresql://secret"  # noqa: SLF001
    assert phase11._settings_database_url(SimpleNamespace(database_url="postgresql://plain")) == "postgresql://plain"  # noqa: SLF001

    def fake_gpu_run(command, **kwargs):  # noqa: ANN001
        del kwargs
        if command[0] == "nvidia-smi":
            return SimpleNamespace(returncode=0, stdout="GPU One, 1024\nGPU Two, 2048\n")
        raise AssertionError("powershell fallback should not be used")

    monkeypatch.setattr(phase11.subprocess, "run", fake_gpu_run)
    assert phase11._capture_gpu_snapshot() == {"source": "nvidia-smi", "lines": ["GPU One, 1024", "GPU Two, 2048"]}  # noqa: SLF001

    def fake_gpu_json_run(command, **kwargs):  # noqa: ANN001
        del kwargs
        if command[0] == "nvidia-smi":
            return SimpleNamespace(returncode=1, stdout="")
        return SimpleNamespace(returncode=0, stdout='[{"Name":"GPU X","AdapterRAM":2048}]')

    monkeypatch.setattr(phase11.subprocess, "run", fake_gpu_json_run)
    assert phase11._capture_gpu_snapshot() == {"source": "powershell", "value": [{"Name": "GPU X", "AdapterRAM": 2048}]}  # noqa: SLF001

    def fake_cpu_run(command, **kwargs):  # noqa: ANN001
        del kwargs
        if command[0] == "powershell":
            return SimpleNamespace(returncode=0, stdout="Name\nIntel Xeon\n")
        return SimpleNamespace(returncode=1, stdout="")

    monkeypatch.setattr(phase11.subprocess, "run", fake_cpu_run)
    assert phase11._capture_cpu_name() == "Intel Xeon"  # noqa: SLF001

    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text(json.dumps({"first_emission_p95_ms": 11, "finalP95Ms": 22}), encoding="utf-8")
    assert phase11._load_latency_baseline(baseline_path) == {"firstEmissionP95Ms": 11, "finalP95Ms": 22}  # noqa: SLF001
    bad_baseline_path = tmp_path / "baseline-empty.json"
    bad_baseline_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError):
        phase11._load_latency_baseline(bad_baseline_path)  # noqa: SLF001

    state = {
        "final_response": {
            "artifacts": [{"kind": "pdf"}],
            "visualization": {"kind": "chart"},
        },
        "artifact_result": {"artifact": {"kind": "mermaid"}},
        "dataset_manifests": [
            {"schema_id": "schema-1", "source_kind": "source-1"},
            {"schemaId": "schema-2", "sourceKind": "source-2"},
            {"schema_id": "", "source_kind": "ignored"},
        ],
        "observability": {"toolCalls": [{"name": "tool-a"}, {"name": ""}, "bad"]},
        "required_results": {"projectsSnapshot": {}, "projectsReport": {}},
        "supplemental_results": {"knowledgeSearch": {}},
        "artifact_intent": {"kind": "pdf"},
        "scope": "projects",
        "generation": {"status": "success", "generatedTokens": 12, "latencyMs": 34},
    }

    assert phase11._actual_artifact_kind(state) == "pdf"  # noqa: SLF001
    assert phase11._actual_dataset_summary(state) == (("schema-1", "schema-2"), ("source-1", "source-2", "ignored"))  # noqa: SLF001
    assert phase11._trajectory_from_state(state) == (  # noqa: SLF001
        "normalize_question",
        "classify_scope",
        "build_and_validate_plan",
        "get_projects_snapshot",
        "get_projects_report_data",
        "search_silo_knowledge",
        "generate_report_pdf",
        "build_grounded_response",
        "synthesize_answer",
        "verify_response",
    )
    assert phase11._tool_call_names(state) == ("tool-a",)  # noqa: SLF001

    attempt = _make_phase11_attempt(case, mode="deterministic", attempt=1, latency_ms=123)
    mode_summary = phase11.Phase11ModeSummary(
        mode="deterministic",
        cases_total=1,
        attempts_total=1,
        case_pass_count=1,
        attempt_pass_count=1,
        required_tool_recall=1.0,
        forbidden_tool_violation_count=0,
        scope_accuracy=1.0,
        source_kind_accuracy=1.0,
        artifact_accuracy=1.0,
        citation_validity_rate=1.0,
        conclusion_success_rate=1.0,
        number_consistency_rate=1.0,
        first_emission_p95_ms=25,
        final_p95_ms=123,
        baseline_first_emission_p95_ms=11,
        baseline_final_p95_ms=22,
        deterministic_final_p95_ms=None,
        final_vs_baseline_ratio=1.0,
        final_vs_deterministic_ratio=None,
        gate_status="approved",
        gate_notes=("Tudo ok",),
    )
    report = phase11.Phase11EvaluationReport(
        generated_at="2026-08-04T12:00:00Z",
        corpus_path=str(tmp_path / "corpus.jsonl"),
        output_dir=str(tmp_path / "output"),
        hardware={"platform": "Windows"},
        runtime={
            "provider": "vllm",
            "model": phase11.EXPECTED_CHAT_MODEL,
            "chatDigest": phase11.EXPECTED_CHAT_DIGEST,
            "embeddingDigest": phase11.EXPECTED_EMBEDDING_DIGEST,
        },
        modes={"deterministic": mode_summary},
        attempts=(attempt,),
    )

    markdown = phase11._render_summary_markdown(report)  # noqa: SLF001
    sanitized = phase11._sanitize_report(report)  # noqa: SLF001
    assert "# Fase 11" in markdown
    assert "Tudo ok" in markdown
    assert sanitized["modes"]["deterministic"]["gate_status"] == "approved"
    assert sanitized["attempts"][0]["case_id"] == "case-utils"

    parsed = phase11._parse_args(  # noqa: SLF001
        [
            "--corpus-path",
            str(tmp_path / "corpus.jsonl"),
            "--output-dir",
            str(tmp_path / "output"),
            "--database-url",
            "postgresql://user:pass@localhost:5432/silo",
            "--uploads-dir",
            str(tmp_path / "uploads"),
            "--vllm-url",
            "http://localhost:11434",
            "--attempts-per-case",
            "2",
            "--mode",
            "both",
            "--baseline-json",
            str(baseline_path),
        ]
    )
    assert parsed.mode == "both"
    assert parsed.attempts_per_case == 2
    assert parsed.baseline_json == baseline_path


def test_phase11_helper_branches_cover_snapshot_resolution_seed_and_lineage(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'phase11-helpers.sqlite3'}", future=True)
    metadata = MetaData()
    user_table = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("email", String, nullable=False),
        Column("name", String, nullable=False),
        Column("is_active", Boolean, nullable=False),
    )
    message_table = Table(
        "ai_assistant_message",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("sender_type", String, nullable=False),
        Column("sender_user_id", String, nullable=True),
        Column("sender_name", String, nullable=False),
        Column("provider", String, nullable=True),
        Column("model", String, nullable=True),
        Column("generation_status", String, nullable=True),
        Column("latency_ms", String, nullable=True),
        Column("error_message", String, nullable=True),
        Column("content", String, nullable=False),
        Column("metadata", JSON, nullable=True),
        Column("embedding", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    metadata.create_all(engine)
    monkeypatch.setattr(phase11, "legacy_tables", {"user": user_table, "ai_assistant_message": message_table})

    settings = SimpleNamespace(
        database_url=str(engine.url),
        vllm=SimpleNamespace(model="mistral", embedding_model="nomic-embed-text:v1.5"),
        ai_agent_mode=SimpleNamespace(value="deterministic"),
    )
    current_user = phase11.CurrentUser(
        id="user-1",
        email="user@example.test",
        name="User",
        is_active=True,
    )
    empty_context_case = phase11.Phase11CorpusCase(
        id="case-empty",
        primary_category="general",
        scope="general",
        prompt="Pergunta base",
        conversation_context=None,
        is_in_scope_expected=True,
        expected_plan=(),
        required_tools=(),
        allowed_tools=(),
        forbidden_tools=(),
        source_kind="executive_report",
        sources=(),
        verifiable_numbers=(),
        expected_dataset={"schemaId": "general.v1", "sourceKind": "executive_report"},
        expected_artifact={"kind": "none"},
        pdf_allowed=False,
        risk_tags=(),
    )
    assert empty_context_case.conversation_context_hash is None

    fake_psutil = ModuleType("psutil")
    fake_psutil.virtual_memory = lambda: SimpleNamespace(total=8, available=4)  # type: ignore[assignment]
    monkeypatch.setitem(sys.modules, "psutil", fake_psutil)

    def fake_run(command, **kwargs):  # noqa: ANN001
        del kwargs
        if command[0] == "nvidia-smi":
            return SimpleNamespace(returncode=0, stdout="GPU One, 1024\nGPU Two, 2048\n")
        if command[0] == "powershell" and "Processor" in command[-1]:
            return SimpleNamespace(returncode=0, stdout="Name\nIntel Xeon\n")
        return SimpleNamespace(returncode=1, stdout="")

    monkeypatch.setattr(phase11.subprocess, "run", fake_run)
    snapshot = phase11.capture_hardware_snapshot()
    assert snapshot["memoryTotalBytes"] == 8
    assert snapshot["memoryAvailableBytes"] == 4
    assert snapshot["gpu"] == {"source": "nvidia-smi", "lines": ["GPU One, 1024", "GPU Two, 2048"]}
    assert snapshot["cpuName"] == "Intel Xeon"
    assert phase11._capture_gpu_snapshot() == {"source": "nvidia-smi", "lines": ["GPU One, 1024", "GPU Two, 2048"]}  # noqa: SLF001

    def fake_gpu_raw_run(command, **kwargs):  # noqa: ANN001
        del kwargs
        if command[0] == "nvidia-smi":
            return SimpleNamespace(returncode=1, stdout="")
        return SimpleNamespace(returncode=0, stdout="GPU RAW PAYLOAD")

    monkeypatch.setattr(phase11.subprocess, "run", fake_gpu_raw_run)
    assert phase11._capture_gpu_snapshot() == {"source": "powershell", "raw": "GPU RAW PAYLOAD"}  # noqa: SLF001
    assert phase11._load_latency_baseline(None) is None  # noqa: SLF001

    with engine.begin() as connection:
        connection.execute(
            user_table.insert(),
            [
                {"id": "user-active", "email": "active@example.test", "name": "Active", "is_active": True},
                {"id": "user-inactive", "email": "inactive@example.test", "name": "Inactive", "is_active": False},
            ],
        )

    with engine.connect() as connection:
        active_user = phase11._resolve_eval_user(connection, seed_database_if_missing=False, settings=settings)  # noqa: SLF001
    assert active_user.id == "user-active"

    with engine.begin() as connection:
        connection.execute(user_table.delete().where(user_table.c.id == "user-active"))

    with engine.connect() as connection:
        fallback_user = phase11._resolve_eval_user(connection, seed_database_if_missing=False, settings=settings)  # noqa: SLF001
    assert fallback_user.id == "user-inactive"

    with engine.begin() as connection:
        connection.execute(user_table.delete())

    with engine.connect() as connection:
        with pytest.raises(RuntimeError):
            phase11._resolve_eval_user(connection, seed_database_if_missing=False, settings=settings)  # noqa: SLF001

    def fake_seed_database(database_url: str) -> None:
        seeded_engine = create_engine(database_url, future=True)
        with seeded_engine.begin() as seeded_connection:
            seeded_connection.execute(
                user_table.insert(),
                [
                    {"id": "user-seeded", "email": "seeded@example.test", "name": "Seeded", "is_active": True},
                ],
            )

    monkeypatch.setattr("silo.db.seed.seed_database", fake_seed_database)
    with engine.connect() as connection:
        seeded_user = phase11._resolve_eval_user(connection, seed_database_if_missing=True, settings=settings)  # noqa: SLF001
    assert seeded_user.id == "user-seeded"

    with engine.begin() as connection:
        phase11._seed_followup_context(
            connection,
            thread_id="thread-empty",
            current_user=current_user,
            context={},
            settings=settings,
        )  # noqa: SLF001
    with engine.connect() as connection:
        assert connection.execute(select(message_table)).all() == []

    with engine.begin() as connection:
        phase11._seed_followup_context(
            connection,
            thread_id="thread-1",
            current_user=current_user,
            context={
                "priorScope": "reports",
                "priorQuestion": "Primeira pergunta",
                "priorAnswerSummary": "Resumo anterior",
            },
            settings=settings,
        )  # noqa: SLF001
    with engine.connect() as connection:
        seeded_messages = connection.execute(select(message_table).order_by(message_table.c.created_at.asc())).mappings().all()
    assert len(seeded_messages) == 2
    assert seeded_messages[0]["sender_type"] == "user"
    assert seeded_messages[1]["sender_type"] == "assistant"

    with engine.connect() as connection:
        runtime_context = phase11._create_runtime_context(
            connection=connection,
            current_user=current_user,
            settings=settings,
            mode="hybrid",
            model_runtime=SimpleNamespace(),
            embedding_runtime=SimpleNamespace(),
        )  # noqa: SLF001
        assert runtime_context.mode == "hybrid"
        assert runtime_context.connection_factory is not None
        assert runtime_context.has_reports_permission is True
        built_state = phase11._build_state_for_case(
            empty_context_case,
            runtime_context=runtime_context,
            thread_id="thread-1",
        )  # noqa: SLF001
        assert built_state["question"] == empty_context_case.prompt
        assert built_state["thread_id"] == "thread-1"

    assert phase11._actual_artifact_kind({"final_response": {"visualization": {"kind": "chart"}}}) == "chart"  # noqa: SLF001
    assert phase11._actual_artifact_kind({"artifact_result": {"artifact": {"kind": "mermaid"}}}) == "mermaid"  # noqa: SLF001
    assert phase11._actual_artifact_kind({}) == "none"  # noqa: SLF001
    assert phase11._actual_dataset_summary({  # noqa: SLF001
        "dataset_manifests": [
            {"schema_id": "", "source_kind": "ignored"},
            {"schemaId": "schema-1", "sourceKind": "source-1"},
        ]
    }) == (("schema-1",), ("ignored", "source-1"))

    lineage_case = phase11.Phase11CorpusCase(
        id="case-lineage",
        primary_category="general",
        scope="general",
        prompt="Pergunta fora de escopo",
        conversation_context=None,
        is_in_scope_expected=False,
        expected_plan=(),
        required_tools=(),
        allowed_tools=(),
        forbidden_tools=(),
        source_kind="executive_report",
        sources=(),
        verifiable_numbers=(),
        expected_dataset={"schemaId": "general.v1", "sourceKind": "executive_report"},
        expected_artifact={"kind": "none"},
        pdf_allowed=False,
        risk_tags=(),
    )
    lineage = phase11._lineage_for_case(
        lineage_case,
        {
            "scope": "general",
            "is_in_scope": False,
            "final_response": {
                "scope": "general",
                "isInScope": False,
                "citations": [{"label": "Fonte"}],
                "generation": {"status": "success", "latencyMs": 1, "generatedTokens": 2},
            },
            "dataset_manifests": [],
            "generation": {"status": "success", "latencyMs": 1, "generatedTokens": 2},
            "citations": [{"label": "Fonte"}],
            "errors": [],
            "artifact_result": {"artifact": {"kind": "none"}},
        },
    )  # noqa: SLF001
    assert lineage["actual_source_kind"] is None
    assert lineage["scope_match"] is True
    assert lineage["dataset_manifest_ok"] is False
    assert lineage["conclusion_ok"] is True


@pytest.mark.asyncio
async def test_phase11_run_case_attempt_covers_success_error_and_cleanup(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'phase11-run.sqlite3'}", future=True)
    case = _make_phase11_case("case-run")
    current_user = phase11.CurrentUser(
        id="user-1",
        email="user@example.test",
        name="User",
        is_active=True,
    )
    settings = SimpleNamespace(
        vllm=SimpleNamespace(model="mistral", embedding_model="nomic-embed-text:v1.5"),
    )
    runtime_context = SimpleNamespace(
        connection=SimpleNamespace(),
        current_user=current_user,
        dataset_registry=DatasetRegistry(),
        settings=settings,
        mode="deterministic",
        request_id="request-1",
        run_id="run-1",
        has_reports_permission=True,
    )
    created_threads: list[str] = []
    deleted_threads: list[str] = []

    monkeypatch.setattr(phase11, "_create_runtime_context", lambda **kwargs: runtime_context)
    monkeypatch.setattr(
        phase11,
        "create_assistant_thread",
        lambda connection, user_id, title: SimpleNamespace(thread=SimpleNamespace(id="thread-1")),
    )
    monkeypatch.setattr(
        phase11,
        "_build_state_for_case",
        lambda case, runtime_context, thread_id: {"question": case.prompt, "progress": [], "thread_id": thread_id},
    )
    monkeypatch.setattr(
        phase11,
        "_lineage_for_case",
        lambda case, state: {
            "actual_scope": case.scope,
            "actual_is_in_scope": case.is_in_scope_expected,
            "scope_match": True,
            "actual_trajectory": case.expected_plan,
            "required_tools_missing": (),
            "forbidden_tool_violations": (),
            "actual_source_kind": case.source_kind,
            "source_kind_match": True,
            "expected_artifact_kind": str(case.expected_artifact.get("kind") or "none"),
            "actual_artifact_kind": str(case.expected_artifact.get("kind") or "none"),
            "artifact_match": True,
            "actual_dataset_schema_ids": (str(case.expected_dataset.get("schemaId") or ""),),
            "dataset_source_kinds": (case.source_kind,),
            "dataset_manifest_ok": True,
            "citations_count": 1,
            "citations_valid": True,
            "conclusion_ok": True,
            "generation_status": "success",
            "generation_error_message": None,
            "prompt_eval_count": 10,
            "output_token_count": 12,
            "required_tools_expected_count": len(case.required_tools),
        },
    )

    async def _success_invoke(state, context):  # noqa: ANN001
        del context
        return {
            "scope": case.scope,
            "is_in_scope": case.is_in_scope_expected,
            "final_response": {"scope": case.scope, "isInScope": case.is_in_scope_expected},
            "generation": {"status": "success", "latencyMs": 42, "generatedTokens": 12},
            "citations": [{"label": "Fonte"}],
        }

    monkeypatch.setattr(phase11, "get_assistant_graph", lambda: SimpleNamespace(ainvoke=_success_invoke))

    def fake_delete_assistant_thread(connection, user_id, thread_id):  # noqa: ANN001
        del connection
        deleted_threads.append(f"{user_id}:{thread_id}")

    monkeypatch.setattr(phase11, "delete_assistant_thread", fake_delete_assistant_thread)
    monkeypatch.setattr(phase11.time, "perf_counter", iter([1.0, 1.25]).__next__)

    attempt_result, thread_id = await phase11._run_case_attempt(
        case=case,
        attempt=1,
        mode="deterministic",
        settings=settings,
        engine=engine,
        current_user=current_user,
        model_runtime=SimpleNamespace(),
        embedding_runtime=SimpleNamespace(),
        hardware={"platform": "Windows"},
        model_digest="chat-digest",
        embedding_digest="embed-digest",
    )  # noqa: SLF001

    assert thread_id == "thread-1"
    assert attempt_result.generation_status == "success"
    assert attempt_result.latency_ms == 250
    assert deleted_threads == ["user-1:thread-1"]

    async def _failing_invoke(state, context):  # noqa: ANN001
        del state, context
        raise RuntimeError("boom")

    monkeypatch.setattr(phase11, "get_assistant_graph", lambda: SimpleNamespace(ainvoke=_failing_invoke))
    monkeypatch.setattr(phase11.time, "perf_counter", iter([2.0, 2.1]).__next__)

    failed_attempt, failed_thread_id = await phase11._run_case_attempt(
        case=case,
        attempt=2,
        mode="deterministic",
        settings=settings,
        engine=engine,
        current_user=current_user,
        model_runtime=SimpleNamespace(),
        embedding_runtime=SimpleNamespace(),
        hardware={"platform": "Windows"},
        model_digest="chat-digest",
        embedding_digest="embed-digest",
    )  # noqa: SLF001

    assert failed_thread_id == "thread-1"
    assert failed_attempt.generation_status == "error"
    assert "boom" in failed_attempt.generation_error_message
    assert deleted_threads == ["user-1:thread-1", "user-1:thread-1"]
