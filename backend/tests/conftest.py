import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # Rate limiting is time-based global state; reset it around every test
    # so endpoint tests stay deterministic regardless of order or count.
    from main import reset_rate_limits

    reset_rate_limits()
    yield
    reset_rate_limits()