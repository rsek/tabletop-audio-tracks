import yaml from "yaml";
import request from 'request';
import async from 'async';
import fs from 'fs';
import ProgressBar from 'progress';
import FastGlob from 'fast-glob';

const file = fs.readFileSync("./tabletop-audio-tracks.yaml", { encoding: "utf-8" });
const data = yaml.parse(file);

/**
 * Downloads a series of files one at a time.
 */
class Downloader {
  constructor() {
    this.q = async.queue(this.singleFile, 1);

    // assign a callback
    this.q.drain(function () {
      console.log('all items have been processed');
    });

    // assign an error callback
    this.q.error(function (err, task) {
      console.error('task experienced an error', task);
    });
  }

  downloadFiles(links) {
    for (let link of links) {
      this.q.push(link);
    }
  }

  singleFile(link, cb) {
    let file = request(link);
    let bar;
    file.on('response', (res) => {
      const len = parseInt(res.headers['content-length'], 10);
      console.log();
      bar = new ProgressBar('  Downloading [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len
      });
      file.on('data', (chunk) => {
        bar.tick(chunk.length);
      })
      file.on('end', () => {
        console.log('\n');
        cb();
      })
    })
    let urlParts = link.split("/");
    let fileName = urlParts[urlParts.length - 1];
    let pathOut = "./tracks/" + fileName;
    file.pipe(fs.createWriteStream(pathOut));
  }
}

function getFileName(path) {
  let urlParts = path.split("/");
  let fileName = urlParts[urlParts.length - 1];
  return fileName;
}
const baseUrl = "https://sounds.tabletopaudio.com/";

const alreadyDownloaded = FastGlob.sync("./tracks/*.mp3").map(file => baseUrl + getFileName(file));

console.log(`The 'tracks' directory contains ${alreadyDownloaded.length} tracks.`)

const tracksToGet = data.tracks.filter(track => !alreadyDownloaded.includes(track.src));

switch (tracksToGet.length) {
  case 0: {
    console.log("All tracks listed in 'tabletop-audio-tracks.json' are already present. Nothing will be downloaded.");
    break;
  }
  default: {
    console.log(`${tracksToGet.length} tracks listed in 'tabletop-audio-tracks.json' aren't present and will be downloaded: ${tracksToGet.map(item => getFileName(item.src)).join(", ")}`);
    const dl = new Downloader();
    dl.downloadFiles(
      tracksToGet.map(track => track.src)
    );
  }
    break;
}


