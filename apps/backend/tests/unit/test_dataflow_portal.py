from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from silo.domain.dataflow import ecflow_kafka, pert
from silo.domain.dataflow.ecflow_kafka import parse_ecflow_kafka_pipelines
from silo.domain.dataflow.helpers import (
    clamp_progress,
    normalize_data_flow_reference_key,
    normalize_model_key,
    normalize_product_status,
)
from silo.domain.dataflow.pert import build_pert_graph_from_groups
from silo.services import dataflow_portal
from silo.services.dataflow_portal import (
    get_monitoring_products_from_kafka_rest_sync,
    get_product_data_flow_pipelines_from_kafka_rest_sync,
)


def _smna_ecflow_payload() -> dict[str, object]:
    return {
        "kind": "suite",
        "name": "SMNA_PRE_OPER",
        "date": "2026-05-13",
        "turn": "PRE_OPER",
        "node_state": "queued",
        "groups": [
            {
                "kind": "family",
                "name": "00",
                "id": "SMNA_00_2026-05-13",
                "date": "2026-05-13",
                "turn": "00",
                "node_state": "complete",
                "tasks": [
                    {
                        "kind": "task",
                        "id": "download_gfs_025",
                        "name": "Download GFS 0.25",
                        "state": "complete",
                        "plannedStartAt": "2026-05-13T00:00:00Z",
                        "plannedEndAt": "2026-05-13T00:30:00Z",
                        "startedAt": "2026-05-13T00:00:00Z",
                        "finishedAt": "2026-05-13T00:30:00Z",
                        "referenceDurationMinutes": 30,
                    },
                ],
            },
        ],
    }


def test_dataflow_normalization_helpers_match_expected_contract() -> None:
    assert normalize_model_key("BRAMS AMS 15KM") == "brams-ams-15km"
    assert (
        normalize_data_flow_reference_key("/suite/ingestion/download_gfs_025_2026-03-06")
        == "ingestion_download_gfs_025"
    )
    assert normalize_product_status("completed") == "completed"
    assert normalize_product_status("running") == "in_progress"
    assert clamp_progress(None, "completed") == 100
    assert clamp_progress(None, "in_progress") == 50
    assert clamp_progress(None, "pending") == 0


def test_parse_ecflow_tree_and_build_pert_graph() -> None:
    sample_tree = {
        "kind": "suite",
        "name": "BSM",
        "id": "suite_bsm_2026-03-06_18",
        "turn": "18",
        "date": "2026-03-06",
        "groups": [
            {
                "kind": "family",
                "name": "Ingestao de dados",
                "id": "ingestion_2026-03-06_18",
                "turn": "18",
                "date": "2026-03-06",
                "tasks": [
                    {
                        "id": "download_gfs_025",
                        "name": "Download GFS 0.25",
                        "status": "completed",
                        "progress": 100,
                        "dependencies": [],
                        "type": "task",
                    },
                    {
                        "id": "download_ecmwf_hres",
                        "name": "Download ECMWF HRES",
                        "status": "completed",
                        "progress": 100,
                        "dependencies": [],
                        "type": "task",
                    },
                ],
            }
        ],
    }

    pipelines = parse_ecflow_kafka_pipelines(sample_tree, "bsm")
    assert len(pipelines) == 1
    pipeline = pipelines[0]
    assert pipeline["model"] == "bsm"
    assert pipeline["status"] == "completed"
    assert pipeline["groups"][0]["tasks"][0]["progress"] == 100

    graph = build_pert_graph_from_groups(
        pipeline["groups"],
        {"model": pipeline["model"], "date": pipeline["date"], "turn": pipeline["turn"]},
    )
    assert graph["summary"]["total"] == 2
    assert graph["summary"]["successRate"] == 100
    assert len(graph["lanes"]) == 1
    assert len(graph["edges"]) == 0


def test_kafka_rest_uses_shared_smna_feed_before_local_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        dataflow_portal,
        "load_kafka_rest_config",
        lambda: SimpleNamespace(
            use_mock_data=True,
            rest_proxy_url="",
            dataflow_topic_prefix="topics-",
            group_id="group-1",
        ),
    )

    async def _fake_fetch_shared_smna_ecflow_tree_root() -> object:
        return _smna_ecflow_payload()

    monkeypatch.setattr(
        dataflow_portal,
        "_fetch_shared_smna_ecflow_tree_root",
        _fake_fetch_shared_smna_ecflow_tree_root,
    )
    monkeypatch.setattr(
        dataflow_portal,
        "_load_pipeline_data",
        lambda: (_ for _ in ()).throw(AssertionError("local fallback should not run")),
    )

    pipelines = get_product_data_flow_pipelines_from_kafka_rest_sync(slug="bam")
    assert len(pipelines) == 1
    assert pipelines[0]["date"] == "2026-05-13"
    assert pipelines[0]["turn"] == "00"
    assert pipelines[0]["model"] == "bam"
    assert pipelines[0]["status"] == "completed"
    assert pipelines[0]["groups"][0]["tasks"][0]["progress"] == 100


