import type { Chapter } from "./chapter.js";
import type { Format } from "./format.js";
import type { Stream } from "./stream.js";
export type FileResponse = {
    input_url: string;
    stream_count: number;
    best_video_stream_index: number;
    best_audio_stream_index: number;
    format: Format;
    streams: Stream[];
    chapter_count: number;
    chapters: Chapter[];
};
export type ProbeResult = {
    error_code: number;
    error_message: string;
    response: FileResponse | undefined;
};
