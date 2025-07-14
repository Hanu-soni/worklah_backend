var https = require('follow-redirects').https;
var fs = require('fs');

var options = {
    'method': 'POST',
    'hostname': 'api.infobip.com',
    'path': '/2fa/2/applications',
    'headers': {
        'Authorization': 'App dcba5db3de3f8c70aa5b5892eea3a859-45578984-85d3-47b0-85f5-fb60da83990d',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    'maxRedirects': 20
};

var req = https.request(options, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
        chunks.push(chunk);
    });

    res.on("end", function (chunk) {
        var body = Buffer.concat(chunks);
        console.log(body.toString());
    });

    res.on("error", function (error) {
        console.error(error);
    });
});

var postData = JSON.stringify({
    "name": "2fa test application",
    "enabled": true,
    "configuration": {
        "pinAttempts": 10,
        "allowMultiplePinVerifications": true,
        "pinTimeToLive": "15m",
        "verifyPinLimit": "1/3s",
        "sendPinPerApplicationLimit": "100/1d",
        "sendPinPerPhoneNumberLimit": "10/1d"
    }
});

req.write(postData);

req.end();