// imports
require("dotenv").config();
var express = require("express"); // Express web server framework
var cors = require("cors");
var cookieParser = require("cookie-parser");
var SpotifyWebApi = require("spotify-web-api-node");
const readline = require("readline-sync");
const open = require("open");

var log = require("./utils");

// variables
var client_id = process.env.CLIENT_ID || null;
var client_secret = process.env.CLIENT_SECRET || null;
var user_id = process.env.USER_ID || null;
var redirect_uri = "http://localhost:8888/callback"; // Your redirect uri
var scopes = ["playlist-modify-private"];
var state = "init";

var spotifyApi = new SpotifyWebApi({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

// Check env parameters
function checkParameters() {
    if (client_id === null || client_secret === null || user_id === null) {
        log.error(
            "ERROR: Must configure .env (CLIENT_ID, CLIENT_SECRET, USER_ID"
        );
        return false;
    }
    return true;
}

// initialize http server
var app = express();
app.use(cors()).use(cookieParser());

app.get("/callback", function(req, res) {
    var code = req.query.code || null;
    if (code !== null) {
        // Retrieve an access token and a refresh token
        spotifyApi.authorizationCodeGrant(code).then(
            function(data) {
                log.debug("The token expires in " + data.body["expires_in"]);
                log.debug("The access token is " + data.body["access_token"]);
                log.debug("The refresh token is " + data.body["refresh_token"]);

                // Set the access token on the API object to use it in later calls
                spotifyApi.setAccessToken(data.body["access_token"]);
                spotifyApi.setRefreshToken(data.body["refresh_token"]);

                var result = afterLoggedInSpotify();
                if (result) {
                    res.status(200).send("Playlist created!");
                } else {
                    res.status(500).send(
                        "Error creating playlist, check console log!"
                    );
                }
            },
            function(err) {
                log.error(err);
            }
        );
    } else {
        res.sendStatus(404);
    }
});

main();

function main() {
    // Check env config before anything
    if (!checkParameters()) {
        return;
    }

    log.info("Listening on localhost:8888...");
    app.listen(8888);

    // Create the authorization URL
    var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    log.debug("Authorization URL: " + authorizeURL);

    // Opens the URL in the default browser and waits for the opened app to quit
    log.debug("Opening app browser");
    open(authorizeURL, { wait: true });
}

async function afterLoggedInSpotify() {
    // Get parameters from terminal input
    var playlist = readline.question("Inform the name of your playlist: ");
    while (playlist.length === 0) {
        playlist = readline.question("Inform a valid name for your playlist: ");
    }

    var filename = readline.question(
        "Inform the name of file containing songs (default: songs.txt): "
    );
    if (filename.length === 0) {
        filename = "songs.txt";
    }

    // http://michaelthelin.se/spotify-web-api-node/
    // Read file
    var songs = await readSongsFromFile(filename);
    if (songs.length === 0) {
        log.error("Could not read file");
        return false;
    }

    // Search for songs in Spotify
    var tracks = await searchSongsOnSpotify(songs);
    if (tracks.length === 0) {
        log.error("Did not found any song in spotify");
        return false;
    }

    // Create the playlist
    return createPlaylistWithTracksOnSpotify(playlist, tracks);
}

function readSongsFromFile(path) {
    var fs = require("fs");
    var songs = fs
        .readFileSync(path, "utf8")
        .toString()
        .split("\n");

    return songs;
}

async function searchSongsOnSpotify(songs) {
    // Create a promise for every song, to query in parallel
    var promises = [];
    for (song of songs) {
        promises.push(spotifyApi.searchTracks(song, { limit: 1 }));
    }

    // Execute these promises and get the result of every one
    var spotifyTracks = [];
    await Promise.all(promises).then(function(results) {
        for (index in results) {
            let result = results[index];
            if (result.body.tracks.items[0] !== undefined) {
                spotifyTracks.push(result.body.tracks.items[0].uri);
            } else {
                log.debug("Song not found: " + songs[index]);
            }
        }
    });

    return spotifyTracks;
}

async function createPlaylistWithTracksOnSpotify(name, tracks) {
    let success = false;
    let playlistId;
    await spotifyApi.createPlaylist(user_id, name, { public: false }).then(
        function(data) {
            log.info("Created playlist!");
            playlistId = data.body.id;
        },
        function(err) {
            log.error(err);
        }
    );

    if (playlistId !== undefined) {
        await spotifyApi
            .addTracksToPlaylist(playlistId, tracks)
            .then(function(data) {
                log.info("Added tracks to the playlist!");
                success = true;
            })
            .catch(function(err) {
                log.error(err);
            });
    }
    return success;
}
