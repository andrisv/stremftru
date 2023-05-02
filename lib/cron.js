const cron = require('node-cron');
const cache = require('./cache');


function delCache(scheduler) {

	cron.schedule(scheduler, async function() {

		const now = Math.round(Date.now() / 1000);

		if (cache.db.status == 'closed') {
			await cache.db.open();
		}

		for await (const [key, value] of cache.db.iterator()) {
			if (value[0].ttl < now) {
				cache.db.del(key);
			}
		}

		await cache.db.close();

	});
}


module.exports = {
	delCache
};