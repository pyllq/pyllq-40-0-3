/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
let GMPScope = Cu.import("resource://gre/modules/addons/GMPProvider.jsm");
Cu.import("resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyGetter(this, "pluginsBundle",
  () => Services.strings.createBundle("chrome://global/locale/plugins.properties"));

XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");

let gMockAddons = new Map();
let gMockEmeAddons = new Map();

for (let plugin of GMPScope.GMP_PLUGINS) {
  let mockAddon = Object.freeze({
      id: plugin.id,
      isValid: true,
      isInstalled: false,
      nameId: plugin.name,
      descriptionId: plugin.description,
      missingKey: plugin.missingKey,
  });
  gMockAddons.set(mockAddon.id, mockAddon);
  if (mockAddon.id.indexOf("gmp-eme-") == 0) {
    gMockEmeAddons.set(mockAddon.id, mockAddon);
  }
}

let gInstalledAddonId = "";
let gPrefs = Services.prefs;
let gGetKey = GMPScope.GMPPrefs.getPrefKey;

function MockGMPInstallManager() {
}

MockGMPInstallManager.prototype = {
  checkForAddons: () => Promise.resolve([...gMockAddons.values()]),

  installAddon: addon => {
    gInstalledAddonId = addon.id;
    return Promise.resolve();
  },
};


function run_test() {
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");
  startupManager();

  gPrefs.setBoolPref(GMPScope.GMPPrefs.KEY_LOGGING_DUMP, true);
  gPrefs.setIntPref(GMPScope.GMPPrefs.KEY_LOGGING_LEVEL, 0);
  gPrefs.setBoolPref(GMPScope.GMPPrefs.KEY_EME_ENABLED, true);
  for (let addon of gMockAddons.values()) {
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_FORCEVISIBLE, addon.id),
                       true);
  }
  GMPScope.GMPProvider.shutdown();
  GMPScope.GMPProvider.startup();

  run_next_test();
}

add_task(function* test_notInstalled() {
  for (let addon of gMockAddons.values()) {
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id), "");
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, addon.id), false);
  }

  let addons = yield promiseAddonsByIDs([...gMockAddons.keys()]);
  Assert.equal(addons.length, gMockAddons.size);

  for (let addon of addons) {
    Assert.ok(!addon.isInstalled);
    Assert.equal(addon.type, "plugin");
    Assert.equal(addon.version, "");

    let mockAddon = gMockAddons.get(addon.id);

    Assert.notEqual(mockAddon, null);
    let name = pluginsBundle.GetStringFromName(mockAddon.nameId);
    Assert.equal(addon.name, name);
    let description = pluginsBundle.GetStringFromName(mockAddon.descriptionId);
    Assert.equal(addon.description, description);

    Assert.ok(!addon.isActive);
    Assert.ok(!addon.appDisabled);
    Assert.ok(addon.userDisabled);

    Assert.equal(addon.blocklistState, Ci.nsIBlocklistService.STATE_NOT_BLOCKED);
    Assert.equal(addon.size, 0);
    Assert.equal(addon.scope, AddonManager.SCOPE_APPLICATION);
    Assert.equal(addon.pendingOperations, AddonManager.PENDING_NONE);
    Assert.equal(addon.operationsRequiringRestart, AddonManager.PENDING_NONE);

    Assert.equal(addon.permissions, AddonManager.PERM_CAN_UPGRADE |
                                    AddonManager.PERM_CAN_ENABLE);

    Assert.equal(addon.updateDate, null);

    Assert.ok(addon.isCompatible);
    Assert.ok(addon.isPlatformCompatible);
    Assert.ok(addon.providesUpdatesSecurely);
    Assert.ok(!addon.foreignInstall);

    let mimetypes = addon.pluginMimeTypes;
    Assert.ok(mimetypes);
    Assert.equal(mimetypes.length, 0);
    let libraries = addon.pluginLibraries;
    Assert.ok(libraries);
    Assert.equal(libraries.length, 0);
    Assert.equal(addon.pluginFullpath, "");
  }
});

