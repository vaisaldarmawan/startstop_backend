require('dotenv').config();
const { exec } = require('child_process');
const mqtt = require('mqtt');

// Load environment variables
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const INFO_INTERVAL = process.env.INFO_INTERVAL;

// MQTT Configuration
const mqttOptions = {
  host: MQTT_HOST,
  port: MQTT_PORT,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
};

let mqttClient;
try {
  mqttClient = mqtt.connect(mqttOptions);
} catch (error) {
  console.error('MQTT Connection Error:', error);
  process.exit(1);
}

const hwTopic = `${MQTT_HOST}/status`;
const ewTopic = `${MQTT_HOST}/ew_status`;

// System commands for fetching local machine data
const commands = {
  ip: "hostname -I | awk '{print $1}'",
  os: "cat /etc/os-release | grep 'PRETTY_NAME' | cut -d '=' -f2 | tr -d \"\\\"\"",
  hostname: 'hostname',
  uptime: `awk '{printf "%d days, %d hours, %d mins", $1/86400, ($1%86400)/3600, ($1%3600)/60}' /proc/uptime`,
  cpu: "lscpu | grep 'Model name' | awk -F ':' '{print $2}'",
  cpuCores: "lscpu | grep '^CPU(s):' | awk '{print $2}'",
  cpuThreads: "lscpu | grep 'Thread(s) per core' | awk '{print $4}'",
  cpuUsage: "mpstat 1 1 | awk '/Average/ {printf \"%.2f%%\", 100 - $NF}'",
  gpu: "lspci | grep -i vga | cut -d ':' -f3 | sed 's/^ //g'",
  ram: "free -m | awk 'NR==2{printf \"%s MB / %s MB\", $3, $2}'",
  ramUsage: "free | awk 'NR==2{printf \"%.2f%%\", $3*100/$2}'",
  hdd: "df -h --total | grep 'total' | awk '{print $3, \"/\", $2}'",
  hddUsage: "df -h --total | grep 'total' | awk '{print $5}'",
  googlePing: "ping -c 1 google.com | grep 'time=' | awk -F '=' '{print $4}' | cut -d ' ' -f1 | awk '{print $1 \" ms\"}'",
  bmkgPing: "ping -c 1 bmkg.go.id | grep 'time=' | awk -F '=' '{print $4}' | cut -d ' ' -f1 | awk '{print $1 \" ms\"}'"
};

// Function to execute system commands safely
const fetchData = (callback) => {
  const results = {};
  const keys = Object.keys(commands);
  let count = 0;

  console.log("Executing system commands...");

  keys.forEach((key) => {
    const command = commands[key];

    if (typeof command !== 'string' || !command.trim()) {
      console.error(`Invalid command for ${key}:`, command);
      results[key] = 'Error';
      count++;
      if (count === keys.length) callback(results);
      return;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command for ${key}:`, stderr || error.message);
        results[key] = 'Error';
      } else {
        results[key] = stdout.trim();
      }
      count++;
      if (count === keys.length) {
        callback(results);
      }
    });
  });
};

// Function to fetch Earthworm status
const fetchEarthwormStatus = (callback) => {
  const command = `LC_ALL=C bash -i -c 'status | awk "/-----+/{flag=1; next} flag && NF {print \\$1, \\$2, \\$3, \\$NF}"'`;

  console.log("Fetching Earthworm status...");

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing shell command: ${error.message}`);
      callback([]);
      return;
    }

    if (stderr && !stderr.includes("using default config file startstop_unix.d")) {
      console.error(`Shell error output: ${stderr}`);
      callback([]);
      return;
    }

    const lines = stdout.trim().split("\n");
    if (lines.length === 0 || lines[0] === "") {
      console.warn("Warning: Earthworm is not running.");
      callback([]);
      return;
    }

    const processes = lines.map(line => {
      const [ProcessName, ProcessId, Status, Argument] = line.split(/\s+/);
      return { ProcessName, ProcessId, Status, Argument };
    });

    callback(processes);
  });
};

// MQTT Connection Event Handling
mqttClient.on('connect', () => {
  console.log('Connected to MQTT Broker.');
  startMQTTPublishing();
});

mqttClient.on('error', (err) => {
  console.error('MQTT Error:', err);
});

mqttClient.on('offline', () => {
  console.warn('MQTT Client is offline.');
});

mqttClient.on('reconnect', () => {
  console.log('Reconnecting to MQTT Broker...');
});

mqttClient.on('close', () => {
  console.warn('MQTT Connection closed.');
});

// Function to send data to MQTT at intervals
const startMQTTPublishing = () => {
  console.log("Starting MQTT publishing...");

  setInterval(() => {
    fetchData((hwData) => {
      try {
        const hwPayload = JSON.stringify(hwData);
        mqttClient.publish(hwTopic, hwPayload, { qos: 1 }, (err) => {
          if (err) {
            console.error('MQTT Publish Error (HW):', err);
          } else {
            console.log('Hardware Data sent to MQTT:', hwPayload);
          }
        });
      } catch (error) {
        console.error('Error in publishing hardware data:', error);
      }
    });

    fetchEarthwormStatus((ewData) => {
      try {
        const ewPayload = JSON.stringify(ewData);
        mqttClient.publish(ewTopic, ewPayload, { qos: 1 }, (err) => {
          if (err) {
            console.error('MQTT Publish Error (EW):', err);
          } else {
            console.log('Earthworm Data sent to MQTT:', ewPayload);
          }
        });
      } catch (error) {
        console.error('Error in publishing Earthworm data:', error);
      }
    });
  }, INFO_INTERVAL);
};
