# Workspace app starter

Copy this directory to `components/apps/your-app-id`. Change manifest.json to
describe your app and use a unique, stable id. Implement your UI in index.js,
exporting a React component as default. React is provided by the platform.

Validate: `npm run app:validate -- components/apps/your-app-id`

Package: `npm run app:validate -- components/apps/your-app-id --pack`

The ZIP is a source contribution archive, not an executable browser installation.
Review its contents before sharing. Do not put credentials or operational data
in your app package. Hidden files and common dependency/build folders are excluded.

See `components/apps/README.md` in the platform repository for registration,
the host API, storage semantics and the contribution/release process.
