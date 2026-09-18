"""Prepare and verify a release using the existing Play upload certificate."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile


def build_number(value):
    if not re.fullmatch(r'[1-9][0-9]{0,9}', value) or int(value) > 2100000000:
        raise ValueError('Invalid Android version code')
    return value


def prepare_gradle(source, number):
    number = build_number(number)
    if source.count('versionCode 8') != 1 or source.count('signingConfig signingConfigs.debug') != 2:
        raise ValueError('Native release configuration changed; review before signing')
    source = source.replace('versionCode 8', 'versionCode ' + number)
    marker = '    signingConfigs {\n'
    if source.count(marker) != 1:
        raise ValueError('Ambiguous signing configuration')
    source = source.replace(marker, marker + '''        githubRelease {
            storeFile file(System.getenv('TDF_ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('TDF_ANDROID_STORE_PASSWORD')
            keyAlias System.getenv('TDF_ANDROID_KEY_ALIAS')
            keyPassword System.getenv('TDF_ANDROID_KEY_PASSWORD')
        }
''')
    before, release = source.split('        release {', 1)
    return before + '        release {' + release.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.githubRelease', 1)


def certificate_sha(args):
    output = subprocess.run(['keytool', *args], check=True, capture_output=True).stdout
    pem = re.search(rb'-----BEGIN CERTIFICATE-----\s*(.*?)\s*-----END CERTIFICATE-----', output, re.S)
    if not pem:
        raise ValueError('Certificate missing')
    return hashlib.sha256(base64.b64decode(pem[1])).hexdigest()


def prepare():
    number = build_number(os.environ['ANDROID_VERSION_CODE'])
    target = Path(os.environ['TDF_ANDROID_KEYSTORE_PATH'])
    target.write_bytes(base64.b64decode(os.environ['TDF_ANDROID_KEYSTORE_BASE64'], validate=True))
    target.chmod(0o600)
    actual = certificate_sha(['-exportcert', '-rfc', '-keystore', str(target), '-storepass:env', 'TDF_ANDROID_STORE_PASSWORD', '-alias', os.environ['TDF_ANDROID_KEY_ALIAS']])
    if actual != os.environ['TDF_ANDROID_CERT_SHA256']:
        raise ValueError('Upload certificate mismatch')
    gradle = Path('android/app/build.gradle')
    gradle.write_text(prepare_gradle(gradle.read_text(), number))


def verify():
    aab = Path('android/app/build/outputs/bundle/release/app-release.aab')
    subprocess.run(['jarsigner', '-verify', str(aab)], check=True, capture_output=True)
    actual = certificate_sha(['-printcert', '-rfc', '-jarfile', str(aab)])
    if actual != os.environ['TDF_ANDROID_CERT_SHA256']:
        raise ValueError('Artifact upload certificate mismatch')
    tool = os.environ['BUNDLETOOL_PATH']
    manifest = subprocess.run(['java', '-jar', tool, 'dump', 'manifest', '--bundle=' + str(aab), '--module=base'], check=True, capture_output=True).stdout
    root = ET.fromstring(manifest)
    android = '{http://schemas.android.com/apk/res/android}'
    version = json.loads(Path('package.json').read_text())['version']
    assert root.get('package') == 'com.tdf.records', 'Wrong package'
    assert root.get(android + 'versionCode') == os.environ['ANDROID_VERSION_CODE'], 'Wrong version code'
    assert root.get(android + 'versionName') == version, 'Wrong version'
    assert root.find('application').get(android + 'debuggable') != 'true', 'Debuggable release'
    with zipfile.ZipFile(aab) as archive:
        assert archive.testzip() is None, 'Corrupt archive'
        config = json.loads(archive.read('base/assets/app.config'))
        assert config['extra']['apiBase'] == 'https://tdf-hq.fly.dev', 'Wrong embedded API'
        bundle = archive.read('base/assets/index.android.bundle')
        assert b'https://tdf-hq.fly.dev' in bundle and b'127.0.0.1:18631' not in bundle, 'Wrong bundled API'
    output = Path('release-artifacts')
    output.mkdir(exist_ok=True)
    receipt = {'sourceSHA': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'], 'package': 'com.tdf.records', 'version': version, 'build': os.environ['ANDROID_VERSION_CODE'], 'sha256': hashlib.file_digest(aab.open('rb'), 'sha256').hexdigest(), 'bytes': aab.stat().st_size, 'certificateSHA256': actual, 'signatureVerified': True, 'embeddedProductionAPI': True, 'publication': 'not uploaded or submitted'}
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    aab.rename(output / 'TDFRecords.aab')
    print(json.dumps(receipt))


if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify}[sys.argv[1]]()
