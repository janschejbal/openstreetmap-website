#!/bin/bash

while [[ true ]]; do
{
	/var/openstreetmap/update-osm-data.sh
	sleep 60;
};
done
