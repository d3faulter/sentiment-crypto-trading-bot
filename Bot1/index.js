const axios = require('axios');
const { RestClientV5 } = require('bybit-api');
require('dotenv').config({ path: '../.env' });

// News Sources to consider as reputable. Add or remove sources as needed.
const REPUTABLE_SOURCES = [
    'cryptoslate.com',
    'newsbtc.com',
    'finbold.com',
    'cointelegraph.com',
    'coindesk.com',
    'cryptopotato.com',
    'cryptonews.com',
    'cryptobriefing.com',
    'cryptodaily.co.uk',
    'cryptonewsz.com',
    'bitcoinist.com',
    'ambcrypto.com',
    'dailyhodl.com',
    'bitcoin.com',
    'fxstreet.com',
    'investing.com',
    'seekingalpha.com',
    'coingape.com',
    'cryptobriefing.com',
    'cryptoslate.com',
    'cryptonews.com',
    'benzinga.com',
    'dailycoin.com',
];


const client = new RestClientV5({
    key: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_API_SECRET,
});

module.exports = async function (context, myTimer) {
    const timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue) {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);

    try {
        const news = await fetchNews();
        const coinSymbolsFromNews = extractCoinSymbolsFromNews(news);
        const availableCoins = await fetchAvailableCoins();
        const relevantNews = getRelevantCoinNews(coinSymbolsFromNews, availableCoins, news);
       
        // context.log(coinSymbolsFromNews); // Very long terminal output if uncommented
       // context.log(relevantNews);

       const allRelevantNews = [].concat(...Object.values(relevantNews));
       const sentiments = await analyzeSentiment(allRelevantNews);
    //    console.log(sentiments);
        context.log(sentiments);

    } catch (error) {
        context.log('Error in main function:', error.message);
    }
};

async function fetchNews() {
    const allNews = [];
    const baseURL = 'https://cryptopanic.com/api/v1/posts/';

    for (let page = 1; page <= 1; page++) { // remember to change loop back to page 5
        try {
            const response = await axios.get(baseURL, {
                params: {
                    auth_token: process.env.CRYPTOPANIC_API_KEY,
                    kind: 'news',
                    page: page
                },
            });

            if (response.data && response.data.results) {
                allNews.push(...response.data.results);
            }

            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        } catch (error) {
            console.error(`Failed to fetch news on page ${page}: ${error.message}`);
        }
    }

    console.log(`Fetched: ${allNews.length} articles. Extracting coin symbols...`);
    return allNews;
}

function extractCoinSymbolsFromNews(allNews) {
    const coinSymbols = new Set();

    allNews.forEach(article => {
        if (Array.isArray(article.currencies)) {
            article.currencies.forEach(currency => coinSymbols.add(currency.code));
        }
    });

    console.log(`Extracted ${coinSymbols.size} coins from news articles. Fetching available coins on ByBit...`);
    return [...coinSymbols];
}

async function fetchAvailableCoins() {
    const bybitCoins = new Set();

    try {
        const response = await client.get('v5/market/tickers', { category: 'spot' });

        if (response.retCode === 0 && response.result && response.result.list) {
            response.result.list.forEach(ticker => {
                const symbol = ticker.symbol.split('USDT')[0];
                bybitCoins.add(symbol);
            });
        }
    } catch (error) {
        console.error(`Failed to fetch available coins: ${error.message}`);
    }

    console.log(`Found ${bybitCoins.size} coins available on ByBit. Matching with news...`);
    return [...bybitCoins];
}

function getRelevantCoinNews(coinSymbolsFromNews, availableCoins, allNews) {
    const relevantCoinNews = {};

    coinSymbolsFromNews.forEach(symbol => {
        if (availableCoins.includes(symbol)) {
            relevantCoinNews[symbol] = allNews.filter(article => {
                return Array.isArray(article.currencies) && article.currencies.some(currency => currency.code === symbol);
            });
        }
    });

    console.log(`Found ${Object.keys(relevantCoinNews).length} matched coins between news and ByBit. Analyzing sentiment of ${allNews.length} headlines...`);
    return relevantCoinNews;
}

// Sentiment analysis of news using OpenAI's Davinci model

function printProgressBar(percentage) {
    const length = 40; // Length of the progress bar
    const position = Math.floor((percentage / 100) * length);
    const progressBar = Array(length).fill('-');
    for (let i = 0; i < position; i++) {
        progressBar[i] = '=';
    }
    process.stdout.clearLine();  // Clear the current line in terminal
    process.stdout.cursorTo(0);  // Move cursor to the beginning of the line
    process.stdout.write(`[${progressBar.join('')}] ${percentage.toFixed(2)}%`); // Print the progress bar
}

async function analyzeSentiment(coinNews) {
    const sentiments = {};
    const coinScores = {};

    const totalArticles = coinNews.length;
    let processedArticles = 0;

    printProgressBar(0); // Initial progress bar

    for (const article of coinNews) {
        try {
            // 1. Extract Sentiment from the Headline
            const response = await axios.post('https://api.openai.com/v1/engines/davinci/completions', {
                prompt: `You are a master at sentiment analysis of news in relation to the stock and crypto market. You know exactly how a stock or coin will move due to the impact of a news article. Please analyze the sentiment of this headline: "${article.title}". Rate it from 0 (very negative) to 10 (very positive).`,
                max_tokens: 5
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            let score = parseFloat(response.data.choices[0].text.trim());

            // 2. Consider the News Source Reputation
            const reputableSources = REPUTABLE_SOURCES;
            const reputationMultiplier = reputableSources.includes(article.domain) ? 1.5 : 1;
            score *= reputationMultiplier;

            // 3. Factor in Votes or Reactions
            if (article.votes && article.votes.positive > 100) {
                score *= 1.5;
            }

            // Accumulate scores for each currency in the article
            for (const currency of article.currencies) {
                if (!coinScores[currency.code]) {
                    coinScores[currency.code] = { totalScore: 0, count: 0 };
                }
                coinScores[currency.code].totalScore += score;
                coinScores[currency.code].count += 1;
            }

            processedArticles++;
            const percentage = (processedArticles / totalArticles) * 100;
            printProgressBar(percentage); // Update progress bar

        } catch (error) {
            console.error(`Failed to analyze sentiment for ${article.title}: ${error}`);
        }
    }

    console.log('\n'); // Move to the next line after the progress bar

    // Calculate average scores and determine sentiment for each coin
    for (const coin in coinScores) {
        const averageScore = coinScores[coin].totalScore / coinScores[coin].count;
        sentiments[coin] = averageScore >= 12 ? 'strong buy' :
                           averageScore >= 8  ? 'buy' :
                           averageScore <= 3  ? 'strong sell' :
                           averageScore <= 5  ? 'sell' : 'neutral';
                           console.log(sentiments[coin]);
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

// Mock context and myTimer objects for local testing
const mockContext = {
    log: console.log
};

const mockTimer = {
    isPastDue: false
};

// Call the main function directly
module.exports(mockContext, mockTimer);