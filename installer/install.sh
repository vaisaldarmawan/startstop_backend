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

# Fungsi untuk animasi loading di samping teks dan menangkap error
loading() {
    local pid=$1
    local message=$2
    local tmpfile=$3
    local delay=0.1
    local spin='|/-\'

    while ps -p $pid > /dev/null 2>&1; do
        for i in $(seq 0 3); do
            echo -ne "\r$message [${spin:$i:1}]"
            sleep $delay
        done
    done

    wait $pid
    exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo -ne "\r$message [${GREEN}DONE${NC}]          \n"
    else
        echo -ne "\r$message [${RED}ERROR${NC}]          \n"

        if [[ -s $tmpfile ]]; then
            cat $tmpfile | while read line; do
                echo -e "${RED} >> $line${NC}"
            done
        fi
    fi

    rm -f $tmpfile
}

cd
sleep 1s
reset
echo " "
echo " "
echo " "
echo -ne "${GREEN}Proses Installasi akan segera dimulai "
for i in {1..5}; do
    echo -ne "."
    sleep 1
done
echo -e "${NC}"

echo -ne " >> Update Repository & Package [ ]"
dnf update -y > /dev/null 2> update_error.log &
loading $! " >> Update Repository & Package" "update_error.log"

echo -ne " >> Menginstall git [ ]"
dnf install git -y > /dev/null 2> git_error.log &
loading $! " >> Menginstall git" "git_error.log"

echo -ne " >> Mengunduh Repository Node JS [ ]"
curl -fsSL https://rpm.nodesource.com/setup_current.x | bash - > /dev/null 2> node_repo_error.log &
loading $! " >> Mengunduh Repository Node JS" "node_repo_error.log"

echo -ne " >> Menginstall Node JS Versi Terbaru [ ]"
dnf install nodejs -y > /dev/null 2> node_install_error.log &
loading $! " >> Menginstall Node JS Versi Terbaru" "node_install_error.log"

echo -ne " >> Menginstall PM2 global [ ]"
npm install -g pm2 > /dev/null 2> pm2_error.log &
loading $! " >> Menginstall PM2 global" "pm2_error.log"

echo -ne " >> Menghentikan Service Crontab [ ]"
systemctl stop crond > /dev/null 2> crontab_error.log &
loading $! " >> Menghentikan Service Crontab" "crontab_error.log"

cd
echo -ne " >> Mengecek Direktori startstop_backend [ ]"
if [ -d "sispro/startstop_backend" ]; then
    rm -rf sispro/startstop_backend > /dev/null 2> dir_remove_error.log &
    loading $! " >> Menghapus Direktori startstop_backend" "dir_remove_error.log"
else
    echo -ne "\r >> Mengecek Direktori startstop_backend [${GREEN}NOT FOUND${NC}]\n"
fi

echo -ne " >> Membuat direktori sispro [ ]"
mkdir -p sispro > /dev/null 2> mkdir_error.log &
loading $! " >> Membuat direktori sispro" "mkdir_error.log"

cd sispro

echo -ne " >> Mengunduh & Menginstall File Backend Sispro [ ]"
git clone https://github.com/vaisaldarmawan/startstop_backend.git > /dev/null 2> git_clone_error.log &
loading $! " >> Mengunduh & Menginstall File Backend Sispro" "git_clone_error.log"

rm -rf startstop_backend/.git

cd startstop_backend

echo -ne " >> Mengubah nama file .env_example menjadi .env [ ]"
mv .env_example .env > /dev/null 2> mv_error.log &
loading $! " >> Mengubah nama file .env_example menjadi .env" "mv_error.log"

echo -ne " >> Mengecek proses PM2 [ ]"
if pm2 list | grep -q "ew_to_command.js"; then
    pm2 delete ew_to_command.js > /dev/null 2> pm2_ew_delete_error.log &
    loading $! " >> Menghapus ew_to_command.js dari PM2" "pm2_ew_delete_error.log"
else
    echo -ne "\r >> Mengecek ew_to_command.js di PM2 [${GREEN}NOT FOUND${NC}]\n"
fi

if pm2 list | grep -q "hw_ew_info.js"; then
    pm2 delete hw_ew_info.js > /dev/null 2> pm2_hw_delete_error.log &
    loading $! " >> Menghapus hw_ew_info.js dari PM2" "pm2_hw_delete_error.log"
else
    echo -ne "\r >> Mengecek hw_ew_info.js di PM2 [${GREEN}NOT FOUND${NC}]\n"
fi

echo -ne " >> Memasukan command ke dalam crontab [ ]"
if crontab -l | grep -q "@reboot screen -dmS startstop startstop"; then
    echo -ne "\r >> Memasukan command ke dalam crontab [${GREEN}DONE${NC}]\n"
else
    (crontab -l; echo "@reboot screen -dmS startstop startstop") | crontab - &> /dev/null 2> crontab_add_error.log &
    loading $! " >> Memasukan command ke dalam crontab" "crontab_add_error.log"
fi


echo -ne " >> Menginstall modul dotenv [ ]"
npm install -g dotenv > /dev/null 2> dotenv_error.log &
npm install dotenv > /dev/null 2> dotenv_error.log &
loading $! " >> Menginstall modul dotenv" "dotenv_error.log"

echo -ne " >> Menginstall modul mqtt [ ]"
npm install -g mqtt > /dev/null 2> mqtt_error.log &
npm install mqtt > /dev/null 2> mqtt_error.log &
loading $! " >> Menginstall modul mqtt" "mqtt_error.log"

echo -ne " >> Mendaftarkan ew_to_command.js ke PM2 [ ]"
pm2 start ew_to_command.js --name ew_to_command.js > /dev/null 2> pm2_ew_error.log &
loading $! " >> Mendaftarkan ew_to_command.js ke PM2" "pm2_ew_error.log"

echo -ne " >> Mendaftarkan hw_ew_info.js ke PM2 [ ]"
pm2 start hw_ew_info.js --name hw_ew_info.js > /dev/null 2> pm2_hw_error.log &
loading $! " >> Mendaftarkan hw_ew_info.js ke PM2" "pm2_hw_error.log"

# Instalasi modul tambahan
for package in sysstat pciutils net-tools util-linux hostname iproute procps-ng coreutils findutils; do
    echo -ne " >> Menginstall modul ${package} [ ]"
    dnf install -y $package > /dev/null 2> ${package}_error.log &
    loading $! " >> Menginstall modul ${package}" "${package}_error.log"
done

echo -ne " >> Menghidupkan Service Crontab [ ]"
systemctl start crond > /dev/null 2> crontab_error.log &
loading $! " >> Menghidupkan Service Crontab" "crontab_error.log"

echo -ne " >> Mengatur PM2 sebagai startup systemd [ ]"
pm2 startup systemd > /dev/null 2> pm2_startup_error.log &
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
loading $! " >> Mengatur PM2 sebagai startup systemd" "pm2_startup_error.log"

echo -ne " >> Menyimpan konfigurasi PM2 [ ]"
pm2 save > /dev/null 2> pm2_save_error.log &
loading $! " >> Menyimpan konfigurasi PM2" "pm2_save_error.log"

echo -e " ${GREEN}"
echo " ============================= "
echo "  >> Installasi Selesai !! << "
echo " ============================= "
echo " "
echo " - Versi Node JS : $(node -v)"
echo " - Versi PM2 : $(pm2 -v)"
echo -e " ${NC}"
echo " "
echo -e "${YELLOW}NOTE : JALANKAN PROGRAM config.sh UNTUK MELAKUKAN KONFIGURASI.${NC}"
