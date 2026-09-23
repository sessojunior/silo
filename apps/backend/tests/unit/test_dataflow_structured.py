from copy import deepcopy

import pytest

from silo.domain.dataflow.ecflow_kafka import parse_ecflow_kafka_pipelines


@pytest.mark.parametrize("wrapped", [False, True])
def test_structured_pipelines_preserve_task_times_and_model(wrapped: bool) -> None:
    pipeline = {
        "model": "bam",
        "date": "2026-09-21",
        "turn": "00",
        "groups": [
            {
                "tasks": [
                    {
                        "id": "download",
                        "start": "2026-09-21T00:00:00Z",
                        "end": "2026-09-21T00:30:00Z",
                        "progress": 100,
                    }
                ]
            }
        ],
    }
    original = deepcopy(pipeline)
    payload = {"pipelines": [pipeline]} if wrapped else [pipeline]

    result = parse_ecflow_kafka_pipelines(payload, "different-fallback")

    assert result == [original]
    assert pipeline == original


def test_structured_pipelines_retain_empty_groups_and_sort_turns() -> None:
    pipelines = [
        {"model": "bam", "date": "2026-09-21", "turn": "06", "groups": []},
        {"model": "bam", "date": "2026-09-20", "turn": "18", "groups": []},
        {"model": "bam", "date": "2026-09-21", "turn": "12", "groups": []},
    ]

    result = parse_ecflow_kafka_pipelines(pipelines)

    assert [(item["date"], item["turn"]) for item in result] == [
        ("2026-09-21", "12"),
        ("2026-09-21", "06"),
        ("2026-09-20", "18"),
    ]


def test_lists_of_pipeline_files_are_flattened() -> None:
    pipeline = {"model": "bam", "date": "2026-09-21", "turn": "00", "groups": []}

    assert parse_ecflow_kafka_pipelines([{"pipelines": [pipeline]}]) == [pipeline]
