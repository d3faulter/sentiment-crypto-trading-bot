# sentiment-crypto-trading-bot [not finished]

Script for serverless Azure Functions script using API's to: Perform AI sentiment analysis of news headlines, rating the potential up- and downside and performing SPOT trades based on current portfolio.

Currently using timed trigger.

# Setup
1. Change the cron timer to suit your intervals. 
2a. Create a ".env" file in root with your api keys and secret
2b. After setting up the functions app, create a new application setting under "Configuration" in the Azure dashboard, and add your credentials as
"CRYPTOPANIC_API_KEY", "BYBIT_API_SECRET" and "BYBIT_API_KEY".


# Bot Differences

## Bot 1 - Higher risk tolerance
## Bot 2 - Medium risk tolerance
## Bot 3 - Low risk tolerance

# Host on server (constant uptime)
With few to no changes, bot can be hosted on a server, although adding another trigger might be a good idea to limit API calls e.g. when a new article is uploaded in CryptoPanic.
