import type { Tag } from "./primitives.js";
export type Format = {
    filename: string;
    nb_streams: number;
    nb_programs: number;
    nb_stream_groups: number;
    format_name: string;
    format_long_name: string;
    start_time: number | null;
    duration: number | null;
    size: bigint | null;
    bit_rate: bigint | null;
    probe_score: number;
    flags: number;
    tags: Tag[];
};
