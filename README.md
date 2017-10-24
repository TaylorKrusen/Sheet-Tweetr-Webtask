# Sheet-Tweetr

Do you have a big event coming up at the end of the month and want to tell the world via Twitter? With Sheet-Tweetr you can make a single announcement and post it multiple times leading up to your event.

Sheet-Tweetr exists to fulfill two purposes:
1. Make redundant announcements on Twitter a little easier to plan and manage.
2. Serve as a point of reference for integrating the Smartsheet API with another, third party API. 

Sheet-Tweetr was written to run in [Auth0's serverless environment called Webtask](https://webtask.io/), which we will be using to run our code on a scheduled, recurring basis. You will need a [Twitter Developer Account](https://developer.twitter.com/#) and a [Smartsheet Developer Account](http://developers.smartsheet.com/register)—both are free! 

----------
### Setting up Sheet-Tweetr
##### In Smartsheet:

 - Create a new sheet with the following columns: Name, Tweet, Image, Start, End, Frequency, Frequency Type, LastRan and First Tweet Time. I.E.: ![enter image description here](https://lh3.googleusercontent.com/-5szgOzKjQ-A/We6BcbNcPcI/AAAAAAAAAG4/_FR260Hz9Z4wKalj76ik-1u5Op3giHu1ACLcBGAs/s0/Screen+Shot+2017-10-23+at+4.49.28+PM.png "ColumnNames.png")
 - Enter some test data in a couple rows using a valid date range.
 - Grab your Sheet ID (this can be found under sheet properties). You will need this for an environment variable in the next step.
 - Grab your [Smartsheet Access Token](https://smartsheet-platform.github.io/api-docs/#authentication-and-access-tokens). Select 'Account Settings' --> 'API Access'. Click the 'Generate a new access token' button and copy the token. You will need this for an environmental variable in next step. 

##### In Webtask:

 - Create a new, blank Webtask using the Online Editor (select 'create empty').
 - Go to 'Settings' --> 'Secrets'. 
 
![enter image description here](https://lh3.googleusercontent.com/b32ZMs9TXsE3aD7V7PlnH50FaxRBL4TDEOOb2ZHfxNBktIz1skJ-xfDCAWROZPihUy9hxt-e2ss=s0 "WebtaskSecrets.png")
 - Add the following environment variables:
    * Smartsheet Sheet ID
    * Smartsheet Access Token
    * Twitter Consumer Key
    * Twitter Consumer Secret
    * Twitter Access Token (Copy/pasting the Twitter Access Token usually adds several blank spaces in front of the string you are grabbing. Watch for it.) 
    * Twitter Access Secret
 
 - In Settings --> NPM Modules, install the following node modules:
     * Smartsheet
     * Twit
     * Request
     * Node-Base64-Image
 - Copy the code from this repo and paste it in your webtask. **We are not done yet.**

##### General

 - Change the `timezoneDifference` variable to reflect your time zone.
 - Make a GET request to “https://<i></i>api.smartsheet.com/2.0/sheets/YOUR_SHEET_ID”
 - In the resulting JSON, find the "columns" key. Each object in that array is a column and contains an "id" and "title" property. 
 
 ![enter image description here](https://lh3.googleusercontent.com/8o31jk_64I0Ch60-EKczSu8FGvcoJ3iNz31FJcZ9bo8A5RwH2jk5HxGITHmygonJsr8HNfBiyqk=s0 "columnJSON.png")
 -  In the `COLUMN_MAP` variable in Webtask, replace the value for each property with the appropriate column id you got back in the JSON response. **Every** value in `COLUMN_MAP` must be replaced with the corresponding column id from your sheet. 
 
 ![enter image description here](https://lh3.googleusercontent.com/-_BorLYdRSCk/We6NDE-aK2I/AAAAAAAAAHg/nxFYJHAt1eIokIf2RR06GqeHF9tLlr1XgCLcBGAs/s0/Screen+Shot+2017-10-23+at+5.39.50+PM.png "ColumnMap.png")

**Note:** this image is just for reference. Your sheet will have unique column ids that can only be retrieved through a [GET Sheet request](https://smartsheet-platform.github.io/api-docs/#get-sheet). 

----------
### Post a Test Tweet! 

 - Open the logs in Webtask. Select Runner and click Run. 
 - Check Twitter. Did your test tweet come through? 
 - Look at the Webtask logs for any error messages. 

----------
### How Does it Work?

 1. Sheet-Tweetr grabs your sheet data from Smartsheet.
 2. We loop through each row and manipulate the data into a `scheduledItem` object.
 3. Each `scheduledItem` is checked for the following criteria:
	 
 - The current date is between the Start and End Date we provided.
 - Tweet hasn't been posted yet and doesn't have a specific post time.
 - Tweet hasn't been posted yet and _**does**_ have a specific post time.
>  At this point we know the tweet has a valid date range and has been
> posted before so we need to check the frequency (`checkFrequency`
> function). Basically "this tweet went out before—has enough time
> passed to post it again?".
 - The tweet is valid and should go out again.

 4. If the `scheduledItem` meets  any of the bottom three criteria, then it's pushed into an array called `itemsWithValidDates`.
 5. Once each row from our sheet has been checked, the `itemsWithValidDates` array is passed to our `postTweet` function. 
 6. The `postTweet` function breaks out of our application if the array is empty (meaning no valid items to tweet) or calls our tweet methods on the first entry in the array. 
 7. If an outgoing tweet returns an error, then the `postTweet` function is called again on the next item in the array. 
 8. Once a tweet goes out successfully we break out of our application. 
 


----------
### Having Trouble Getting Sheet-Tweetr to Work? 
Step 1: Check all your environmental variables for extra spaces (Smartsheet Access Token, Twitter Access Token, etc.).

Step 2: Record the errors you are getting from the Webtask logs and reach out to the [Developer Relations Team](mailto:devrel@smartsheet.com) at Smartsheet.


----------
### Helpful Resources

 - [Smartsheet Documentation](https://smartsheet-platform.github.io/api-docs/)
 - [Webtask Documentation](https://webtask.io/docs/101)
 - [README for Twit](https://github.com/ttezel/twit) (the node-twitter integration module we are using).  

	 


----------


**Disclaimer**: this app is a sample meant to serve as a reference for working with the Smartsheet API and is not an officially supported integration. Using automated posts with Twitter _can_ get your account banned if you abuse it. Use at your own risk. 