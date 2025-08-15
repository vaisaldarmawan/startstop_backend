require('dotenv').config();
const mqtt = require('mqtt');
const { execSync, exec } = require('child_process');

// Load environment variables
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MY_IP = execSync("hostname -I | awk '{print $1}'").toString().trim();
const MQTT_TOPIC_CLI = `${MY_IP}/cli`;
const MQTT_TOPIC_LOG = `${MY_IP}/log`;
const LOG_INTERVAL = process.env.LOG_INTERVAL;

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
    client.subscribe(MQTT_TOPIC_CLI, (err) => {
        if (err) {
            console.error("Subscription error:", err);
        } else {
            console.log(`Subscribed to topic: ${MQTT_TOPIC_CLI}`);
        }
    });

    client.subscribe(MQTT_TOPIC_LOG, (err) => {
        if (err) {
            console.error("Subscription error:", err);
        } else {
            console.log(`Subscribed to topic: ${MQTT_TOPIC_LOG}`);
        }
    });

    // Function to fetch last 10 lines from screen session.
    setInterval(() => {
        const command = `sudo -u sysop bash -c "screen -r earthworm -X hardcopy -h /tmp/screenlog && tail -n 10 /tmp/screenlog > /tmp/screenlog.tmp && mv /tmp/screenlog.tmp /tmp/screenlog && cat /tmp/screenlog"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Execution error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }

            const screenData = stdout.trim();
            if (screenData) {
                console.log(`Sending data to MQTT: ${screenData}`);
                client.publish(MQTT_TOPIC_LOG, screenData, { qos: 1, retain: false });
            }
        });
    }, LOG_INTERVAL); // Menggunakan interval dari .env
});

client.on('message', (receivedTopic, message) => {
    if (receivedTopic === MQTT_TOPIC_CLI) {
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
