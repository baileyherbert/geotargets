import 'source-map-support/register.js';
import { Google, VersionData, LocationEntity } from './google.js';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger.js';
import core from '@actions/core';

const saveFiles = {
    'City': 'cities',
    'Country': 'countries',
    'County': 'counties',
    'Postal Code': 'postal_codes',
    'Region': 'regions',
    'State': 'states'
};

class App {

    /**
     * Bootstrap.
     */
    public static async boot() {
        try {
            await this.getVersion();
        }
        catch (error) {
            logger.error('Encountered an error while building:');
            logger.error(error);
            core.setFailed(error as Error);
            process.exit(1);
        }
    }

    /**
     * Finds the latest version and download link of the remote file.
     */
    public static async getVersion() {
        logger.info('Remote: Fetching latest version...');

        let version = await Google.getLatestVersion();
        core.setOutput('date', version.date);

        if (!version.uri.match(/\.csv(\.zip)?/i)) {
            throw new Error('Target link is invalid.');
        }

        logger.info('Remote: Latest available version is %s.', version.date);

        // Read existing metadata file
        const metadataPath = path.resolve('builds/metadata.json');

        if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

            if (metadata.date === version.date) {
                core.setOutput('new_changes', 'false');
                logger.info('Geotargets: No new data is available, stopping.');
                return;
            }
        }

        // Continue to download the file
        core.setOutput('new_changes', 'true');
        await this.downloadFile(version);
    }

    /**
     * Downloads the remote file.
     */
    private static async downloadFile(version: VersionData) {
        logger.info('Remote: Fetching %s', version.uri);

        // Download the file and compute size
        const content = await Google.getTargetFile(version.uri);
        const size = content.length / 1048576;

        // Debug download size
        logger.info('Remote: Fetched file successfully (%f MiB).', size.toFixed(2));

        // Continue to parse the file
        await this.parseFile(version, content);
    }

    /**
     * Parses the downloaded file.
     */
    private static async parseFile(version: VersionData, content: Buffer) {
        logger.info('Geotargets: Starting build...');

        const entities = Google.getLocationEntities(content);

        if (!entities.length) {
            throw new Error('No entities available in the file.');
        }

        logger.info('Geotargets: Parsed %s entities.', entities.length.toLocaleString());

        await this.writeFiles(version, entities);
    }

    /**
     * Prepares the output directory and starts building files.
     */
    private static async writeFiles(version: VersionData, entities: LocationEntity[]) {
        const buildsPath = path.resolve('builds');
        const jsonPath = path.resolve(buildsPath, 'json');
        const csvPath = path.resolve(buildsPath, 'csv');

        // Make directories
        if (!fs.existsSync(buildsPath)) fs.mkdirSync(buildsPath);
        if (!fs.existsSync(jsonPath)) fs.mkdirSync(jsonPath);
        if (!fs.existsSync(csvPath)) fs.mkdirSync(csvPath);

        const counts = new Map<string, number>();
        const csvFiles = new Map<string, string>();
        const jsonFiles = new Map<string, string>();

        // Write files
        for (let type in saveFiles) {
            const fileName = saveFiles[type as keyof typeof saveFiles];
            const targets = entities.filter(entity => entity.type === type).map((entity: any) => {
                delete entity.type;
                return entity;
            });

            await this.writeDataFile(targets, 'json', fileName);
            await this.writeDataFile(targets, 'csv', fileName);

            counts.set(fileName, targets.length);
            csvFiles.set(fileName, `csv/${fileName}.csv`);
            jsonFiles.set(fileName, `json/${fileName}.json`);
        }

        // Write new metadata
        const metadataPath = path.resolve(buildsPath, 'metadata.json');
        logger.info('Writing metadata file: %s', metadataPath);
        await fs.promises.writeFile(metadataPath, JSON.stringify({
            date: version.date,
            source: version.uri,
            counts: Object.fromEntries(counts),
            formats: {
                csv: Object.fromEntries(csvFiles),
                json: Object.fromEntries(jsonFiles)
            }
        }, null, '\t'));

        logger.info('Geotargets: Build completed.');
    }

    /**
     * Builds and writes the given entities to a file in the specified format.
     */
    private static async writeDataFile(entities: LocationEntity[], format: 'json' | 'csv', fileName: string) {
        const savePath = path.resolve('builds', format, `${fileName}.${format}`);
        let saveData = '';

        // Write csv format
        if (format == 'csv') {
            saveData = 'Id,Name,Canonical,Region,Country,Country Code\n';

            entities.forEach(target => {
                saveData += `"${target.id}","${target.name}","${target.canonical}","${target.region||''}","${target.country}","${target.countryCode}"\n`;
            });
        }

        // Write json format
        else if (format == 'json') {
            saveData = JSON.stringify(entities, null, 4);
        }

        // Save the file
        fs.writeFileSync(savePath, saveData);

        // Debug file size
        const size = saveData.length / 1048576;
        logger.info('Geotargets: Built %s (%f MiB)', savePath, size.toFixed(2));
    }

}

await App.boot();
