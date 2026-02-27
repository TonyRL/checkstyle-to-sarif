# checkstyle-to-sarif

Convert Checkstyle XML output to Static Analysis Results Interchange Format (SARIF) v2.1.0.

## Usage

### File Input

```bash
npx checkstyle-to-sarif --input /path/to/checkstyle.xml --output /path/to/results.sarif
```

### stdin

```bash
cat /path/to/checkstyle.xml | npx checkstyle-to-sarif --output /path/to/results.sarif
```

### stdout

```bash
npx checkstyle-to-sarif --input /path/to/checkstyle.xml > /path/to/results.sarif
```

### Aliases

```bash
npx checkstyle-to-sarif -i /path/to/checkstyle.xml -o /path/to/results.sarif
```

## CLI Options

- --input <path>, -i <path>: path to the Checkstyle XML input file
- --output <path>, -o <path>: path to write SARIF output (defaults to stdout)
- --help: show help
- --version: show version

## Node.js Usage

```ts
import { convertCheckstyleToSarif } from 'checkstyle-to-sarif'
import { readFile, writeFile } from 'node:fs/promises'

const xml = await readFile('checkstyle.xml', 'utf-8')
const sarif = convertCheckstyleToSarif(xml)
await writeFile('results.sarif', sarif, 'utf-8')
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
