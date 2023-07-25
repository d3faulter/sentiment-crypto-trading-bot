const axios = require('axios');
const { RestClientV5 } = require('bybit-api');

// Timer til at køre
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
    
    try {
        for (let page = 1; page <= 5; page++) {
            const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
                params: {
                    auth_token: '',
                    kind: 'news',
                    page: page
                },
            });
            allNews.push(...response.data.results);
        }
        
        return allNews;
    } catch (error) {
        console.error(`Failed to fetch news: ${error}`);
        return null;
    }
}

// Gemmer coins fra nyheds response
function extractCoinSymbolsFromNews(news) {
    const coinSymbols = [];

    for (const article of news) {
        for (const currency of article.currencies) {
            if (!coinSymbols.includes(currency.code)) {
                coinSymbols.push(currency.code);
            }
        }
    }

    return coinSymbols;
}


// Fetch all tickers from ByBit

async function fetchAvailableCoins() {
    const availableCoins = [];

    try {
        const response = await client.get('market/tickers', {
            category: 'spot',
        });

        if (response.retCode === 0) {
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

    return availableCoins;
}



// Fetch 24 hour ticker data
async function fetch24HourData(availableCoins) {
    const data = {};

    for (const symbol of availableCoins) {
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

    return data;
}
