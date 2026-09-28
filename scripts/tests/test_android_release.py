import importlib.util
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

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



    def test_signed_bundle_requires_current_api_and_verified_discussion_links(self):
        root = ET.parse(Path(__file__).parents[2] / 'android/app/src/main/AndroidManifest.xml').getroot()
        runtime = json.loads((Path(__file__).parents[2] / 'app.json').read_text())['expo']['runtimeVersion']
        config = {'runtimeVersion': runtime, 'extra': {'apiBase': 'https://api.tdfrecords.net'}}
        runtime_dump = f'0x7f010000 - string/expo_runtime_version\n\t(default) - [STR] \"{runtime}\"\n'
        bundle = b'production https://api.tdfrecords.net'
        release.validate_interaction_release(root, config, bundle, runtime_dump)
        for bad in ({}, {'extra': {'apiBase': 'https://tdf-hq.fly.dev'}}):
            with self.subTest(config=bad), self.assertRaises(ValueError):
                release.validate_interaction_release(root, bad, bundle, runtime_dump)
        for bad in (b'https://tdf-hq.fly.dev', bundle + b'http://127.0.0.1:18128'):
            with self.subTest(bundle=bad), self.assertRaises(ValueError):
                release.validate_interaction_release(root, config, bad, runtime_dump)
        for bad in ('', runtime_dump.replace(runtime, '1.0.1'), runtime_dump + '\t(fr) - [STR] "1.0.0"\n'):
            with self.subTest(runtime=bad), self.assertRaisesRegex(ValueError, 'OTA runtime'):
                release.validate_interaction_release(root, config, bundle, bad)
        with self.assertRaisesRegex(ValueError, 'OTA runtime'):
            release.validate_interaction_release(root, {**config, 'runtimeVersion': '1.0.1'}, bundle, runtime_dump)
        root.find('.//intent-filter[@{http://schemas.android.com/apk/res/android}autoVerify="true"]').set('{http://schemas.android.com/apk/res/android}autoVerify', 'false')
        with self.assertRaises(ValueError):
            release.validate_interaction_release(root, config, bundle, runtime_dump)

if __name__ == '__main__':
    unittest.main()
