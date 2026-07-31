"""Unit tests for adaptive threshold calibration (autonomy_engine.calibration)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import pytest

from autonomy_engine import adaptive_calibration as calibration


@pytest.fixture(autouse=True)
def isolated_calibration_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """Isolate calibration IO to a temp directory for every test."""
    cal_file = tmp_path / "action_type_calibration.json"
    monkeypatch.setenv("CALIBRATION_PATH", str(cal_file))
    calibration.reset()
    yield cal_file
    calibration.reset()


def test_initial_load_empty(isolated_calibration_path: Path) -> None:
    assert calibration.snapshot() == {}
    assert not isolated_calibration_path.exists()


def test_record_positive_signals(isolated_calibration_path: Path) -> None:
    for i in range(1, 11):
        entry = calibration.record_signal("single_record_write", positive=True)
        assert entry["confirms_without_modification"] == i
        assert entry["rejects_or_modifications"] == 0

    # 10 net confirms -> offset -1.0
    assert entry["band_offset"] == -1.0

    # File persisted correctly
    data = json.loads(isolated_calibration_path.read_text("utf-8"))
    assert "single_record_write" in data
    assert data["single_record_write"]["band_offset"] == -1.0


def test_record_negative_signals(isolated_calibration_path: Path) -> None:
    for i in range(1, 11):
        entry = calibration.record_signal("bulk_delete", positive=False)

    assert entry["confirms_without_modification"] == 0
    assert entry["rejects_or_modifications"] == 10
    assert entry["band_offset"] == 1.0


def test_below_threshold_has_zero_offset() -> None:
    for _ in range(9):
        calibration.record_signal("read", positive=True)

    entry = calibration.snapshot()["read"]
    assert entry["band_offset"] == 0.0


def test_apply_calibration_shifts_decision_down() -> None:
    for _ in range(10):
        calibration.record_signal("single_record_write", positive=True)

    # confirm -> autonomous
    new_dec, note = calibration.apply_calibration("confirm", "single_record_write")
    assert new_dec == "autonomous"
    assert note is not None
    assert "lowered" in note

    # full_review -> confirm
    new_dec2, note2 = calibration.apply_calibration("full_review", "single_record_write")
    assert new_dec2 == "confirm"
    assert note2 is not None

    # autonomous -> already at lowest level, no change
    new_dec3, note3 = calibration.apply_calibration("autonomous", "single_record_write")
    assert new_dec3 == "autonomous"
    assert note3 is None


def test_apply_calibration_shifts_decision_up() -> None:
    for _ in range(10):
        calibration.record_signal("read", positive=False)

    # autonomous -> confirm
    new_dec, note = calibration.apply_calibration("autonomous", "read")
    assert new_dec == "confirm"
    assert note is not None
    assert "raised" in note

    # confirm -> full_review
    new_dec2, note2 = calibration.apply_calibration("confirm", "read")
    assert new_dec2 == "full_review"
    assert note2 is not None

    # full_review -> already at highest level, no change
    new_dec3, note3 = calibration.apply_calibration("full_review", "read")
    assert new_dec3 == "full_review"
    assert note3 is None


def test_unknown_action_type_unaffected() -> None:
    new_dec, note = calibration.apply_calibration("confirm", "unknown_action")
    assert new_dec == "confirm"
    assert note is None
