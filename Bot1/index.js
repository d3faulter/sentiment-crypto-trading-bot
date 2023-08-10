const axios = require('axios');
const { RestClientV5 } = require('bybit-api');
require('dotenv').config({ path: '../.env' });

const client = new RestClientV5({
    apiKey: process.env.BYBIT_API_KEY, 
    apiSecret: process.env.BYBIT_API_SECRET,
});


// // Timer til at køre
 module.exports = async function (context, myTimer) {
     var timeStamp = new Date().toISOString();
    
     if (myTimer.isPastDue)
     {
        context.log('JavaScript is running late!');
     }
     context.log('JavaScript timer trigger function ran!', timeStamp);   
   
    const news = await fetchNews();
    const coinSymbolsFromNews = extractCoinSymbolsFromNews(news);
    context.log(coinSymbolsFromNews);

    const availableCoins = await fetchAvailableCoins();
    const commonCoins = coinSymbolsFromNews.filter(symbol => availableCoins.includes(symbol));
    context.log(commonCoins);

    const coinData = await fetch24HourData(commonCoins);
    context.log(coinData);
 };


// Fetch news
async function fetchNews() {
    const allNews = [];

    // Response is paginated, so we need to loop through all pages
    try {
        for (let page = 1; page <= 5; page++) {
            const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
                params: {
                    auth_token: process.env.CRYPTOPANIC_API_KEY,
                    kind: 'news',
                    page: page
                },
            });
            allNews.push(...response.data.results);
        }
        console.log(`Fetched: ${allNews.length} articles`);
        return allNews;

    } catch (error) {
        console.error(`Failed to fetch news: ${error}`);
        return null;
    }
}

// Save coins from news response
function extractCoinSymbolsFromNews(News) { // Should be allNews?
    const coinSymbols = [];

    try {
        for (const article of News) {
            // Check if article.currencies is defined and is an array
            if (Array.isArray(article.currencies)) {
                for (const currency of article.currencies) {
                    if (!coinSymbols.includes(currency.code))  {
                        coinSymbols.push(currency.code);
                    }
                }
            }
        }
        console.log(`Extracted ${coinSymbols.length} coins from news articles`);
        return coinSymbols;
    } catch (error) {
        console.error(`Failed to extract coins from news: ${error}`);
    }
}


// Check if coins in coinSymbols are available on ByBit and return the available ones
async function fetchAvailableCoins(coinSymbols) {
    const availableCoins = [];

    try {
        const response = await client.get('market/tickers', {
            category: 'spot',
        });

        console.log(response);
*        if (response.retCode === 0) {
            const tickers = response.result.list;

            for (const ticker of tickers) {
                const symbol = ticker.symbol.split('USDT')[0];  // Split the symbol on 'USDT' to get the coin symbol
                if (!availableCoins.includes(symbol)) {
                    availableCoins.push(symbol);
                }
            }
        }
    } catch (error) {
        console.error(`Failed to fetch available coins: ${error}`);
    }

    console.log(`Found ${availableCoins.length} coins available on ByBit`);
    return availableCoins;
}

// ### Sentiment analysis of news ###

// Match availableCoins with fetched news to get coinNews, which is an array of the news that are relevant for the available coins
function matchNewsWithCoins(availableCoins, allNews) {
    const coinNews = [];

    for (const article of allNews) {
        for (const currency of article.currencies) {
            if (availableCoins.includes(currency.code)) {
                coinNews.push(article);
            }
        }
    }
    console.log(coinNews);
    return coinNews;

}

// Sentiment analysis of news using OpenAI
async function analyzeSentiment(coinNews) {
    const sentiments = {};

    for (const article of coinNews) {
        try {
            const response = await axios.post('https://api.openai.com/v1/engines/davinci/completions', {
                prompt: `Analyze the sentiment of this headline: "${article.title}". Rate it from 0 (very negative) to 10 (very positive).`,
                max_tokens: 5
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const score = parseFloat(response.data.choices[0].text.trim());
            if (score >= 8) {
                sentiments[article.currency.code] = 'buy';
            } else if (score <= 2) {
                sentiments[article.currency.code] = 'sell';
            } else {
                sentiments[article.currency.code] = 'neutral';
            }
        } catch (error) {
            console.error(`Failed to analyze sentiment for ${article.title}: ${error}`);
        }
    }

    return sentiments;
}


// Fetch 24 hour ticker data (should only be done if coin is assessed as either buy or sell)
// Currently checks all coins, but should only check the ones that are assessed as either buy or sell -> Change availableCoins to res of above analysis
async function fetch24HourData(sentiments) {
    const data = {};

    for (const symbol in sentiments) {
        if (sentiments[symbol] === 'buy' || sentiments[symbol] === 'sell') {
            try {
                const response = await client.getTickers({
                    category: 'spot',
                    symbol: symbol,
                });

                if (response.retCode === 0) {
                    data[symbol] = response.result;
                }
            } catch (error) {
                console.error(`Failed to fetch 24-hour data for ${symbol}: ${error}`);
            }
        }
    }

    return data;
}


// Price analysis with EMA's, MACD, RSI and Volume. Evaluated by GPT



// !!!!!!!!!!!!!!!!!! Add all new functons to timer trigger in the top !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


// Mock context and myTimer objects for local testing
const mockContext = {
    log: console.log
};

const mockTimer = {
    isPastDue: false
};

// Call the main function directly
module.exports(mockContext, mockTimer);