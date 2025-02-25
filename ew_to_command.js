require('dotenv').config();
const mqtt = require('mqtt');
const { exec } = require('child_process');

// Load environment variables
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = `${MQTT_HOST}/cli`;

const mqttOptions = {
    host: MQTT_HOST,
    port: MQTT_PORT,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
};

// Connect to MQTT broker
const client = mqtt.connect(`mqtt://${mqttOptions.host}:${mqttOptions.port}`, {
    username: mqttOptions.username,
    password: mqttOptions.password
});

client.on('connect', () => {
    console.log(`Connected to MQTT broker at ${mqttOptions.host}:${mqttOptions.port}`);
    client.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
            console.error("Subscription error:", err);
        } else {
            console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
        }
    });
});

client.on('message', (receivedTopic, message) => {
    if (receivedTopic === MQTT_TOPIC) {
        const command = message.toString().trim();
        console.log(`Received command: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Execution error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
        });
    }
});

client.on('error', (err) => {
    console.error("MQTT Error:", err);
});