def test_kafka_rest_falls_back_to_legacy_pipeline_data(monkeypatch) -> None:
    monkeypatch.setattr(
        dataflow_portal,
        "load_kafka_rest_config",
        lambda: SimpleNamespace(
            use_mock_data=True,
            rest_proxy_url="",
            dataflow_topic_prefix="topics-",
            group_id="group-1",
        ),
    )

    async def _missing_shared_smna_ecflow_tree_root() -> object | None:
        return None

    monkeypatch.setattr(
        dataflow_portal,
        "_fetch_shared_smna_ecflow_tree_root",
        _missing_shared_smna_ecflow_tree_root,
    )

    pipelines = get_product_data_flow_pipelines_from_kafka_rest_sync(slug="bsm")
    assert len(pipelines) >= 1
    assert pipelines[0]["date"] == "2026-03-06"
    assert pipelines[0]["turn"] == "18"
    assert pipelines[0]["model"] == "bsm"


def test_monitoring_fallback_uses_seed_products(monkeypatch) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")

    monitoring = get_monitoring_products_from_kafka_rest_sync([{"slug": "bam", "name": "BAM"}])
    assert monitoring["referenceDate"] == "2026-03-06"
    assert monitoring["products"][0]["productId"] == "bam"
    assert monitoring["products"][0]["turns"][0]["status"] == "completed"


