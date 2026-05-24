import type { ProbeResult } from "./types/index.js";
export type ProbeRequest = {
    type: "probe";
    file: File;
};
export type ProbeResponse = {
    ok: true;
    result: ProbeResult;
} | {
    ok: false;
    error: string;
};
