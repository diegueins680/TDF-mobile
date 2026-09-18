#!/usr/bin/env python3
"""Check the exported application, not just xcodebuild's exit status."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import zipfile


def main():
    directory = Path(sys.argv[1])
    ipas = list(directory.glob('*.ipa'))
    if len(ipas) != 1:
        raise ValueError('Expected exactly one exported IPA')
    ipa = ipas[0]
    with tempfile.TemporaryDirectory(prefix='tdf-ios-verify-', dir=os.environ['RUNNER_TEMP']) as temp:
        with zipfile.ZipFile(ipa) as archive:
            for entry in archive.namelist():
                if entry.startswith('/') or '..' in Path(entry).parts:
                    raise ValueError('Unsafe IPA entry')
            archive.extractall(temp)
        apps = list((Path(temp) / 'Payload').glob('*.app'))
        if len(apps) != 1:
            raise ValueError('Expected one application in IPA')
        app = apps[0]
        info = plistlib.loads((app / 'Info.plist').read_bytes())
        expected_version = json.loads(Path('package.json').read_text())['version']
        assert info['CFBundleIdentifier'] == 'com.tdfrecords.app', 'Wrong bundle identifier'
        assert info['CFBundleShortVersionString'] == expected_version, 'Wrong app version'
        assert info['CFBundleVersion'] == os.environ['IOS_BUILD_NUMBER'], 'Wrong build number'
        assert int(info['DTSDKName'].removeprefix('iphoneos').split('.')[0]) >= 26, 'iOS SDK is too old'
        schemes = {s for row in info.get('CFBundleURLTypes', []) for s in row.get('CFBundleURLSchemes', [])}
        assert 'tdf' in schemes and os.environ['GOOGLE_IOS_URL_SCHEME'] in schemes, 'Missing existing deep-link/OAuth scheme'
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
        profile = plistlib.loads(subprocess.run(['security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')], capture_output=True, check=True).stdout)
        assert profile['Entitlements']['application-identifier'] == '83J23NPXG7.com.tdfrecords.app', 'Wrong profile app'
        assert not profile['Entitlements'].get('get-task-allow'), 'Development signing is not an App Store release'
        config_files = list(app.rglob('app.config'))
        configs = [json.loads(p.read_text()) for p in config_files]
        assert any(c.get('extra', {}).get('apiBase') == 'https://tdf-hq.fly.dev' for c in configs), 'Production API missing from embedded Expo config'
        receipt = {'sourceSHA': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'], 'runAttempt': os.environ['GITHUB_RUN_ATTEMPT'], 'bundleIdentifier': info['CFBundleIdentifier'], 'version': expected_version, 'build': info['CFBundleVersion'], 'sdk': info['DTSDKName'], 'xcode': info.get('DTXcode'), 'artifact': ipa.name, 'bytes': ipa.stat().st_size, 'sha256': hashlib.file_digest(ipa.open('rb'), 'sha256').hexdigest(), 'signatureVerified': True, 'embeddedProductionAPI': True, 'publication': 'not uploaded or submitted', 'physicalGoogleOAuth': 'required separately before production'}
        (directory / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps(receipt))


if __name__ == '__main__':
    main()
