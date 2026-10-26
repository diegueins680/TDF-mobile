import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class AudioRuntimeTests(unittest.TestCase):
    def test_rejects_a_consistent_old_runtime_that_lacks_the_native_picker(self):
        source = Path(__file__).parents[2]
        with tempfile.TemporaryDirectory(prefix='tdf-audio-runtime-') as tmp:
            root = Path(tmp) / 'app'
            shutil.copytree(source, root, ignore=shutil.ignore_patterns(
                '.git', 'node_modules', '.expo', 'Pods', '.gradle', 'build', 'dist', '__pycache__'))
            for name in ['app.json', 'ios/TDFRecords/Supporting/Expo.plist',
                         'android/app/src/main/res/values/strings.xml']:
                p = root / name
                p.write_text(p.read_text().replace('1.0.1-interactions-audio.1', '1.0.1-interactions.1'))
            env = {k: v for k, v in os.environ.items() if not k.startswith(('EXPO_PUBLIC_', 'EAS_BUILD_PROFILE'))}
            result = subprocess.run(['node', str(root / 'scripts/release-check.mjs')],
                                    env=env, capture_output=True, text=True, timeout=20)
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn('OTA runtime', result.stderr)


if __name__ == '__main__':
    unittest.main()
