var MongoClient = require("mongodb").MongoClient;
var uri = "mongodb://localhost:27017/IMDB";
var moviesCollection = "movies";
console.log("Updating Movies database");
var batch = 10;
var max = 100;

//for (var j = 0; j < max; j++) {
MongoClient.connect(uri).then(db => {
  /*db.collection(moviesCollection).find({'Cast':{'$regex':'.*Tom Cruise.*'}}).toArray(function(err, result) {
        if (err) throw err;
        console.log(result);
        db.close();
      });
      */

  db
    .collection(moviesCollection)
    .aggregate([
        //{ $match: {"Title":{$type:16}}},
        { $match: {$nor: [{ "Genres": { $elemMatch: { $exists: true } } },{ "Genres": [] }]}},
      //{ $match: {$nor: [{ "Cast": { $elemMatch: { $exists: true } } },{ "Cast": [] }]}},
      //{ $match: { "Title": {$regex:'^z.*'}}},
      { $project: { Genres: { $split: ["$Genre", ", "] }, Title: 1, Genre:1 } }
    ])
    .toArray(function(err, result) {
      if (err) throw err;
      //console.log(result);

      for (var i = 0, len = result.length; i < len; i++) {
        if (result[i] != null) {
          console.log(
            `Updating ${result[i]._id} with title ${result[i].Title} and genres ${result[i].Genre}`
          );
          var castArray = { Genres: result[i].Genres };
          db
            .collection(moviesCollection)
            .update({ _id: result[i]._id }, { $set: castArray }, function(
              err,
              res
            ) {
              if (err) {
                console.log(`error updating doc ${result[i]._id}`)
                throw err;
              }
              //console.log(`updated ${result[i].Title}`);
            });
            
        }
      }
      db.close();
    });
});
