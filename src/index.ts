import { Google, VersionData, LocationEntity, LocationType } from './google';
import * as path from 'path';
import * as fs from 'fs';

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
            console.error('Encountered an error while building:');
            console.error(error);
            process.exit(1);
        }
    }

    /**
     * Finds the latest version and download link of the remote file.
     */
    public static async getVersion() {
        console.log('Remote: Fetching latest version...');

        let version = await Google.getLatestVersion();
        if (!version.uri.endsWith('.csv')) throw new Error('Target link is invalid.');

        console.log('Remote: Latest available version is %s.', version.date);

        // Continue to download the file
        await this.downloadFile(version);
    }

    /**
     * Downloads the remote file.
     */
    private static async downloadFile(version: VersionData) {
        console.log('Remote: Fetching %s', version.uri);

        // Download the file and compute size
        let content = await Google.getTargetFile(version.uri);
        let size = content.length / 1048576;

        // Debug download size
        console.log('Remote: Fetched file successfully (%f MiB).', size.toFixed(2));
        console.log();

        // Continue to parse the file
        await this.parseFile(content);
    }

    /**
     * Parses the downloaded file.
     */
    private static async parseFile(content: string) {
        console.log('Geotargets: Starting build...');

        let entities = Google.getLocationEntities(content);
        if (!entities.length) throw new Error('No entities available in the file.');

        console.log('Geotargets: Parsed %s entities.', entities.length.toLocaleString());

        await this.writeFiles(entities);
    }

    /**
     * Prepares the output directory and starts building files.
     */
    private static async writeFiles(entities: LocationEntity[]) {
        let buildsPath = path.join(__dirname, '../', 'builds');
        let jsonPath = path.join(buildsPath, 'json');
        let csvPath = path.join(buildsPath, 'csv');

        // Make directories
        if (!fs.existsSync(buildsPath)) fs.mkdirSync(buildsPath);
        if (!fs.existsSync(jsonPath)) fs.mkdirSync(jsonPath);
        if (!fs.existsSync(csvPath)) fs.mkdirSync(csvPath);

        // Write files
        for (let type in saveFiles) {
            let fileName = saveFiles[type];
            let targets = entities.filter(entity => entity.type === type).map(entity => {
                delete entity.type;
                return entity;
            });

            await this.writeDataFile(targets, 'json', fileName);
            await this.writeDataFile(targets, 'csv', fileName);
        }

        console.log('Geotargets: Build completed.');
    }

    /**
     * Builds and writes the given entities to a file in the specified format.
     */
    private static async writeDataFile(entities: LocationEntity[], format: 'json' | 'csv', fileName: string) {
        let savePath = path.join(__dirname, '../', 'builds', format, `${fileName}.${format}`);
        let saveData = '';

        // Write csv format
        if (format == 'csv') {
            saveData = 'Id,Name,Region,Country,Country Code\n';

            entities.forEach(target => {
                saveData += `"${target.id}","${target.name}","${target.region||''}","${target.country}","${target.countryCode}"\n`;
            });
        }

        // Write json format
        else if (format == 'json') {
            saveData = JSON.stringify(entities, null, 4);
        }

        // Save the file
        fs.writeFileSync(savePath, saveData);

        // Debug file size
        let size = saveData.length / 1048576;
        console.log('Geotargets: Built %s (%f MiB)', savePath, size.toFixed(2));
    }

}

App.boot();
