# checkstyle-to-sarif

Convert Checkstyle XML output to Static Analysis Results Interchange Format (SARIF) v2.1.0.

## Usage

### File input

```bash
npx checkstyle-to-sarif --input checkstyle.xml --output results.sarif
```

### Stdin input

```bash
cat checkstyle.xml | npx checkstyle-to-sarif --output results.sarif
```

### Stdout output

```bash
npx checkstyle-to-sarif --input checkstyle.xml > results.sarif
```

### Short aliases

```bash
npx checkstyle-to-sarif -i checkstyle.xml -o results.sarif
```

## CLI Options

- --input <path>, -i <path>: path to the Checkstyle XML input file
- --output <path>, -o <path>: path to write SARIF output (defaults to stdout)
- --help: show help
- --version: show version

## Programmatic API

```ts
import { convertCheckstyleToSarif } from 'checkstyle-to-sarif'
import { readFile, writeFile } from 'node:fs/promises'

const xml = await readFile('checkstyle.xml', 'utf-8')
const sarif = convertCheckstyleToSarif(xml)
await writeFile('results.sarif', sarif, 'utf-8')
```

## SARIF v2.1.0 Compliance

The output follows the SARIF v2.1.0 specification and includes:

- version: 2.1.0
- runs with tool.driver.name set to Checkstyle
- results with message, level, and locations
- physicalLocation with artifactLocation and region

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
