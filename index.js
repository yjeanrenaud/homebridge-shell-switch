let Service;
let Characteristic;
let HomebridgeAPI;
const { exec } = require('child_process');

class ShellSwitch {
  constructor(log, config) {
    this.log = log;

    // Setup Configuration
    this.setupConfig(config);

    // Persistent Storage
    this.cacheDirectory = HomebridgeAPI.user.persistPath();
    this.storage = require('node-persist');
    this.storage.initSync({ dir: this.cacheDirectory, forgiveParseErrors: true });

    // Setup Services
    this.createSwitchService();
    this.createAccessoryInformationService();
  }

  setupConfig(config) {
    this.name = config.name;
    this.onCmd = config.onCmd;
    this.offCmd = config.offCmd;
    this.timeout = config.timeout || 30;
  }

  getCachedState() {
    const cachedState = this.storage.getItemSync(this.name);
    if (cachedState === undefined || cachedState === false) {
      return false;
    }
    return true;
  }

  createSwitchService() {
    this.switchService = new Service.Switch(this.name);
    this.switchService.getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchState.bind(this))
      .on('set', this.setSwitchState.bind(this));

    if (this.getCachedState.bind(this)) {
      this.restoringStateOnBoot = true;
      this.switchService.setCharacteristic(Characteristic.On, true);
    }
  }

  createAccessoryInformationService() {
    this.accessoryInformationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Shell Command Switch')
      .setCharacteristic(Characteristic.Model, 'Shell Command Switch');
  }

  getServices() {
    return [this.accessoryInformationService, this.switchService];
  }

  getSwitchState(callback) {
    callback(this.getCachedState.bind(this));
  }

  setSwitchState(on, callback) {
    // Don't actually toggle the switch state if we're just ensuring the
    // existing state is being restored on boot.
    if (this.restoringStateOnBoot) {
      this.restoringStateOnBoot = false;
      return callback();
    }

    this.log(`Setting switch to ${on}`);
    this.storage.setItemSync(this.name, on);

    let cmd = this.offCmd;
    if (on) { cmd = this.onCmd; }

    this.log(`Executing command: '${cmd}'`);
    return exec(cmd, { timeout: this.timeout }, (error) => {
      if (error) { this.log(error); }
      callback(error);
    });
  }
}

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory('homebridge-shell-switch', 'ShellSwitch', ShellSwitch);
};
