const {
  Level
} = require('level')


const db = new Level('./cache', {
  valueEncoding: 'json'
})


async function put(movie_id, object) {

  if (db.status == 'closed') {
    await db.open();
  }

  const time_to_live = Math.round(Date.now() / 1000) + 604800 // plus 1 week

  //insert into 0 position
  object.unshift({
    ttl: time_to_live
  });

  return db.put(movie_id, object)
    .then(async function() {
      await db.close();
      return 1;
    })
    .catch(async function(error) {
      await db.close();
      return error;
    });
}


async function get(movie_id) {

  if (db.status == 'closed') {
    await db.open();
  }

  return db.get(movie_id)
    .then(async function(data) {
      await db.close();
      return data;
    })
    .catch(async function(error) {
      await db.close();
      return error;
    });
}


module.exports = {
  put,
  get,
  db
};