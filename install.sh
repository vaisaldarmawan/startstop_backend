#!/bin/bash

# ANSI color codes
YELLOW='\e[33m'
GREEN='\e[32m'
RED='\e[31m'
NC='\e[0m' # No Color

# Mengecek apakah skrip dijalankan oleh user root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Program ini hanya bisa dijalankan oleh superuser. Harap jalankan kembali program ini menggunakan user 'root'.${NC}"
   exit 1
fi

# Fungsi untuk animasi loading di samping teks
loading() {
    local pid=$1
    local message=$2
    local delay=0.1
    local spin='|/-\'

    while ps -p $pid > /dev/null 2>&1; do
        for i in $(seq 0 3); do
            echo -ne "\r$message [${spin:$i:1}]"
            sleep $delay
        done
    done

    # Mengecek status exit code dari proses
    wait $pid
    exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo -ne "\r$message [${GREEN}DONE${NC}]          \n"
    else
        echo -ne "\r$message [${RED}ERROR${NC}]          \n"
        echo -e "${RED}Terjadi kesalahan saat menjalankan: $message${NC}"
    fi
}

cd
sleep 1s
reset
echo " "
echo " "
echo " "
echo " >> Proses Installasi akan segera dimulai . . ."
sleep 1s

echo -ne " >> Update Repository [ ]"
dnf check-update > /dev/null 2>&1 &
loading $! " >> Update Repository"

echo -ne " >> Update Package [ ]"
dnf update -y > /dev/null 2>&1 &
loading $! " >> Update Package"

echo -ne " >> Menginstall git [ ]"
dnf install git -y > /dev/null 2>&1 &
loading $! " >> Menginstall git"

echo -ne " >> Menginstall Node JS Versi Terbaru [ ]"
curl -fsSL https://rpm.nodesource.com/setup_current.x | sudo bash - > /dev/null 2>&1 &
loading $! " >> Mengunduh Repository Node JS"

dnf install nodejs -y > /dev/null 2>&1 &
loading $! " >> Menginstall Node JS Versi Terbaru"

echo -ne " >> Menginstall PM2 global [ ]"
npm install -g pm2 > /dev/null 2>&1 &
loading $! " >> Menginstall PM2 global"

echo -ne " >> Menghentikan Service Crontab [ ]"
systemctl stop crond > /dev/null 2>&1 &
loading $! " >> Menghentikan Service Crontab"

cd
echo -ne " >> Membuat direktori sispro [ ]"
mkdir sispro > /dev/null 2>&1 &
loading $! " >> Membuat direktori sispro"

cd sispro

echo -ne " >> Mengunduh & Menginstall File Backend Sispro [ ]"
git clone https://github.com/vaisaldarmawan/startstop_backend.git > /dev/null 2>&1 &
loading $! " >> Mengunduh & Menginstall File Backend Sispro"

rm -rf startstop_backend/.git

cd startstop_backend
mv .env_example .env

echo -ne " >> Memasukan command ke dalam crontab [ ]"
line1="@reboot screen -dmS startstop startstop"
(crontab -u $(whoami) -l; echo "$line1" ) | crontab -u $(whoami) - &> /dev/null &
loading $! " >> Memasukan command ke dalam crontab"

echo -ne " >> Mendaftarkan command ke PM2 [ ]"
pm2 start ew_to_command.js --name ew_to_command.js > /dev/null 2>&1 &
loading $! " >> Mendaftarkan ew_to_command.js ke PM2"

echo -ne " >> Menginstall modul dotenv [ ]"
npm install -g dotenv --save > /dev/null 2>&1 &
loading $! " >> Menginstall modul dotenv"

echo -ne " >> Menginstall modul mqtt [ ]"
npm install -g mqtt --save > /dev/null 2>&1 &
loading $! " >> Menginstall modul mqtt"

echo -ne " >> Menginstall modul sysstat [ ]"
sudo dnf install -y sysstat > /dev/null 2>&1 &
loading $! " >> Menginstall modul sysstat"

echo -ne " >> Menginstall modul pciutils [ ]"
sudo dnf install -y pciutils > /dev/null 2>&1 &
loading $! " >> Menginstall modul pciutils"

echo -ne " >> Menginstall modul net-tools [ ]"
sudo dnf install -y net-tools > /dev/null 2>&1 &
loading $! " >> Menginstall modul net-tools"

echo -ne " >> Menginstall modul util-linux [ ]"
sudo dnf install -y util-linux > /dev/null 2>&1 &
loading $! " >> Menginstall modul util-linux"

echo -ne " >> Menginstall modul hostname [ ]"
sudo dnf install -y hostname > /dev/null 2>&1 &
loading $! " >> Menginstall modul hostname"

echo -ne " >> Menginstall modul iproute [ ]"
sudo dnf install -y iproute > /dev/null 2>&1 &
loading $! " >> Menginstall modul iproute"

echo -ne " >> Menginstall modul procps-ng [ ]"
sudo dnf install -y procps-ng > /dev/null 2>&1 &
loading $! " >> Menginstall modul procps-ng"

echo -ne " >> Menginstall modul coreutils [ ]"
sudo dnf install -y coreutils > /dev/null 2>&1 &
loading $! " >> Menginstall modul coreutils"

echo -ne " >> Menginstall modul findutils [ ]"
sudo dnf install -y findutils > /dev/null 2>&1 &
loading $! " >> Menginstall modul findutils"

pm2 start hw_ew_info.js --name hw_ew_info.js > /dev/null 2>&1 &
loading $! " >> Mendaftarkan hw_ew_info.js ke PM2"

pm2 startup systemd > /dev/null 2>&1 &
loading $! " >> Mengatur PM2 sebagai startup systemd"

env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root > /dev/null 2>&1 &
loading $! " >> Mengaktifkan PM2 pada root"

pm2 save > /dev/null 2>&1 &
loading $! " >> Menyimpan konfigurasi PM2"

echo " "
echo " "
echo "============================= "
echo " >> Installasi Selesai !! << "
echo "============================= "
echo " "
echo " - Versi Node JS : $(node -v)"
echo " - Versi PM2 : $(pm2 -v)"
echo " - PM2 List :"
pm2 list
echo " "
echo " "
echo -e "  ${YELLOW}- Note :${NC}"
echo -e "  ${YELLOW}  Silahkan edit file '.env' di dalam folder 'startstop_backend' ${NC}"
