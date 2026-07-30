"""Share WMS database/client fixtures with tests both inside and beside tests/."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from tests.conftest import *  # noqa: F401,F403
