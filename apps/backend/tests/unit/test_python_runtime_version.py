import sys

import silo


def test_python_runtime_minor_version_is_313() -> None:
    assert sys.version_info[:2] == (3, 13)


def test_silo_package_imports() -> None:
    assert silo.__doc__
