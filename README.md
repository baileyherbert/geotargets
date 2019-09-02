# Geotargets

## Introduction

This repository maintains builds of geographical targets from around the world. The builds are separated into categories and are available in two formats (`json` and `csv`). The following categories are collected:

- Cities
- Countries
- Counties
- Postal codes
- Regions
- States

## Builds

The latest builds are available under the `builds` directory in the repository. You can also find archives containing all files in the [releases](https://github.com/baileyherbert/geotargets/releases) tab.

- CSV: https://github.com/baileyherbert/geotargets/tree/master/builds/csv
- JSON: https://github.com/baileyherbert/geotargets/tree/master/builds/json

## Usage

To build these files locally, you need to have Node.js installed and must clone this repository onto your desktop. Then open a terminal in root directory and run:

```
npm run build
```

The script will download the latest data from Google, process it, and then write its output files in the `builds` directory.