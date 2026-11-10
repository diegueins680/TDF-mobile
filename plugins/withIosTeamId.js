// Expo config plugin: inject iOS DEVELOPMENT_TEAM into all XCBuildConfiguration
// blocks (Debug + Release) and set PBXProject attributes TargetAttributes.DevelopmentTeam
// via withDangerousMod post-prebuild pbxproj rewrite (path c''').
//
// Hard-coded TEAMID per CTO-ratified path (c'''): 83J23NPXG7.
// Rewritten by tdf-label-release lane 2026-11-10 14:51 UTC after string + tuple
// forms of withXcodeProject-based plugin both failed to load during prebuild.

const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const TEAM_ID = '83J23NPXG7';

function withIosTeamId(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      // Lazy-require xcode only when the dangerous mod runs, so that mere
      // plugin resolution does not fail if the dep isn't installed yet.
      const xcode = require('xcode');
      const pbxprojPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'TDFRecords.xcodeproj',
        'project.pbxproj'
      );
      const project = xcode.project(pbxprojPath);
      project.parseSync();

      // 1. DEVELOPMENT_TEAM on every XCBuildConfiguration.
      const buildConfigs = project.pbxXCBuildConfigurationSection();
      let bcCount = 0;
      for (const key of Object.keys(buildConfigs)) {
        const entry = buildConfigs[key];
        if (!entry || typeof entry !== 'object') continue;
        if (!entry.buildSettings) continue;
        entry.buildSettings.DEVELOPMENT_TEAM = TEAM_ID;
        bcCount += 1;
      }

      // 2. TargetAttributes.<targetUUID>.DevelopmentTeam on each native target.
      const projectSection = project.pbxProjectSection();
      let taCount = 0;
      for (const projectKey of Object.keys(projectSection)) {
        const projectEntry = projectSection[projectKey];
        if (!projectEntry || typeof projectEntry !== 'object') continue;
        if (!projectEntry.attributes) projectEntry.attributes = {};
        if (!projectEntry.attributes.TargetAttributes) {
          projectEntry.attributes.TargetAttributes = {};
        }
        const targets = projectEntry.targets || [];
        for (const targetRef of targets) {
          const targetKey =
            typeof targetRef === 'string' ? targetRef : targetRef.value;
          if (!targetKey) continue;
          if (!projectEntry.attributes.TargetAttributes[targetKey]) {
            projectEntry.attributes.TargetAttributes[targetKey] = {};
          }
          projectEntry.attributes.TargetAttributes[targetKey].DevelopmentTeam =
            TEAM_ID;
          taCount += 1;
        }
      }

      const fs = require('fs');
      fs.writeFileSync(pbxprojPath, project.writeSync());
      void bcCount;
      void taCount;
      return cfg;
    },
  ]);
}

module.exports = withIosTeamId;
