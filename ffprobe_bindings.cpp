// Embind glue around ffprobe.h. It translates the owned C response tree into
// plain JS objects so the worker can postMessage the result directly.

#include <emscripten/bind.h>
#include <emscripten/val.h>

extern "C" {
#include "ffprobe.h"
#include <libavutil/avutil.h>
#include <libavutil/error.h>
}

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>

using emscripten::function;
using emscripten::val;

namespace {

std::string str_or_empty(const char *str) {
  return str ? std::string(str) : std::string();
}

val js_i64(int64_t value) {
  return val::global("BigInt")(std::to_string(value));
}

val js_i64_or_null(int64_t value) {
  if (value == AV_NOPTS_VALUE) {
    return val::null();
  }
  return js_i64(value);
}

val js_size_or_null(int64_t value) {
  if (value < 0) {
    return val::null();
  }
  return js_i64(value);
}

val js_count_or_null(int64_t value) {
  if (value <= 0) {
    return val::null();
  }
  return js_i64(value);
}

val js_bitrate_or_null(int64_t value) {
  if (value <= 0) {
    return val::null();
  }
  return js_i64(value);
}

val js_double_or_null(double value) {
  if (std::isnan(value)) {
    return val::null();
  }
  return val(value);
}

val to_js(const Rational &rational) {
  val out = val::object();
  out.set("num", rational.num);
  out.set("den", rational.den);
  return out;
}

val to_js(const Disposition &disposition) {
  val out = val::object();
  out.set("default_flag", disposition.default_flag);
  out.set("dub", disposition.dub);
  out.set("original", disposition.original);
  out.set("comment", disposition.comment);
  out.set("lyrics", disposition.lyrics);
  out.set("karaoke", disposition.karaoke);
  out.set("forced", disposition.forced);
  out.set("hearing_impaired", disposition.hearing_impaired);
  out.set("visual_impaired", disposition.visual_impaired);
  out.set("clean_effects", disposition.clean_effects);
  out.set("attached_pic", disposition.attached_pic);
  out.set("timed_thumbnails", disposition.timed_thumbnails);
  out.set("non_diegetic", disposition.non_diegetic);
  out.set("captions", disposition.captions);
  out.set("descriptions", disposition.descriptions);
  out.set("metadata", disposition.metadata);
  out.set("dependent", disposition.dependent);
  out.set("still_image", disposition.still_image);
  out.set("multilayer", disposition.multilayer);
  return out;
}

val to_js(const Tag &tag) {
  val out = val::object();
  out.set("key", str_or_empty(tag.key));
  out.set("value", str_or_empty(tag.value));
  return out;
}

val to_js(const TagList &tags) {
  val out = val::array();
  for (int i = 0; i < tags.count; ++i) {
    out.set(i, to_js(tags.entries[i]));
  }
  return out;
}

val to_js(const Stream &stream) {
  val out = val::object();
  out.set("index", stream.index);
  out.set("codec_name", str_or_empty(stream.codec_name));
  out.set("codec_long_name", str_or_empty(stream.codec_long_name));
  out.set("profile", str_or_empty(stream.profile));
  out.set("codec_type", str_or_empty(stream.codec_type));
  out.set("codec_tag_string", str_or_empty(stream.codec_tag_string));
  out.set("codec_tag", str_or_empty(stream.codec_tag));
  out.set("width", stream.width);
  out.set("height", stream.height);
  out.set("coded_width", stream.coded_width);
  out.set("coded_height", stream.coded_height);
  out.set("has_b_frames", stream.has_b_frames);
  out.set("sample_aspect_ratio", to_js(stream.sample_aspect_ratio));
  out.set("display_aspect_ratio", to_js(stream.display_aspect_ratio));
  out.set("pix_fmt", str_or_empty(stream.pix_fmt));
  out.set("level", stream.level);
  out.set("color_range", str_or_empty(stream.color_range));
  out.set("color_space", str_or_empty(stream.color_space));
  out.set("color_transfer", str_or_empty(stream.color_transfer));
  out.set("color_primaries", str_or_empty(stream.color_primaries));
  out.set("chroma_location", str_or_empty(stream.chroma_location));
  out.set("field_order", str_or_empty(stream.field_order));
  out.set("sample_fmt", str_or_empty(stream.sample_fmt));
  out.set("sample_rate", stream.sample_rate);
  out.set("channels", stream.channels);
  out.set("channel_layout", str_or_empty(stream.channel_layout));
  out.set("bits_per_sample", stream.bits_per_sample);
  out.set("initial_padding", stream.initial_padding);
  out.set("id", str_or_empty(stream.id));
  out.set("r_frame_rate", to_js(stream.r_frame_rate));
  out.set("avg_frame_rate", to_js(stream.avg_frame_rate));
  out.set("time_base", to_js(stream.time_base));
  out.set("start_pts", js_i64_or_null(stream.start_pts));
  out.set("start_time", js_double_or_null(stream.start_time));
  out.set("duration_ts", js_i64_or_null(stream.duration_ts));
  out.set("duration", js_double_or_null(stream.duration));
  out.set("bit_rate", js_bitrate_or_null(stream.bit_rate));
  out.set("bits_per_raw_sample", stream.bits_per_raw_sample);
  out.set("nb_frames", js_count_or_null(stream.nb_frames));
  out.set("frame_size", stream.frame_size);
  out.set("extradata_size", stream.extradata_size);
  out.set("disposition", to_js(stream.disposition));
  out.set("tags", to_js(stream.tags));
  return out;
}

val to_js(const Format &format) {
  val out = val::object();
  out.set("filename", str_or_empty(format.filename));
  out.set("nb_streams", format.nb_streams);
  out.set("nb_programs", format.nb_programs);
  out.set("nb_stream_groups", format.nb_stream_groups);
  out.set("format_name", str_or_empty(format.format_name));
  out.set("format_long_name", str_or_empty(format.format_long_name));
  out.set("start_time", js_double_or_null(format.start_time));
  out.set("duration", js_double_or_null(format.duration));
  out.set("size", js_size_or_null(format.size));
  out.set("bit_rate", js_bitrate_or_null(format.bit_rate));
  out.set("probe_score", format.probe_score);
  out.set("flags", format.flags);
  out.set("tags", to_js(format.tags));
  return out;
}

val to_js(const Chapter &chapter) {
  val out = val::object();
  out.set("id", chapter.id);
  out.set("time_base", to_js(chapter.time_base));
  out.set("start", js_i64_or_null(chapter.start));
  out.set("start_time", js_double_or_null(chapter.start_time));
  out.set("end", js_i64_or_null(chapter.end));
  out.set("end_time", js_double_or_null(chapter.end_time));
  out.set("tags", to_js(chapter.tags));
  return out;
}

val to_js(const FileResponse &response) {
  val out = val::object();
  val streams = val::array();
  val chapters = val::array();

  out.set("input_url", str_or_empty(response.input_url));
  out.set("stream_count", response.stream_count);
  out.set("best_video_stream_index", response.best_video_stream_index);
  out.set("best_audio_stream_index", response.best_audio_stream_index);
  out.set("format", to_js(response.format));
  for (int i = 0; i < response.stream_count; ++i) {
    streams.set(i, to_js(response.streams[i]));
  }
  out.set("streams", streams);
  out.set("chapter_count", response.chapter_count);
  for (int i = 0; i < response.chapter_count; ++i) {
    chapters.set(i, to_js(response.chapters[i]));
  }
  out.set("chapters", chapters);
  return out;
}

val make_error_result(int code) {
  val result = val::object();
  char buf[256] = {0};

  result.set("error_code", code);
  if (av_strerror(code, buf, sizeof(buf)) < 0) {
    snprintf(buf, sizeof(buf), "probe_file failed (%d)", code);
  }
  result.set("error_message", std::string(buf));
  result.set("response", val::undefined());
  return result;
}

val probe(const std::string &path) {
  FileResponse *response = nullptr;
  const int rc = probe_file(path.c_str(), &response);
  if (rc < 0 || !response) {
    val result = make_error_result(rc < 0 ? rc : -1);
    if (response) {
      free_file_response(response);
    }
    return result;
  }

  val result = val::object();
  result.set("error_code", 0);
  result.set("error_message", std::string());
  result.set("response", to_js(*response));
  free_file_response(response);
  return result;
}

} // namespace

EMSCRIPTEN_BINDINGS(ffprobe) { function("probe", &probe); }
