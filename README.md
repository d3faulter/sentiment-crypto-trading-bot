# sentiment-crypto-trading-bot [not finished]

Script for serverless Azure Functions script using API's to: Perform AI sentiment analysis of news headlines, rating the potential up- and downside and performing SPOT trades based on current portfolio.

Currently using timed trigger.

# Setup
1. Change the cron timer to suit your intervals. 
2a. Create a ".env" file in root with your api keys and secret
2b. After setting up the functions app, create a new application setting under "Configuration" in the Azure dashboard, and add your credentials as
"CRYPTOPANIC_API_KEY", "BYBIT_API_SECRET", "BYBIT_API_KEY" and "OPENAI_API_KEY".

# Process
1. News are fetched and mentioned coins are saved
2. Mentioned coins are checked for availability on ByBit
3. GPT does a sentiment analysis of the individual articles cointaining the available coins. Results in a rating between 0.0 - 10.0
4. If rating is to sell, current portfolio is checked for containing the coin and sold if true.
5. If rating is to buy, 24 hour price data is fetched from Bybit, and GPT does rating analysis of Moving Averages, RSI and MACD. If combined results evolves to buy, x amount of coin is bought. Amount is calculated as a percentage of the max set variable buying percentage. Buying allocation is calculated from the overall ratings, thus the AI's overall certainty. 

# Bot Differences

## Bot 1 - Higher risk tolerance
## Bot 2 - Medium risk tolerance
## Bot 3 - Low risk tolerance

# Host on server (constant uptime)
With few to no changes, bot can be hosted on a server, although adding another trigger might be a good idea to limit API calls e.g. when a new article is uploaded in CryptoPanic.
