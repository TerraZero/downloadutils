const FS = require('fs');
const Path = require('path');
const YoutubeDownloader = require('youtube-dl');

const DownloadUtils = require('../index');
const AsyncPromise = require('utils/src/AsyncPromise');

module.exports = class Download {

  constructor(url, output = null, args = [], opts = {}) {
    this._url = url;
    this._output = null;
    this._info = null;
    this._fullinfo = null;
    this._convert = null;
    this._args = args;
    if (!opts.cwd) opts.cwd = process.cwd();
    this._opts = opts;

    this._downloadstream = null;
    this._converterstream = null;
    this._outputstream = null;
    this._promise = null;

    this.toFile(output);
  }

  get url() {
    return this._url;
  }

  get args() {
    return this._args;
  }

  get opts() {
    return this._opts;
  }

  get cwd() {
    return this.opts.cwd;
  }

  get output() {
    return this._output;
  }

  get promise() {
    if (this._promise === null) {
      this._promise = new AsyncPromise();
    }
    return this._promise.promise;
  }

  toConvert(extname = null) {
    this._convert = extname;
    return this;
  }

  toFile(output = null) {
    if (output !== null) {
      if (Path.isAbsolute(output)) {
        this._output = output;
      } else {
        this._output = Path.join(this.cwd, output);
      }
      if (this._convert !== null) {
        const extname = Path.extname(this._output);

        this._output = this._output.substring(0, this._output.length - extname.length);
        if (extname.startsWith('.')) this._output += '.';
        this._output += this._convert;
      }
    }
    return this;
  }

  getFullInfo() {
    if (this._fullinfo === null) {
      return new Promise((resolve, reject) => {
        YoutubeDownloader.getInfo(this.url, null, null, (err, info) => {
          if (err) {
            reject(err);
          } else {
            this._fullinfo = info;
            resolve(info);
          }
        });
      });
    } else {
      return Promise.resolve(this._fullinfo);
    }
  }

  getSize() {
    if (this._info) {
      return this._info.size;
    }
    return null;
  }

  download() {
    this._downloadstream = YoutubeDownloader(this.url, this.args, this.opts);
    this._downloadstream.on('info', this.onInfo.bind(this));
    this._downloadstream.on('error', this.onError.bind(this));
    return this;
  }

  onInfo(info) {
    this._info = info;
    if (this.output === null) {
      this.toFile(info._filename);
    }
    if (Path.extname(info._filename) === Path.extname(this.output)) {
      this._outputstream = FS.createWriteStream(this.output);
      this._outputstream.on('finish', this.onFinish.bind(this));
      this._outputstream.on('error', this.onError.bind(this));
      this._downloadstream.pipe(this._outputstream);
    } else {
      this._converterstream = DownloadUtils.Converter(this._downloadstream);
      this._converterstream.on('end', this.onFinish.bind(this));
      this._converterstream.on('error', this.onError.bind(this));
      this._converterstream.save(this.output);
    }
  }

  onFinish() {
    this._promise.resolve(this);
  }

  onError() {
    this._promise.reject(arguments);
  }

}
