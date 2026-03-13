#!/bin/bash

for folder in */; do
    if [ -f "$folder/package.json" ]; then
        echo "npm install in $folder"
        (cd "$folder" && npm install)
    fi
done