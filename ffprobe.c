#include "ffprobe.h"

#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/channel_layout.h>
#include <libavutil/mem.h>
#include <libavutil/pixdesc.h>
#include <libavutil/samplefmt.h>

static Rational make_rational(AVRational value) {
  Rational rational = {.num = value.num, .den = value.den};
  return rational;
}

static double ts_seconds(int64_t ts, AVRational time_base) {
  if (ts == AV_NOPTS_VALUE || time_base.den == 0) {
    return NAN;
  }

  return ts * av_q2d(time_base);
}

static char *dup_string(const char *value) {
  return value ? av_strdup(value) : NULL;
}

/* Format 32-bit codec tags as zero-padded hex strings like ffprobe. */
static char *hex_u32(uint32_t value) {
  char buffer[16] = {0};

  snprintf(buffer, sizeof(buffer), "0x%08" PRIx32, value);
  return av_strdup(buffer);
}

/* Format signed integer identifiers as compact hex strings. */
static char *hex_int(int value) {
  char buffer[16] = {0};

  snprintf(buffer, sizeof(buffer), "0x%x", value);
  return av_strdup(buffer);
}

/* Map FFmpeg field order values to the strings ffprobe emits. */
static const char *field_order_name(enum AVFieldOrder field_order) {
  switch (field_order) {
  case AV_FIELD_PROGRESSIVE:
    return "progressive";
  case AV_FIELD_TT:
    return "tt";
  case AV_FIELD_BB:
    return "bb";
  case AV_FIELD_TB:
    return "tb";
  case AV_FIELD_BT:
    return "bt";
  default:
    return NULL;
  }
}

/* Expand FFmpeg's stream disposition bitmask into explicit 0/1 fields.
 * The `!!(flags & MASK)` idiom converts any non-zero bit test result to 1
 * and leaves zero as 0, which matches the struct's plain integer fields.
 */
static void fill_disposition(Disposition *out, int disposition) {
  memset(out, 0, sizeof(*out));

  /* Normalize each disposition bit to a stable integer boolean. */
  out->default_flag = !!(disposition & AV_DISPOSITION_DEFAULT);
  out->dub = !!(disposition & AV_DISPOSITION_DUB);
  out->original = !!(disposition & AV_DISPOSITION_ORIGINAL);
  out->comment = !!(disposition & AV_DISPOSITION_COMMENT);
  out->lyrics = !!(disposition & AV_DISPOSITION_LYRICS);
  out->karaoke = !!(disposition & AV_DISPOSITION_KARAOKE);
  out->forced = !!(disposition & AV_DISPOSITION_FORCED);
  out->hearing_impaired = !!(disposition & AV_DISPOSITION_HEARING_IMPAIRED);
  out->visual_impaired = !!(disposition & AV_DISPOSITION_VISUAL_IMPAIRED);
  out->clean_effects = !!(disposition & AV_DISPOSITION_CLEAN_EFFECTS);
  out->attached_pic = !!(disposition & AV_DISPOSITION_ATTACHED_PIC);
  out->timed_thumbnails = !!(disposition & AV_DISPOSITION_TIMED_THUMBNAILS);
  out->non_diegetic = !!(disposition & AV_DISPOSITION_NON_DIEGETIC);
  out->captions = !!(disposition & AV_DISPOSITION_CAPTIONS);
  out->descriptions = !!(disposition & AV_DISPOSITION_DESCRIPTIONS);
  out->metadata = !!(disposition & AV_DISPOSITION_METADATA);
  out->dependent = !!(disposition & AV_DISPOSITION_DEPENDENT);
  out->still_image = !!(disposition & AV_DISPOSITION_STILL_IMAGE);
  out->multilayer = !!(disposition & AV_DISPOSITION_MULTILAYER);
}

/* Copy FFmpeg metadata entries into a simple owned key/value list. */
static int fill_tag_list(TagList *out, AVDictionary *dictionary) {
  const AVDictionaryEntry *entry = NULL;
  int count;

  memset(out, 0, sizeof(*out));
  if (!dictionary) {
    return 0;
  }

  count = av_dict_count(dictionary);
  if (count <= 0) {
    return 0;
  }

  out->entries = av_calloc((size_t)count, sizeof(*out->entries));
  if (!out->entries) {
    return AVERROR(ENOMEM);
  }

  while ((entry = av_dict_iterate(dictionary, entry))) {
    Tag *tag = &out->entries[out->count];

    tag->key = av_strdup(entry->key);
    tag->value = av_strdup(entry->value);
    if ((entry->key && !tag->key) || (entry->value && !tag->value)) {
      av_free(tag->key);
      av_free(tag->value);
      return AVERROR(ENOMEM);
    }
    out->count++;
  }

  return 0;
}

