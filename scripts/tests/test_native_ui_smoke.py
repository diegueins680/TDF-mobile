import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('native_ui', Path(__file__).parents[1] / 'run-native-ui-smoke.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ResultGateTests(unittest.TestCase):
    def good(self):
        return dict(success=True, numPassedTests=3, numTotalTests=3,
                    numFailedTests=0, numPendingTests=0, numTodoTests=0)

    def test_three_executed_tests_pass(self):
        module.check_results(self.good())

    def test_skipped_failed_missing_or_partial_runs_do_not_pass(self):
        for changed in [dict(success=False), dict(numPendingTests=1), dict(numFailedTests=1),
                        dict(numPassedTests=0, numTotalTests=0), dict(numPassedTests=2),
                        dict(numTotalTests=4), dict(numTodoTests=1)]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                module.check_results(self.good() | changed)
        with self.assertRaises(ValueError):
            module.check_results({})