add_task(function* test_installed() {
  const TEST_DATE = new Date(2013, 0, 1, 12);
  const TEST_VERSION = "1.2.3.4";
  const TEST_TIME_SEC = Math.round(TEST_DATE.getTime() / 1000);

  let addons = yield promiseAddonsByIDs([...gMockAddons.keys()]);
  Assert.equal(addons.length, gMockAddons.size);

  for (let addon of addons) {
    let mockAddon = gMockAddons.get(addon.id);
    Assert.notEqual(mockAddon, null);

    let file = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file.append(addon.id);
    file.append(TEST_VERSION);
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, mockAddon.id), false);
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_LAST_UPDATE, mockAddon.id),
                      "" + TEST_TIME_SEC);
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, mockAddon.id),
                      TEST_VERSION);

    Assert.ok(addon.isInstalled);
    Assert.equal(addon.type, "plugin");
    Assert.ok(!addon.isActive);
    Assert.ok(!addon.appDisabled);
    Assert.ok(addon.userDisabled);

    let name = pluginsBundle.GetStringFromName(mockAddon.nameId);
    Assert.equal(addon.name, name);
    Assert.equal(addon.version, TEST_VERSION);

    Assert.equal(addon.permissions, AddonManager.PERM_CAN_UPGRADE |
                                    AddonManager.PERM_CAN_ENABLE);

    Assert.equal(addon.updateDate.getTime(), TEST_TIME_SEC * 1000);

    let mimetypes = addon.pluginMimeTypes;
    Assert.ok(mimetypes);
    Assert.equal(mimetypes.length, 0);
    let libraries = addon.pluginLibraries;
    Assert.ok(libraries);
    Assert.equal(libraries.length, 1);
    Assert.equal(libraries[0], TEST_VERSION);
    let fullpath = addon.pluginFullpath;
    Assert.equal(fullpath.length, 1);
    Assert.equal(fullpath[0], file.path);
  }
});

add_task(function* test_enable() {
  let addons = yield promiseAddonsByIDs([...gMockAddons.keys()]);
  Assert.equal(addons.length, gMockAddons.size);

  for (let addon of addons) {
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, addon.id), true);

    Assert.ok(addon.isActive);
    Assert.ok(!addon.appDisabled);
    Assert.ok(!addon.userDisabled);

    Assert.equal(addon.permissions, AddonManager.PERM_CAN_UPGRADE |
                                    AddonManager.PERM_CAN_DISABLE);
  }
});

add_task(function* test_globalEmeDisabled() {
  let addons = yield promiseAddonsByIDs([...gMockEmeAddons.keys()]);
  Assert.equal(addons.length, gMockEmeAddons.size);

  gPrefs.setBoolPref(GMPScope.GMPPrefs.KEY_EME_ENABLED, false);
  GMPScope.GMPProvider.shutdown();
  GMPScope.GMPProvider.startup();
  for (let addon of addons) {
    Assert.ok(!addon.isActive);
    Assert.ok(addon.appDisabled);
    Assert.ok(!addon.userDisabled);

    Assert.equal(addon.permissions, 0);
  }
  gPrefs.setBoolPref(GMPScope.GMPPrefs.KEY_EME_ENABLED, true);
  GMPScope.GMPProvider.shutdown();
  GMPScope.GMPProvider.startup();
});

add_task(function* test_autoUpdatePrefPersistance() {
  let addons = yield promiseAddonsByIDs([...gMockAddons.keys()]);
  Assert.equal(addons.length, gMockAddons.size);

  for (let addon of addons) {
    let autoupdateKey = gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_AUTOUPDATE, addon.id);
    gPrefs.clearUserPref(autoupdateKey);

    addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
    Assert.ok(!gPrefs.getBoolPref(autoupdateKey));

    addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_ENABLE;
    Assert.equal(addon.applyBackgroundUpdates, AddonManager.AUTOUPDATE_ENABLE);
    Assert.ok(gPrefs.getBoolPref(autoupdateKey));

    addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DEFAULT;
    Assert.ok(!gPrefs.prefHasUserValue(autoupdateKey));
  }
});

