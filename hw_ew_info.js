require('dotenv').config();
const { execSync, exec } = require('child_process');
const mqtt = require('mqtt');
const pool = require('./db');

// Load environment variables
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const INFO_INTERVAL = parseInt(process.env.INFO_INTERVAL || '10000');

const MY_IP = execSync("hostname -I | awk '{print $1}'").toString().trim();
const hwTopic = `${MY_IP}/status`;
const ewTopic = `${MY_IP}/ew_status`;

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

const fetchData = (callback) => {
  const results = {};
  const keys = Object.keys(commands);
  let count = 0;

  keys.forEach((key) => {
    const command = commands[key];
    exec(command, (error, stdout) => {
      results[key] = error ? 'Error' : stdout.trim();
      count++;
      if (count === keys.length) callback(results);
    });
  });
};

const fetchEarthwormStatus = (callback) => {
  const command = `LC_ALL=C bash -i -c 'status | awk "/-----+/{flag=1; next} flag && NF {print \\$1, \\$2, \\$3, \\$NF}"'`;

  exec(command, (error, stdout, stderr) => {
    if (error || (stderr && !stderr.includes("using default config"))) {
      callback([]);
      return;
    }

    const lines = stdout.trim().split("\n");
    if (lines.length === 0 || lines[0] === "") {
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

const insertHardwareInfoToDB = async (hwData) => {
  const dateInput = new Date();

  try {
    await pool.query(
      `INSERT INTO hw_ew_info (
        ip, os, hostname, uptime, cpu, cpuCores, cpuThreads, cpuUsage,
        gpu, ram, ramUsage, hdd, hddUsage, googlePing, bmkgPing, date_input
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        hwData.ip,
        hwData.os,
        hwData.hostname,
        hwData.uptime,
        hwData.cpu,
        hwData.cpuCores,
        hwData.cpuThreads,
        hwData.cpuUsage,
        hwData.gpu,
        hwData.ram,
        hwData.ramUsage,
        hwData.hdd,
        hwData.hddUsage,
        hwData.googlePing,
        hwData.bmkgPing,
        dateInput
      ]
    );

    console.log('✅ PostgreSQL insert success at', dateInput.toLocaleString());
  } catch (err) {
    console.error('❌ PostgreSQL Insert Error:', err.message);
  }
};

// Fungsi insert manual via terminal
const insertManual = () => {
  fetchData(async (hwData) => {
    console.log('🛠️ Manual insert triggered...');
    await insertHardwareInfoToDB(hwData);
    process.exit(0); // keluar setelah insert
  });
};

// MQTT handlers
mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  if (!process.argv.includes('--manual')) {
    startMQTTPublishing();
  }
});
mqttClient.on('error', (err) => console.error('MQTT Error:', err));
mqttClient.on('offline', () => console.warn('⚠️ MQTT Client offline.'));
mqttClient.on('reconnect', () => console.log('🔄 Reconnecting MQTT...'));
mqttClient.on('close', () => console.warn('🚪 MQTT connection closed.'));

let lastInsertedHour = null;

const startMQTTPublishing = () => {
  setInterval(() => {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();

    fetchData(async (hwData) => {
      try {
        const payload = JSON.stringify(hwData);
        mqttClient.publish(hwTopic, payload, { qos: 1 });
        console.log('📤 HW MQTT:', payload);

        if (currentMinute === 0 && currentHour !== lastInsertedHour) {
          await insertHardwareInfoToDB(hwData);
          lastInsertedHour = currentHour;
        }
      } catch (err) {
        console.error('❌ HW Publish Error:', err.message);
      }
    });

    fetchEarthwormStatus((ewData) => {
      try {
        const payload = JSON.stringify(ewData);
        mqttClient.publish(ewTopic, payload, { qos: 1 });
        console.log('📤 EW MQTT:', payload);
      } catch (err) {
        console.error('❌ EW Publish Error:', err.message);
      }
    });
  }, INFO_INTERVAL);
};

// Jalankan insert manual jika flag --manual digunakan
if (process.argv.includes('--manual')) {
  insertManual();
}
