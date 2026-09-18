import copy
import datetime
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('signing', Path(__file__).parents[1] / 'ios-signing.py')
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)

class SigningContract(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 9, 18, tzinfo=datetime.timezone.utc)
        self.profile = {'ExpirationDate': datetime.datetime(2027, 1, 1), 'TeamIdentifier': ['83J23NPXG7'], 'Entitlements': {'application-identifier': '83J23NPXG7.com.tdfrecords.app', 'get-task-allow': False}, 'UUID': 'ebc7d007-b938-45ff-af73-8ffd86b4c546', 'DeveloperCertificates': [b'fixture']}

    def test_current_app_store_profile(self):
        self.assertEqual(signing.validate_profile(self.profile, self.now), self.profile['UUID'])

    def test_rejects_expired_wrong_team_wrong_app_and_non_store_profiles(self):
        for field, value in [('ExpirationDate', datetime.datetime(2026, 1, 1)), ('TeamIdentifier', ['ANOTHERTEAM']), ('Entitlements', {'application-identifier': '83J23NPXG7.another.app'}), ('ProvisionedDevices', ['device']), ('ProvisionsAllDevices', True), ('DeveloperCertificates', []), ('UUID', '../profile')]:
            with self.subTest(field=field):
                profile = copy.deepcopy(self.profile)
                profile[field] = value
                with self.assertRaises(ValueError):
                    signing.validate_profile(profile, self.now)

    def test_rejects_debug_entitlement(self):
        self.profile['Entitlements']['get-task-allow'] = True
        with self.assertRaises(ValueError):
            signing.validate_profile(self.profile, self.now)

    def test_build_input_cannot_be_a_path_or_shell_command(self):
        for value in ['', '0', '-1', '23; echo unsafe', '../23', '1\n2', '1234567890']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                signing.validate_build_number(value)
        self.assertEqual(signing.validate_build_number('23'), '23')

if __name__ == '__main__':
    unittest.main()
