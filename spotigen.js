require("dotenv").config();
var express = require("express"); // Express web server framework
var cors = require("cors");
var cookieParser = require("cookie-parser");
var SpotifyWebApi = require("spotify-web-api-node");
var request = require("request");

const open = require("open");

var client_id = process.env.CLIENT_ID;
var client_secret = process.env.CLIENT_SECRET;
var redirect_uri = "http://localhost:8888/callback"; // Your redirect uri

var scopes = ["playlist-modify-public"];
var stateKey = "spotify_auth_state";
var state = "init";

var app = express();

app.use(cors()).use(cookieParser());

app.get("/callback", function(req, res) {
    // your application requests refresh and access tokens
    // after checking the state parameter
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    // if (state === null || state !== storedState) {
    //     console.log("state_mismatch state: ", state, "storedState: ", storedState);
    // } else {
    res.clearCookie(stateKey);
    var authHeader = client_id + ":" + client_secret;
    var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: "authorization_code"
        },
        headers: {
            Authorization:
                "Basic " +
                Buffer.alloc(authHeader.length, authHeader).toString("base64")
        },
        json: true
    };

    request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token,
                refresh_token = body.refresh_token;

            var options = {
                url: "https://api.spotify.com/v1/me",
                headers: { Authorization: "Bearer " + access_token },
                json: true
            };

            // use the access token to access the Spotify Web API
            request.get(options, function(error, response, body) {
                console.log(body);
            });

            // we can also pass the token to the browser to make requests from there
            console.log(
                "access_token: ",
                access_token,
                " refresh_token: ",
                refresh_token
            );

            afterLoggedIn(access_token);
            res.sendStatus(200);
        } else {
            console.log("invalid_token");
        }
    });
    // }
});
console.log("Listening on 8888");
app.listen(8888);

var spotifyApi = new SpotifyWebApi({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

// Create the authorization URL
var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
console.log("URL: ", authorizeURL);

(async () => {
    // Opens the URL in the default browser and waits for the opened app to quit
    await open(authorizeURL, { wait: true });
    console.log("Opening app browser");
})();

function afterLoggedIn(access_token) {
    console.log("The access token is ", access_token);
    spotifyApi.setAccessToken(access_token);

    // // Get Elvis' albums
    // spotifyApi.getArtistAlbums("43ZHCT0cAZBISjO8DG9PnE").then(
    //     function(data) {
    //         console.log("Artist albums", data.body);
    //     },
    //     function(err) {
    //         console.error(err);
    //     }
    // );

    // http://michaelthelin.se/spotify-web-api-node/#createPlaylist
    spotifyApi.createPlaylist(process.env.USER, 'My cool playlist!', { public : true }).then(
        function(data) {
            console.log("Created playlist: ", data);
        },
        function(err) {
            console.error(err);
        }
    );
}
