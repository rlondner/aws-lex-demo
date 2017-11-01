"use strict";
var os = require('os');
var MongoClient = require("mongodb").MongoClient;
var uri = "mongodb://localhost:27017/IMDB";
var moviesCollection = "movies";
const allGenres = "All";
let cachedDb = null;

// Close dialog with the customer, reporting fulfillmentState of Failed or Fulfilled ("Thanks, your pizza will arrive in 20 minutes")
function close(sessionAttributes, fulfillmentState, message) {
  return {
    sessionAttributes,
    dialogAction: {
      type: "Close",
      fulfillmentState,
      message
    }
  };
}

function delegate(sessionAttributes, slots) {
  return {
    sessionAttributes,
    dialogAction: {
      type: "Delegate",
      slots
    }
  };
}

function buildValidationResult(isValid, violatedSlot, messageContent) {
  if (messageContent == null) {
    return {
      isValid,
      violatedSlot
    };
  }
  return {
    isValid,
    violatedSlot,
    message: { contentType: "PlainText", content: messageContent }
  };
}

function validateRequest(actor, genre) {
  return buildValidationResult(true, null, null);
}

// --------------- Events -----------------------

function dispatch(context, intentRequest, callback) {
  const sessionAttributes = intentRequest.sessionAttributes;
  const slots = intentRequest.currentIntent.slots;
  const slotDetails = intentRequest.currentIntent.slotDetails;
  const actor = slots.castMember;
  const genre = slots.genre;
  var jsonSlots = JSON.stringify(slots);
  var jsonSlotDetails = JSON.stringify(slotDetails);

  console.log(
    `request received for userId=${intentRequest.userId}, intentName=${intentRequest
      .currentIntent
      .name} with slots=${jsonSlots} and slotDetails=${jsonSlotDetails}`
  );

  /*
  const validationResult = validateRequest(actor, genre);
  if (!validationResult.isValid) {
      slots[`${validationResult.violatedSlot}`] = null;
      callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
      return;
  }
  const outputSessionAttributes = intentRequest.sessionAttributes || {};
  callback(delegate(outputSessionAttributes, intentRequest.currentIntent.slots));
  return;
  */

  if (genre != undefined && actor != undefined) {
    context.callbackWaitsForEmptyEventLoop = false;
    var mongoDBUri = process.env["MONGODB_URI"];
    try {
      //testing if the database connection exists and is connected to Atlas so we can try to re-use it
      if (cachedDb && cachedDb.serverConfig.isConnected()) {
        query(cachedDb, intentRequest, callback);
      } else {
        //some performance penalty might be incurred when running that database connection initialization code
        //console.log(`=> connecting to database ${mongoDBUri}`);
        MongoClient.connect(mongoDBUri, function(err, db) {
          if (err) {
            console.log(`the error is ${err}.`, err);
            process.exit(1);
          }
          cachedDb = db;
          return query(cachedDb, intentRequest, callback);
        });
      }
    } catch (err) {
      console.error("an error occurred", err);
    }
  }
  /*
  MongoClient.connect(mongoDBUri)
    .then(db => {
      
    })
    .catch(err => {
      if (err) {
        console.log(`the error is ${err}.`, err);
        process.exit(1);
      }
    });
    */
}

function query(db, intentRequest, callback) {
  const sessionAttributes = intentRequest.sessionAttributes;
  const slots = intentRequest.currentIntent.slots;
  const actor = toTitleCase(slots.castMember);
  const genre = toTitleCase(slots.genre);
  var year = parseInt(slots.year.replace(/[^0-9]/g, ""), 10);
  console.log(`Searching for ${genre} movies with ${actor} in ${year}`);

  var actorMovies = "";
  var msgGenre = undefined;
  var msgYear = undefined;

  var query = {
    Cast: { $in: [actor] },
    Genres: { $not: { $in: ["Documentary", "News", ""] } },
    Type: "movie"
  };

  if (genre != undefined && genre != allGenres) {
    query.Genres = { $in: [genre] };
    msgGenre = genre.toLowerCase();
  }

  if ((year != undefined && isNaN(year)) || year > 1895) {
    query.Year = year;
    msgYear = year;
  }

  console.log(`query is ${JSON.stringify(query)}`);

  var resMessage = undefined;
  if (msgGenre == undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${actor}.`;
  }
  if (msgGenre != undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any ${msgGenre} movie for ${actor}.`;
  }
  if (msgGenre == undefined && msgYear != undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${actor} in ${msgYear}.`;
  }
  if (msgGenre != undefined && msgYear != undefined) {
    resMessage = `Sorry, ${actor} played in no ${msgGenre} movie in ${msgYear}.`;
  }

  db
    .collection(moviesCollection)
    .find(query, { _id: 0, Title: 1, Year: 1 })
    .sort({ Year: 1 })
    .toArray(function(err, results) {
      if (err) {
        console.log(`Error querying the db: ${err}.`, err);
        process.exit(1);
      }
      if (results.length > 0) {
        for (var i = 0, len = results.length; i < len; i++) {
          actorMovies += `${results[i].Title} (${results[i].Year}), ${os.EOL}`;
        }
        //removing the last comma and space
        actorMovies = actorMovies.substring(0, actorMovies.length - 2);
        if (msgGenre != undefined) {
          resMessage = `${actor} played in the following ${msgGenre} movies: ${actorMovies}`;
        } else {
          resMessage = `${actor} played in the following movies: ${actorMovies}`;
        }
        if (msgYear != undefined) {
          resMessage = `In ${msgYear}, ` + resMessage;
        }
      }
      console.log(`${actor}'s ${genre} movies are ${actorMovies}`);
      //db.close();
      callback(
        close(sessionAttributes, "Fulfilled", {
          contentType: "PlainText",
          content: resMessage
        })
      );
    });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
  console.log(`MongoDB Uri is ${uri}`);
  try {
    if (event.bot.name !== "SearchMoviesBot") {
      callback("Invalid Bot Name");
      process.exit(1);
    }
    var jsonContents = JSON.parse(JSON.stringify(event));
    //handling API Gateway input where the event is embedded into the 'body' element
    if (event.body !== null && event.body !== undefined) {
      console.log("retrieving payload from event.body");
      jsonContents = JSON.parse(event.body);
    }
    dispatch(context, jsonContents, response => {
      callback(null, response);
    });
  } catch (err) {
    callback(err);
  }
};
