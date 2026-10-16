"""WS2 weighed-portion benchmark scorer tests.

Guards scripts/weighed_benchmark.py — the scorer for the M5 weighed-portion
field study. Ground truth is weighed_g only; missing estimates count as
failures, never silently dropped.
"""
import importlib.util
import sys
import textwrap
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"


def load_scorer():
    spec = importlib.util.spec_from_file_location(
        "weighed_benchmark", SCRIPTS_DIR / "weighed_benchmark.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["weighed_benchmark"] = module  # dataclasses need this at exec time
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def wb():
    return load_scorer()


def write_log(tmp_path, body):
    path = tmp_path / "log.csv"
    path.write_text(textwrap.dedent(body).strip() + "\n", encoding="utf-8")
    return str(path)


HEADER = "portion_id,dish,weighed_g,photo_file,est_mass_g,est_carbs_g,catalog_carbs_for_weighed_g,notes,best_carbs_g"


def test_known_mape_values(wb, tmp_path):
    path = write_log(
        tmp_path,
        f"""{HEADER}
        p1,biryani,100,p1.jpg,110,50,55,,52
        p2,daal,200,p2.jpg,180,100,110,,105
        """,
    )
    rows = wb.load_log(path)
    assert len(rows) == 2
    # mass APE: |110-100|/100 = 0.10, |180-200|/200 = 0.10 -> MAPE 10.0%
    assert wb.mean([r.mass_ape for r in rows]) == pytest.approx(0.10)
    # carb APE vs catalog: |50-55|/55, |100-110|/110 -> ~9.09%
    assert wb.mean([r.carb_ape for r in rows]) == pytest.approx(0.0909, abs=1e-4)
    # catalog APE vs best: |55-52|/52, |110-105|/105
    assert wb.mean([r.catalog_ape for r in rows]) == pytest.approx(0.0526, abs=1e-4)
    report = wb.build_report(rows)
    assert "10.0%" in report
    assert "9.1%" in report


def test_missing_estimate_counts_as_failure(wb, tmp_path):
    path = write_log(
        tmp_path,
        f"""{HEADER}
        p1,roti,60,p1.jpg,,30,32,,
        p2,roti,60,p2.jpg,66,30,32,,
        """,
    )
    rows = wb.load_log(path)
    assert rows[0].mass_ape is None  # unscored, not dropped
    assert rows[1].mass_ape == pytest.approx(0.10)
    report = wb.build_report(rows)
    assert "p1" in report  # named in the unscored/failure line
    assert "Unscored rows" in report


def test_missing_column_rejected(wb, tmp_path):
    path = write_log(tmp_path, "portion_id,dish,weighed_g\np1,roti,60\n")
    with pytest.raises(SystemExit):
        wb.load_log(path)
    assert wb.main([path]) == 2


def test_zero_weighed_g_rejected(wb, tmp_path):
    path = write_log(
        tmp_path,
        f"""{HEADER}
        p1,roti,0,p1.jpg,66,30,32,,
        """,
    )
    with pytest.raises(SystemExit):
        wb.load_log(path)


def test_header_only_rejected(wb, tmp_path):
    path = write_log(tmp_path, HEADER + "\n")
    with pytest.raises(SystemExit):
        wb.load_log(path)
    assert wb.main([path]) == 2


def test_failure_gallery_ranks_worst_first(wb, tmp_path):
    path = write_log(
        tmp_path,
        f"""{HEADER}
        p1,biryani,100,good.jpg,102,50,52,,
        p2,nihari,100,bad.jpg,200,90,52,,
        """,
    )
    rows = wb.load_log(path)
    report = wb.build_report(rows)
    assert report.index("bad.jpg") < report.index("good.jpg")


def test_main_writes_report_file(wb, tmp_path):
    log = write_log(
        tmp_path,
        f"""{HEADER}
        p1,biryani,100,p1.jpg,110,50,55,,
        """,
    )
    out = str(tmp_path / "report.md")
    assert wb.main([log, "--out", out]) == 0
    text = Path(out).read_text(encoding="utf-8")
    assert "WS2 weighed-portion benchmark" in text
    assert "10.0%" in text
