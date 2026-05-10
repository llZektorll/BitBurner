import { main as loaderMain } from "./Loader.js";

/** @param {NS} ns */
export async function main(ns) {
  ns.tprint("controller: legacy entrypoint detected; handing off to /auto/Loader.js.");
  await loaderMain(ns);
}
