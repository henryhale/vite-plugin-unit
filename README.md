# vite-plugin-unit

[![npm](https://img.shields.io/npm/v/vite-plugin-unit.svg?style=for-the-badge)](https://www.npmjs.com/package/vite-plugin-unit)

A vite plugin to enable you build websites in units.

Check out the [create-unit](https://github.com/henryhale/create-unit) library for details.

## installation

```sh
npm i -D vite-plugin-unit
```

## usage

```js
import unit from "vite-plugin-unit";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        unit({/* options */})
    ]
});
```

## configuration

```ts
type PluginOptions = {
    pages: string;
    template: string;
    slot: string;
};
```

- `options.template`: _string_ - The HTML file in which compiles .unit files will be mounted
- `options.pages`: _string_ - The folder under `src` folder containing the pages or routes
- `options.slot`: _string_ - The slot identifier in the template to be replaced by compiled .unit files

## default options

```js
const defaultOptions = {
    pages: "pages/",
    template: "template.html",
    slot: "#slot#"
};
```

## License

Released under the [MIT License](./LICENSE.md)

Copyright &copy; 2024-present, [Henry Hale](https://github.com/henryhale)
