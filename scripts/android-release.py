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



def validate_interaction_release(root, config, bundle, runtime_dump):
    android = '{http://schemas.android.com/apk/res/android}'
    runtime = json.loads((Path(__file__).parents[1] / 'app.json').read_text())['expo']['runtimeVersion']
    values = re.findall(r'\[STR\] "([^"\n]+)"', runtime_dump)
    resource = re.search(r'(0x[0-9a-fA-F]+) - string/expo_runtime_version', runtime_dump)
    metadata = root.find(".//meta-data[@" + android + "name='expo.modules.updates.EXPO_RUNTIME_VERSION']")
    allowed = {'@string/expo_runtime_version', runtime}
    if resource:
        allowed.add('@' + resource[1])
    if (config.get('runtimeVersion') != runtime or not values or any(value != runtime for value in values)
            or metadata is None or metadata.get(android + 'value') not in allowed):
        raise ValueError('Wrong OTA runtime in compiled Android resources or embedded Expo config')
    expected = {(host, route) for host in ('www.tdfrecords.net', 'tdf-app.pages.dev')
                for route in ('/eventos/', '/conversacion/')}
    actual = set()
    for intent in root.findall('.//intent-filter'):
        if intent.get(android + 'autoVerify') != 'true':
            continue
        for data in intent.findall('data'):
            if data.get(android + 'scheme') == 'https':
                actual.add((data.get(android + 'host'), data.get(android + 'pathPrefix')))
    if actual != expected:
        raise ValueError('Verified app links do not match the deployed hosts and routes')
    if config.get('extra', {}).get('apiBase') != 'https://api.tdfrecords.net':
        raise ValueError('Wrong embedded production API')
    if b'https://api.tdfrecords.net' not in bundle or b'127.0.0.1:18128' in bundle or b'127.0.0.1:18631' in bundle:
        raise ValueError('Wrong bundled production API')


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
        bundle = archive.read('base/assets/index.android.bundle')
        runtime_dump = subprocess.run(['java', '-jar', tool, 'dump', 'resources', '--bundle=' + str(aab), '--resource=string/expo_runtime_version', '--values'], check=True, capture_output=True, text=True).stdout
        validate_interaction_release(root, config, bundle, runtime_dump)
    output = Path('release-artifacts')
    output.mkdir(exist_ok=True)
    receipt = {'sourceSHA': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'], 'package': 'com.tdf.records', 'version': version, 'build': os.environ['ANDROID_VERSION_CODE'], 'sha256': hashlib.file_digest(aab.open('rb'), 'sha256').hexdigest(), 'bytes': aab.stat().st_size, 'certificateSHA256': actual, 'signatureVerified': True, 'embeddedProductionAPI': True, 'publication': 'not uploaded or submitted'}
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    aab.rename(output / 'TDFRecords.aab')
    print(json.dumps(receipt))


if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify}[sys.argv[1]]()
