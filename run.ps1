$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'node_modules/@xyflow/react')) {
    npm install
}

npm run dev
