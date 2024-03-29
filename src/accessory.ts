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
    private lightbulbHue = 0;
    private lightbulbSat = 0;

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

        var mqttOptions = {
            username: config.username,
            password: config.password
        };

        // connect to MQTT broker

        log.info("Initializing MQTT");
        log.info("Connecting to " + this.mqttURL);

        this.mqttClient = connect(this.mqttURL, mqttOptions);
        var that = this;
        this.mqttClient.on('error', function (err) {
            that.log.error('Error event on MQTT:', err);
        });

        this.mqttClient.on('message', function (topic, message) {

            that.log.info(message.toString(), topic);

            // On/Off

            if (topic == that.config.topics.getOn) {
                var status = message.toString();
                that.lightbulbOn = (status == "ON" ? true : false);
                that.lightbulbService.getCharacteristic(hap.Characteristic.On).setValue(that.lightbulbOn, undefined, 'fromSetValue');
            }

            if (topic == that.config.topics.getRes) {

                // Brightness
                
                if (JSON.parse(message.toString()).Dimmer != null)
                {
                    var newB = JSON.parse(message.toString()).Dimmer as number;

                    // Only take further action if there was an actual (value) change (since a lot of data is 'crammed' into this MQTT message and not everything changes)

                    if (newB != that.lightbulbBrightness)
                    {
                        that.lightbulbBrightness = newB;
                        that.lightbulbService.getCharacteristic(hap.Characteristic.Brightness).setValue(that.lightbulbBrightness, undefined, 'fromSetValue');
                    }
                }

                // Color temperature

                if (JSON.parse(message.toString()).CT != null)
                {
                    var newCT = JSON.parse(message.toString()).CT as number;

                    // Only take further action if there was an actual (value) change (since a lot of data is 'crammed' into this MQTT message and not everything changes)

                    if (newCT != that.lightbulbColorTemp)
                    {
                        that.lightbulbColorTemp = newCT;
                        that.lightbulbService.getCharacteristic(hap.Characteristic.ColorTemperature).setValue(that.lightbulbColorTemp, undefined, 'fromSetValue');
                    }
                }

                // Hue

                if (JSON.parse(message.toString()).HSBColor != null)
                {
                    var newHue = JSON.parse(message.toString()).HSBColor.toString().split(',')[0] as number;

                    // Only take further action if there was an actual (value) change (since a lot of data is 'crammed' into this MQTT message and not everything changes)

                    if (newHue != that.lightbulbHue)
                    {
                        that.lightbulbHue = newHue;
                        that.lightbulbService.getCharacteristic(hap.Characteristic.Hue).setValue(that.lightbulbHue, undefined, 'fromSetValue');
                    }
                }

                // Saturation

                if (JSON.parse(message.toString()).HSBColor != null)
                {
                    var newSat = JSON.parse(message.toString()).HSBColor.toString().split(',')[1] as number;

                    // Only take further action if there was an actual (value) change (since a lot of data is 'crammed' into this MQTT message and not everything changes)

                    if (newSat != that.lightbulbSat)
                    {
                        that.lightbulbSat = newSat;
                        that.lightbulbService.getCharacteristic(hap.Characteristic.Saturation).setValue(that.lightbulbSat, undefined, 'fromSetValue');
                    }
                }
            }
        });
        
        log.info("Subscribing to topic " + this.config.topics.getOn );

        this.mqttClient.subscribe(this.config.topics.getOn);
        this.mqttClient.subscribe(this.config.topics.getRes);

        // Adding lightbulb service

        this.lightbulbService = new hap.Service.Lightbulb(this.name);

        // Lightbulb On/Off callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.On)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current state of the lightbulb was returned: " + (this.lightbulbOn? "ON": "OFF"));
            callback(undefined, this.lightbulbOn);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context: string) => {
            if(context !== 'fromSetValue') {
                this.lightbulbOn = value as boolean;
                this.mqttClient.publish(this.config.topics.setOn, this.lightbulbOn? "ON": "OFF");
            }
            log.info("Lightbulb state was set to: " + (this.lightbulbOn? "ON": "OFF"));
            callback();
        });

        // Lightbulb brightness callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current brightness of the lightbulb was returned: " + this.lightbulbBrightness);
            callback(undefined, this.lightbulbBrightness);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context: string) => {
            if(context !== 'fromSetValue') {
                this.lightbulbBrightness = value as number;
                this.mqttClient.publish(this.config.topics.setBrightness, this.lightbulbBrightness.toString());
            }
            log.info("Lightbulb brightness was set to: " + this.lightbulbBrightness);
            callback();
        });

        // Lightbulb color temperature callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.ColorTemperature)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current color temperature of the lightbulb was returned: " + this.lightbulbColorTemp);
            callback(undefined, this.lightbulbColorTemp);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context: string) => {
            if(context !== 'fromSetValue') {
                this.lightbulbColorTemp = value as number;
                this.mqttClient.publish(this.config.topics.setColorTemp, this.lightbulbColorTemp.toString());
            }
            log.info("Lightbulb color temperature was set to: " + this.lightbulbColorTemp);
            callback();
        });

        // Lightbulb hue callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.Hue)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current hue of the lightbulb was returned: " + this.lightbulbHue);
            callback(undefined, this.lightbulbHue);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context: string) => {
            if(context !== 'fromSetValue') {
                this.lightbulbHue = value as number;
                this.mqttClient.publish(this.config.topics.setHue, this.lightbulbHue.toString());
            }
            log.info("Lightbulb hue was set to: " + this.lightbulbHue);
            callback();
        });

        // Lightbulb saturation callbacks

        this.lightbulbService.getCharacteristic(hap.Characteristic.Saturation)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            log.info("Current saturation of the lightbulb was returned: " + this.lightbulbSat);
            callback(undefined, this.lightbulbSat);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context: string) => {
            if(context !== 'fromSetValue') {
                this.lightbulbSat = value as number;
                this.mqttClient.publish(this.config.topics.setSat, this.lightbulbSat.toString());
            }
            log.info("Lightbulb saturation was set to: " + this.lightbulbSat);
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
