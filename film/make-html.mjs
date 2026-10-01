// Inlines build/data.json into film.html -> build/film.html
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync(new URL("./film.html", import.meta.url), "utf8");
const data = readFileSync(new URL("./build/data.json", import.meta.url), "utf8").replace(/</g, "\\u003c");
writeFileSync(new URL("./build/film.html", import.meta.url), html.replace("/*DATA*/null", data));
