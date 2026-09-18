#!/usr/bin/env python3
"""Install existing App Store signing material in an ephemeral CI keychain."""
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import subprocess
import sys

BUNDLE = 'com.tdfrecords.app'
TEAM = '83J23NPXG7'


def validate_profile(profile, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    expiry = profile['ExpirationDate'].replace(tzinfo=datetime.timezone.utc)
    if expiry <= now:
        raise ValueError('The provisioning profile has expired')
    entitlements = profile['Entitlements']
    if profile['TeamIdentifier'] != [TEAM] or entitlements.get('application-identifier') != f'{TEAM}.{BUNDLE}':
        raise ValueError('The provisioning profile belongs to another app or team')
    if entitlements.get('get-task-allow') or profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices'):
        raise ValueError('An App Store distribution profile is required')
    if not re.fullmatch(r'[A-Fa-f0-9-]{36}', profile['UUID']):
        raise ValueError('Invalid profile UUID')
    if not profile.get('DeveloperCertificates'):
        raise ValueError('No distribution certificate in profile')
    return profile['UUID']


def validate_build_number(value):
    if not re.fullmatch(r'[1-9][0-9]{0,8}', value):
        raise ValueError('Build number must be a positive integer with at most nine digits')
    return value


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def prepare():
    if os.environ.get('GITHUB_REF') != 'refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch':
        raise ValueError('Signed builds require a manual dispatch from main')
    build = validate_build_number(os.environ['IOS_BUILD_NUMBER'])
    stage = Path(os.environ['RUNNER_TEMP']) / 'tdf-ios-signing'
    stage.mkdir(mode=0o700, exist_ok=False)
    os.umask(0o077)
    certificate = stage / 'distribution.p12'
    certificate.write_bytes(base64.b64decode(os.environ['TDF_IOS_DISTRIBUTION_P12'], validate=True))
    provision = stage / 'app.mobileprovision'
    provision.write_bytes(base64.b64decode(os.environ['TDF_IOS_PROVISIONING_PROFILE'], validate=True))
    profile = plistlib.loads(run(['security', 'cms', '-D', '-i', str(provision)], capture_output=True).stdout)
    uuid = validate_profile(profile)
    keychain = stage / 'signing.keychain-db'
    password = secrets.token_urlsafe(32)
    run(['security', 'create-keychain', '-p', password, str(keychain)], capture_output=True)
    run(['security', 'set-keychain-settings', '-lut', '21600', str(keychain)])
    run(['security', 'unlock-keychain', '-p', password, str(keychain)], capture_output=True)
    run(['security', 'import', str(certificate), '-P', os.environ['TDF_IOS_P12_PASSWORD'], '-A', '-t', 'cert', '-f', 'pkcs12', '-k', str(keychain)], capture_output=True)
    run(['security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-k', password, str(keychain)], capture_output=True)
    run(['security', 'list-keychain', '-d', 'user', '-s', str(keychain)])
    identity = run(['security', 'find-identity', '-v', '-p', 'codesigning', str(keychain)], capture_output=True, text=True).stdout
    accepted = {hashlib.sha1(c).hexdigest().upper() for c in profile['DeveloperCertificates']}
    if not any(value in identity for value in accepted):
        raise ValueError('The imported signing identity does not match the provisioning profile')
    profiles = Path.home() / 'Library/MobileDevice/Provisioning Profiles'
    profiles.mkdir(parents=True, exist_ok=True)
    installed = profiles / f'{uuid}.mobileprovision'
    installed.write_bytes(provision.read_bytes())
    (stage / 'installed-profile-path').write_text(str(installed))
    app_info = Path('ios/TDFRecords/Info.plist')
    info = plistlib.loads(app_info.read_bytes())
    version = json.loads(Path('package.json').read_text())['version']
    info['CFBundleVersion'] = build
    info['CFBundleShortVersionString'] = version
    app_info.write_bytes(plistlib.dumps(info))
    options = {'method': 'app-store-connect', 'teamID': TEAM, 'signingStyle': 'manual', 'signingCertificate': 'Apple Distribution', 'provisioningProfiles': {BUNDLE: uuid}, 'manageAppVersionAndBuildNumber': False, 'uploadSymbols': True}
    (stage / 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
    # Apply signing to the application target only, never CocoaPods resource bundles.
    ruby = """require 'xcodeproj'
p = Xcodeproj::Project.open('ios/TDFRecords.xcodeproj')
targets = p.targets.select { |t| t.name == 'TDFRecords' && t.product_type == 'com.apple.product-type.application' }
raise 'Expected one application target' unless targets.length == 1
targets.first.build_configurations.each do |c|
 c.build_settings['CODE_SIGN_STYLE'] = 'Manual'
 c.build_settings['DEVELOPMENT_TEAM'] = ENV.fetch('TDF_SIGN_TEAM')
 c.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ENV.fetch('TDF_SIGN_PROFILE')
 c.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
 c.build_settings['CURRENT_PROJECT_VERSION'] = ENV.fetch('IOS_BUILD_NUMBER')
end
p.save
"""
    run(['ruby', '-e', ruby], env={**os.environ, 'TDF_SIGN_TEAM': TEAM, 'TDF_SIGN_PROFILE': uuid})
    print(json.dumps({'bundle': BUNDLE, 'team': TEAM, 'version': version, 'build': build, 'profileExpires': profile['ExpirationDate'].isoformat(), 'signingPrepared': True}))


def cleanup():
    stage = Path(os.environ['RUNNER_TEMP']) / 'tdf-ios-signing'
    if not stage.exists():
        return
    keychain = stage / 'signing.keychain-db'
    if keychain.exists():
        subprocess.run(['security', 'delete-keychain', str(keychain)], capture_output=True)
    receipt = stage / 'installed-profile-path'
    if receipt.exists():
        installed = Path(receipt.read_text())
        expected = Path.home() / 'Library/MobileDevice/Provisioning Profiles'
        if installed.parent == expected and re.fullmatch(r'[A-Fa-f0-9-]{36}\.mobileprovision', installed.name):
            installed.unlink(missing_ok=True)
    for item in stage.iterdir():
        if item.is_file():
            item.unlink()
    stage.rmdir()


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['prepare']:
            prepare()
        elif sys.argv[1:] == ['cleanup']:
            cleanup()
        else:
            raise ValueError('Use prepare or cleanup')
    except subprocess.CalledProcessError as error:
        print(f'Apple signing command failed: {error.cmd[0]} (exit {error.returncode}); credentials omitted', file=sys.stderr)
        sys.exit(1)
    except (ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