def test_ecflow_kafka_helpers_cover_recursive_and_validation_branches() -> None:
    grouped_file = {
        "pipelines": [
            {
                "model": "bsm",
                "date": "2026-03-06",
                "turn": "18",
                "groups": [{"tasks": [{"id": "task-a"}]}],
            },
            {
                "model": "bsm",
                "date": "2026-03-05",
                "turn": "06",
                "groups": [{"tasks": [{"id": "task-b"}]}],
            },
        ]
    }
    ecflow_tree = {
        "kind": "suite",
        "name": "BSM_PRE_OPER",
        "id": "suite_2026-03-06_18",
        "turn": "18",
        "date": "2026-03-06",
        "groups": [
            {
                "kind": "family",
                "name": "Ingestao",
                "id": "ingestao_2026-03-06_18",
                "turn": "18",
                "date": "2026-03-06",
                "tasks": [
                    {
                        "id": "download_gfs_025",
                        "name": "Download GFS 0.25",
                        "status": "completed",
                        "progress": 100,
                        "dependencies": ["  "],
                        "type": "task",
                        "referenceDurationMinutes": True,
                        "startedAt": "2026-03-06T00:00:00Z",
                    }
                ],
                "groups": [
                    {
                        "kind": "family",
                        "name": "Modelagem",
                        "id": "modelagem_2026-03-06_18",
                        "turn": "18",
                        "date": "2026-03-06",
                        "tasks": [
                            {
                                "id": "model_run",
                                "name": "Model run",
                                "state": "running",
                                "progress": 50,
                                "dependencies": ["download_gfs_025"],
                                "plannedStartAt": "2026-03-06T00:15:00Z",
                                "finishedAt": "2026-03-06T00:45:00Z",
                                "delayMinutes": 6,
                                "isDelayed": False,
                            }
                        ],
                    }
                ],
            }
        ],
    }

    assert ecflow_kafka._is_grouped_pipeline_data(grouped_file) is True
    assert ecflow_kafka._is_grouped_pipeline_data_file(grouped_file) is True
    assert ecflow_kafka._is_grouped_pipeline_data_item(grouped_file["pipelines"][0]) is True
    assert ecflow_kafka._is_ecflow_node(ecflow_tree) is True
    assert ecflow_kafka._is_ecflow_tree_root(ecflow_tree) is True
    assert ecflow_kafka._resolve_model_slug(ecflow_tree) == "bsm"
    assert ecflow_kafka._resolve_model_slug(ecflow_tree, "smec") == "smec"
    assert ecflow_kafka._extract_date_from_identifier("suite_2026-03-06_18") == "2026-03-06"
    assert ecflow_kafka._extract_turn_from_identifier("family_18_2026-03-05") == "18"
    assert ecflow_kafka._find_ancestor_date([{"id": "family_2026-03-05_06"}]) == "2026-03-05"
    assert (
        ecflow_kafka._resolve_execution_date(
            {"id": "task_2026-03-06_18"}, [{"id": "family_2026-03-05_06"}]
        )
        == "2026-03-06"
    )
    assert ecflow_kafka._resolve_execution_turn({"id": "task_18_2026-03-06"}) == "18"
    assert ecflow_kafka._child_nodes({"groups": [{"id": "child"}]}) == [{"id": "child"}]
    assert ecflow_kafka._task_nodes({"tasks": [{"id": "task"}]}) == [{"id": "task"}]
    assert ecflow_kafka._stable_dependencies(["a", " ", 1, None, "b"]) == ["a", "b"]
    assert ecflow_kafka._to_valid_date_string("2026-03-06T12:00:00Z") == "2026-03-06T12:00:00Z"
    assert ecflow_kafka._to_valid_date_string("bad") is None
    assert ecflow_kafka._add_minutes_iso("2026-03-06T12:00:00Z", 15) == "2026-03-06T12:15:00Z"
    assert ecflow_kafka._now_iso_string().endswith("Z")
    assert ecflow_kafka._number_value(True) is None
    assert ecflow_kafka._number_value(1.5) == 1.5
    assert ecflow_kafka._parse_turn("18") == 18.0
    assert ecflow_kafka._parse_turn("invalid") == float("-inf")
    assert ecflow_kafka._sort_pipelines(grouped_file["pipelines"])[0]["date"] == "2026-03-06"
    assert ecflow_kafka._stable_pipeline_sort_key(grouped_file["pipelines"][0]) == (
        "2026-03-06",
        18.0,
    )

    parsed_file = parse_ecflow_kafka_pipelines(grouped_file)
    parsed_list = parse_ecflow_kafka_pipelines(grouped_file["pipelines"])
    assert parsed_file[0]["turn"] == "18"
    assert parsed_list[1]["turn"] == "06"

    assert ecflow_kafka._collect_task_groups(ecflow_tree["groups"][0], [])
    assert (
        ecflow_kafka._map_task_node_to_data_flow_task(
            ecflow_tree["groups"][0]["tasks"][0], ecflow_tree["groups"][0]
        )["isDelayed"]
        is False
    )
    assert (
        ecflow_kafka._derive_pipeline_status(
            [{"tasks": [{"status": "completed"}, {"status": "with_problems"}]}]
        )
        == "with_problems"
    )
    assert ecflow_kafka._resolve_execution_date(ecflow_tree["groups"][0], []) == "2026-03-06"


