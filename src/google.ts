import * as request from 'request';

const parseLineRegex = /^"(\d+)","([^"]+)","([^"]+)","(\d+)?","([A-Z]+)","([\w\s]+)",.+$/;
const consideredTypes: LocationType[] = ['City', 'Country', 'County', 'Postal Code', 'Region', 'State'];

export class Google {

    /**
     * Downloads and returns the latest version of the geotargets file.
     */
    public static getLatestVersion() : Promise<VersionData> {
        return new Promise((resolve, reject) => {
            request('https://developers.google.com/adwords/api/docs/appendix/geotargeting', (err, response, body) => {
                if (err) return reject(err);
                if (response.statusCode !== 200) return reject(new Error(`Received status code ${response.statusCode}.`));

                // Let's use a simple regular expression to find the latest csv link
                let match = /<a href="([^"]+)">Latest .csv \((\d+-\d+-\d+)\)<\/a>/.exec(body);

                // If successful, the expression will match both the url and the version
                if (match) {
                    let uri = match[1];
                    if (uri.startsWith('/')) uri = 'https://developers.google.com' + uri;

                    return resolve({
                        date: match[2],
                        uri
                    });
                }

                // Otherwise, throw an error
                throw new Error('Failed to locate download link');
            });
        });
    }

    /**
     * Downloads the file at the given URI and returns the content as a string.
     */
    public static getTargetFile(uri: string) : Promise<string> {
        return new Promise((resolve, reject) => {
            request(uri, (err, response, body) => {
                if (err) return reject(err);
                if (response.statusCode !== 200) return reject(new Error(`Received status code ${response.statusCode}.`));
                if (!body.startsWith('Criteria ID')) return reject(new Error('File content is corrupt or malformed.'));

                return resolve(body);
            });
        });
    }

    /**
     * Parses the given string into an array of location entities.
     */
    public static getLocationEntities(content: string) : LocationEntity[] {
        // Remove the header line
        content = content.substr(content.indexOf('\n') + 1).trim();

        // Split the content into an array of lines
        let lines = content.split(/(?:\r?\n)+/);

        // Parse the lines
        let entities = lines.map<LocationEntity>((line, index) => {
            let match = parseLineRegex.exec(line);

            // If there is no match, throw an error
            if (!match) {
                throw new Error(`Regular expression failed on line #${index + 2}.`);
            }

            // Skip locations whose types are not considered
            if (consideredTypes.indexOf(match[6] as any) < 0) return;

            // Parse the canonical
            let canonical = this.parseCanonical(match[2], match[3]);
            if (!canonical) return;

            // Extract and format data
            let id = parseInt(match[1]);
            let name = match[2];
            let type = match[6] as LocationType;
            let region = canonical.region;
            let country = { name: canonical.country, code: match[5].toLowerCase() };

            // Return the entity
            return {
                id,
                name,
                canonical: match[3],
                region,
                country: country.name,
                countryCode: country.code,
                type
            };
        });

        // Filter out undefined values
        return entities.filter(entity => typeof entity !== 'undefined');
    }

    /**
     * Returns the name of the region from the given canonical.
     */
    private static parseCanonical(name: string, canonical: string): LocationCanonical | undefined {
        if (name === canonical) {
            return { country: name };
        }

        if (!canonical.startsWith(`${name},`)) {
            let commaCount = (canonical.match(/,/g) || []).length;
            if (commaCount === 2) name = canonical.substr(0, canonical.indexOf(','));
            else return;
        }

        let stateName = canonical.substr(name.length + 1);
        let comma = stateName.lastIndexOf(',');

        let region = stateName.substr(0, comma);
        let country = stateName.substr(comma + 1);

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
