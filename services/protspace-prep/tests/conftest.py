import os
import tempfile

# Set the job root before importing the app, so the module-level create_app()
# call uses a writable directory on developer machines.
os.environ.setdefault(
    "PREP_JOB_ROOT", tempfile.mkdtemp(prefix="protspace-prep-test-")
)

import pytest
from httpx import ASGITransport, AsyncClient

from protspace_prep.app import create_app


@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
