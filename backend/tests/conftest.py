import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from main import reset_analysis_tasks, reset_rate_limits
    from services.gemini_service import reset_analysis_cache

    reset_rate_limits()
    reset_analysis_tasks()
    reset_analysis_cache()
    yield
    reset_rate_limits()
    reset_analysis_tasks()
    reset_analysis_cache()


@pytest.fixture
def poll_analysis():
    def poll(client, submission):
        assert submission.status_code == 202
        task_id = submission.json()["task_id"]
        for _ in range(200):
            response = client.get(f"/api/analyze/status/{task_id}")
            if response.status_code != 200 or response.json()["status"] != "processing":
                return response
            time.sleep(0.01)
        pytest.fail("Analysis task did not finish within the test timeout.")

    return poll