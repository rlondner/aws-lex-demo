var MongoClient = require("mongodb").MongoClient;
//var uri = "mongodb://localhost:27017/IMDB";
var uri = "mongodb://atlasAdminM1:Ibg5LRNk0tZN1KhS@cluster0-shard-00-00-nebpx.mongodb.net:27017,cluster0-shard-00-01-nebpx.mongodb.net:27017,cluster0-shard-00-02-nebpx.mongodb.net:27017/IMDB?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin"
var moviesCollection = "movies";

MongoClient.connect(uri)
  .then(db => {
    db
      .collection(moviesCollection)
      .find({ Cast: { $in: ["Tom Cruise"] } })
      .toArray(function(err, results) {
        if (err) {
          console.log(`Error querying the db: ${err}.`, err);
          process.exit(1);
        }
        console.log(results);
        db.close();
      });   
  })
  .catch(err => {
    if (err) {
      console.log(`the error is ${err}.`, err);
      process.exit(1);
    }
  });
/*
MongoClient.connect(uri).then(db => {
  if (err) {
    console.log(`the error is ${err}.`, err);
    process.exit(1);
  }
  //let results = db.collection(moviesCollection).find({'Cast': {'$regex':'.*Tom Cruise.*'}})
  db.collection(moviesCollection).find({'Cast': {'$in':'Tom Cruise'}}).toArray(function(err, results) {
    //if (err) throw err;
  console.log(results);
  return results;
  })
  db.close();
});
*/