def test_pert_helpers_cover_schedule_and_blocking_branches() -> None:
    acyclic_nodes = [
        {"id": "a", "name": "Download", "durationMinutes": 10, "status": "completed"},
        {"id": "b", "name": "QC", "durationMinutes": True, "status": "with_problems"},
        {"id": "c", "name": "WRF", "durationMinutes": 0, "status": "pending"},
    ]
    cyclic_nodes = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    edges = [{"source": "a", "target": "b"}, {"source": "b", "target": "c"}]

    cycle_sort = pert.topo_sort(
        cyclic_nodes,
        [
            {"source": "a", "target": "b"},
            {"source": "b", "target": "c"},
            {"source": "c", "target": "a"},
        ],
    )
    assert cycle_sort["order"] == []
    assert set(cycle_sort["leftover"]) == {"a", "b", "c"}

    pert.apply_pert_schedule(acyclic_nodes, edges)
    assert acyclic_nodes[0]["esMinutes"] == 0
    assert acyclic_nodes[0]["efMinutes"] == 10
    assert acyclic_nodes[1]["esMinutes"] == 10
    assert acyclic_nodes[1]["efMinutes"] == 15
    assert acyclic_nodes[2]["esMinutes"] == 15
    assert acyclic_nodes[2]["lfMinutes"] == 20
    assert acyclic_nodes[2]["isCritical"] is True

    groups = [
        {
            "id": "lane-ingest",
            "name": "Ingestao",
            "tasks": [
                {
                    "id": "task-a",
                    "name": "Download",
                    "status": "completed",
                    "progress": 100,
                    "dependencies": [],
                    "referenceDurationMinutes": 10,
                },
                {
                    "id": "task-b",
                    "name": "QC",
                    "status": "with_problems",
                    "progress": 50,
                    "dependencies": ["task-a"],
                    "referenceDurationMinutes": 5,
                },
            ],
        },
        {
            "id": "lane-model",
            "name": "Modelo",
            "tasks": [
                {
                    "id": "task-c",
                    "name": "Run",
                    "status": "pending",
                    "progress": 0,
                    "dependencies": ["task-b"],
                    "referenceDurationMinutes": 5,
                },
            ],
        },
    ]
    graph = build_pert_graph_from_groups(
        groups, {"model": "bsm", "date": "2026-03-06", "turn": "18"}
    )
    assert graph["summary"]["total"] == 3
    assert graph["summary"]["failedTaskIds"] == ["task-b"]
    assert "task-c" in graph["summary"]["affectedTaskIds"]
    assert graph["edges"][1]["isBlocked"] is True
    assert graph["lanes"][0]["iconToken"] == "ingestion"
    assert graph["lanes"][1]["iconToken"] == "model"

    assert pert._task_list({"tasks": "nope"}) == []
    assert pert._dependency_list({"dependencies": [" a ", "", 1]}) == ["a"]
    assert pert._duration_minutes({"referenceDurationMinutes": True}) == 0
    assert pert._duration_minutes({"referenceDurationMinutes": 12}) == 12
    assert pert._duration_from_iso("2026-03-06T12:00:00Z", "2026-03-06T12:30:00Z") == 30
    assert pert._duration_from_iso("bad", "2026-03-06T12:30:00Z") == 0
    assert pert._effective_duration({"durationMinutes": True}) == pert.DEFAULT_QUEUED_DURATION_MIN
    assert pert._pick_icon_token("qc") == "preprocess"
    assert pert._pick_icon_token("wrf") == "model"
    assert pert._pick_icon_token("post") == "postprocess"
    assert pert._pick_icon_token("distrib") == "distribution"
    assert pert._pick_icon_token("control") == "verification"
    assert pert._read_text(3.5) == "3.5"
    assert pert._read_text(False) is None


@pytest.mark.asyncio
async def test_dataflow_portal_live_helpers_and_cancelled_delete(monkeypatch) -> None:
    monkeypatch.setattr(
        dataflow_portal,
        "load_kafka_rest_config",
        lambda: SimpleNamespace(
            use_mock_data=False,
            rest_proxy_url="http://kafka-rest.test",
            dataflow_topic_prefix="topics-",
            group_id="group-1",
        ),
    )

    pipelines = [
        {
            "model": "bsm",
            "date": "2026-03-06",
            "turn": "18",
            "groups": [{"tasks": [{"progress": 100}, {"progress": 50}]}],
        },
        {
            "model": "bsm",
            "date": "2026-03-06",
            "turn": "06",
            "groups": [{"tasks": [{"progress": 0}, {"progress": 50}]}],
        },
    ]

    async def _fake_fetch_live_data_flow_pipelines(slug, *, config=None):
        del config
        return pipelines if slug == "bsm" else []

    monkeypatch.setattr(
        dataflow_portal,
        "_fetch_live_data_flow_pipelines",
        _fake_fetch_live_data_flow_pipelines,
    )

    filtered = await dataflow_portal.get_product_data_flow_pipelines_from_kafka_rest(
        slug="bsm",
        date="2026-03-06",
        turn="18",
    )
    assert len(filtered) == 1
    assert filtered[0]["turn"] == "18"

    monitoring = await dataflow_portal.get_monitoring_products_from_kafka_rest(
        [{"slug": "bsm", "name": "BSM"}]
    )
    assert monitoring["referenceDate"] == "2026-03-06"
    assert monitoring["products"][0]["productId"] == "bsm"
    assert monitoring["products"][0]["turns"][0]["progress"] == 75

    assert dataflow_portal._pipeline_progress({"groups": []}) == 0
    assert (
        dataflow_portal._pipeline_to_monitoring_product(
            {"slug": "bsm", "name": "BSM"},
            pipelines,
        )["turns"][0]["progress"]
        == 75
    )
    assert dataflow_portal._to_parsed_json_value('{"hello": "world"}') == {"hello": "world"}
    assert dataflow_portal._parse_turn("06") == 6.0
    assert dataflow_portal._parse_turn("invalid") == float("-inf")

    class _FakeClient:
        def __init__(self) -> None:
            self.deleted = False

        async def delete_rest_consumer(self, _instance) -> None:
            self.deleted = True
            raise asyncio.CancelledError()

    client = _FakeClient()
    await dataflow_portal._best_effort_delete_consumer(client, SimpleNamespace())
    assert client.deleted is True
