import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('release', Path(__file__).parents[1] / 'android-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class AndroidReleaseTests(unittest.TestCase):
    def test_version_codes_reject_injection_and_play_overflow(self):
        for value in ['', '0', '-1', '17\n', '1;echo secret', '2100000001']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.build_number(value)
        self.assertEqual(release.build_number('17'), '17')

    def test_actual_gradle_keeps_debug_and_changes_only_release_signing(self):
        source = (Path(__file__).parents[2] / 'android/app/build.gradle').read_text()
        result = release.prepare_gradle(source, '17')
        self.assertEqual(result.count('signingConfig signingConfigs.debug'), 1)
        self.assertEqual(result.count('signingConfig signingConfigs.githubRelease'), 1)
        self.assertIn('versionCode 17', result)
        self.assertIn("applicationId 'com.tdf.records'", result)
        self.assertNotIn('secret-password', result)

    def test_config_drift_stops_before_silent_debug_signing(self):
        with self.assertRaises(ValueError):
            release.prepare_gradle('versionCode 9', '17')


if __name__ == '__main__':
    unittest.main()