static void free_tag_list(TagList *tags) {
  int i;

  for (i = 0; i < tags->count; i++) {
    av_free(tags->entries[i].key);
    av_free(tags->entries[i].value);
  }

  av_free(tags->entries);
  tags->entries = NULL;
  tags->count = 0;
}

/* Convert the channel layout struct into the usual readable string. */
static char *copy_channel_layout(const AVChannelLayout *layout) {
  char buffer[128] = {0};

  if (!layout || layout->nb_channels <= 0) {
    return NULL;
  }
  if (av_channel_layout_describe(layout, buffer, sizeof(buffer)) < 0) {
    return NULL;
  }

  return av_strdup(buffer);
}

/* Ask the decoder for coded dimensions when codec parameters do not expose
 * them. */
static void fill_coded_dimensions(Stream *out, const AVStream *stream) {
  const AVCodecParameters *codecpar = stream->codecpar;
  const AVCodec *decoder;
  AVCodecContext *decoder_context;

  out->coded_width = 0;
  out->coded_height = 0;
  if (codecpar->codec_type != AVMEDIA_TYPE_VIDEO) {
    return;
  }

  decoder = avcodec_find_decoder(codecpar->codec_id);
  if (!decoder) {
    return;
  }

  decoder_context = avcodec_alloc_context3(decoder);
  if (!decoder_context) {
    return;
  }

  if (avcodec_parameters_to_context(decoder_context, codecpar) >= 0 &&
      avcodec_open2(decoder_context, decoder, NULL) >= 0) {
    out->coded_width = decoder_context->coded_width > 0
                           ? decoder_context->coded_width
                           : decoder_context->width;
    out->coded_height = decoder_context->coded_height > 0
                            ? decoder_context->coded_height
                            : decoder_context->height;
  }

  avcodec_free_context(&decoder_context);
}

static void free_streams(Stream *streams, int stream_count) {
  int i;

  for (i = 0; i < stream_count; i++) {
    av_free(streams[i].codec_name);
    av_free(streams[i].codec_long_name);
    av_free(streams[i].profile);
    av_free(streams[i].codec_type);
    av_free(streams[i].codec_tag_string);
    av_free(streams[i].codec_tag);
    av_free(streams[i].pix_fmt);
    av_free(streams[i].color_range);
    av_free(streams[i].color_space);
    av_free(streams[i].color_transfer);
    av_free(streams[i].color_primaries);
    av_free(streams[i].chroma_location);
    av_free(streams[i].field_order);
    av_free(streams[i].sample_fmt);
    av_free(streams[i].channel_layout);
    av_free(streams[i].id);
    free_tag_list(&streams[i].tags);
  }

  av_free(streams);
}

static void free_format_info(Format *format) {
  av_free(format->filename);
  av_free(format->format_name);
  av_free(format->format_long_name);
  free_tag_list(&format->tags);
}

static void free_chapters(Chapter *chapters, int chapter_count) {
  int i;

  for (i = 0; i < chapter_count; i++) {
    free_tag_list(&chapters[i].tags);
  }

  av_free(chapters);
}

static int fill_chapter_info(Chapter *out, const AVChapter *chapter) {
  memset(out, 0, sizeof(*out));
  out->id = (int)chapter->id;
  out->time_base = make_rational(chapter->time_base);
  out->start = chapter->start;
  out->start_time = ts_seconds(chapter->start, chapter->time_base);
  out->end = chapter->end;
  out->end_time = ts_seconds(chapter->end, chapter->time_base);
  return fill_tag_list(&out->tags, chapter->metadata);
}

/* Populate the top-level container fields from the format context. */
static int fill_format_info(Format *out, const AVFormatContext *format_context,
                            const char *input) {
  const char *filename = format_context->url ? format_context->url : input;
  const char *format_name =
      format_context->iformat ? format_context->iformat->name : NULL;
  const char *format_long_name =
      format_context->iformat ? format_context->iformat->long_name : NULL;

  memset(out, 0, sizeof(*out));

  out->filename = dup_string(filename);
  out->format_name = dup_string(format_name);
  out->format_long_name = dup_string(format_long_name);
  if ((filename && !out->filename) || (format_name && !out->format_name) ||
      (format_long_name && !out->format_long_name)) {
    return AVERROR(ENOMEM);
  }

  out->nb_streams = (int)format_context->nb_streams;
  out->nb_programs = (int)format_context->nb_programs;
  out->nb_stream_groups = (int)format_context->nb_stream_groups;
  out->start_time = format_context->start_time == AV_NOPTS_VALUE
                        ? NAN
                        : (double)format_context->start_time / AV_TIME_BASE;
  out->duration = format_context->duration == AV_NOPTS_VALUE
                      ? NAN
                      : (double)format_context->duration / AV_TIME_BASE;
  out->size = format_context->pb ? avio_size(format_context->pb) : -1;
  out->bit_rate = format_context->bit_rate;
  out->probe_score = format_context->probe_score;
  out->flags = format_context->flags;
  return fill_tag_list(&out->tags, format_context->metadata);
}

