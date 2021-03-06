import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service
} from "homebridge";

import {
    Client,
    connect
} from "mqtt";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;
    api.registerAccessory("ExampleSwitch", ExampleSwitch);
};

class ExampleSwitch implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly config: AccessoryConfig;
    private readonly name: string;
    private readonly mqttClient: Client;
    private readonly mqttURL: string;
    private readonly mqttClientID: string;
    private lightbulbOn = false;
    private lightbulbBrightness = 0;
    private lightbulbColorTemp = 153;

    private readonly informationService: Service;
    private readonly lightbulbService: Service;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.config = config;
        this.name = config.name;

        this.mqttURL = config.url;
        this.mqttClientID =
            'mqttjs_' +
            config.name + "_" +
            Math.random().toString(16).substr(2, 8);

        // connect to MQTT broker

        log.info("Initializing MQTT");
        log.info("Connecting to " + this.mqttURL);

        this.mqttClient = connect(this.mqttURL);
        var that = this;
        this.mqttClient.on('error', function (err) {
            that.log.error('Error event on MQTT:', err);
        });

        this.mqttClient.on('message', function (topic, message) {

            that.log.info(message.toString(), topic);

            if (topic == that.config.topics.getOn) {
                var status = message.toString();
                that.lightbulbOn = (status == "ON" ? true : false);
                // that.lightbulbService.getCharacteristic(hap.Characteristic.On).setValue(that.lightbulbOn, undefined, 'fromSetValue');
            }
        });
        
        log.info("Subscribing to topic " + this.config.topics.getOn );

        this.mqttClient.subscribe(this.config.topics.getOn);

        // Adding lightbulb service

        this.lightbulbService = new hap.Service.Lightbulb(this.name);

        // Lightbulb On/Off callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.On)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current state of the lightbulb was returned: " + (this.lightbulbOn? "ON": "OFF"));
            callback(undefined, this.lightbulbOn);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.lightbulbOn = value as boolean;
            this.mqttClient.publish(this.config.topics.setOn, this.lightbulbOn? "ON": "OFF");
            log.info("Lightbulb state was set to: " + (this.lightbulbOn? "ON": "OFF"));
            callback();
        });

        // Lightbulb brightness callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current brightness of the lightbulb was returned: " + this.lightbulbBrightness);
            callback(undefined, this.lightbulbBrightness);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.lightbulbBrightness = value as number;
            log.info("Lightbulb brightness was set to: " + this.lightbulbBrightness);
            callback();
        });

        // Lightbulb color temperature callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.ColorTemperature)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current color temperature of the lightbulb was returned: " + this.lightbulbColorTemp);
            callback(undefined, this.lightbulbColorTemp);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.lightbulbColorTemp = value as number;
            log.info("Lightbulb color temperature was set to: " + this.lightbulbColorTemp);
            callback();
        });

        this.informationService = new hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
        .setCharacteristic(hap.Characteristic.Model, "Custom Model");

        log.info("Finished initializing!");
    }

    /*
    * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
    * Typical this only ever happens at the pairing process.
    */
    identify(): void {
        this.log("Identify!");
    }

    /*
    * This method is called directly after creation of this instance.
    * It should return all services which should be added to the accessory.
    */
    getServices(): Service[] {
        return [
        this.informationService,
        this.lightbulbService,
        ];
    }

}
