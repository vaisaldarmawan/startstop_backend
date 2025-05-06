#!/bin/bash

# Path ke file .env
ENV_FILE="/root/sispro/startstop_backend/.env"

# Definisi warna untuk output
export RED='\033[0;31m'
export YELLOW='\033[1;33m'
export GREEN='\e[32m'
export NC='\033[0m' # No Color

# Pastikan user berada di home directory
cd ~
sleep 1s
reset

# Cek apakah file .env ada
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: File $ENV_FILE tidak ditemukan!${NC}"
    exit 1
fi

# Fungsi untuk memastikan nilai default pada .env jika belum ada
function ensure_env_variable {
    local var_name="$1"
    local default_value="$2"
    if ! grep -q "^$var_name=" "$ENV_FILE"; then
        echo "$var_name=$default_value" >> "$ENV_FILE"
    fi
}

# Menjamin variabel .env ada sebelum diedit
ensure_env_variable "MQTT_HOST" "localhost"
ensure_env_variable "MQTT_PORT" "1111"
ensure_env_variable "MQTT_USERNAME" "user"
ensure_env_variable "MQTT_PASSWORD" "password"
ensure_env_variable "INFO_INTERVAL" "5000"
ensure_env_variable "LOG_INTERVAL" "5000"
ensure_env_variable "DB_HOST" "localhost"
ensure_env_variable "DB_USER" "user"
ensure_env_variable "DB_PORT" "1111"
ensure_env_variable "DB_PASSWORD" "password"
ensure_env_variable "DB_NAME" "database"
ensure_env_variable "DB_CONNECTION_LIMIT" "10"

# Konfigurasi input pengguna
echo -e "${GREEN}Konfigurasi MQTT :${NC}"

