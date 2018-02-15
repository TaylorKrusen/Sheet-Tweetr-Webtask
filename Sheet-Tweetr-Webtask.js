module.exports = function(ctx, cb) {
    'use strict';
    const COLUMN_MAP = {
        tweetTextCID: 12345,//replace with column id for 'Tweet'
        tweetImageCID: 12345,//replace with column id for 'Image'
        tweetStartCID: 12345,//replace with column id for 'Start'
        tweetEndCID: 12345,//replace with column id for 'End'
        tweetFreqCID: 12345,//replace with column id for 'Frequency'
        tweetFreqTypeCID: 12345,//replace with column id for 'Frequency Type'
        tweetLastRanCID: 12345,//replace with column id for 'LastRan'
        tweetTimeCID: 12345,//replace with column id for 'First Tweet Time'
    };
    const twit = require('twit');
    const smartsheet = require('smartsheet');
    const base64 = require('node-base64-image');
    const request = require('request');
    // IMPORTANT: Set your local time zone abbreviations.
    const userTimeZone = "PST";
    
    const itemsWithValidDates = [];

    const smartsheetClient = smartsheet.createClient({
        accessToken: ctx.secrets.SMARTSHEET_ACCESS_TOKEN,
    });

    const options = {
        id: ctx.secrets.SMARTSHEET_SHEET_ID, // Id of Sheet
    };

    const Twitter = new twit({
        consumer_key: ctx.secrets.TWITTER_CONSUMER_KEY,
        consumer_secret: ctx.secrets.TWITTER_CONSUMER_SECRET,
        access_token: ctx.secrets.TWITTER_ACCESS_TOKEN,
        access_token_secret: ctx.secrets.TWITTER_ACCESS_SECRET,
        timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
    });

    function tweet(status, rowId) {
        Twitter.post('statuses/update', status, (err, data, response) => {
            if (err) {
                console.log(`error ${err}`);
                postTweet(itemsWithValidDates);
                return err;
            }
            console.log('successfully tweeted');
            updateSheetRow(rowId);
            return cb();
        });
    }

    function tweetWithImg(text, image64, rowId) {
        Twitter.post(
            'media/upload',
            { media_data: image64 },
            (err, media, response) => {
            if (err) {
                console.log(`error ${err}`);
                return err;
            }
            const status = {
                status: text,
                media_ids: media.media_id_string,
            };
        tweet(status, rowId);
        });
    }

    function tweetTheRow(scheduledItem) {
        if (scheduledItem.tweetImage !== undefined) {
            getImgData(scheduledItem.tweetImage, image64 => {
                tweetWithImg(scheduledItem.tweetText, image64, scheduledItem.rowId);
            });
        } else {
            const status = {
                status: scheduledItem.tweetText,
            };
            tweet(status, scheduledItem.rowId);
        }
    }

    function createSimpleRow(row) {
        const rowValues = {};
        row.cells.forEach(cell => {
            const columnId = cell.columnId;
            rowValues[columnId] = cell.value;
            if (cell.image) {
                rowValues[columnId] = cell.image.id;
            }
        });
        return rowValues;
    }

    function updateSheetRow(rowId) {
        const rowUpdate = [
            {
                id: rowId,
                cells: [
                    {
                        columnId: COLUMN_MAP['tweetLastRanCID'],
                        value: Date.now(),
                    },
                ],
            },
        ];
        const options = {
            body: rowUpdate,
            sheetId: ctx.secrets.SMARTSHEET_SHEET_ID,
        };
        smartsheetClient.sheets.updateRow(options, (error, data) => {
            if (error) {
                console.log(error);
                return error;
            }
            console.log('successfully updated');
        });
    }

    function getImgData(imageId, imageReturn) {
        const options = {
            method: 'POST',
            url: 'https://api.smartsheet.com/2.0/imageurls',
            headers: {
                authorization: 'Bearer ' + ctx.secrets.SMARTSHEET_ACCESS_TOKEN,
            },
            body: [{ imageId: imageId }],
            json: true,
        };
        request(options, (error, response, body) => {
            if (error) {
                console.log(error);
                return error;
            } else {
                const tempImgUrl = body.imageUrls[0].url;
                const temp = { string: true };
                base64.encode(tempImgUrl, temp, (err, image64) => {
                    if (err) {
                        console.log(err);
                        return err;
                    }
                    return imageReturn(image64);
                });
            }
        });
    }

    function frequencyCheck(lastRan, freq, freqType) {
        const nextTweet = new Date(lastRan);
        switch (freqType) {
            case 'hour':
                // This line sets max hourly limit to 3 per hour. Higher numbers are likely to get your account banned from Twitter. Remove at your own risk.
                if (freq > 3) { freq = 3; }
                nextTweet.setHours(nextTweet.getHours() + freq);
                break;
            case 'day':
                const dailyHourSplit = 24 / freq;
                nextTweet.setHours(nextTweet.getHours() + dailyHourSplit);
                break;
            case 'week':
                const weeklyHourSplit = 168 / freq;
                nextTweet.setHours(nextTweet.getHours() + weeklyHourSplit);
                break;
            case 'month':
                const monthlyHourSplit = 720 / freq;
                nextTweet.setHours(nextTweet.getHours() + monthlyHourSplit);
                break;
        }
        return nextTweet;
    }

    function specificTime(timeString, postDate) {
        let hours = Number(timeString.match(/^(\d+)/)[1]);
        const minutes = Number(timeString.match(/:(\d+)/)[1]);
        const AMPM = timeString.match(/[a-z]+/i)[0];
        const midnight = AMPM.toLowerCase() === 'am' && hours === 12;
        const evening = AMPM.toLowerCase() === 'pm' && hours !== 12;
        if (evening) {
          hours += 12;
        }
        if (midnight) {
          hours = 0;
        }
        let tweetDate = new Date(postDate);
        tweetDate.setHours(tweetDate.getHours() + hours);
        tweetDate.setMinutes(tweetDate.getMinutes() + minutes);

        return new Date(Date.parse(tweetDate + " " + userTimeZone))
    }

    function examineCriteria(
        tweetStartDate,
        tweetEndDate,
        tweetTime,
        lastRan,
        freq,
        freqType,
        comparedTo
        ) {
        // USE CASE 1: date does not fall within given range
        if (tweetStartDate >= comparedTo || tweetEndDate <= comparedTo) {
            console.log('Invalid date range');
            return { invalidDate: true };
        }
        // USE CASE 2: scheduled item has valid dates, but has not been posted yet
        if (lastRan === undefined) {
            let postTime = specificTime(tweetTime, tweetStartDate).getTime();
            const oneHour = 3.6e6;
            const oneHourBefore = comparedTo - oneHour;
            const oneHourAfter = comparedTo + oneHour;
            if (postTime <= oneHourAfter && postTime >= oneHourBefore) {
                console.log('close enough...');
                return { firstPost: true };
            }
        }
        // USE CASE 3: the tweet has valid dates and should go out again
        let nextTweetDate = frequencyCheck(lastRan, freq, freqType);
        if (nextTweetDate.getTime() < comparedTo) {
            return { validPost: true };
        }
        return {};
    }

    function validateItem(scheduledItem) {
        // build an array to assemble all the tweets and then have them go out how you want
        const isValidItem = examineCriteria(
            scheduledItem.tweetStartDate,
            scheduledItem.tweetEndDate,
            scheduledItem.tweetTime,
            scheduledItem.lastRan,
            scheduledItem.freq,
            scheduledItem.freqType,
            Date.now()
        );

        if (
            isValidItem.firstPost ||
            isValidItem.validPost
        ) {
            return true;
        }
    }

    function getListOfItems() {
        smartsheetClient.sheets.getSheet(options, (error, data) => {
            if (error) {
                console.log(error);
                return error;
            }
            for (let i = 0; i < data.rows.length; i++) {
                let row = data.rows[i];
                let simpleRow = createSimpleRow(row);
                let scheduledItem = {
                    tweetText: simpleRow[COLUMN_MAP.tweetTextCID],
                    tweetImage: simpleRow[COLUMN_MAP.tweetImageCID],
                    tweetStartDate: Date.parse(simpleRow[COLUMN_MAP.tweetStartCID]),
                    tweetEndDate: Date.parse(simpleRow[COLUMN_MAP.tweetEndCID]),
                    lastRan: simpleRow[COLUMN_MAP.tweetLastRanCID],
                    freq: simpleRow[COLUMN_MAP.tweetFreqCID],
                    freqType: simpleRow[COLUMN_MAP.tweetFreqTypeCID],
                    tweetTime: simpleRow[COLUMN_MAP.tweetTimeCID],
                    rowId: row.id,
                };
                let result = validateItem(scheduledItem);

                if (result === true) {
                    itemsWithValidDates.push(scheduledItem);
                    continue;
                }
            }
            postTweet(itemsWithValidDates);
        });
    }

    function postTweet(validItems) {
        if (!validItems.length) {
            console.log("no tweetable items");
            return cb();
        }
        if (validItems.length > 0) {
            let nextItem = validItems.shift();
            tweetTheRow(nextItem);
        }
    }

    getListOfItems();
};
