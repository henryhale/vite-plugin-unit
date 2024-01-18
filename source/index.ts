/**
 *  vite-plugin-unit
 *  @description A vite plugin to enable you build websites in units using alpine.js
 *  @author Henry Hale
 *  @license MIT
 *  @url https://github.com/henryhale/vite-plugin-unit
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { log } from "node:console";
import type { Plugin } from "vite";

export type PluginOptions = {
    pages: string;
    template: string;
    slot: string;
};

const defaultOptions: PluginOptions = {
    pages: "pages/",
    template: "template.html",
    slot: "#slot#"
};

export default function plugin(options: Partial<PluginOptions> = {}): Plugin[] {
    const opt = Object.assign({}, defaultOptions, options);

    // https://stackoverflow.com/questions/64963450/dirname-is-not-defined
    const __dirname = resolve(dirname(""));

    // unit file extension
    const ext = ".unit";

    // source code folder
    const srcDir = "src/";

    // intermediate output folder for unit.js
    const outputDir = "./.unit/";

    // regexp to match single html tag
    const htmlRegex = /<(.+?) ([/]?|.+?)>/g;

    // mapping file path to thier contents
    const pathToCode = new Map<string, string>();

    // function that compiles .unit files
    function compile(file = "", code = ""): string {
        let filePath = null;
        let content = null;
        const nameToPath = new Map<string, string>();

        // remove all import statements while saving the import names & content
        return (
            code
                .replace(/import (.+?) from "(.+?)"(.+?)/g, (_, importName, importPath) => {
                    filePath = join(dirname(file), importPath);
                    nameToPath.set(importName, filePath);
                    if (!pathToCode.has(filePath)) {
                        content = compile(filePath, readFileSync(filePath, "utf-8"));
                        pathToCode.set(filePath, content);
                    }
                    return "";
                })
                // replace every html tag matching an import name
                .replace(htmlRegex, (match, tag, attr = "") => {
                    const path = nameToPath.get(tag);
                    if (path) {
                        if (attr.endsWith("/")) attr = attr.slice(0, -1);
                        return pathToCode.get(path)!.replace(/<(.+?)>/, (m) => m.slice(0, -1) + " " + attr + ">");
                    }
                    return match;
                })
                .trim()
        );
    }

    return [
        {
            /**
             * Unit.js - Server plugin
             */
            name: "vite-plugin-unit-serve",

            /**
             * use this plugin in development mode
             */
            apply: "serve",

            /**
             * partial config
             */
            config() {
                return {
                    root: srcDir
                };
            },

            /**
             * intercept vite server requests and compile .unit files on demand
             */
            configureServer({ middlewares, config }) {
                /**
                 * register a middleware to intercept the server's requests
                 */
                middlewares.use(async (req, res, next) => {
                    /**
                     * function to send compiled .unit file as html
                     */
                    async function respond(file: string) {
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "text/html");
                        const contents = await readFile(join(config.root, opt.template), { encoding: "utf-8" });
                        pathToCode.clear();
                        const compiled = compile(file, await readFile(file, { encoding: "utf-8" }));
                        res.end(contents.replace(opt.slot, compiled));
                    }

                    // folder containing pages
                    const srcDir = join(config.root, opt.pages);

                    // generate actual file path
                    let filePath = join(srcDir, req.url + (req.url?.endsWith("/") ? "index.html" : ""));

                    // check if the requested html file does not exist
                    if (filePath.endsWith(".html") && !existsSync(filePath)) {
                        filePath = filePath.replace(".html", ext);
                        if (existsSync(filePath)) {
                            // print request to the console
                            log(req.method?.toUpperCase(), req.url, filePath.slice(config?.root?.length || 0));

                            // send requested file
                            return await respond(filePath);
                        }
                    }

                    // try checking if the requested asset exists in the `src` folder
                    if (filePath.lastIndexOf(".") > -1) {
                        filePath = join(config.root, req.url!);
                        if (existsSync(filePath)) {
                            // direct the file path relative to the `src` folder
                            req.url = filePath;
                        }
                    }

                    return next();
                });
            }
        },
        {
            /**
             * Unit.js - Build plugin
             */
            name: "vite-plugin-unit-build",

            /**
             * only apply this plugin on `vite build` command
             */
            apply: "build",

            /**
             * modify vite config in favor of this plugin
             */
            config() {
                return {
                    base: "./",
                    root: outputDir
                };
            },

            /**
             * function invoked when the build process begins
             */
            async buildStart(options) {
                const output = join(__dirname, outputDir);

                /**
                 * Create unit.js compiled output directory
                 */
                if (existsSync(output)) {
                    await rm(output, { recursive: true, force: true });
                }
                await mkdir(outputDir);

                /**
                 * Copy entire `src/` to `.unit/`
                 */
                await cp("./src/", outputDir, { recursive: true });

                /**
                 * Grab the template file
                 */
                const templateFile = join(outputDir, opt.template);
                const template = await readFile(templateFile, { encoding: "utf-8" });

                /**
                 * Capture the pages
                 */
                const srcDir = join(outputDir, "./pages/");
                const srcFiles = await readdir(srcDir, { recursive: true });
                const pages = srcFiles.filter((file) => extname(file) === ext);
                log("pages: ", pages);

                /**
                 * Function that generate .html file from compiled .unit file
                 */
                async function generateBuild(page: string) {
                    const filePath = join(srcDir, page);
                    if (Array.isArray(options.input)) {
                        options.input.push(join(outputDir, page.replace(ext, ".html")));
                    } else {
                        // ...
                    }
                    const fileContent = await readFile(filePath, { encoding: "utf-8" });
                    const compiledPage = compile(filePath, fileContent);
                    const result = template.replace(opt.template, compiledPage);
                    log("build: ", page);
                    return await writeFile(join(outputDir, page.replace(ext, ".html")), result);
                }

                /**
                 * Clear the input files
                 */
                if (options.input.length) {
                    options.input.length = 0;
                } else {
                    options.input = [];
                }

                /**
                 * Generate builds, add input files for rollup to resolve dependencies
                 */
                await Promise.all(pages.map((page) => generateBuild(page)));
            },

            /**
             * function invoked when the output bundle is complete
             */
            async closeBundle() {
                /**
                 * Remove the dist folder if exists
                 */
                const distFolder = join(__dirname, "dist");
                if (existsSync(distFolder)) {
                    await rm(distFolder, { recursive: true, force: true });
                }

                /**
                 * Copy the entire unit dist folder to the root of the project
                 */
                await cp(outputDir + "dist", distFolder, { recursive: true });

                // await new Promise((res) => setTimeout(res, 5000));

                /**
                 * Delete the entire unit output folder
                 */
                await rm(outputDir, { recursive: true, force: true });
            }
        }
    ];
}
