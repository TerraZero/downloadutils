/**
 * @typedef T_DownloadOptions
 * @property {string} cwd
 */

const FS = require('fs');
const Path = require('path');
const YoutubeDownloader = require('youtube-dl');

const DownloadUtils = require('../index');
const AsyncPromise = require('utils/src/AsyncPromise');

module.exports = class Download {

  /**
   * @param {string} url
   * @param {null|string} output
   * @param {string[]} args
   * @param {T_DownloadOptions} opts
   */
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

    this._error = null;

    this.toFile(output);
  }

  /**
   * @returns {string}
   */
  get url() {
    return this._url;
  }

  /**
   * @returns {string[]}
   */
  get args() {
    return this._args;
  }

  /**
   * @returns {T_DownloadOptions}
   */
  get opts() {
    return this._opts;
  }

  /**
   * @returns {string}
   */
  get output() {
    return this._output;
  }

  /**
   * @returns {Promise}
   */
  get promise() {
    if (this._promise === null) {
      this._promise = new AsyncPromise();
    }
    return this._promise.promise;
  }

  /**
   * @returns {string}
   */
  get target() {
    let target = null;

    if (!this._output) return target;
    if (Path.isAbsolute(this._output)) {
      target = this._output;
    } else {
      target = Path.join(this.opts.cwd, this._output);
    }

    if (this._convert !== null) {
      const extname = Path.extname(target);

      target = target.substring(0, target.length - extname.length);
      if (extname.startsWith('.')) target += '.';
      target += this._convert;
    }
    return target;
  }

  get error() {
    return this._error;
  }

  toConvert(extname = null) {
    this._convert = extname;
    return this;
  }

  toFile(output = null) {
    this._output = output;
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
    const target = this.target;
    if (Path.extname(info._filename) === Path.extname(target)) {
      this._outputstream = FS.createWriteStream(target);
      this._outputstream.on('finish', this.onFinish.bind(this));
      this._outputstream.on('error', this.onError.bind(this));
      this._downloadstream.pipe(this._outputstream);
    } else {
      this._converterstream = DownloadUtils.Converter(this._downloadstream);
      this._converterstream.on('end', this.onFinish.bind(this));
      this._converterstream.on('error', this.onError.bind(this));
      this._converterstream.save(target);
    }
  }

  onFinish() {
    if (this._promise !== null) this._promise.resolve({ download: this, arguments });
  }

  onError(error) {
    this._error = error;
    if (this._promise !== null) this._promise.reject({ download: this, arguments });
  }

}
