import fetch from 'node-fetch';
import { parse } from 'node-html-parser';
import AdmZip from 'adm-zip';

const consideredTypes: LocationType[] = ['City', 'Country', 'County', 'Postal Code', 'Region', 'State'];

export class Google {

    /**
     * Downloads and returns the latest version of the geotargets file.
     */
    public static async getLatestVersion(): Promise<VersionData> {
        const response = await fetch('https://developers.google.com/adwords/api/docs/appendix/geotargeting');

        if (!response.ok) {
            throw new Error(`Received status code ${response.status}.`);
        }

        const body = await response.text();
        const document = parse(body);
        const linkElements = document.querySelectorAll('a[href]');
        const matchingElement = linkElements.find(link => /latest/i.test(link.text) && /csv/i.test(link.text));

        if (!matchingElement) {
            throw new Error('Failed to locate download link');
        }

        const date = matchingElement.text.match(/(\d{4}-\d{2}-\d{2})/);
        const uri = (new URL(matchingElement.getAttribute('href')!, response.url)).toString();

        if (!date) {
            throw new Error('Failed to locate date in download link');
        }

        return {
            date: date[1],
            uri
        };
    }

    /**
     * Downloads the file at the given URI and returns the content as a string.
     */
    public static async getTargetFile(uri: string): Promise<Buffer> {
        const response = await fetch(uri);

        if (!response.ok) {
            throw new Error(`Received status code ${response.status}.`);
        }

        const body = Buffer.from(await response.arrayBuffer());

        return body;
    }

    /**
     * Parses the given buffer into an array of location entities.
     */
    public static getLocationEntities(binary: Buffer) : LocationEntity[] {
        const zip = new AdmZip(binary);
        const zipEntries = zip.getEntries();
        const targetFileName = zipEntries.map(e => e.entryName).find(name => /\.csv$/i.test(name));

        if (!targetFileName) {
            throw new Error('Failed to locate target file in zip archive.');
        }

        const entry = zip.getEntry(targetFileName)!;
        let content = entry.getData().toString('utf8');

        // Remove the header line
        content = content.substring(content.indexOf('\n') + 1).trim();

        // Split the content into an array of lines
        const lines = content.split(/(?:\r?\n)+/);

        // Parse the lines
        const entities = lines.map<LocationEntity | undefined>((line, index) => {
            const values = this.parseLine(line);

            // If there are less than 6 values, throw an error
            if (values.length < 6) {
                console.error(line);
                throw new Error(`Parsing failed on line #${index + 2} (not enough values)`);
            }

            // Skip locations whose types are not considered
            if (consideredTypes.indexOf(values[5] as any) < 0) return;

            // Parse the canonical
            const canonical = this.parseCanonical(values[1], values[2]);
            if (!canonical) return;

            // Extract and format data
            const id = parseInt(values[0]);
            const name = values[1];
            const type = values[5] as LocationType;
            const region = canonical.region;
            const country = { name: canonical.country, code: values[4].toLowerCase() };

            // Return the entity
            return {
                id,
                name,
                canonical: values[2],
                region,
                country: country.name,
                countryCode: country.code,
                type
            };
        });

        // Filter out undefined values
        return entities.filter(entity => typeof entity !== 'undefined') as LocationEntity[];
    }

    /**
     * Parses the given CSV line into an array of values.
     *
     * @param line
     * @returns
     */
    private static parseLine(line: string): string[] {
        const values = new Array<string>();

        let currentValue = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (inQuotes) {
                if (char === '"' && (nextChar === undefined || nextChar === ',')) {
                    values.push(currentValue);
                    currentValue = '';
                    inQuotes = false;
                }
                else {
                    currentValue += char;
                }
            }
            else {
                // Skip commas
                if (char === ',') {
                    continue;
                }

                // Skip whitespace
                if (char === ' ') {
                    continue;
                }

                // Check for quotes
                if (char === '"') {
                    inQuotes = true;
                }
                else {
                    currentValue += char;
                }
            }
        }

        if (currentValue.length > 0) {
            values.push(currentValue);
        }

        return values;
    }

    /**
     * Returns the name of the region from the given canonical.
     */
    private static parseCanonical(name: string, canonical: string): LocationCanonical | undefined {
        if (name === canonical) {
            return { country: name };
        }

        if (!canonical.startsWith(`${name},`)) {
            const commaCount = (canonical.match(/,/g) || []).length;
            if (commaCount === 2) name = canonical.substring(0, canonical.indexOf(','));
            else return;
        }

        const stateName = canonical.substring(name.length + 1);
        const comma = stateName.lastIndexOf(',');

        const region = stateName.substr(0, comma);
        const country = stateName.substr(comma + 1);

        return { region, country };
    }

}

export type VersionData = {
    date: string;
    uri: string;
};

export type LocationEntity = {
    id: number;
    type: LocationType;
    name: string;
    region?: string;
    country: string;
    countryCode: string;
    canonical: string;
};

export type LocationType = 'City' | 'Country' | 'County' | 'Postal Code' | 'Region' | 'State' | 'Territory';

export type LocationCanonical = {
    region?: string;
    country: string;
};
