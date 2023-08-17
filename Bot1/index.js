const axios = require('axios');
const ti = require('technicalindicators');
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
       
       const allRelevantNews = [].concat(...Object.values(relevantNews));
        
        allRelevantNews.forEach(article => {
             context.log(article.title + ' ' + article.domain);
        });

        const sentiments = await analyzeSentiment(allRelevantNews);
        context.log(sentiments);

//       const sentiments = {
//        'BTC': 'strong buy',
//        'ETH': 'buy',
//        'ADA': 'sell',
//        'XRP': 'strong sell',
//        'DOT': 'strong buy'
//    };

      const coinData = await fetch7DayKlineData(sentiments);
        context.log(coinData);

        // Calculate technical indicators and assign an overall score for each coin
        const coinScores = {};
        for (const symbol in coinData) {
            coinScores[symbol] = calculateTechnicalIndicators(coinData[symbol]);
        }
        context.log(coinScores);

    } catch (error) {
        context.log('Error in main function:', error.message);
    }
};

// Fetcher from Cryptopanic

async function fetchNews() {
    const allNews = [];
    const baseURL = 'https://cryptopanic.com/api/v1/posts/';

    for (let page = 1; page <= 4; page++) { // remember to change loop back to page 5
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
    const uniqueArticles = new Set(); // To store unique articles

    coinSymbolsFromNews.forEach(symbol => {
        if (availableCoins.includes(symbol)) {
            const filteredArticles = allNews.filter(article => {
                return Array.isArray(article.currencies) && article.currencies.some(currency => currency.code === symbol);
            });
            
            // Add unique articles to the Set
            filteredArticles.forEach(article => uniqueArticles.add(JSON.stringify(article)));
        }
    });

    // Convert the Set back to an array
    const uniqueArticleArray = Array.from(uniqueArticles).map(articleStr => JSON.parse(articleStr));

    console.log(`Found ${uniqueArticleArray.length} unique matched articles between news and ByBit. Analyzing sentiment of headlines: \n`);
    return uniqueArticleArray;
}


// Sentiment analysis of news using OpenAI's Davinci model

// Progress bar to track sentiment analysis
function printProgressBar(percentage) {
    const length = 40; // Length of the progress bar
    const position = Math.floor((percentage / 100) * length);
    const progressBar = Array(length).fill('-');
    for (let i = 0; i < position; i++) {
        progressBar[i] = '=';
    }
    process.stdout.clearLine();
    process.stdout.cursorTo(0);  // Move cursor to the beginning of the line
    process.stdout.write(`[${progressBar.join('')}] ${percentage.toFixed(2)}%`); // Print the progress bar
}

async function analyzeSentiment(coinNews) {
    const sentiments = {};
    const coinScores = {};

    const totalArticles = coinNews.length;
    let processedArticles = 0;

    console.log('\n'); 
    printProgressBar(0); // Initial progress bar

    for (const article of coinNews) {
        try {
            // 1. Extract Sentiment from the Headline
            const response = await axios.post('https://api.openai.com/v1/engines/davinci/completions', {
                prompt: `You are a specialized AI expert in sentiment analysis, with a deep understanding of nuances and subtleties in news related to the stock and cryptocurrency markets. Each headline may contain overt signals or subtle hints about its sentiment. Your analysis directly influences trading decisions, making accuracy and precision absolutely essential. Please read and evaluate the following headline multiple times, considering both its overt and subtle cues, its relevance to the specific cryptocurrency, and its potential impact on market movements: "${article.title}". Provide a sentiment score based on the content of "${article.title}" from 0 (extremely negative) to 10 (extremely positive). Only if the headline is ambiguous or its impact is truly uncertain, only then rate it as neutral. Ensure you've considered every aspect of the headline before finalizing your score.`,
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
    }

    return sentiments;
}

// Fetch 24 hour ticker data for all non-neutral coins

async function fetch7DayKlineData(sentiments) {
    const data = {};

    // Filter coins based on their sentiment
    const relevantCoins = Object.keys(sentiments).filter(symbol => 
        ['buy', 'strong buy', 'sell', 'strong sell'].includes(sentiments[symbol])
    );

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds

    for (const symbol of relevantCoins) {
        try {
            const response = await client.get('/v5/market/kline', {
                category: 'spot',
                symbol: symbol + 'USDT', // Fetching USDT pairs
                interval: '60',
                start: oneWeekAgo,
                end: Date.now()
            });

            if (response.retCode === 0 && response.result && response.result.list) {
                data[symbol] = response.result.list; // This will be an array of Kline data for the past 7 days
            }
        } catch (error) {
            console.error(`Failed to fetch 7-day Kline data for ${symbol}: ${error.message}`);
        }
    }

    return data;
}


// Technical analysis

function calculateTechnicalIndicators(klineData) {
    const close = klineData.map(data => parseFloat(data[4]));
    const high = klineData.map(data => parseFloat(data[2]));
    const low = klineData.map(data => parseFloat(data[3]));
    const volume = klineData.map(data => parseFloat(data[5]));

    // Calculate RSI
    const rsi = ti.RSI.calculate({ values: close, period: 14 });
    const currentRSI = rsi[rsi.length - 1];

    // Calculate MACD
    const macdResult = ti.MACD.calculate({
        values: close,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });
    const currentMACD = macdResult[macdResult.length - 1];

    // Calculate EMA
    const ema50 = ti.EMA.calculate({ values: close, period: 50 });
    const currentEMA50 = ema50[ema50.length - 1];
    const ema200 = ti.EMA.calculate({ values: close, period: 200 });
    const currentEMA200 = ema200[ema200.length - 1];

    // Calculate Bollinger Bands
    const bb = ti.BollingerBands.calculate({ values: close, period: 20, stdDev: 2 });
    const currentBB = bb[bb.length - 1];

    // Calculate Stochastic Oscillator
    const stochastic = ti.Stochastic.calculate({
        high: high,
        low: low,
        close: close,
        period: 14,
        signalPeriod: 3
    });
    const currentStochastic = stochastic[stochastic.length - 1];

    // Here, you can add logic to evaluate the calculated indicators and return an overall score.
    // For simplicity, I'll return a random score between 1 and 10.
    return Math.floor(Math.random() * 10) + 1;
}

// Mock context and myTimer objects for local testing
const mockContext = {
    log: console.log
};

const mockTimer = {
    isPastDue: false
};



// Call the main function directly
module.exports(mockContext, mockTimer);