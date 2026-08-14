from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import Column, DateTime, JSON, MetaData, String, Table, create_engine

from silo.ai import assistant_tools


def _build_tables(metadata: MetaData) -> dict[str, Table]:
    product_table = Table(
        "product",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("slug", String, nullable=False),
        Column("description", String, nullable=True),
        Column("short_description", String, nullable=True),
    )
    project_table = Table(
        "project",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("short_description", String, nullable=True),
        Column("description", String, nullable=True),
        Column("status", String, nullable=True),
        Column("priority", String, nullable=True),
        Column("created_at", DateTime, nullable=True),
    )
    problem_category_table = Table(
        "product_problem_category",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("color", String, nullable=False),
        Column("sort_order", String, nullable=False),
    )
    problem_table = Table(
        "product_problem",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("user_id", String, nullable=True),
        Column("problem_category_id", String, nullable=False),
        Column("title", String, nullable=False),
        Column("description", String, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    solution_table = Table(
        "product_solution",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_problem_id", String, nullable=False),
        Column("user_id", String, nullable=True),
        Column("description", String, nullable=False),
        Column("reply_id", String, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    solution_checked_table = Table(
        "product_solution_checked",
        metadata,
        Column("product_solution_id", String, primary_key=True),
    )
    user_table = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("email", String, nullable=False),
    )
    project_task_table = Table(
        "project_task",
        metadata,
        Column("id", String, primary_key=True),
        Column("project_id", String, nullable=False),
        Column("status", String, nullable=False),
        Column("priority", String, nullable=True),
        Column("sort", String, nullable=True),
    )
    project_activity_table = Table(
        "project_activity",
        metadata,
        Column("id", String, primary_key=True),
        Column("project_id", String, nullable=False),
        Column("status", String, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    activity_table = Table(
        "product_activity",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("date", String, nullable=False),
        Column("turn", String, nullable=False),
        Column("status", String, nullable=False),
        Column("intervention", String, nullable=True),
        Column("description", String, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    history_table = Table(
        "product_activity_history",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_activity_id", String, nullable=False),
        Column("user_id", String, nullable=False),
        Column("action", String, nullable=False),
        Column("from_status", String, nullable=True),
        Column("to_status", String, nullable=True),
        Column("details", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
    )
    return {
        "product": product_table,
        "project": project_table,
        "product_problem_category": problem_category_table,
        "product_problem": problem_table,
        "product_solution": solution_table,
        "product_solution_checked": solution_checked_table,
        "user": user_table,
        "project_task": project_task_table,
        "project_activity": project_activity_table,
        "product_activity": activity_table,
        "product_activity_history": history_table,
    }


def test_resolution_helpers_cover_database_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    tables = _build_tables(metadata)
    metadata.create_all(engine)
    monkeypatch.setattr(assistant_tools, "legacy_tables", tables)

    timestamp = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    with engine.begin() as connection:
        connection.execute(
            tables["product"].insert(),
            [
                {
                    "id": "product-bam",
                    "name": "BAM",
                    "slug": "bam",
                    "description": "Modelo global operacional",
                    "short_description": "Global",
                },
                {
                    "id": "product-smec",
                    "name": "SMEC",
                    "slug": "smec",
                    "description": "Modelo secundario operacional",
                    "short_description": "Operacional",
                },
                {
                    "id": "product-brams",
                    "name": "BRAMS",
                    "slug": "brams",
                    "description": "Modelo regional de testes",
                    "short_description": "Regional",
                },
            ],
        )
        connection.execute(
            tables["project"].insert(),
            [
                {
                    "id": "project-1",
                    "name": "Sistema de Monitoramento",
                    "short_description": "Monitoramento diário",
                    "description": "Projeto de monitoramento operacional",
                    "status": "active",
                    "priority": "high",
                    "created_at": timestamp,
                },
                {
                    "id": "project-2",
                    "name": "Monitoramento de Dados",
                    "short_description": "Dados e alertas",
                    "description": "Projeto de monitoramento de dados",
                    "status": "active",
                    "priority": "normal",
                    "created_at": timestamp,
                },
            ],
        )
        connection.execute(
            tables["product_problem_category"].insert(),
            [
                {"id": "no_incidents", "name": "Sem incidentes", "color": "#10B981", "sort_order": 0},
                {"id": "model-failure", "name": "Falha de modelo", "color": "#EF4444", "sort_order": 10},
                {"id": "data-delay", "name": "Atraso de dados", "color": "#F59E0B", "sort_order": 20},
            ],
        )
        connection.execute(
            tables["user"].insert(),
            [{"id": "user-1", "name": "User One", "email": "user@example.test"}],
        )
        connection.execute(
            tables["product_problem"].insert(),
            [
                {
                    "id": "problem-1",
                    "product_id": "product-bam",
                    "user_id": "user-1",
                    "problem_category_id": "model-failure",
                    "title": "Falha no modelo",
                    "description": "Problema principal",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
                {
                    "id": "problem-2",
                    "product_id": "product-smec",
                    "user_id": "user-1",
                    "problem_category_id": "data-delay",
                    "title": "Atraso de dados",
                    "description": "Outro problema",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            ],
        )
        connection.execute(
            tables["product_solution"].insert(),
            [
                {
                    "id": "solution-1",
                    "product_problem_id": "problem-1",
                    "user_id": "user-1",
                    "description": "Solucao 1",
                    "reply_id": None,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
                {
                    "id": "solution-2",
                    "product_problem_id": "problem-1",
                    "user_id": "user-1",
                    "description": "Solucao 2",
                    "reply_id": None,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            ],
        )
        connection.execute(
            tables["product_solution_checked"].insert(),
            [{"product_solution_id": "solution-1"}],
        )
        connection.execute(
            tables["project_task"].insert(),
            [
                {"id": "task-1", "project_id": "project-1", "status": "open", "priority": "high", "sort": "1"},
                {"id": "task-2", "project_id": "project-1", "status": "blocked", "priority": "high", "sort": "2"},
                {"id": "task-3", "project_id": "project-2", "status": "done", "priority": "normal", "sort": "3"},
            ],
        )
        connection.execute(
            tables["project_activity"].insert(),
            [
                {
                    "id": "activity-1",
                    "project_id": "project-1",
                    "status": "done",
                    "created_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_activity"].insert(),
            [
                {
                    "id": "run-1",
                    "product_id": "product-bam",
                    "date": "2026-08-04",
                    "turn": "0",
                    "status": "completed",
                    "intervention": None,
                    "description": "Rodada concluida",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
                {
                    "id": "run-2",
                    "product_id": "product-smec",
                    "date": "2026-08-04",
                    "turn": "6",
                    "status": "with_problems",
                    "intervention": "Ajuste manual",
                    "description": "Rodada com problema",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            ],
        )
        connection.execute(
            tables["product_activity_history"].insert(),
            [
                {
                    "id": "history-1",
                    "product_activity_id": "run-1",
                    "user_id": "user-1",
                    "action": "update",
                    "from_status": "pending",
                    "to_status": "completed",
                    "details": {"note": "ok"},
                    "created_at": timestamp,
                }
            ],
        )

    with engine.connect() as connection:
        exact_models = assistant_tools.resolve_models(connection, "bam")
        generic_models = assistant_tools.resolve_models(
            connection,
            "Quais modelos estão com menor disponibilidade nos últimos 30 dias?",
        )
        fuzzy_models = assistant_tools.resolve_models(connection, "operacional geral")
        exact_projects = assistant_tools.resolve_projects(connection, "project-1")
        fuzzy_projects = assistant_tools.resolve_projects(connection, "monitoramento")
        categories = assistant_tools.resolve_problem_categories(connection, "falha")
        problems = assistant_tools.list_registered_problems(
            connection,
            start_date="2026-08-01",
            end_date="2026-08-31",
            limit=10,
        )
        problem_details = assistant_tools.get_registered_problem_details(connection, problem_id="problem-1")
        missing_problem_details = assistant_tools.get_registered_problem_details(connection, problem_id="missing")
        snapshot = assistant_tools.get_projects_snapshot(connection)
        snapshot_without_tasks = assistant_tools.get_projects_snapshot(connection, include_tasks=False)
        solution_counts = assistant_tools._count_solutions_by_problem(connection, ["problem-1", "problem-2"])  # noqa: SLF001

    assert exact_models["matches"][0]["id"] == "product-bam"
    assert exact_models["ambiguous"] is False
    # Perguntas genericas sobre modelos nao devem gerar matches nem clarificacao.
    assert generic_models["matches"] == []
    assert generic_models["ambiguous"] is False
    assert fuzzy_models["matches"] == []
    assert fuzzy_models["ambiguous"] is False
    assert exact_projects["matches"][0]["id"] == "project-1"
    assert fuzzy_projects["ambiguous"] is True
    assert categories["matches"][0]["id"] == "model-failure"
    assert all(item["id"] != "no_incidents" for item in categories["matches"])
    problem_1_item = next(item for item in problems["items"] if item["id"] == "problem-1")
    problem_2_item = next(item for item in problems["items"] if item["id"] == "problem-2")
    assert problem_1_item["solutionsCount"] == 2
    assert problem_2_item["solutionsCount"] == 0
    assert problem_details["problem"]["id"] == "problem-1"
    assert [item["verified"] for item in problem_details["solutions"]] == [False, True]
    assert missing_problem_details == {"problem": None, "solutions": []}
    assert snapshot["totalProjects"] == 2
    assert snapshot["totalTasks"] == 3
    assert snapshot["blockedTasks"] == 1
    project_1_snapshot = next(item for item in snapshot["projects"] if item["id"] == "project-1")
    project_2_snapshot = next(item for item in snapshot["projects"] if item["id"] == "project-2")
    project_1_snapshot_without_tasks = next(item for item in snapshot_without_tasks["projects"] if item["id"] == "project-1")
    assert len(project_1_snapshot["tasks"]) == 2
    assert len(project_2_snapshot["tasks"]) == 1
    assert project_1_snapshot_without_tasks["tasks"] == []
    assert solution_counts == {"problem-1": 2, "problem-2": 0}


def test_resolution_scoring_and_date_helpers_cover_edge_cases(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_generate_embedding(query: str) -> list[float]:
        assert query == "texto de teste"
        return [0.25 for _ in range(768)]

    monkeypatch.setattr(assistant_tools, "generate_embedding", _fake_generate_embedding)
    monkeypatch.setattr(
        assistant_tools,
        "SYSTEM_CLOCK",
        SimpleNamespace(now=lambda: datetime(2026, 8, 4, 12, 0, tzinfo=UTC)),
    )

    query_embedding = assistant_tools._generate_query_embedding_for_search("texto de teste")  # noqa: SLF001
    assert len(query_embedding) == 768
    assert query_embedding[0] == 0.25
    assert assistant_tools._generate_query_embedding_for_search("   ") == tuple(0.0 for _ in range(768))  # noqa: SLF001

    assert assistant_tools._coerce_embedding_similarity(query_embedding, [0.25 for _ in range(768)]) > 0.99  # noqa: SLF001
    assert assistant_tools._coerce_embedding_similarity(query_embedding, [0.25]) == 0.0  # noqa: SLF001
    assert assistant_tools._coerce_embedding_similarity(query_embedding, None) == 0.0  # noqa: SLF001

    recent = datetime(2026, 8, 4, 11, 50, tzinfo=UTC)
    old = recent - timedelta(days=20)
    assert assistant_tools._score_recency(recent) > assistant_tools._score_recency(old)  # noqa: SLF001
    assert assistant_tools._score_recency("invalid") == 0.0  # noqa: SLF001

    assert assistant_tools._date_range_bounds("2026-08-01", "2026-08-04") == (  # noqa: SLF001
        date(2026, 8, 1),
        date(2026, 8, 4),
    )
    assert assistant_tools._date_range_bounds(None, None, default_days=7) == (  # noqa: SLF001
        date(2026, 7, 29),
        date(2026, 8, 4),
    )
    assert assistant_tools._period_from_query({"start": "2026-08-01", "end": "2026-08-04"}) == {  # noqa: SLF001
        "start": "2026-08-01",
        "end": "2026-08-04",
    }


def test_resolution_remaining_branches_cover_search_rendering_and_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    tables = _build_tables(metadata)
    tables["help"] = Table(
        "help",
        metadata,
        Column("id", String, primary_key=True),
        Column("title", String, nullable=False),
        Column("description", String, nullable=False),
        Column("embedding", JSON, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    tables["product_manual_chunk"] = Table(
        "product_manual_chunk",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("content", String, nullable=False),
        Column("embedding", JSON, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    metadata.create_all(engine)
    monkeypatch.setattr(assistant_tools, "legacy_tables", tables)
    monkeypatch.setattr(
        assistant_tools,
        "SYSTEM_CLOCK",
        SimpleNamespace(now=lambda: datetime(2026, 8, 4, 12, 0, tzinfo=UTC)),
    )

    async def _fake_generate_embedding(query: str) -> list[float]:
        assert query == "falha no modelo"
        return [0.1 for _ in range(768)]

    monkeypatch.setattr(assistant_tools, "generate_embedding", _fake_generate_embedding)

    timestamp = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    with engine.begin() as connection:
        connection.execute(
            tables["product"].insert(),
            [
                {
                    "id": "product-bam",
                    "name": "BAM",
                    "slug": "bam",
                    "description": "Modelo global operacional",
                    "short_description": "Global",
                },
                {
                    "id": "product-brams",
                    "name": "BRAMS",
                    "slug": "brams",
                    "description": "Modelo regional de testes",
                    "short_description": "Regional",
                },
            ],
        )
        connection.execute(
            tables["project"].insert(),
            [
                {
                    "id": "project-1",
                    "name": "Projeto Alpha",
                    "short_description": "Resumo",
                    "description": "Projeto de exemplo",
                    "status": "active",
                    "priority": "high",
                    "created_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_problem_category"].insert(),
            [
                {"id": "model-failure", "name": "Falha de modelo", "color": "#EF4444", "sort_order": 10},
                {"id": "data-delay", "name": "Atraso de dados", "color": "#F59E0B", "sort_order": 20},
            ],
        )
        connection.execute(
            tables["user"].insert(),
            [{"id": "user-1", "name": "User One", "email": "user@example.test"}],
        )
        connection.execute(
            tables["product_problem"].insert(),
            [
                {
                    "id": "problem-1",
                    "product_id": "product-bam",
                    "user_id": "user-1",
                    "problem_category_id": "model-failure",
                    "title": "Falha no modelo",
                    "description": "Problema principal com falha operacional prolongada",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_solution"].insert(),
            [
                {
                    "id": "solution-1",
                    "product_problem_id": "problem-1",
                    "user_id": "user-1",
                    "description": "Solução principal com resposta longa",
                    "reply_id": None,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_solution_checked"].insert(),
            [{"product_solution_id": "solution-1"}],
        )
        connection.execute(
            tables["project_task"].insert(),
            [
                {"id": "task-1", "project_id": "project-1", "status": "open", "priority": "high", "sort": "1"},
                {"id": "task-2", "project_id": "project-1", "status": "done", "priority": "low", "sort": "2"},
            ],
        )
        connection.execute(
            tables["project_activity"].insert(),
            [
                {
                    "id": "activity-1",
                    "project_id": "project-1",
                    "status": "done",
                    "created_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_activity"].insert(),
            [
                {
                    "id": "run-1",
                    "product_id": "product-bam",
                    "date": "2026-08-03",
                    "turn": "0",
                    "status": "completed",
                    "intervention": None,
                    "description": "Rodada concluida",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
                {
                    "id": "run-2",
                    "product_id": "product-bam",
                    "date": "2026-08-04",
                    "turn": "6",
                    "status": "with_problems",
                    "intervention": "Ajuste manual",
                    "description": "Rodada com problema",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            ],
        )
        connection.execute(
            tables["product_activity_history"].insert(),
            [
                {
                    "id": "history-1",
                    "product_activity_id": "run-2",
                    "user_id": "user-1",
                    "action": "update",
                    "from_status": "pending",
                    "to_status": "with_problems",
                    "details": {"note": "ajuste"},
                    "created_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["help"].insert(),
            [
                {
                    "id": "help-1",
                    "title": "Falha no modelo",
                    "description": "Falha no modelo precisa de revisão",
                    "embedding": [0.1 for _ in range(768)],
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            ],
        )
        connection.execute(
            tables["product_manual_chunk"].insert(),
            [
                {
                    "id": "manual-1",
                    "product_id": "product-bam",
                    "content": "Falha no modelo manual com orientação prática",
                    "embedding": [0.1 for _ in range(768)],
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            ],
        )

    assert assistant_tools.normalize_text("  Árvore   de\n  Dados ") == "arvore de dados"
    assert assistant_tools.token_overlap_score("a e", "sem termos") == 0.0  # noqa: SLF001
    assert assistant_tools.token_overlap_score("falha modelo", "falha do modelo") > 0.0  # noqa: SLF001
    assert assistant_tools.fuzzy_score("", "qualquer coisa") == 0.0  # noqa: SLF001
    canonical_1 = assistant_tools._canonical_json({"b": 1, "a": 2})  # noqa: SLF001
    canonical_2 = assistant_tools._canonical_json({"a": 2, "b": 1})  # noqa: SLF001
    assert canonical_1 == canonical_2
    assert assistant_tools._optional_text(123) is None  # noqa: SLF001
    assert assistant_tools._escape_mermaid('linha "um"\ndois') == "linha 'um' dois"  # noqa: SLF001
    assert assistant_tools._escape_svg('<a & b> "c"') == "&lt;a &amp; b&gt; &quot;c&quot;"  # noqa: SLF001
    assert assistant_tools._select_products_by_ids(connection, []) == []  # noqa: SLF001
    assert assistant_tools._coerce_embedding_similarity((0.1, 0.2), object()) == 0.0  # noqa: SLF001
    assert assistant_tools._coerce_embedding_similarity((0.1, 0.2), [float("inf"), 0.2]) == 0.0  # noqa: SLF001
    assert assistant_tools._score_recency(None) == 0.0  # noqa: SLF001
    assert assistant_tools._score_knowledge_candidate(  # noqa: SLF001
        query="falha",
        query_embedding=(0.1, 0.1),
        source="help",
        identifier="help-0",
        content="   ",
        embedding=None,
        created_at=None,
    ) == []
    scored_candidates = assistant_tools._score_knowledge_candidate(  # noqa: SLF001
        query="falha",
        query_embedding=(0.1, 0.1, 0.1),
        source="help",
        identifier="help-1",
        content="falha no modelo com detalhe relevante" + (" x" * 1000),
        embedding=[0.1, 0.1, 0.1],
        created_at=timestamp,
        extra={"title": "Falha", "ignored": None},
    )
    assert scored_candidates[0]["truncated"] is True
    assert scored_candidates[0]["title"] == "Falha"
    assert "ignored" not in scored_candidates[0]

    with engine.connect() as connection:
        invalid_cursor_runs = assistant_tools.list_model_runs(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            cursor="invalido",
            limit=1,
        )
        assert len(invalid_cursor_runs["items"]) == 1
        assert invalid_cursor_runs["nextCursor"] is not None

        cursor_runs = assistant_tools.list_model_runs(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            cursor="2026-08-04|6|run-2",
            limit=5,
        )
        assert [item["id"] for item in cursor_runs["items"]] == ["run-1"]

        summarized_all = assistant_tools.summarize_model_runs(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            product_ids=["product-bam"],
        )
        summarized_empty = assistant_tools.summarize_model_runs(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            status="missing",
        )
        assert summarized_all["totalRuns"] == 2
        assert summarized_all["availabilityPct"] == 100.0
        assert summarized_empty["totalRuns"] == 0
        assert summarized_empty["availabilityPct"] == 0.0

        compared = assistant_tools.compare_model_run_periods(  # noqa: SLF001
            connection,
            start_date="2026-08-04",
            end_date="2026-08-04",
            product_ids=["product-bam"],
        )
        assert compared["current"]["totalRuns"] == 1
        assert compared["previous"]["totalRuns"] == 1

        problematic = assistant_tools.list_problematic_runs(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            limit=1,
        )
        assert problematic["items"][0]["id"] == "run-2"

        history_missing_product = assistant_tools.get_model_run_history(connection, product_id_or_slug="missing")  # noqa: SLF001
        history_without_runs = assistant_tools.get_model_run_history(connection, product_id_or_slug="brams")  # noqa: SLF001
        history_with_runs = assistant_tools.get_model_run_history(connection, product_id_or_slug="bam")  # noqa: SLF001
        assert history_missing_product == {"product": None, "history": []}
        assert history_without_runs["history"] == []
        assert history_with_runs["history"][0]["id"] == "history-1"

        problems_filtered = assistant_tools.list_registered_problems(  # noqa: SLF001
            connection,
            start_date="2026-08-03",
            end_date="2026-08-04",
            product_id="product-bam",
            problem_category_id="model-failure",
        )
        problem_details = assistant_tools.get_registered_problem_details(connection, problem_id="problem-1")  # noqa: SLF001
        assert problems_filtered["items"][0]["id"] == "problem-1"
        assert problem_details["problem"]["id"] == "problem-1"
        assert problem_details["solutions"][0]["verified"] is True

        snapshot = assistant_tools.get_projects_snapshot(connection)
        snapshot_without_tasks = assistant_tools.get_projects_snapshot(connection, include_tasks=False)
        assert snapshot["totalProjects"] == 1
        assert snapshot["totalTasks"] == 2
        assert snapshot_without_tasks["projects"][0]["tasks"] == []

        monkeypatch.setattr(
            assistant_tools,
            "get_availability_report",
            lambda connection, period: {"kind": "availability", "period": period},
        )
        monkeypatch.setattr(
            assistant_tools,
            "get_problems_report",
            lambda connection, period, product_id, problem_category: {
                "kind": "problems",
                "period": period,
                "productId": product_id,
                "problemCategory": problem_category,
            },
        )
        monkeypatch.setattr(
            assistant_tools,
            "get_executive_report",
            lambda connection, period, product_id, group_id: {
                "kind": "executive",
                "period": period,
                "productId": product_id,
                "groupId": group_id,
            },
        )
        monkeypatch.setattr(
            assistant_tools,
            "get_projects_report",
            lambda connection, period: {"kind": "projects", "period": period},
        )
        assert assistant_tools.get_availability_report_data(connection, {"start": "2026-08-03", "end": "2026-08-04"})["kind"] == "availability"  # noqa: SLF001
        assert assistant_tools.get_problems_report_data(connection, {"start": "2026-08-03", "end": "2026-08-04", "productId": "product-bam", "problemCategory": "model-failure"})["productId"] == "product-bam"  # noqa: SLF001
        assert assistant_tools.get_executive_report_data(connection, {"start": "2026-08-03", "end": "2026-08-04", "productId": "product-bam", "groupId": "group-ops"})["groupId"] == "group-ops"  # noqa: SLF001
        assert assistant_tools.get_projects_report_data(connection, {"start": "2026-08-03", "end": "2026-08-04"})["kind"] == "projects"  # noqa: SLF001

        search_results = assistant_tools.search_silo_knowledge(connection, query="falha no modelo", limit=-1)  # noqa: SLF001
        assert search_results["limit"] == 1
        assert set(search_results["sources"]) <= {"help", "manual", "problem", "solution"}
        assert search_results["items"]

    with pytest.raises(ValueError, match="inválido"):
        assistant_tools.build_chart_spec(  # noqa: SLF001
            template_id="models_overview",
            dataset={},
            chart_type="scatter",
            title="Teste",
        )

    empty_chart = assistant_tools.build_chart_spec(  # noqa: SLF001
        template_id="models_overview",
        dataset={},
        chart_type="bar",
        title="Vazio",
    )
    assert empty_chart["categories"] == []

    with pytest.raises(ValueError, match="incompatíveis"):
        assistant_tools.build_chart_spec(  # noqa: SLF001
            template_id="models_overview",
            dataset={
                "categories": ["A"],
                "series": [{"name": "S", "values": [1], "unit": "x"}],
                "unit": "y",
            },
            chart_type="bar",
            title="Teste",
        )

    chart_from_dataset = assistant_tools.build_chart_spec(  # noqa: SLF001
        template_id="models_overview",
        dataset={
            "categories": ["A", "B"],
            "series": [{"name": "S", "values": [1, 2], "unit": "x"}],
        },
        chart_type="line",
        title="Com dados",
    )
    assert chart_from_dataset["series"][0]["values"] == [1.0, 2.0]

    chart_from_products = assistant_tools.build_chart_spec(  # noqa: SLF001
        template_id="projects_overview",
        dataset={"products": [{"slug": "produto-a", "availabilityPercentage": 88}]},
        chart_type="donut",
        title="Produtos",
    )
    assert chart_from_products["categories"] == ["produto-a"]

    chart_from_top_products = assistant_tools.build_chart_spec(  # noqa: SLF001
        template_id="executive_overview",
        dataset={"topProducts": [{"productName": "Produto A", "incidentRuns": 4}]},
        chart_type="bar",
        title="Top",
    )
    assert chart_from_top_products["series"][0]["values"] == [4.0]

    with pytest.raises(ValueError, match="excede"):
        assistant_tools._finalize_chart_spec({"data": "x" * 200000})  # noqa: SLF001

    valid_mermaid = assistant_tools.build_mermaid_diagram(  # noqa: SLF001
        template_id="project_flow",
        dataset={"projects": [{"name": "Projeto A", "tasks": [{"name": "Tarefa A"}]}]},
        title="Fluxo",
    )
    assert valid_mermaid["kind"] == "mermaid"

    with pytest.raises(ValueError, match="inválido"):
        assistant_tools.build_mermaid_diagram(  # noqa: SLF001
            template_id="template-desconhecido",
            dataset={"projects": []},
            title="Fluxo",
        )

    monkeypatch.setattr(assistant_tools, "_escape_mermaid", lambda value: "javascript:alert(1)")
    with pytest.raises(ValueError, match="inseguro"):
        assistant_tools.build_mermaid_diagram(  # noqa: SLF001
            template_id="project_flow",
            dataset={"projects": [{"name": "Projeto A", "tasks": []}]},
            title="Fluxo inseguro",
        )

    monkeypatch.setattr(assistant_tools, "_escape_svg", lambda value: "X" * 100_000)
    with pytest.raises(ValueError, match="excede"):
        assistant_tools.render_summary_image(title="Título", lines=["Linha 1", "Linha 2"])  # noqa: SLF001

    monkeypatch.setattr(assistant_tools.asyncio, "get_running_loop", lambda: object())
    assert assistant_tools._generate_query_embedding_for_search("texto") == tuple(0.0 for _ in range(768))  # noqa: SLF001

    assert assistant_tools._coerce_chart_number(1.5) == 1.5  # noqa: SLF001
    with pytest.raises(ValueError, match="não finito"):
        assistant_tools._coerce_chart_number(float("inf"))  # noqa: SLF001

    with pytest.raises(ValueError, match="Tipo de relatório desconhecido"):
        assistant_tools.generate_report_pdf(  # noqa: SLF001
            connection,
            report_type="invalid",
            data={"summary": {}},
            period_label="Período",
        )

    assert assistant_tools._build_pdf_titles()["executive"] == "Relatório Executivo"  # noqa: SLF001
    assert "executive" in assistant_tools._build_pdf_renderers()  # noqa: SLF001

    from silo.services import pdf_artifacts as pdf_artifacts_module

    class _FakeRenderer:
        def __init__(self, builders, title_map):  # noqa: ANN001
            self.builders = builders
            self.title_map = title_map

        def render(self, *, report_type, data, period_label):  # noqa: ANN001
            del report_type, data, period_label
            return SimpleNamespace(pdf_bytes=b"%PDF-1.4", generated_at=timestamp, page_count=1)

    class _FakeArtifactStore:
        def __init__(self, upload_kind):  # noqa: ANN001
            self.upload_kind = upload_kind

        def save(self, *, report_type, pdf_bytes, generated_at):  # noqa: ANN001
            del report_type, pdf_bytes, generated_at
            return SimpleNamespace(
                url="/uploads/serve/reports/executive.pdf",
                filename="executive.pdf",
                byte_size=42,
                sha256="sha256:abc",
            )

    monkeypatch.setattr(pdf_artifacts_module, "PdfRenderer", _FakeRenderer)
    monkeypatch.setattr(pdf_artifacts_module, "PdfArtifactStore", _FakeArtifactStore)
    generated_pdf = assistant_tools.generate_report_pdf(  # noqa: SLF001
        connection,
        report_type="executive",
        data={"summary": {"totalProducts": 1}},
        period_label="2026-08-01 a 2026-08-04",
    )
    assert generated_pdf["filename"] == "executive.pdf"