static int fill_stream_info(Stream *out, const AVStream *stream) {
  const AVCodecParameters *codecpar = stream->codecpar;
  const AVCodecDescriptor *descriptor =
      avcodec_descriptor_get(codecpar->codec_id);
  const char *codec_name = avcodec_get_name(codecpar->codec_id);
  const char *profile_name =
      avcodec_profile_name(codecpar->codec_id, codecpar->profile);
  const char *codec_type = av_get_media_type_string(codecpar->codec_type);
  const char *codec_tag_string = av_fourcc2str(codecpar->codec_tag);
  const char *pix_fmt_name = codecpar->codec_type == AVMEDIA_TYPE_VIDEO
                                 ? av_get_pix_fmt_name(codecpar->format)
                                 : NULL;
  const char *sample_fmt_name = codecpar->codec_type == AVMEDIA_TYPE_AUDIO
                                    ? av_get_sample_fmt_name(codecpar->format)
                                    : NULL;
  const char *color_range_name = av_color_range_name(codecpar->color_range);
  const char *color_space_name = av_color_space_name(codecpar->color_space);
  const char *color_transfer_name = av_color_transfer_name(codecpar->color_trc);
  const char *color_primaries_name =
      av_color_primaries_name(codecpar->color_primaries);
  const char *chroma_location_name =
      av_chroma_location_name(codecpar->chroma_location);
  const char *field_order = field_order_name(codecpar->field_order);
  AVRational dar = {0, 1};

  memset(out, 0, sizeof(*out));

  /* Derive display aspect ratio from frame size and sample aspect ratio. */
  if (stream->sample_aspect_ratio.num > 0 &&
      stream->sample_aspect_ratio.den > 0 && codecpar->width > 0 &&
      codecpar->height > 0) {
    av_reduce(&dar.num, &dar.den,
              (int64_t)codecpar->width * stream->sample_aspect_ratio.num,
              (int64_t)codecpar->height * stream->sample_aspect_ratio.den,
              1024 * 1024);
  }

  /* Copy codec identity fields first so consumers can label the stream. */
  out->index = stream->index;
  out->codec_name = dup_string(codec_name);
  out->codec_long_name = dup_string(descriptor ? descriptor->long_name : NULL);
  out->profile = dup_string(profile_name);
  out->codec_type = dup_string(codec_type);
  out->codec_tag_string = dup_string(codec_tag_string);
  /* Expose the raw container codec tag for debugging/ffprobe parity. */
  out->codec_tag = hex_u32(codecpar->codec_tag);
  if ((codec_name && !out->codec_name) ||
      (descriptor && descriptor->long_name && !out->codec_long_name) ||
      (profile_name && !out->profile) || (codec_type && !out->codec_type) ||
      (codec_tag_string && !out->codec_tag_string) || !out->codec_tag) {
    return AVERROR(ENOMEM);
  }

  /* Copy the media-specific properties and normalized timing values. */
  out->width = codecpar->width;
  out->height = codecpar->height;
  fill_coded_dimensions(out, stream);
  out->has_b_frames = codecpar->video_delay;
  out->sample_aspect_ratio = make_rational(stream->sample_aspect_ratio);
  out->display_aspect_ratio = make_rational(dar);
  out->pix_fmt = dup_string(pix_fmt_name);
  out->level = codecpar->level;
  out->color_range = dup_string(color_range_name);
  out->color_space = dup_string(color_space_name);
  out->color_transfer = dup_string(color_transfer_name);
  out->color_primaries = dup_string(color_primaries_name);
  out->chroma_location = dup_string(chroma_location_name);
  out->field_order = dup_string(field_order);
  out->sample_fmt = dup_string(sample_fmt_name);
  out->sample_rate = codecpar->sample_rate;
  out->channels = codecpar->ch_layout.nb_channels;
  out->channel_layout = copy_channel_layout(&codecpar->ch_layout);
  out->bits_per_sample = av_get_bits_per_sample(codecpar->codec_id);
  out->initial_padding = codecpar->initial_padding;
  /* Expose the raw stream id for debugging/ffprobe parity. */
  out->id = hex_int(stream->id);
  out->r_frame_rate = make_rational(stream->r_frame_rate);
  out->avg_frame_rate = make_rational(stream->avg_frame_rate);
  out->time_base = make_rational(stream->time_base);
  out->start_pts = stream->start_time;
  out->start_time = ts_seconds(stream->start_time, stream->time_base);
  out->duration_ts = stream->duration;
  out->duration = ts_seconds(stream->duration, stream->time_base);
  out->bit_rate = codecpar->bit_rate;
  out->bits_per_raw_sample = codecpar->bits_per_raw_sample;
  out->nb_frames = stream->nb_frames;
  out->frame_size = codecpar->frame_size;
  out->extradata_size = codecpar->extradata_size;
  fill_disposition(&out->disposition, stream->disposition);
  if ((pix_fmt_name && !out->pix_fmt) ||
      (color_range_name && !out->color_range) ||
      (color_space_name && !out->color_space) ||
      (color_transfer_name && !out->color_transfer) ||
      (color_primaries_name && !out->color_primaries) ||
      (chroma_location_name && !out->chroma_location) ||
      (field_order && !out->field_order) ||
      (sample_fmt_name && !out->sample_fmt) || !out->id ||
      (codecpar->ch_layout.nb_channels > 0 && !out->channel_layout)) {
    return AVERROR(ENOMEM);
  }

  return fill_tag_list(&out->tags, stream->metadata);
}

