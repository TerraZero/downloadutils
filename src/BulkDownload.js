/**
 * @typedef T_DownloadItem
 * @property {string} url The url to download
 * @property {string} convert The extname target
 * @property {string} output The output file path
 * @property {number} bulkID The id of the bulk process
 * @property {string[]} args Arguments for the download command
 * @property {import('./Download').T_DownloadOptions} opts Options for the download library
 * @property {import('./Download')} download The download object
 * @property {boolean} finished If the download and convert is finished
 * @property {string} file The path of the local file
 * @property {null|Error} error If the stream has an error
 */

const Path = require('path');
const Events = require('events');

const Download = require('./Download');
const AsyncPromise = require('utils/src/AsyncPromise');

module.exports = class BulkDownload {

  /**
   * @param {T_DownloadItem[]} data
   * @param {string[]} args
   * @param {import('./Download').T_DownloadOptions} opts
   * @param {number} bulk
   */
  constructor(data, args = [], opts = {}, bulk = 5) {
    this._data = data;
    this._args = args;
    this._opts = opts;
    this._bulk = bulk;

    this._events = new Events();
    this._index = 0;
    this._promise = null;
  }

  /**
   * @returns {T_DownloadItem[]}
   */
  get data() {
    return this._data;
  }

  /**
   * @returns {number}
   */
  get bulk() {
    return this._bulk;
  }

  /**
   * @returns {import('events')}
   */
  get events() {
    return this._events;
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

  setBulk(number) {
    this._bulk = number;
    return this;
  }

  setCWD(path) {
    if (!Path.isAbsolute(path)) {
      path = Path.join(process.cwd(), path);
    }
    this._opts.cwd = path;
    return this;
  }

  download() {
    for (let i = 0; i < this._bulk; i++) {
      this.next(i);
    }
    return this;
  }

  async next(bulkID) {
    this.onFinish();
    if (this._index === this.data.length) return;
    const item = this.data[this._index++];
    item.bulkID = bulkID;
    item.args = item.args || [];
    item.opts = item.opts || {};
    item.download = new Download(item.url, item.output, [...this._args, ...item.args], {...this._opts, ...item.opts});

    if (item.convert) item.download.toConvert(item.convert);
    item.download.download().promise
      .then(() => {
        item.finished = true;
        this.next(bulkID);
      })
      .catch((...args) => {
        this.onError(...args);
      });
    this.events.emit('next', item);
  }

  onFinish() {
    for (const item of this.data) {
      if (!item.finished) return;
    }
    if (this._promise !== null) this._promise.resolve({ download: this, arguments });
  }

  onError() {
    if (this._promise !== null) this._promise.reject({ download: this, arguments });
  }

}