function createMockPluginFilesIfNeeded(aFile, aPluginId) {
  function createFile(aFileName) {
    let f = aFile.clone();
    f.append(aFileName);
    if (!f.exists()) {
      f.create(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    }
  };

  let id = aPluginId.substring(4);
  let libName = AppConstants.DLL_PREFIX + id + AppConstants.DLL_SUFFIX;

  createFile(libName);
  createFile(id + ".info");
  if (aPluginId == "gmp-eme-adobe")
    createFile(id + ".voucher");
}

// Array.includes is only in 41, so polyfill for 40/39 uplift.
if (![].includes) {
  Array.prototype.includes = function(element) {
    var O = Object(this);
    return O.indexOf(element) != -1;
  }
}

add_task(function* test_pluginRegistration() {
  const TEST_VERSION = "1.2.3.4";

  let profD = do_get_profile();
  for (let addon of gMockAddons.values()) {
    let file = profD.clone();
    file.append(addon.id);
    file.append(TEST_VERSION);

    let addedPaths = [];
    let removedPaths = [];
    let clearPaths = () => { addedPaths = []; removedPaths = []; }

    let MockGMPService = {
      addPluginDirectory: path => {
        if (!addedPaths.includes(path)) {
          addedPaths.push(path);
        }
      },
      removePluginDirectory: path => {
        if (!removedPaths.includes(path)) {
          removedPaths.push(path);
        }
      },
      removeAndDeletePluginDirectory: path => {
        if (!removedPaths.includes(path)) {
          removedPaths.push(path);
        }
      },
    };

    let reportedKeys = [];

    let MockTelemetry = {
      getHistogramById: key => {
        return {
          add: value => {
            reportedKeys.push(key);
          }
        }
      }
    };

    GMPScope.gmpService = MockGMPService;
    GMPScope.telemetryService = MockTelemetry;
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, addon.id), true);

    // Test that plugin registration fails if the plugin dynamic library and
    // info files are not present.
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id),
                       TEST_VERSION);
    clearPaths();
    yield promiseRestartManager();
    Assert.equal(addedPaths.indexOf(file.path), -1);
    Assert.deepEqual(removedPaths, [file.path]);

    // Test that the GMPProvider tried to report via telemetry that the
    // addon's lib file is missing.
    Assert.deepEqual(reportedKeys, [addon.missingKey]);

    // Create dummy GMP library/info files, and test that plugin registration
    // succeeds during startup, now that we've added GMP info/lib files.
    createMockPluginFilesIfNeeded(file, addon.id);

    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id),
                       TEST_VERSION);
    clearPaths();
    yield promiseRestartManager();
    Assert.notEqual(addedPaths.indexOf(file.path), -1);
    Assert.deepEqual(removedPaths, []);

    // Check that clearing the version doesn't trigger registration.
    clearPaths();
    gPrefs.clearUserPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id));
    Assert.deepEqual(addedPaths, []);
    Assert.deepEqual(removedPaths, [file.path]);

    // Restarting with no version set should not trigger registration.
    clearPaths();
    yield promiseRestartManager();
    Assert.equal(addedPaths.indexOf(file.path), -1);
    Assert.equal(removedPaths.indexOf(file.path), -1);

    // Changing the pref mid-session should cause unregistration and registration.
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id),
                       TEST_VERSION);
    clearPaths();
    const TEST_VERSION_2 = "5.6.7.8";
    let file2 = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file2.append(addon.id);
    file2.append(TEST_VERSION_2);
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id),
                      TEST_VERSION_2);
    Assert.deepEqual(addedPaths, [file2.path]);
    Assert.deepEqual(removedPaths, [file.path]);

    // Disabling the plugin should cause unregistration.
    gPrefs.setCharPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_VERSION, addon.id),
                       TEST_VERSION);
    clearPaths();
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, addon.id), false);
    Assert.deepEqual(addedPaths, []);
    Assert.deepEqual(removedPaths, [file.path]);

    // Restarting with the plugin disabled should not cause registration.
    clearPaths();
    yield promiseRestartManager();
    Assert.equal(addedPaths.indexOf(file.path), -1);
    Assert.equal(removedPaths.indexOf(file.path), -1);

    // Re-enabling the plugin should cause registration.
    clearPaths();
    gPrefs.setBoolPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_ENABLED, addon.id), true);
    Assert.deepEqual(addedPaths, [file.path]);
    Assert.deepEqual(removedPaths, []);
    GMPScope = Cu.import("resource://gre/modules/addons/GMPProvider.jsm");
  }
});

add_task(function* test_periodicUpdate() {
  Object.defineProperty(GMPScope, "GMPInstallManager", {
    value: MockGMPInstallManager,
    writable: true,
    enumerable: true,
    configurable: true
  });

  let addons = yield promiseAddonsByIDs([...gMockAddons.keys()]);
  Assert.equal(addons.length, gMockAddons.size);

  for (let addon of addons) {
    gPrefs.clearUserPref(gGetKey(GMPScope.GMPPrefs.KEY_PLUGIN_AUTOUPDATE, addon.id));

    addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
    gPrefs.setIntPref(GMPScope.GMPPrefs.KEY_UPDATE_LAST_CHECK, 0);
    let result =
      yield addon.findUpdates({}, AddonManager.UPDATE_WHEN_PERIODIC_UPDATE);
    Assert.strictEqual(result, false);

    addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_ENABLE;
    gPrefs.setIntPref(GMPScope.GMPPrefs.KEY_UPDATE_LAST_CHECK, Date.now() / 1000 - 60);
    result =
      yield addon.findUpdates({}, AddonManager.UPDATE_WHEN_PERIODIC_UPDATE);
    Assert.strictEqual(result, false);

    gPrefs.setIntPref(GMPScope.GMPPrefs.KEY_UPDATE_LAST_CHECK,
                     Date.now() / 1000 - 2 * GMPScope.SEC_IN_A_DAY);
    gInstalledAddonId = "";
    result =
      yield addon.findUpdates({}, AddonManager.UPDATE_WHEN_PERIODIC_UPDATE);
    Assert.strictEqual(result, true);
    Assert.equal(gInstalledAddonId, addon.id);
  }

  GMPScope = Cu.import("resource://gre/modules/addons/GMPProvider.jsm");
});
