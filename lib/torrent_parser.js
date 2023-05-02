const bencode = require('./bencode');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const needle = require('needle');
const cheerio = require("cheerio");
const ptt = require("parse-torrent-title");


const domainLink = 'http://fast-torents.ru';

let cinemeta_movie = {
  set id(value) {
    this._id = value;
  },
  set name(value) {
    this._name = value;
  },
  set release_year(value) {
    this._release_year = parseInt(value);
  },
  get id() {
    return this._id;
  },
  get name() {
    return this._name;
  },
  get release_year() {
    return this._release_year;
  }
};

function getStreams() {

  return needle('post', domainLink + '/search/' + encodeURI(cinemeta_movie.name) + '/1.html', {
      from_date: cinemeta_movie.release_year - 1,
      to_date: cinemeta_movie.release_year + 1
    })
    .then(function(res) {
      const $ = cheerio.load(res.body);

      let movieLink = []
      const filmItems = $('div.film-item');

      if (filmItems.length > 0) {
        for (const el of filmItems) {
          const alternativeHeadline = $(el).find('div.film-wrap').find('h2').find('span').contents().last().text();
          if (alternativeHeadline.toLowerCase() === cinemeta_movie.name.toLowerCase()) {
            movieLink = $(el).find('a.film-download').attr('href');
            break;
          }
        };
      } else {
        throw Error("movie not found");
      }

      if (typeof movieLink === 'undefined') {
        throw Error("movie not found");
      }

      return movieLink;

    })
    .then(function(movieLink) {

      return needle('get', domainLink + movieLink)
        .then(async function(res) {

          let $ = cheerio.load(res.body);

          const dynamicPageUrl = $('div#dynamic_film_torrents').attr('obj_id');

          if (typeof dynamicPageUrl !== 'undefined') {
            const resPromise = needle("get", domainLink + dynamicPageUrl);
            res = await resPromise.then((response) => {
              return response;
            });
            $ = cheerio.load(res.body);
          }

          const torrentInfo = $('div.torrent-row');
          const movieData = [];

          torrentInfo.each((index, el) => {
            const movie = {};

            movie.index = index;

            movie.title = $(el).find('.torrent-info').find('.download-event').text();
            movie.title = movie.title.substring(0, movie.title.indexOf('.torrent'));

            movie.name = ptt.parse(movie.title).resolution ||
              (typeof ptt.parse(movie.title).source === 'undefined' ? "WEB-DL" : ptt.parse(movie.title).source.toUpperCase());

            movie.health = $(el).find('.upload1').find('.c19').find('em').attr('class');
            movie.health = typeof movie.health === 'undefined' ? 'health_0' : movie.health;
            movie.health = parseInt(movie.health[movie.health.length - 1]);

            movie.size = formatBytes($(el).attr('size'));

            movie.torrentLink = domainLink + $(el).find('.upload1').find('.c7').find('a').attr('href');

            movieData.push(movie);

          });

          //sorted by torrent health
          const sortedStreams = movieData.sort((m1, m2) => (m1.health < m2.health) ? 1 : (m1.health > m2.health) ? -1 : 0);

          return sortedStreams;

        })
        .catch(function(err) {
          console.log(err);
          return [];
        });

    })
    .then(async function(sortedStreams) {

      for (let i = 0; i < sortedStreams.length; i++) {
        if (i > 9) {
          break;
        }
        const infoHash = await getInfoHash(sortedStreams[i].torrentLink).then((infoHash) => {
          return infoHash;
        });

        if (typeof infoHash === 'undefined') {
          sortedStreams.splice(i, 1);
          i--;
          continue;
        }

        sortedStreams[i].infoHash = infoHash;

        sortedStreams[i].title += '\n📶 ' + getTorrentHealthBar(sortedStreams[i].health);
        sortedStreams[i].title += ' 💾 ' + sortedStreams[i].size;
      }

      const streams = sortedStreams.slice(0, 10);
      return streams;

    })
    .catch(function(err) {
      console.log(err);
      return [];
    });
}


function formatBytes(bytes, decimals = 2) {

  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}


function getInfoHash(tUrl) {

  return new Promise((resolve, reject) => {

    const torrentUrl = encodeURI(tUrl);

    const client = torrentUrl.startsWith('https') ? https : http;
    const request = client.get(torrentUrl, response => {

        if (response.statusCode != 200) {
          return;
        }

        let data = Buffer.alloc(0);
        response.on('data', chunk => {
          data = Buffer.concat([data, chunk]);
        });
        response.on('end', () => {
          const decodedData = bencode.decode(data);
          const infoData = decodedData.info;

          if (typeof infoData !== 'undefined') {

            const infoHash = crypto.createHash('sha1').update(bencode.encode(infoData)).digest('hex');

            setTimeout(() => {
              resolve(infoHash);
            }, 100);

          } else {
            resolve();
          }

        });
      })
      .on("error", e => reject(e));
  });

};


function getTorrentHealthBar(healthNumber) {
  const char_empty = '▯';
  const char_full = '▮';
  let health_bar = '';

  for (let i = 0; i < 5; i++) {
    if (i < healthNumber) {
      health_bar += char_full;
    } else {
      health_bar += char_empty;
    }
  }

  return health_bar;
}

module.exports = {
  getStreams,
  cinemeta_movie
};