while true; do
    read -p "MQTT HOST (IP xx.xx.xx.xx atau URL) : " MQTT_HOST
    if [[ -z "$MQTT_HOST" ]]; then
        MQTT_HOST="localhost"
        break
    elif [[ "$MQTT_HOST" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ || "$MQTT_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        break
    else
        echo -e "${YELLOW}WARN: Masukkan IP atau URL yang valid.${NC}"
    fi
done

while true; do
    read -p "MQTT PORT (default: 1883) : " MQTT_PORT
    if [[ -z "$MQTT_PORT" ]]; then
        MQTT_PORT="1883"
        break
    elif [[ "$MQTT_PORT" =~ ^[0-9]+$ && "$MQTT_PORT" -gt 0 && "$MQTT_PORT" -le 65535 ]]; then
        break
    else
        echo -e "${YELLOW}WARN: Masukkan angka antara 1 - 65535.${NC}"
    fi
done

read -p "MQTT USERNAME : " MQTT_USERNAME
while [[ -z "$MQTT_USERNAME" ]]; do
    echo -e "${YELLOW}WARN: Username tidak boleh kosong.${NC}"
    read -p "MQTT USERNAME : " MQTT_USERNAME
done

read -sp "MQTT PASSWORD : " MQTT_PASSWORD
while [[ -z "$MQTT_PASSWORD" ]]; do
    echo -e "\n${YELLOW}WARN: Password tidak boleh kosong.${NC}"
    read -sp "MQTT PASSWORD : " MQTT_PASSWORD
done
echo -e "\n"

echo -e "${GREEN}Konfigurasi Interval (milisecond) :${NC}"
while true; do
    read -p "Interval Hw Monitor (default: 5000) : " INFO_INTERVAL
    if [[ -z "$INFO_INTERVAL" ]]; then
        INFO_INTERVAL="5000"
        break
    elif [[ "$INFO_INTERVAL" =~ ^[0-9]+$ && "$INFO_INTERVAL" -ge 5000 ]]; then
        break
    else
        echo -e "${YELLOW}WARN: Anda hanya bisa memasukkan angka minimal 5000.${NC}"
    fi
done

while true; do
    read -p "Interval Ew Monitor (default: 5000) : " LOG_INTERVAL
    if [[ -z "$LOG_INTERVAL" ]]; then
        LOG_INTERVAL="5000"
        break
    elif [[ "$LOG_INTERVAL" =~ ^[0-9]+$ && "$LOG_INTERVAL" -ge 5000 ]]; then
        break
    else
        echo -e "${YELLOW}WARN: Anda hanya bisa memasukkan angka minimal 5000.${NC}"
    fi
done
echo -e "\n"

echo -e "${GREEN}Konfigurasi PostgreSQL :${NC}"

read -p "DB HOST (default: localhost) : " DB_HOST
if [[ -z "$DB_HOST" ]]; then DB_HOST="localhost"; fi

read -p "DB USER (default: user) : " DB_USER
if [[ -z "$DB_USER" ]]; then DB_USER="user"; fi

while true; do
    read -p "DB PORT (default: 5432) : " DB_PORT
    if [[ -z "$DB_PORT" ]]; then
        DB_PORT="5432"
        break
    elif [[ "$DB_PORT" =~ ^[0-9]+$ && "$DB_PORT" -gt 0 && "$DB_PORT" -le 65535 ]]; then
        break
    else
        echo -e "${YELLOW}WARN: Masukkan angka antara 1 - 65535.${NC}"
    fi
done

read -sp "DB PASSWORD : " DB_PASSWORD
while [[ -z "$DB_PASSWORD" ]]; do
    echo -e "\n${YELLOW}WARN: Password tidak boleh kosong.${NC}"
    read -sp "DB PASSWORD : " DB_PASSWORD
done
echo -e "\n"

read -p "DB NAME (default: database) : " DB_NAME
if [[ -z "$DB_NAME" ]]; then DB_NAME="database"; fi

read -p "DB CONNECTION LIMIT (default: 10) : " DB_CONNECTION_LIMIT
if [[ -z "$DB_CONNECTION_LIMIT" ]]; then DB_CONNECTION_LIMIT="10"; fi

# Perbarui nilai di file .env
sed -i "s/^MQTT_HOST=.*/MQTT_HOST=$MQTT_HOST/" "$ENV_FILE"
sed -i "s/^MQTT_PORT=.*/MQTT_PORT=$MQTT_PORT/" "$ENV_FILE"
sed -i "s/^MQTT_USERNAME=.*/MQTT_USERNAME=$MQTT_USERNAME/" "$ENV_FILE"
sed -i "s/^MQTT_PASSWORD=.*/MQTT_PASSWORD=$MQTT_PASSWORD/" "$ENV_FILE"
sed -i "s/^INFO_INTERVAL=.*/INFO_INTERVAL=$INFO_INTERVAL/" "$ENV_FILE"
sed -i "s/^LOG_INTERVAL=.*/LOG_INTERVAL=$LOG_INTERVAL/" "$ENV_FILE"
sed -i "s/^DB_HOST=.*/DB_HOST=$DB_HOST/" "$ENV_FILE"
sed -i "s/^DB_USER=.*/DB_USER=$DB_USER/" "$ENV_FILE"
sed -i "s/^DB_PORT=.*/DB_PORT=$DB_PORT/" "$ENV_FILE"
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=\"$DB_PASSWORD\"/" "$ENV_FILE"
sed -i "s/^DB_NAME=.*/DB_NAME=$DB_NAME/" "$ENV_FILE"
sed -i "s/^DB_CONNECTION_LIMIT=.*/DB_CONNECTION_LIMIT=$DB_CONNECTION_LIMIT/" "$ENV_FILE"

echo -e "${YELLOW}Konfigurasi berhasil diperbarui pada $ENV_FILE${NC}"

# Restart aplikasi dengan PM2 dengan animasi loading
echo " "
echo -ne "${GREEN}Restarting services "
for i in {1..7}; do
    echo -ne "."
    sleep 1
done
echo -e "${NC}"

pm2 restart hw_ew_info.js 
pm2 restart ew_to_command.js 

echo -e "${GREEN}Selesai.${NC}"
