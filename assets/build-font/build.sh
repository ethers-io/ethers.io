#!/bin/bash

rm -rf ../../static/ethers.woff
fontforge -script $PWD/builder/scripts/generate_font.py
./builder/scripts/sfnt2woff ./fonts/ethers.ttf 
cp ./fonts/ethers.woff ../../static
