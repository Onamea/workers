# Onamea workers

Typescript implementation for Onamea. Supporting both CLI and Browser Webworkers 

## Compile

```
deno compile --allow-env --output onamea --include ./src/worker.ts ./src/main.ts
```

## Run

```
deno run --allow-read --allow-env src/main.ts { vanity name }
./onamea { vanity name }
```

## Build worker.js browser file
```
deno bundle src/worker.ts --outdir dist
```

## Development

```
deno lint
```
