from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator
import os
from uuid import uuid4

import httpx
import pytest


@dataclass
class ApiClients:
    pmi: httpx.Client
    oms: httpx.Client
    wms: httpx.Client

    def close(self) -> None:
        self.pmi.close()
        self.oms.close()
        self.wms.close()


@pytest.fixture(scope="session")
def pmi_api_url() -> str:
    return os.getenv("E2E_PMI_API_URL", "http://localhost:18100")


@pytest.fixture(scope="session")
def oms_api_url() -> str:
    return os.getenv("E2E_OMS_API_URL", "http://localhost:18101")


@pytest.fixture(scope="session")
def wms_api_url() -> str:
    return os.getenv("E2E_WMS_API_URL", "http://localhost:18102")


@pytest.fixture(scope="session")
def web_base_url() -> str:
    return os.getenv("E2E_WEB_BASE_URL", "http://localhost:13103")


@pytest.fixture(scope="session")
def api_clients(pmi_api_url: str, oms_api_url: str, wms_api_url: str) -> Iterator[ApiClients]:
    internal_headers = {"X-API-Key": "oms_wms_internal_api_key_secret_2026"}
    clients = ApiClients(
        pmi=httpx.Client(base_url=pmi_api_url, headers=internal_headers, timeout=httpx.Timeout(60.0, connect=10.0)),
        oms=httpx.Client(base_url=oms_api_url, headers=internal_headers, timeout=httpx.Timeout(60.0, connect=10.0)),
        wms=httpx.Client(base_url=wms_api_url, headers=internal_headers, timeout=httpx.Timeout(60.0, connect=10.0)),
    )
    try:
        yield clients
    finally:
        clients.close()


@pytest.fixture(scope="session")
def e2e_run_id() -> str:
    return uuid4().hex[:8]


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "viewport": {"width": 1440, "height": 1200},
        "ignore_https_errors": True,
    }


@pytest.fixture(autouse=True)
def reset_promotions_db(api_clients):
    from e2e_tests.utils.api_helpers import PMIApi
    pmi_api = PMIApi(api_clients.pmi)
    pmi_api.reset_db()
    yield
    pmi_api.reset_db()


