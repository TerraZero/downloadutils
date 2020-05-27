/**
 * @typedef T_DownloadOptions
 * @property {string} cwd
 * @property {boolean} overwrite If the target file should be overwritten
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
   * @returns {Promise<this>}
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

    if (!this.output) return target;
    if (Path.isAbsolute(this.output)) {
      target = this.output;
    } else {
      target = Path.join(this.opts.cwd, this.output);
    }

    if (this._convert !== null) {
      const extname = Path.extname(target);

      target = target.substring(0, target.length - extname.length);
      if (extname.startsWith('.')) target += '.';
      target += this._convert;
    }
    return target;
  }

  /**
   * @returns {Error}
   */
  get error() {
    return this._error;
  }

  /**
   * @returns {import('./BulkDownload').T_DownloadItem}
   */
  get item() {
    return {
      url: this.url,
      args: this.args,
      opts: this.opts,
      download: this,
      convert: this._convert,
      target: this.target,
      output: this.output,
    };
  }

  /**
   * @param {string} extname
   * @returns {this}
   */
  toConvert(extname = null) {
    this._convert = extname;
    return this;
  }

  /**
   * @param {string} output
   * @returns {this}
   */
  toFile(output = null) {
    this._output = output;
    return this;
  }

  /**
   * @returns {Promise<object>}
   */
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

  /**
   * Only available after info trigger.
   *
   * @returns {number}
   */
  getSize() {
    if (this._info) {
      return this._info.size;
    }
    return null;
  }

  /**
   * Start the download process.
   *
   * @returns {this}
   */
  download() {
    if (this.checkExists()) {
      this.onFinish();
      return this;
    }
    this._downloadstream = YoutubeDownloader(this.url, this.args, this.opts);
    this._downloadstream.on('info', this.onInfo.bind(this));
    this._downloadstream.on('error', this.onError.bind(this));
    return this;
  }

  /**
   * The info process.
   *
   * @param {object} info
   */
  onInfo(info) {
    this._info = info;
    if (this.output === null) {
      this.toFile(info._filename);
    }
    if (this.checkExists()) {
      this.onFinish();
      return;
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

  checkExists() {
    const target = this.target;

    if (this.opts.overwrite || target === null || !FS.existsSync(target)) return false;
    return true;
  }

  /**
   * The finish process.
   */
  onFinish() {
    if (this._promise !== null) this._promise.resolve({ download: this, arguments });
  }

  /**
   * The error process.
   */
  onError(error) {
    this._error = error;
    if (this._promise !== null) this._promise.reject({ download: this, arguments });
  }

}
