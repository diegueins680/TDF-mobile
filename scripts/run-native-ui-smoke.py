#!/usr/bin/env python3
"""Boot an owned CI device and require real Detox results; no store operations."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def run(args, *, timeout=120, env=None):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT,
                                   timeout=timeout, env=env).strip()


def check_results(result):
    if not (result.get('success') is True and result.get('numPassedTests') == 3
            and result.get('numTotalTests') == 3 and result.get('numFailedTests') == 0
            and result.get('numPendingTests') == 0 and result.get('numTodoTests', 0) == 0):
        raise ValueError('Expected exactly three executed, passing UI tests; skips are not a pass')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('platform', choices=['ios', 'android'])
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--initialize', action='store_true')
    args = parser.parse_args()
    out = Path(args.evidence).resolve()
    out.mkdir(parents=True, exist_ok=True)
    receipt = {'scope': 'isolated UI smoke; no backend/provider/hardware qualification',
               'platform': args.platform, 'status': 'failed',
               'source_sha': run(['git', 'rev-parse', 'HEAD']),
               'run_id': os.environ.get('GITHUB_RUN_ID'),
               'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
               'lock_sha256': digest('package-lock.json')}
    if args.initialize:
        receipt['status'] = 'not_run'
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        return
    env = dict(os.environ, TDF_UI_EVIDENCE=str(out))
    owned_device = None
    emulator = None
    logcat = None
    try:
        if os.environ.get('GITHUB_SHA') != receipt['source_sha']:
            raise ValueError('Run only from the exact checked-out GitHub workflow commit')
        # Refuse silent reuse of receipts from an earlier attempt.
        if (out / 'jest.json').exists():
            raise ValueError('Evidence directory already contains a Jest result')
        if args.platform == 'ios':
            inventory = json.loads(run(['xcrun', 'simctl', 'list', '-j']))
            runtimes = [r for r in inventory['runtimes'] if r.get('isAvailable')
                        and r['identifier'].startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
            runtime = max(runtimes, key=lambda r: tuple(map(int, r['version'].split('.'))))
            phones = [d for d in inventory['devicetypes'] if d['name'].startswith('iPhone')]
            model = next((d for d in phones if d['name'] == 'iPhone 16'), phones[-1])
            owned_device = run(['xcrun', 'simctl', 'create', 'TDF-CI-' + env['GITHUB_RUN_ID'],
                                model['identifier'], runtime['identifier']])
            env['TDF_UI_DEVICE'] = owned_device
            receipt['device'] = {'id': owned_device, 'model': model['name'], 'runtime': runtime['identifier']}
            app = Path(env['TDF_UI_APP'])
            receipt['artifacts'] = {str(p): digest(p) for p in [app / 'TDFRecords', app / 'main.jsbundle']}
            run(['xcrun', 'simctl', 'boot', owned_device])
            run(['xcrun', 'simctl', 'bootstatus', owned_device, '-b'], timeout=240)
        else:
            if not os.access('/dev/kvm', os.R_OK | os.W_OK):
                raise ValueError('KVM is unavailable; do not change permissions or use paid fallback')
            sdk = Path(env['ANDROID_HOME'])
            emulator_bin = str(sdk / 'emulator/emulator')
            run([emulator_bin, '-accel-check'])
            image = 'system-images;android-36;default;x86_64'
            receipt['device'] = {'avd': 'tdf-ci', 'image': image, 'serial': 'emulator-5554'}
            for p in ['android/app/build/outputs/apk/release/app-release.apk',
                      'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk']:
                receipt.setdefault('artifacts', {})[p] = digest(p)
            subprocess.run([str(sdk / 'cmdline-tools/latest/bin/avdmanager'), 'create', 'avd',
                            '--name', 'tdf-ci', '--package', image], input='no\n', text=True,
                           check=True, timeout=120, stdout=(out / 'avd.log').open('w'), stderr=subprocess.STDOUT)
            emulator = subprocess.Popen([emulator_bin, '-avd', 'tdf-ci', '-port', '5554',
                '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot', '-gpu', 'swiftshader_indirect'],
                stdout=(out / 'emulator.log').open('w'), stderr=subprocess.STDOUT)
            deadline = time.monotonic() + 240
            while time.monotonic() < deadline:
                if emulator.poll() is not None:
                    raise RuntimeError('Emulator exited before boot')
                try:
                    if run(['adb', '-s', 'emulator-5554', 'shell', 'getprop', 'sys.boot_completed'], timeout=10) == '1':
                        break
                except (subprocess.SubprocessError, OSError):
                    pass
                time.sleep(2)
            else:
                raise TimeoutError('Android did not boot in 240 seconds')
            run(['adb', '-s', 'emulator-5554', 'reverse', 'tcp:18128', 'tcp:18128'])
            logcat = subprocess.Popen(['adb', '-s', 'emulator-5554', 'logcat', '-v', 'threadtime'],
                                     stdout=(out / 'logcat.log').open('w'), stderr=subprocess.STDOUT)
        with (out / 'detox.log').open('w') as log:
            subprocess.run(['node_modules/.bin/detox', 'test', '--config-path', './e2e/ci/detox.config.js',
                            '--configuration', 'ci.' + args.platform, '--headless', '--loglevel', 'verbose'],
                           check=True, timeout=900, env=env, stdout=log, stderr=subprocess.STDOUT)
        result = json.loads((out / 'jest.json').read_text())
        check_results(result)
        receipt['status'] = 'passed'
        receipt['passed_tests'] = result['numPassedTests']
    except Exception as error:
        receipt['error'] = str(error)
        raise
    finally:
        # Capture even when beforeEach fails before Detox's screenshot hook.
        if owned_device:
            try:
                snapshot = subprocess.run(['xcrun', 'simctl', 'io', owned_device,
                    'screenshot', str(out / 'final-screen.png')], timeout=30,
                    check=False, capture_output=True, text=True)
                receipt['final_screenshot_exit'] = snapshot.returncode
            except (subprocess.SubprocessError, OSError) as error:
                receipt['final_screenshot_error'] = str(error)
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        if logcat:
            logcat.terminate()
            logcat.wait(timeout=15)
        if emulator:
            emulator.terminate()
            try:
                emulator.wait(timeout=30)
            except subprocess.TimeoutExpired:
                emulator.kill()
                emulator.wait(timeout=10)
        if owned_device:
            subprocess.run(['xcrun', 'simctl', 'shutdown', owned_device], timeout=30, check=False)
            subprocess.run(['xcrun', 'simctl', 'delete', owned_device], timeout=30, check=False)


if __name__ == '__main__':
    main()
