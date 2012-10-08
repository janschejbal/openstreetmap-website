#!/bin/bash
set -e

echo -e "\n\n\n"
echo "===== Starting OSM data maintenance ================================"
echo -n "Time: "
date --rfc-3339=seconds
echo -e "\n"


echo "===> Dumping planet..."
time /var/openstreetmap/osmosis-0.41/bin/osmosis --read-apidb host="localhost" database="openstreetmap" user="openstreetmap" password="r5DvuFkZnaWQexGavpM8" --write-xml file="/var/openstreetmap/tmp/planet.osm"
echo -e "\n\n"

echo "===> Updating overpass DB..."
time /var/openstreetmap/overpass/bin/update_database --db-dir=/var/openstreetmap/overpass-db/ --meta < /var/openstreetmap/tmp/planet.osm
echo -e "\n\n"

echo "===> Compressing planet..."
time gzip -c /var/openstreetmap/tmp/planet.osm > /var/openstreetmap/tmp/planet.osm.gz
echo -e "\n\n"

echo "===> Moving files to dump directory..."
mv /var/openstreetmap/tmp/planet.osm /var/openstreetmap/dumps/planet.osm
mv /var/openstreetmap/tmp/planet.osm.gz /var/openstreetmap/dumps/planet.osm.gz
# ensure both files have exactly the same timestamp
touch /var/openstreetmap/dumps/planet.osm /var/openstreetmap/dumps/planet.osm.gz

echo "===> Cleanup XAPI temp files..."
mkdir -p "/tmp/translate_xapi/"
find /tmp/translate_xapi/ -mmin +240 -exec rm {} \;

echo "===> done - finished all operations sucessfully"
echo -n "Time: "
date --rfc-3339=seconds
echo "===================================================================="