void free_file_response(FileResponse *response) {
  if (!response) {
    return;
  }

  av_free(response->input_url);
  free_format_info(&response->format);
  free_streams(response->streams, response->stream_count);
  free_chapters(response->chapters, response->chapter_count);
  av_free(response);
}

/* Open the input, inspect its streams, and build the public response. */
int probe_file(const char *input, FileResponse **out_response) {
  AVFormatContext *format_context = NULL;
  FileResponse *response = NULL;
  unsigned int i;
  int best_stream_index;
  int ret;

  if (!input || !out_response) {
    return AVERROR(EINVAL);
  }

  *out_response = NULL;

  response = av_mallocz(sizeof(*response));
  if (!response) {
    return AVERROR(ENOMEM);
  }

  response->input_url = dup_string(input);
  if (!response->input_url) {
    ret = AVERROR(ENOMEM);
    goto end;
  }

  response->best_video_stream_index = -1;
  response->best_audio_stream_index = -1;

  ret = avformat_open_input(&format_context, input, NULL, NULL);
  if (ret < 0) {
    goto end;
  }

  ret = avformat_find_stream_info(format_context, NULL);
  if (ret < 0) {
    goto end;
  }

  ret = fill_format_info(&response->format, format_context, input);
  if (ret < 0) {
    goto end;
  }

  response->stream_count = (int)format_context->nb_streams;
  response->streams =
      av_calloc((size_t)response->stream_count, sizeof(*response->streams));
  if (response->stream_count > 0 && !response->streams) {
    ret = AVERROR(ENOMEM);
    goto end;
  }

  for (i = 0; i < format_context->nb_streams; i++) {
    ret = fill_stream_info(&response->streams[i], format_context->streams[i]);
    if (ret < 0) {
      goto end;
    }
  }

  response->chapter_count = (int)format_context->nb_chapters;
  if (response->chapter_count > 0) {
    response->chapters =
        av_calloc((size_t)response->chapter_count, sizeof(*response->chapters));
    if (!response->chapters) {
      ret = AVERROR(ENOMEM);
      goto end;
    }
    for (i = 0; i < format_context->nb_chapters; i++) {
      ret = fill_chapter_info(&response->chapters[i],
                              format_context->chapters[i]);
      if (ret < 0) {
        goto end;
      }
    }
  }

  best_stream_index =
      av_find_best_stream(format_context, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
  if (best_stream_index >= 0) {
    response->best_video_stream_index = best_stream_index;
  }

  best_stream_index =
      av_find_best_stream(format_context, AVMEDIA_TYPE_AUDIO, -1, -1, NULL, 0);
  if (best_stream_index >= 0) {
    response->best_audio_stream_index = best_stream_index;
  }

  *out_response = response;
  response = NULL;
  ret = 0;

end:
  avformat_close_input(&format_context);
  free_file_response(response);
  return ret;
}
