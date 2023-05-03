const {
    addonBuilder
} = require('stremio-addon-sdk')
const needle = require('needle')
const tp = require('./lib/torrent_parser')
const cache = require('./lib/cache')


const builder = new addonBuilder({
    id: 'org.stremio.stremftru.addon',
    version: '1.0.0',
    name: 'stremftru',
    description: 'Provides torrent streams from scraped fast-torents.ru',

    catalogs: [],
    resources: ['stream'],
    types: ['movie'],
    idPrefixes: ['tt']
})

builder.defineStreamHandler(async function(args) {
    if (args.type === 'movie') {

        let resPromise = needle("get", 'https://v3-cinemeta.strem.io/meta/' + args.type + '/' + args.id + '.json');
        const res = await resPromise.then(async function(response) {

            if (response.statusCode == 307) { //temporary redirect to cinemeta-live.strem.io
                resPromise = needle("get", response.headers.location);
                response = await resPromise.then((response) => {
                    return response;
                })
            }

            return response;
        });

        tp.cinemeta_movie.id = typeof res.body.meta === 'undefined' ? '' : res.body.meta.imdb_id;
        tp.cinemeta_movie.name = typeof res.body.meta === 'undefined' ? '' : res.body.meta.name;
        tp.cinemeta_movie.release_year = typeof res.body.meta === 'undefined' ? '' : res.body.meta.releaseInfo;

        let streams = await cache.get(tp.cinemeta_movie.id).then((streams) => {
            return streams;
        });

        if (streams.status == 404) {
            streams = await tp.getStreams().then((streams) => {
                if (streams.length > 0) {
                    cache.put(tp.cinemeta_movie.id, streams);
                }
                return streams;
            });
        }

        return Promise.resolve({
            streams: streams
        })
    } else {
        return Promise.resolve({
            streams: []
        })
    }
})

module.exports = builder.getInterface()