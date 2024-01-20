# Geotargets

This repository maintains builds of geographical targets from Google Ads. When new changes are published by Google, they will be automatically merged into the repository within 24 hours, along with a metadata file containing build information.

## Files

Go to the [builds](https://github.com/baileyherbert/geotargets/tree/master/builds) folder to browse compiled files in CSV or JSON format.

- Cities
- Countries
- Counties
- Postal codes
- Regions
- States

## Automation

The data format in this repository will not change, so it is safe to fetch and use its content directly. The entry point for any automation should be the `metadata.json` file which is hosted at the following public link:

> https://raw.githubusercontent.com/baileyherbert/geotargets/master/builds/metadata.json

The date in the metadata can be recorded to detect when new updates are available. The metadata also includes organized links to each data file in their respective formats, which can all be downloaded directly.
