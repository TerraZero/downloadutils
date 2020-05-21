const Converter = require('fluent-ffmpeg');
const FFMpegSource = require('@ffmpeg-installer/ffmpeg');

Converter.setFfmpegPath(FFMpegSource.path);

module.exports = class DownloadUtils {

  static get Converter() {
    return Converter;
  }

  static get Download() {
    return require('./src/Download');
  }

}
