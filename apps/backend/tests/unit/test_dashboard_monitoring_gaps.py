"""Testes focados para Visao Geral, Monitoramento, Produtos e Tasks."""

from __future__ import annotations

import json
from datetime import date, datetime
from types import SimpleNamespace

import pytest

from silo.services.dashboard_portal import _day_index


# ============================================================
# dashboard — _day_index
# ============================================================

class TestDayIndex:
    REF = date(2026, 7, 1)

    def test_datetime_in_range(self):
        assert _day_index(self.REF, datetime(2026, 7, 5, 12, 0)) == 4

    def test_date_in_range(self):
        assert _day_index(self.REF, date(2026, 7, 5)) == 4

    def test_iso_string(self):
        assert _day_index(self.REF, "2026-07-05T12:00:00") == 4

    def test_empty_string(self):
        assert _day_index(self.REF, "") is None

    def test_whitespace_string(self):
        assert _day_index(self.REF, "   ") is None

    def test_invalid_string(self):
        assert _day_index(self.REF, "garbage") is None

    def test_out_of_range(self):
        assert _day_index(self.REF, "2025-01-01") is None

    def test_none_value(self):
        assert _day_index(self.REF, None) is None

    def test_int_value(self):
        assert _day_index(self.REF, 42) is None

    def test_bool_value(self):
        assert _day_index(self.REF, True) is None


# ============================================================
# monitoring_data — funcoes auxiliares
# ============================================================

class TestMonitoringHelpers:
    def test_parse_datetimeish_datetime(self):
        from silo.services.monitoring_data import _parse_datetimeish
        dt = datetime(2026, 3, 6, 10, 0)
        assert _parse_datetimeish(dt) == dt

    def test_parse_datetimeish_string(self):
        from silo.services.monitoring_data import _parse_datetimeish
        result = _parse_datetimeish("2026-03-06T10:00:00")
        assert isinstance(result, datetime)

    def test_parse_datetimeish_none(self):
        from silo.services.monitoring_data import _parse_datetimeish
        assert _parse_datetimeish(None) is None

    def test_parse_datetimeish_empty(self):
        from silo.services.monitoring_data import _parse_datetimeish
        assert _parse_datetimeish("") is None


class TestUpsertRadarValidation:
    def test_missing_id_raises(self):
        from silo.services.monitoring_data import upsert_radar
        with pytest.raises((ValueError, TypeError)):
            upsert_radar(None, {})


class MagicTable:
    def __init__(self, rows):
        self.c = MagicColumns()
        self._rows = rows

    def select(self):
        return self

    def where(self, *a, **kw):
        return self


class MagicColumns:
    pass


class _FakeConn:
    def execute(self, *a, **kw):
        class Result:
            def mappings(self):
                return self
            def first(self):
                return None
            def all(self):
                return []
            def scalar_one_or_none(self):
                return None
        return Result()


# ============================================================
# tasks — post_users validation
# ============================================================

class TestTasksValidation:
    @pytest.mark.asyncio
    async def test_missing_user_ids(self, monkeypatch: pytest.MonkeyPatch):
        from silo.api.routers import tasks as tasks_router

        monkeypatch.setattr(tasks_router, "require_permission", lambda *a, **kw: _fake_dep)
        monkeypatch.setattr(tasks_router, "get_db", lambda: MagicMock())
        monkeypatch.setattr(tasks_router, "set_task_users", lambda *a, **kw: {"success": True, "data": {}})

        result = await tasks_router.post_users(
            taskId="t1",
            payload={"role": "viewer"},
            _current_user=SimpleNamespace(id="u1"),
        )
        payload = json.loads(result.body)
        assert payload["success"] is False
        assert "obrigatórios" in str(payload.get("error", ""))

    @pytest.mark.asyncio
    async def test_empty_user_ids_list(self, monkeypatch: pytest.MonkeyPatch):
        from silo.api.routers import tasks as tasks_router

        monkeypatch.setattr(tasks_router, "require_permission", lambda *a, **kw: _fake_dep)
        monkeypatch.setattr(tasks_router, "get_db", lambda: MagicMock())
        monkeypatch.setattr(tasks_router, "set_task_users", lambda *a, **kw: {"success": True, "data": {}})

        result = await tasks_router.post_users(
            taskId="t1",
            payload={"userIds": ["", "  "], "role": "viewer"},
            _current_user=SimpleNamespace(id="u1"),
        )
        payload = json.loads(result.body)
        assert payload["success"] is False

    @pytest.mark.asyncio
    async def test_valid_user_ids(self, monkeypatch: pytest.MonkeyPatch):
        from silo.api.routers import tasks as tasks_router

        monkeypatch.setattr(tasks_router, "require_permission", lambda *a, **kw: _fake_dep)
        monkeypatch.setattr(tasks_router, "get_db", lambda: MagicMock())
        monkeypatch.setattr(tasks_router, "set_task_users", lambda *a, **kw: {"success": True, "data": {}})

        result = await tasks_router.post_users(
            taskId="t1",
            payload={"userIds": ["u1", "u2"], "role": "viewer"},
            _current_user=SimpleNamespace(id="u1"),
        )
        if hasattr(result, 'body'):
            payload = json.loads(result.body)
        else:
            payload = result
        assert payload["success"] is True


async def _fake_dep():
    return SimpleNamespace(id="u1")


class MagicMock:
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def connect(self): return self
    def begin(self): return self
    def execute(self, *a, **kw): return self
    def __getattr__(self, name): return MagicMock()
