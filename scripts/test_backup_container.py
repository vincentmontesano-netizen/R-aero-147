import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup_container', Path(__file__).with_name('backup-container.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class ArchiveBoundaryTests(unittest.TestCase):
    def archive(self, name, kind=tarfile.REGTYPE):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        path = Path(temporary.name) / 'test.tar.gz'
        with tarfile.open(path, 'w:gz') as output:
            entry = tarfile.TarInfo(name)
            entry.type = kind
            entry.linkname = '/etc/passwd' if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE) else ''
            entry.size = 3 if kind == tarfile.REGTYPE else 0
            output.addfile(entry, io.BytesIO(b'abc') if entry.size else None)
        return path

    def test_regular_nested_content_is_allowed(self):
        backup.validate_archive(self.archive('./vault/person/document.pdf'))

    def test_absolute_and_parent_paths_are_refused(self):
        for name in ['/etc/passwd', '../escape', 'vault/../../escape']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                backup.validate_archive(self.archive(name))

    def test_links_and_devices_are_refused(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE]:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                backup.validate_archive(self.archive('entry', kind))


if __name__ == '__main__':
    unittest.main()
